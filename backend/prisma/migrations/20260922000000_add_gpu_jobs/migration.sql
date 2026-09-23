-- CreateEnum
CREATE TYPE "GPUJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "gpu_jobs" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "GPUJobStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "workerId" TEXT,
    "lastHeartbeatAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gpu_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gpu_jobs_runId_idx" ON "gpu_jobs"("runId");

-- CreateIndex
CREATE INDEX "gpu_jobs_status_idx" ON "gpu_jobs"("status");

-- CreateIndex
CREATE INDEX "gpu_jobs_workerId_idx" ON "gpu_jobs"("workerId");