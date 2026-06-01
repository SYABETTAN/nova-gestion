-- Document storage: storageKey, checksum; remove sandbox flag on documents

ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "storageKey" TEXT;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "checksum" TEXT;

UPDATE "Document"
SET "storageKey" = 'legacy/documents/' || "id"
WHERE "storageKey" IS NULL;

ALTER TABLE "Document" ALTER COLUMN "storageKey" SET NOT NULL;
ALTER TABLE "Document" ALTER COLUMN "fileUrl" DROP NOT NULL;
ALTER TABLE "Document" ALTER COLUMN "sizeBytes" SET DEFAULT 0;
UPDATE "Document" SET "sizeBytes" = 0 WHERE "sizeBytes" IS NULL;
ALTER TABLE "Document" ALTER COLUMN "sizeBytes" SET NOT NULL;

ALTER TABLE "Document" DROP COLUMN IF EXISTS "isSandbox";

CREATE UNIQUE INDEX IF NOT EXISTS "Document_organizationId_storageKey_key"
  ON "Document"("organizationId", "storageKey");

-- Supplier invoice attachments

ALTER TABLE "SupplierInvoiceAttachment" ADD COLUMN IF NOT EXISTS "storageKey" TEXT;
ALTER TABLE "SupplierInvoiceAttachment" ADD COLUMN IF NOT EXISTS "checksum" TEXT;

UPDATE "SupplierInvoiceAttachment"
SET "storageKey" = 'legacy/supplier-attachments/' || "id"
WHERE "storageKey" IS NULL;

ALTER TABLE "SupplierInvoiceAttachment" ALTER COLUMN "storageKey" SET NOT NULL;
ALTER TABLE "SupplierInvoiceAttachment" ALTER COLUMN "fileUrl" DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "SupplierInvoiceAttachment_organizationId_storageKey_key"
  ON "SupplierInvoiceAttachment"("organizationId", "storageKey");
