// ProteinMPNN execution runners: LOCAL (subprocess) and REMOTE (HTTP gateway).
// Normalized output: sequences plus per-run metadata, engine-agnostic.

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { sanitizeName } from '../rfd3/executionModes.js';
import { waitExit } from '../rfd3/childExit.js';
import { parseFasta } from './fastaParser.js';
import type { MpnnExecutionConfig } from './executionModes.js';

export interface MpnnRunOutput {
  /** 1-based design index. */
  index: number;
  sequence: string;
  score: number;
  header?: string;
  source: 'local' | 'remote';
}

export interface MpnnRunSummary {
  runId: string;
  outputs: MpnnRunOutput[];
  executionTimeMs: number;
  logTail: string;
  seed: number;
}

export interface MpnnRunner {
  run(runId: string, inputs: unknown, seed: number): Promise<MpnnRunSummary>;
}

/**
 * LOCAL runner. Spawns the ProteinMPNN CLI with inputs JSON; expects FASTA
 * output (`.fa` files) and reads them back. On Windows without the CLI this
 * fails fast with a clear diagnostic. Subprocess is hard-killed on timeout.
 */
export class LocalMpnnRunner implements MpnnRunner {
  readonly kind = 'local' as const;
  constructor(public readonly config: MpnnExecutionConfig) {}

  async run(runId: string, inputs: unknown, seed: number): Promise<MpnnRunSummary> {
    const dir = path.join(os.tmpdir(), `mpnn_${sanitizeName(runId)}`);
    await fs.mkdir(dir, { recursive: true });
    const inputsPath = path.join(dir, 'inputs.json');
    await fs.writeFile(inputsPath, JSON.stringify(inputs, null, 2), 'utf-8');
    const outDir = path.join(dir, 'out');
    await fs.mkdir(outDir, { recursive: true });

    const logPath = path.join(dir, 'run.log');
    const logFd = await fs.open(logPath, 'a');
    const started = Date.now();
    const args = [
      ...this.config.localEnvPrefix,
      this.config.localBin,
      `inputs=${inputsPath}`,
      `out_folder=${outDir}`,
      `seed=${seed}`,
    ];
    const child = spawn(args[0], args.slice(1), {
      shell: false,
      cwd: dir,
      stdio: ['ignore', logFd.createWriteStream(), logFd.createWriteStream()],
      env: process.env,
    });
    const result = await waitExit(child, this.config.jobTimeoutMs, args.join(' '));
    await logFd.close();

    const logTail = await readTail(logPath, 4000);
    if (result.code !== 0) {
      throw new Error(
        `ProteinMPNN CLI failed (exit ${result.code}): ${result.signal ?? 'none'}\nlogTail:\n${logTail}`,
      );
    }

    const outputs: MpnnRunOutput[] = [];
    for (const [index, entry] of (await readFastaArtifacts(outDir)).entries()) {
      outputs.push({
        index: index + 1,
        sequence: entry.sequence,
        score: scoreFromHeader(entry.header),
        header: entry.header,
        source: 'local',
      });
    }

    return { runId, outputs, executionTimeMs: Date.now() - started, logTail, seed };
  }
}

/** REMOTE runner: POST to a gateway that executes ProteinMPNN on GPU. */
export class RemoteMpnnRunner implements MpnnRunner {
  readonly kind = 'remote' as const;
  constructor(public readonly config: MpnnExecutionConfig) {}

  async run(runId: string, inputs: unknown, seed: number): Promise<MpnnRunSummary> {
    if (!this.config.remoteUrl) throw new Error('RemoteMpnnRunner requires config.remoteUrl');
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
        body: JSON.stringify({ runId, inputs, seed }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`ProteinMPNN gateway error ${res.status}: ${body.slice(0, 400)}`);
      }
      const payload = (await res.json()) as Partial<MpnnRunSummary>;
      const remoteOutputs: MpnnRunOutput[] = (payload.outputs ?? [])
        .map((o, i) => ({
          index: i + 1,
          sequence: String((o as { sequence?: unknown }).sequence ?? ''),
          score: Number((o as { score?: unknown }).score ?? 0),
          header: String((o as { header?: unknown }).header ?? ''),
          source: 'remote' as const,
        }))
        .filter((o) => o.sequence.length > 0);
      return {
        runId,
        outputs: remoteOutputs,
        executionTimeMs: Date.now() - started,
        logTail: String(payload.logTail ?? ''),
        seed,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

export function createMpnnRunner(config: MpnnExecutionConfig): MpnnRunner {
  return config.mode === 'remote' ? new RemoteMpnnRunner(config) : new LocalMpnnRunner(config);
}

async function readFastaArtifacts(outDir: string): Promise<Array<{ header: string; sequence: string }>> {
  let files: string[];
  try {
    files = (await fs.readdir(outDir)).filter((f) => /\.(fa|fasta|seqs)$/i.test(f));
  } catch {
    files = [];
  }
  const entries: Array<{ header: string; sequence: string }> = [];
  for (const file of files.sort()) {
    const text = await fs.readFile(path.join(outDir, file), 'utf-8');
    for (const entry of parseFasta(text)) {
      entries.push({ header: entry.header, sequence: entry.sequence });
    }
  }
  return entries;
}

function scoreFromHeader(header: string | undefined): number {
  // ProteinMPNN FASTA headers may embed a score; default to a neutral 0 when absent.
  if (!header) return 0;
  const match = header.match(/(?:score|sc)[=:,]\s?([0-9.+-]+)/i) ?? header.match(/,?\s?(-?[0-9]+\.[0-9]{2,})\s*,?\s*$/);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  return Number.isFinite(value) ? value : 0;
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