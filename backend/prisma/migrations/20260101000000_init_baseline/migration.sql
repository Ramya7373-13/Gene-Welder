-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";
-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "analyses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gene" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "variantType" TEXT NOT NULL,
    "protein" TEXT,
    "hgvs" TEXT,
    "disease" TEXT,
    "mechanism" TEXT,
    "uniprotId" TEXT,
    "sequence" TEXT,
    "mutantSequence" TEXT,
    "mutationPosition" INTEGER,
    "structuralAnalysis" JSONB,
    "predictions" JSONB,
    "plddtAvg" DOUBLE PRECISION,
    "rmsd" DOUBLE PRECISION,
    "confidence" INTEGER,
    "plddt_per_residue" JSONB,
    "wildtype_structure_path" TEXT,
    "mutant_structure_path" TEXT,
    "wildtype_chain" TEXT,
    "mutant_chain" TEXT,
    "domains_affected" JSONB,
    "alphaFold_version" TEXT,
    "structure_source" TEXT,
    "pathogenicity" TEXT,
    "pathogenicityScore" INTEGER,
    "clinicalSignificance" TEXT,
    "diseaseAssociations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "populationFrequency" TEXT,
    "therapySuitability" JSONB,
    "treatments" JSONB,
    "compensatoryMutations" JSONB,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    CONSTRAINT "analyses_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "history_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "gene" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "riskLevel" TEXT NOT NULL,
    "pathogenicityScore" INTEGER NOT NULL,
    "confidence" INTEGER NOT NULL,
    "diseaseAssociations" TEXT[],
    "therapies" TEXT[],
    "notes" TEXT,
    "analysisType" TEXT NOT NULL,
    "variantType" TEXT NOT NULL,
    "position" INTEGER,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "history_records_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "splicing_analyses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "gene" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "analysisIdFromAPI" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confidence" INTEGER NOT NULL,
    "clinicalSeverity" TEXT NOT NULL,
    "mRNAImpact" JSONB,
    "proteinImpact" JSONB,
    "exonsAffected" JSONB,
    "aiInterpretation" TEXT,
    "therapySuitability" JSONB,
    "source" TEXT,
    "notes" TEXT,
    CONSTRAINT "splicing_analyses_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "shared_access" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "sharedById" TEXT NOT NULL,
    "sharedWithId" TEXT,
    "shareToken" TEXT NOT NULL,
    "permissionType" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    CONSTRAINT "shared_access_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "parentId" TEXT,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "theme" TEXT DEFAULT 'purple',
    "defaultAnalysis" TEXT,
    "notifications" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "protein_structures" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pdbStructure" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION,
    "modelVersion" TEXT,
    "isCached" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "protein_structures_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "variants" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "gene" TEXT NOT NULL,
    "hgvs_c" TEXT NOT NULL,
    "hgvs_p" TEXT,
    "genomic_coords" TEXT,
    "ref_allele" TEXT NOT NULL,
    "alt_allele" TEXT NOT NULL,
    "zygosity" TEXT NOT NULL,
    "gnomad_freq" DOUBLE PRECISION,
    "clinvar_path" BOOLEAN,
    "acmg_class" TEXT,
    "annotations" JSONB,
    "plddt_avg" DOUBLE PRECISION,
    "plddt_per_residue" JSONB,
    "rmsd_to_wildtype" DOUBLE PRECISION,
    "wildtype_structure_path" TEXT,
    "mutant_structure_path" TEXT,
    "wildtype_chain" TEXT,
    "mutant_chain" TEXT,
    "domains_affected" JSONB,
    "alphaFold_version" TEXT,
    "structure_source" TEXT,
    CONSTRAINT "variants_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "predictions" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "model_name" TEXT NOT NULL,
    "model_version" TEXT NOT NULL,
    "model_provider" TEXT NOT NULL,
    "model_hash" TEXT,
    "training_data" TEXT,
    "hyperparameters" JSONB,
    "raw_prompt" TEXT,
    "raw_response" TEXT,
    "parsed_output" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION,
    "execution_time" INTEGER NOT NULL,
    "cost_usd" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "predictions_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "model_registry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "api_endpoint" TEXT,
    "input_schema" JSONB,
    "output_schema" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "model_registry_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "structure_files" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "s3_key" TEXT,
    "local_path" TEXT,
    "checksum" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "structure_files_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "oldValues" JSONB,
    "newValues" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "risk_assessments" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "variantId" TEXT,
    "patientId" TEXT NOT NULL,
    "diseaseType" TEXT NOT NULL,
    "riskScore" DOUBLE PRECISION NOT NULL,
    "biologicalAge" INTEGER,
    "relativeRisk" DOUBLE PRECISION NOT NULL,
    "confidenceIntervalLower" DOUBLE PRECISION NOT NULL,
    "confidenceIntervalUpper" DOUBLE PRECISION NOT NULL,
    "riskTrajectoryCurrent" DOUBLE PRECISION,
    "riskTrajectory5Year" DOUBLE PRECISION,
    "riskTrajectory10Year" DOUBLE PRECISION,
    "riskTrajectoryLifetime" DOUBLE PRECISION,
    "severityLevel" TEXT NOT NULL,
    "riskCategory" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "risk_assessments_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "interventions" (
    "id" TEXT NOT NULL,
    "riskAssessmentId" TEXT NOT NULL,
    "interventionType" TEXT NOT NULL,
    "interventionName" TEXT NOT NULL,
    "interventionDescription" TEXT,
    "evidenceLevel" TEXT NOT NULL,
    "expectedRiskReduction" DOUBLE PRECISION,
    "preventableYears" INTEGER,
    "recommended" BOOLEAN NOT NULL DEFAULT true,
    "implemented" BOOLEAN NOT NULL DEFAULT false,
    "implementationDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "interventions_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "polygenic_scores" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "diseaseType" TEXT NOT NULL,
    "prsScore" DOUBLE PRECISION NOT NULL,
    "prsPercentile" DOUBLE PRECISION NOT NULL,
    "referencePopulation" TEXT NOT NULL,
    "variantCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "polygenic_scores_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "family_risks" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "relativeType" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "variantId" TEXT,
    "recurrenceRisk" DOUBLE PRECISION NOT NULL,
    "inheritancePattern" TEXT NOT NULL,
    "geneticCounselingNeeded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "family_risks_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
-- CreateIndex
CREATE UNIQUE INDEX "shared_access_shareToken_key" ON "shared_access"("shareToken");
-- CreateIndex
CREATE UNIQUE INDEX "patients_patientId_key" ON "patients"("patientId");
-- CreateIndex
CREATE INDEX "variants_gene_idx" ON "variants"("gene");
-- CreateIndex
CREATE INDEX "variants_acmg_class_idx" ON "variants"("acmg_class");
-- CreateIndex
CREATE UNIQUE INDEX "variants_patientId_gene_hgvs_c_key" ON "variants"("patientId", "gene", "hgvs_c");
-- CreateIndex
CREATE INDEX "predictions_modelId_model_version_idx" ON "predictions"("modelId", "model_version");
-- CreateIndex
CREATE INDEX "model_registry_provider_is_active_idx" ON "model_registry"("provider", "is_active");
-- CreateIndex
CREATE UNIQUE INDEX "model_registry_name_version_key" ON "model_registry"("name", "version");
-- CreateIndex
CREATE INDEX "structure_files_variantId_file_type_idx" ON "structure_files"("variantId", "file_type");
-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
-- CreateIndex
CREATE INDEX "risk_assessments_patientId_idx" ON "risk_assessments"("patientId");
-- CreateIndex
CREATE INDEX "risk_assessments_diseaseType_idx" ON "risk_assessments"("diseaseType");
-- CreateIndex
CREATE INDEX "risk_assessments_riskScore_idx" ON "risk_assessments"("riskScore");
-- CreateIndex
CREATE INDEX "interventions_riskAssessmentId_idx" ON "interventions"("riskAssessmentId");
-- CreateIndex
CREATE INDEX "interventions_interventionType_idx" ON "interventions"("interventionType");
-- CreateIndex
CREATE INDEX "polygenic_scores_diseaseType_idx" ON "polygenic_scores"("diseaseType");
-- CreateIndex
CREATE INDEX "polygenic_scores_prsScore_idx" ON "polygenic_scores"("prsScore");
-- CreateIndex
CREATE UNIQUE INDEX "polygenic_scores_patientId_diseaseType_key" ON "polygenic_scores"("patientId", "diseaseType");
-- CreateIndex
CREATE INDEX "family_risks_patientId_idx" ON "family_risks"("patientId");
-- CreateIndex
CREATE INDEX "family_risks_relativeType_idx" ON "family_risks"("relativeType");
-- AddForeignKey
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "history_records" ADD CONSTRAINT "history_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "history_records" ADD CONSTRAINT "history_records_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "splicing_analyses" ADD CONSTRAINT "splicing_analyses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "splicing_analyses" ADD CONSTRAINT "splicing_analyses_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "shared_access" ADD CONSTRAINT "shared_access_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "shared_access" ADD CONSTRAINT "shared_access_sharedById_fkey" FOREIGN KEY ("sharedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "shared_access" ADD CONSTRAINT "shared_access_sharedWithId_fkey" FOREIGN KEY ("sharedWithId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "protein_structures" ADD CONSTRAINT "protein_structures_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "protein_structures" ADD CONSTRAINT "protein_structures_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "variants" ADD CONSTRAINT "variants_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "model_registry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "structure_files" ADD CONSTRAINT "structure_files_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_riskAssessmentId_fkey" FOREIGN KEY ("riskAssessmentId") REFERENCES "risk_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "polygenic_scores" ADD CONSTRAINT "polygenic_scores_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "family_risks" ADD CONSTRAINT "family_risks_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "family_risks" ADD CONSTRAINT "family_risks_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;