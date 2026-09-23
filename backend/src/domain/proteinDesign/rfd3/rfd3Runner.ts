// RFD3 execution runners: LOCAL (subprocess spawn) and REMOTE (HTTP gateway).
//
// Both normalize their results into the same ExecutionRunSummary, so the
// adapter's mode switch happens exactly once, at construction, and everything
// downstream never knows which engine produced the artifacts.
//
// LOCAL runs `rfd3 design out_dir=... inputs=...` with an optional env prefix
// (conda/WSL). The subprocess is hard-killed after `jobTimeoutMs`, stdout/stderr
// go to a per-run log, and the runner waits for `.cif(.gz)` artifacts to land.
//
// REMOTE POSTs a `{runId, mode, inputs}` payload to RFD3_REMOTE_URL and expects
// the gateway to answer with the same normalized summary shape (the gateway can
// be a real GPU worker reachable from this machine).

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { ExecutionConfig } from './executionModes.js';
import { sanitizeName } from './executionModes.js';
import { parseCifContent, decompressCif, isGzipped } from './cifParser.js';
import { waitExit } from './childExit.js';

export interface ExecutedOutput {
  /** Absolute path of the artifact file (LOCAL) or the gateway-reported rel path (REMOTE). */
  path: string;
  /** A single chain's protein sequence when the parser could extract one. */
  sequence: string;
  /** Plain-text structure (decompressed mmCIF) suitable for ledger storage. */
  structureText: string;
  chains: string[];
  residueCount: number;
  source: 'local' | 'remote';
}

export interface ExecutionRunSummary {
  runId: string;
  outputs: ExecutedOutput[];
  executionTimeMs: number;
  logTail: string;
  seed: number;
}

export interface Rfd3Runner {
  run(runId: string, inputs: unknown, seed: number, workDir?: string): Promise<ExecutionRunSummary>;
}

interface RunnerDeps {
  readArtifactText(filePath: string): Promise<string>;
}

const DEFAULT_DEPS: RunnerDeps = {
  readArtifactText: async (filePath) =>
    fs.readFile(filePath, { encoding: 'utf-8', flag: 'r' }).catch(async () => {
      // Likely gzipped: decompress.
      const bytes = await fs.readFile(filePath);
      return isGzipped(bytes) ? decompressCif(bytes) : bytes.toString('utf-8');
    }),
};

/**
 * LOCAL runner: spawn the real `rfd3 design` CLI. Works on Unix and WSL2; on
 * native Windows with no CLI present it fails fast with a clear diagnostic.
 */
export class LocalRunner implements Rfd3Runner {
  readonly kind = 'local' as const;
  constructor(
    public readonly config: ExecutionConfig,
    private deps: RunnerDeps = DEFAULT_DEPS,
  ) {}

  async run(
    runId: string,
    inputs: unknown,
    seed: number,
    workDir?: string,
  ): Promise<ExecutionRunSummary> {
    const dir = await this.makeRunDir(runId, workDir);
    const inputsPath = path.join(dir, 'inputs.json');
    await fs.writeFile(inputsPath, JSON.stringify(inputs, null, 2), 'utf-8');
    const outDir = path.join(dir, 'out');
    await fs.mkdir(outDir, { recursive: true });

    const logPath = path.join(dir, 'run.log');
    const logFd = await fs.open(logPath, 'a');
    const args = [
      ...this.config.localEnvPrefix,
      this.config.localBin,
      'design',
      `out_dir=${outDir}`,
      `inputs=${inputsPath}`,
      `seed=${seed}`,
    ];
    const started = Date.now();
    const child = spawn(args[0], args.slice(1), {
      shell: false,
      cwd: dir,
      stdio: ['ignore', logFd.createWriteStream(), logFd.createWriteStream()],
      env: {
        ...process.env,
        ...(this.config.localCheckpointDir
          ? { FOUNDRY_CHECKPOINT_DIRS: this.config.localCheckpointDir }
          : {}),
      },
    });

    const result = await waitExit(child, this.config.jobTimeoutMs, args.join(' '));
    await logFd.close();

    const logTail = await readTail(logPath, 4000);
    if (result.code !== 0) {
      throw new Error(
        `rfd3 CLI failed (exit ${result.code}): ${result.signal ?? 'none'}\n` +
          `command: ${args.slice(0, 3).join(' ')} ...\nlogTail:\n${logTail}`,
      );
    }

    const files = await collectCifFiles(outDir);
    const outputs: ExecutedOutput[] = [];
    for (const file of files) {
      const text = await this.deps.readArtifactText(file);
      outputs.push(await summarizeArtifact(file, text, 'local'));
    }

    return {
      runId,
      outputs,
      executionTimeMs: Date.now() - started,
      logTail,
      seed,
    };
  }

  private async makeRunDir(runId: string, workDir?: string): Promise<string> {
    const base = workDir ?? os.tmpdir();
    const dir = path.join(base, `rfd3_${sanitizeName(runId)}`);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }
}

/**
 * REMOTE runner: POST the job definition to a gateway that executes on GPU.
 * The gateway is expected to return the same summary shape this adapter uses.
 */
export class RemoteRunner implements Rfd3Runner {
  readonly kind = 'remote' as const;
  constructor(
    public readonly config: ExecutionConfig,
    private deps: RunnerDeps = DEFAULT_DEPS,
  ) {}

  async run(
    runId: string,
    inputs: unknown,
    seed: number,
  ): Promise<ExecutionRunSummary> {
    if (!this.config.remoteUrl) {
      throw new Error('RemoteRunner requires config.remoteUrl');
    }
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.jobTimeoutMs);
    try {
      const res = await fetch(this.config.remoteUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.config.remoteApiKey
            ? { authorization: `Bearer ${this.config.remoteApiKey}` }
            : {}),
        },
        body: JSON.stringify({ runId, mode: 'local', inputs, seed }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`RFD3 gateway error ${res.status}: ${body.slice(0, 400)}`);
      }
      const payload = (await res.json()) as Partial<ExecutionRunSummary>;
      const outputs: ExecutedOutput[] = [];
      for (const raw of payload.outputs ?? []) {
        const text = String((raw as { structureText?: unknown }).structureText ?? '');
        outputs.push(await summarizeArtifact(
          String((raw as { path?: unknown }).path ?? `remote_${outputs.length}`),
          text,
          'remote',
        ));
      }
      return {
        runId,
        outputs,
        executionTimeMs: Date.now() - started,
        logTail: String(payload.logTail ?? ''),
        seed,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

export function createRunner(config: ExecutionConfig): Rfd3Runner {
  return config.mode === 'remote' ? new RemoteRunner(config) : new LocalRunner(config);
}

// --- Shared helpers -----------------------------------------------------------

async function summarizeArtifact(filePath: string, text: string, source: 'local' | 'remote'): Promise<ExecutedOutput> {
  const parsed = parseCifContent(text);
  const chains = Object.keys(parsed.sequenceByChain);
  return {
    path: filePath,
    sequence: parsed.sequenceByChain[chains[0] ?? ''] ?? '',
    structureText: text,
    chains: parsed.chains.length ? parsed.chains : chains,
    residueCount: parsed.residueCount,
    source,
  };
}

async function collectCifFiles(outDir: string): Promise<string[]> {
  const found: string[] = [];
  async function walk(dir: string) {
    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && /\.(cif|cif\.gz)$/i.test(entry.name)) {
        found.push(full);
      }
    }
  }
  await walk(outDir);
  return found.sort();
}

async function readTail(filePath: string, maxBytes: number): Promise<string> {
  try {
    const stat = await fs.stat(filePath);
    const fd = await fs.open(filePath, 'r');
    try {
      const length = Math.min(maxBytes, stat.size);
      const buf = Buffer.alloc(length);
      await fd.read(buf, 0, length, Math.max(0, stat.size - length));
      return buf.toString('utf-8');
    } finally {
      await fd.close();
    }
  } catch {
    return '';
  }
}