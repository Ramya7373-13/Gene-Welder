// Prisma-backed GpuJobPersistence: writes real GPUJob rows. Converts every
// write into a best-effort operation (the queue must never crash because the
// writer is down); a healthy Postgres row will however always match the
// in-memory state, which is what "job persistence" means for the app.

import { prisma } from '../../../prisma.js';
import type { GpuJobPersistence, GpuJobRecord } from './GPUQueueManager.js';

export class PrismaGpuJobPersistence implements GpuJobPersistence {
  async create(record: GpuJobRecord): Promise<void> {
    await prisma.gpuJob.create({
      data: {
        id: record.id,
        runId: record.runId,
        projectId: record.projectId,
        mode: record.mode,
        payload: (record.payload ?? {}) as object,
        status: record.status,
        attempts: record.attempts,
        maxAttempts: record.maxAttempts,
        workerId: record.workerId,
        lastHeartbeatAt: record.lastHeartbeatAt,
        errorMessage: record.errorMessage,
        startedAt: record.startedAt,
        completedAt: record.completedAt,
      },
    });
  }

  async update(id: string, patch: Partial<Omit<GpuJobRecord, 'id'>>): Promise<void> {
    await prisma.gpuJob.update({
      where: { id },
      data: {
        status: patch.status,
        workerId: patch.workerId,
        attempts: patch.attempts,
        lastHeartbeatAt: patch.lastHeartbeatAt,
        errorMessage: patch.errorMessage,
        startedAt: patch.startedAt,
        completedAt: patch.completedAt,
      },
    });
  }

  async listByStatus(status: GpuJobRecord['status']): Promise<GpuJobRecord[]> {
    const rows = await prisma.gpuJob.findMany({
      where: { status },
      orderBy: { createdAt: 'asc' },
    });
    type Row = {
      id: string;
      runId: string;
      projectId: string;
      mode: string;
      payload?: unknown;
      status: GpuJobRecord['status'];
      attempts: number;
      maxAttempts: number;
      workerId: string | null;
      lastHeartbeatAt: Date | null;
      errorMessage: string | null;
      startedAt: Date | null;
      completedAt: Date | null;
      createdAt: Date;
    };
    return (rows as Row[]).map((row) => ({
      id: row.id,
      runId: row.runId,
      projectId: row.projectId,
      mode: row.mode,
      payload: (row.payload ?? {}) as Record<string, unknown>,
      status: row.status,
      attempts: row.attempts,
      maxAttempts: row.maxAttempts,
      workerId: row.workerId ?? undefined,
      lastHeartbeatAt: row.lastHeartbeatAt ?? undefined,
      errorMessage: row.errorMessage ?? undefined,
      startedAt: row.startedAt ?? undefined,
      completedAt: row.completedAt ?? undefined,
      createdAt: row.createdAt,
    }));
  }
}