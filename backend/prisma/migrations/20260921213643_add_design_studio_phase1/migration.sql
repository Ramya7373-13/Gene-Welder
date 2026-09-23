-- CreateEnum
CREATE TYPE "DesignProjectStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "DesignMode" AS ENUM ('BINDER', 'STABILIZER', 'DNA_BINDER', 'ENZYME_RESCUE', 'SCAFFOLD', 'SYMMETRIC_ASSEMBLY', 'MOTIF_SCAFFOLD', 'PROTEIN_SCAFFOLD');

-- CreateEnum
CREATE TYPE "DesignRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'VALIDATING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "design_projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "userId" TEXT NOT NULL,
    "targetGene" TEXT,
    "targetVariant" TEXT,
    "status" "DesignProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "design_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "design_runs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "mode" "DesignMode" NOT NULL,
    "designEngine" TEXT NOT NULL DEFAULT 'rfd3',
    "status" "DesignRunStatus" NOT NULL DEFAULT 'QUEUED',
    "parameters" JSONB NOT NULL,
    "constraintSpec" JSONB,
    "targetStructure" TEXT,
    "targetSequence" TEXT,
    "gpuId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "design_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "design_candidates" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "structure" TEXT,
    "sequence" TEXT,
    "affinityScore" DOUBLE PRECISION,
    "rankedPosition" INTEGER,
    "designMetrics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "design_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "design_constraints" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "constraintType" TEXT NOT NULL,
    "spec" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "design_constraints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validation_results" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "pTM" DOUBLE PRECISION,
    "ipTM" DOUBLE PRECISION,
    "pLDDT" DOUBLE PRECISION,
    "interfaceArea" DOUBLE PRECISION,
    "constraintSatisfactionScore" DOUBLE PRECISION,
    "diversityScore" DOUBLE PRECISION,
    "overallScore" DOUBLE PRECISION,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "validation_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "design_ledger" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "projectId" TEXT,
    "modelVersion" TEXT NOT NULL,
    "weightsHash" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "inputConstraints" JSONB,
    "userId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validationMetrics" JSONB,
    "runId" TEXT,

    CONSTRAINT "design_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "design_projects_userId_idx" ON "design_projects"("userId");

-- CreateIndex
CREATE INDEX "design_projects_targetGene_idx" ON "design_projects"("targetGene");

-- CreateIndex
CREATE INDEX "design_runs_projectId_idx" ON "design_runs"("projectId");

-- CreateIndex
CREATE INDEX "design_runs_status_idx" ON "design_runs"("status");

-- CreateIndex
CREATE INDEX "design_runs_mode_idx" ON "design_runs"("mode");

-- CreateIndex
CREATE INDEX "design_candidates_runId_idx" ON "design_candidates"("runId");

-- CreateIndex
CREATE INDEX "design_candidates_rankedPosition_idx" ON "design_candidates"("rankedPosition");

-- CreateIndex
CREATE INDEX "design_constraints_runId_constraintType_idx" ON "design_constraints"("runId", "constraintType");

-- CreateIndex
CREATE INDEX "validation_results_candidateId_idx" ON "validation_results"("candidateId");

-- CreateIndex
CREATE INDEX "validation_results_overallScore_idx" ON "validation_results"("overallScore");

-- CreateIndex
CREATE INDEX "design_ledger_candidateId_idx" ON "design_ledger"("candidateId");

-- CreateIndex
CREATE INDEX "design_ledger_userId_idx" ON "design_ledger"("userId");

-- CreateIndex
CREATE INDEX "design_ledger_modelVersion_idx" ON "design_ledger"("modelVersion");

-- CreateIndex
CREATE INDEX "design_ledger_projectId_idx" ON "design_ledger"("projectId");

-- AddForeignKey
ALTER TABLE "design_projects" ADD CONSTRAINT "design_projects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_runs" ADD CONSTRAINT "design_runs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "design_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_candidates" ADD CONSTRAINT "design_candidates_runId_fkey" FOREIGN KEY ("runId") REFERENCES "design_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_constraints" ADD CONSTRAINT "design_constraints_runId_fkey" FOREIGN KEY ("runId") REFERENCES "design_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_results" ADD CONSTRAINT "validation_results_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "design_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_ledger" ADD CONSTRAINT "design_ledger_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "design_candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_ledger" ADD CONSTRAINT "design_ledger_runId_fkey" FOREIGN KEY ("runId") REFERENCES "design_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "design_ledger" ADD CONSTRAINT "design_ledger_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "design_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
