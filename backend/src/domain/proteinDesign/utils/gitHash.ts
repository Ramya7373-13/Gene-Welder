// gitHash — resolve the source revision that produced a design run.
//
// Every ledger entry records the git commit hash of the codebase when the entry
// was written, so a design can be tied back to the exact engine code that
// generated it. Resolution is lazy and cached per process; when the commit
// cannot be determined (e.g. no repo, no git binary) we fall back to
// `'unknown'` rather than fail the ledger write.

import { execSync } from 'node:child_process';

let cached: string | null = null;

export function getGitCommitHash(): string {
  if (cached !== null) return cached;
  try {
    cached = execSync('git rev-parse HEAD', {
      cwd: process.cwd(),
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .trim();
  } catch {
    cached = 'unknown';
  }
  return cached;
}

export function resetGitCommitHashCache(): void {
  cached = null;
}