-- Phase G: Design Ledger hash chain.
-- Each ledger entry commits to the candidate content, the validation snapshot,
-- the source revision, the execution job id, and the previous entry in the
-- candidate's chain, so the ledger is tamper-evident.

ALTER TABLE "design_ledger"
  ADD COLUMN "gitCommitHash" TEXT,
  ADD COLUMN "jobId" TEXT,
  ADD COLUMN "candidateHash" TEXT,
  ADD COLUMN "validationHash" TEXT,
  ADD COLUMN "previousLedgerHash" TEXT,
  ADD COLUMN "ledgerHash" TEXT;