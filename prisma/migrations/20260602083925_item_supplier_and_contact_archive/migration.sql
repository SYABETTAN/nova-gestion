-- DropIndex
DROP INDEX "AccountingEntry_organizationId_entryDate_idx";

-- DropIndex
DROP INDEX "Invoice_organizationId_dueDate_idx";

-- DropIndex
DROP INDEX "Invoice_organizationId_issueDate_idx";

-- DropIndex
DROP INDEX "Payment_organizationId_paymentDate_idx";

-- DropIndex
DROP INDEX "Quote_organizationId_createdAt_idx";

-- DropIndex
DROP INDEX "SupplierInvoice_organizationId_issueDate_idx";

-- AlterTable
ALTER TABLE "CustomerContact" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "supplierId" TEXT;

-- CreateIndex
CREATE INDEX "CustomerContact_isArchived_idx" ON "CustomerContact"("isArchived");

-- CreateIndex
CREATE INDEX "Item_supplierId_idx" ON "Item"("supplierId");

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
