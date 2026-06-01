-- Index composites pour filtres fréquents (org + date)
CREATE INDEX IF NOT EXISTS "Invoice_organizationId_issueDate_idx" ON "Invoice"("organizationId", "issueDate");
CREATE INDEX IF NOT EXISTS "Invoice_organizationId_dueDate_idx" ON "Invoice"("organizationId", "dueDate");
CREATE INDEX IF NOT EXISTS "Quote_organizationId_createdAt_idx" ON "Quote"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "Payment_organizationId_paymentDate_idx" ON "Payment"("organizationId", "paymentDate");
CREATE INDEX IF NOT EXISTS "SupplierInvoice_organizationId_issueDate_idx" ON "SupplierInvoice"("organizationId", "issueDate");
CREATE INDEX IF NOT EXISTS "AccountingEntry_organizationId_entryDate_idx" ON "AccountingEntry"("organizationId", "entryDate");
