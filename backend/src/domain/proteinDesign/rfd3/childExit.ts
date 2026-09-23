// Await a child process exit with a hard timeout.

import type { ChildProcess } from 'node:child_process';

export interface ExitResult {
  code: number | null;
  signal: NodeJS.Signals | null;
}

/** Resolve on exit, or kill the child (and its process group) after `timeoutMs`. */
export function waitExit(
  child: ChildProcess,
  timeoutMs: number,
  label: string,
): Promise<ExitResult> {
  return new Promise<ExitResult>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        child.kill('SIGKILL');
      } catch {
        /* already gone */
      }
      reject(new Error(`rfd3 subprocess timed out after ${timeoutMs}ms: ${label}`));
    }, timeoutMs);

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });

    child.on('exit', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, signal });
    });
  });
}