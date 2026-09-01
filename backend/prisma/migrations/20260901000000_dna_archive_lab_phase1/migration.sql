-- CreateTable
CREATE TABLE "dna_storage_experiments" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sourceFileName" TEXT,
    "sourceMimeType" TEXT,
    "sourceFileSizeBytes" INTEGER,
    "sourceSha256" TEXT,
    "encodingProfileJson" JSONB,
    "errorProfileJson" JSONB,
    "randomSeed" INTEGER,
    "prngName" TEXT,
    "prngVersion" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dna_storage_experiments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dna_storage_files" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storagePath" TEXT,
    "storedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purgedAt" TIMESTAMP(3),

    CONSTRAINT "dna_storage_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dna_storage_strands" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "sequence" TEXT NOT NULL,
    "payloadLength" INTEGER NOT NULL,
    "originalChecksum" TEXT NOT NULL,
    "gcPercent" DOUBLE PRECISION NOT NULL,
    "maxHomopolymerRun" INTEGER NOT NULL,
    "passedConstraints" BOOLEAN NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "dna_storage_strands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dna_storage_error_runs" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "errorProfileJson" JSONB NOT NULL,
    "seed" INTEGER NOT NULL,
    "statsJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dna_storage_error_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dna_storage_decode_runs" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "errorRunId" TEXT,
    "resultJson" JSONB NOT NULL,
    "success" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dna_storage_decode_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dna_storage_reports" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "markdown" TEXT NOT NULL,
    "reportJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dna_storage_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dna_storage_strands_experimentId_index_idx" ON "dna_storage_strands"("experimentId", "index");

-- AddForeignKey
ALTER TABLE "dna_storage_files" ADD CONSTRAINT "dna_storage_files_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "dna_storage_experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dna_storage_strands" ADD CONSTRAINT "dna_storage_strands_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "dna_storage_experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dna_storage_error_runs" ADD CONSTRAINT "dna_storage_error_runs_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "dna_storage_experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dna_storage_decode_runs" ADD CONSTRAINT "dna_storage_decode_runs_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "dna_storage_experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dna_storage_reports" ADD CONSTRAINT "dna_storage_reports_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "dna_storage_experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
