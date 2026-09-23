-- Phase F: point each candidate at its on-disk artifact (relative to the
-- design artifact store root). The byte-identical PDB/mmCIF content stays in
-- `structure`; the file store materialises the same data under
-- artifacts/<runId>/candidates/<candidateId>/ for reproducible reads.
ALTER TABLE "design_candidates" ADD COLUMN "structuredFile" TEXT;