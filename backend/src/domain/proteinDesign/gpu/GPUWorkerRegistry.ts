// GPUWorkerRegistry — the in-process view of the GPU worker pool.
//
// A worker is a registered compute device (or remote gateway) that reports
// heartbeats. The registry tracks liveness, health, and per-worker slot usage.
// Workers that stop heart-beating are marked DEAD so the queue manager can
// requeue their jobs instead of waiting for a timeout.

export type GPUWorkerStatus = 'idle' | 'busy' | 'dead';

export interface GPUWorkerInfo {
  id: string;
  /** Engine the worker can execute: 'rfd3' | 'mpnn' | 'any'. */
  kind: string;
  name: string;
  model: string;
  vramMb: number;
  status: GPUWorkerStatus;
  registeredAt: Date;
  lastHeartbeatAt: Date;
  currentJobId?: string;
  slotLimit: number;
  slotsInUse: number;
}

export interface GPUWorkerRegistration {
  id: string;
  kind?: string;
  name?: string;
  model?: string;
  vramMb?: number;
  /** Max concurrent jobs this worker will accept. */
  slotLimit?: number;
}

export interface GPUWorkerRegistryOptions {
  /** A worker is DEAD if its last heartbeat is older than this. */
  heartbeatStaleAfterMs?: number;
  now?: () => Date;
}

export interface AcquiredWorker {
  worker: GPUWorkerInfo;
  release: () => void;
}

function defaultNow(): Date {
  return new Date();
}

export class GPUWorkerRegistry {
  private readonly workers = new Map<string, GPUWorkerInfo>();
  private readonly staleAfterMs: number;
  private readonly now: () => Date;

  constructor(options: GPUWorkerRegistryOptions = {}) {
    this.staleAfterMs = options.heartbeatStaleAfterMs ?? 5000;
    this.now = options.now ?? defaultNow;
  }

  register(spec: GPUWorkerRegistration): GPUWorkerInfo {
    const worker: GPUWorkerInfo = {
      id: spec.id,
      kind: spec.kind ?? 'any',
      name: spec.name ?? spec.id,
      model: spec.model ?? 'unknown',
      vramMb: spec.vramMb ?? 0,
      status: 'idle',
      registeredAt: this.now(),
      lastHeartbeatAt: this.now(),
      slotLimit: spec.slotLimit ?? 1,
      slotsInUse: 0,
    };
    this.workers.set(worker.id, worker);
    return worker;
  }

  unregister(id: string): boolean {
    const worker = this.workers.get(id);
    if (!worker) return false;
    if (worker.slotsInUse > 0) return false;
    return this.workers.delete(id);
  }

  /** Worker reports it is still alive. Restoration from dead is allowed. */
  heartbeat(id: string): boolean {
    const worker = this.workers.get(id);
    if (!worker) return false;
    worker.lastHeartbeatAt = this.now();
    if (worker.status === 'dead') {
      worker.status = worker.slotsInUse > 0 ? 'busy' : 'idle';
    }
    return true;
  }

  isDead(id: string): boolean {
    const worker = this.workers.get(id);
    if (!worker) return true;
    if (worker.status === 'dead') return true;
    return this.now().getTime() - worker.lastHeartbeatAt.getTime() > this.staleAfterMs;
  }

  markDead(id: string): boolean {
    const worker = this.workers.get(id);
    if (!worker) return false;
    worker.status = 'dead';
    return true;
  }

  /** Sweep stale workers; returns the ids marked dead. */
  pruneDead(): string[] {
    const dead: string[] = [];
    for (const worker of this.workers.values()) {
      if (!this.isDead(worker.id)) continue;
      worker.status = 'dead';
      dead.push(worker.id);
    }
    return dead;
  }

  /**
   * Claim a free slot on a healthy worker that can run `jobKind`.
   * Returns an AcquiredWorker, or null when no slot is available.
   */
  acquire(jobKind: string): AcquiredWorker | null {
    const candidates = Array.from(this.workers.values())
      .filter((w) => w.status !== 'dead' && !this.isDead(w.id))
      .filter((w) => w.kind === 'any' || w.kind === jobKind)
      .filter((w) => w.slotsInUse < w.slotLimit)
      .sort((a, b) => a.slotsInUse - b.slotsInUse || a.lastHeartbeatAt.getTime() - b.lastHeartbeatAt.getTime());
    const worker = candidates[0];
    if (!worker) return null;
    worker.status = 'busy';
    worker.slotsInUse += 1;
    return { worker, release: () => this.release(worker.id) };
  }

  private release(id: string): void {
    const worker = this.workers.get(id);
    if (!worker) return;
    worker.slotsInUse = Math.max(0, worker.slotsInUse - 1);
    worker.currentJobId = undefined;
    if (worker.slotsInUse === 0 && worker.status !== 'dead') {
      worker.status = 'idle';
    }
  }

  assignJob(workerId: string, jobId: string): void {
    const worker = this.workers.get(workerId);
    if (worker) worker.currentJobId = jobId;
  }

  get(id: string): GPUWorkerInfo | undefined {
    return this.workers.get(id);
  }

  list(): GPUWorkerInfo[] {
    return Array.from(this.workers.values()).sort((a, b) =>
      a.registeredAt.getTime() - b.registeredAt.getTime(),
    );
  }

  listDead(): GPUWorkerInfo[] {
    return this.list().filter((w) => w.status === 'dead' || this.isDead(w.id));
  }

  get availableSlots(): number {
    return this.list()
      .filter((w) => w.status !== 'dead' && !this.isDead(w.id))
      .reduce((sum, w) => sum + Math.max(0, w.slotLimit - w.slotsInUse), 0);
  }

  get healthyCount(): number {
    return this
      .list()
      .filter((w) => w.status !== 'dead' && !this.isDead(w.id)).length;
  }

  clear(): void {
    this.workers.clear();
  }
}