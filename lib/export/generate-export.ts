import { prisma } from "@/lib/prisma";
import type { ExportFormat, ExportType } from "@prisma/client";
import { generateCsv } from "@/lib/export/csv";
import { generateJsonExport } from "@/lib/export/json";
import { formatExportFileName } from "@/lib/export/export-formatters";
import type { ExportResult } from "@/lib/export/export-types";
import {
  generateCustomersCsv,
  generateItemsCsv,
  generateQuotesCsv,
  generateInvoicesCsv,
  generatePaymentsCsv,
  generateRemindersCsv,
  generateSuppliersCsv,
  generateSupplierInvoicesCsv,
  generateAccountingEntriesCsv,
  generateAccountingEntryLinesCsv,
  generateAccountsCsv,
  generateGeneralLedgerCsv,
  generateTrialBalanceCsv,
  generateVatSummaryCsv,
  generateDashboardKpisCsv,
} from "@/lib/csv";
import { getDashboardData, dashboardDataToKpiRows } from "@/lib/dashboard";
import { getDateRangeFromPreset } from "@/lib/dashboard-periods";
import { getGeneralLedgerQuery } from "@/lib/general-ledger";
import { getTrialBalanceQuery } from "@/lib/trial-balance";
import { getVatSummaryQuery } from "@/lib/vat-summary";
import { getAccountingEntriesForExportQuery } from "@/lib/accounting";

type ExportFilters = {
  startDate?: Date;
  endDate?: Date;
  includeArchived?: boolean;
};

function dateFilter(field: "createdAt" | "issueDate" | "paymentDate" | "entryDate", filters?: ExportFilters) {
  if (!filters?.startDate && !filters?.endDate) return {};
  return {
    [field]: {
      ...(filters.startDate ? { gte: filters.startDate } : {}),
      ...(filters.endDate ? { lte: filters.endDate } : {}),
    },
  };
}

export async function generateExportContent(
  organizationId: string,
  organizationName: string,
  type: ExportType,
  format: ExportFormat,
  filters?: ExportFilters,
): Promise<ExportResult> {
  switch (type) {
    case "CUSTOMERS": {
      const customers = await prisma.customer.findMany({
        where: {
          organizationId,
          ...(filters?.includeArchived ? {} : { isArchived: false }),
        },
        include: { addresses: true },
        orderBy: { name: "asc" },
      });
      if (format === "JSON") {
        return {
          content: generateJsonExport(
            {
              organizationName,
              generatedAt: new Date().toISOString(),
              environment: process.env.APP_ENV ?? "development",
              exportType: type,
              filters,
              rowCount: customers.length,
            },
            customers,
          ),
          fileName: formatExportFileName(type, format),
          rowCount: customers.length,
          mimeType: "application/json",
        };
      }
      return {
        content: generateCustomersCsv(customers),
        fileName: formatExportFileName(type, format),
        rowCount: customers.length,
        mimeType: "text/csv",
      };
    }
    case "ITEMS": {
      const items = await prisma.item.findMany({
        where: { organizationId, ...(filters?.includeArchived ? {} : { isArchived: false }) },
        include: { category: true, unit: true },
      });
      return {
        content: generateItemsCsv(items),
        fileName: formatExportFileName(type, format),
        rowCount: items.length,
        mimeType: "text/csv",
      };
    }
    case "QUOTES": {
      const quotes = await prisma.quote.findMany({
        where: { organizationId, ...dateFilter("createdAt", filters) },
        include: { customer: true },
      });
      if (format === "JSON") {
        return {
          content: generateJsonExport(
            {
              organizationName,
              generatedAt: new Date().toISOString(),
              environment: process.env.APP_ENV ?? "development",
              exportType: type,
              filters,
              rowCount: quotes.length,
            },
            quotes,
          ),
          fileName: formatExportFileName(type, format),
          rowCount: quotes.length,
          mimeType: "application/json",
        };
      }
      return {
        content: generateQuotesCsv(quotes),
        fileName: formatExportFileName(type, format),
        rowCount: quotes.length,
        mimeType: "text/csv",
      };
    }
    case "INVOICES": {
      const invoices = await prisma.invoice.findMany({
        where: { organizationId, ...dateFilter("issueDate", filters) },
        include: { customer: true, quote: true },
      });
      if (format === "JSON") {
        return {
          content: generateJsonExport(
            {
              organizationName,
              generatedAt: new Date().toISOString(),
              environment: process.env.APP_ENV ?? "development",
              exportType: type,
              filters,
              rowCount: invoices.length,
            },
            invoices,
          ),
          fileName: formatExportFileName(type, format),
          rowCount: invoices.length,
          mimeType: "application/json",
        };
      }
      return {
        content: generateInvoicesCsv(invoices),
        fileName: formatExportFileName(type, format),
        rowCount: invoices.length,
        mimeType: "text/csv",
      };
    }
    case "PAYMENTS": {
      const payments = await prisma.payment.findMany({
        where: { organizationId, status: { not: "CANCELLED" }, ...dateFilter("paymentDate", filters) },
        include: { customer: true },
      });
      if (format === "JSON") {
        return {
          content: generateJsonExport(
            {
              organizationName,
              generatedAt: new Date().toISOString(),
              environment: process.env.APP_ENV ?? "development",
              exportType: type,
              filters,
              rowCount: payments.length,
            },
            payments,
          ),
          fileName: formatExportFileName(type, format),
          rowCount: payments.length,
          mimeType: "application/json",
        };
      }
      return {
        content: generatePaymentsCsv(payments),
        fileName: formatExportFileName(type, format),
        rowCount: payments.length,
        mimeType: "text/csv",
      };
    }
    case "REMINDERS": {
      const invoices = await prisma.invoice.findMany({
        where: {
          organizationId,
          amountDue: { gt: 0 },
          dueDate: { lt: new Date() },
          status: { notIn: ["CANCELLED", "CREDITED", "DRAFT"] },
        },
        include: { customer: true },
      });
      const rows = invoices.map((inv) => ({
        ...inv,
        daysOverdue: Math.max(
          0,
          Math.floor((Date.now() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24)),
        ),
        recommendedLevel: "LEVEL_1",
        lastReminderAt: null as Date | null,
        reminderCount: 0,
        reminderStatus: "PENDING",
      }));
      return {
        content: generateRemindersCsv(rows),
        fileName: formatExportFileName(type, format),
        rowCount: rows.length,
        mimeType: "text/csv",
      };
    }
    case "SUPPLIERS": {
      const suppliers = await prisma.supplier.findMany({
        where: { organizationId },
        include: { category: true, addresses: true },
      });
      return {
        content: generateSuppliersCsv(suppliers),
        fileName: formatExportFileName(type, format),
        rowCount: suppliers.length,
        mimeType: "text/csv",
      };
    }
    case "SUPPLIER_INVOICES": {
      const supplierInvoices = await prisma.supplierInvoice.findMany({
        where: { organizationId, ...dateFilter("issueDate", filters) },
        include: { supplier: true, expenseCategory: true },
      });
      return {
        content: generateSupplierInvoicesCsv(supplierInvoices),
        fileName: formatExportFileName(type, format),
        rowCount: supplierInvoices.length,
        mimeType: "text/csv",
      };
    }
    case "ACCOUNTING_ACCOUNTS": {
      const accounts = await prisma.accountingAccount.findMany({
        where: { organizationId },
        orderBy: { accountNumber: "asc" },
      });
      return {
        content: generateAccountsCsv(accounts),
        fileName: formatExportFileName(type, format),
        rowCount: accounts.length,
        mimeType: "text/csv",
      };
    }
    case "ACCOUNTING_JOURNALS": {
      const journals = await prisma.accountingJournal.findMany({
        where: { organizationId },
        orderBy: { code: "asc" },
      });
      const csv = generateCsv(
        ["code", "name", "type", "isActive"],
        journals.map((j) => [j.code, j.name, j.type, j.isActive]),
      );
      return {
        content: csv,
        fileName: formatExportFileName(type, format),
        rowCount: journals.length,
        mimeType: "text/csv",
      };
    }
    case "ACCOUNTING_ENTRIES": {
      const entries = await getAccountingEntriesForExportQuery(organizationId, {
        dateFrom: filters?.startDate?.toISOString().slice(0, 10),
        dateTo: filters?.endDate?.toISOString().slice(0, 10),
        page: 1,
        pageSize: 10000,
        sortBy: "entryDate",
        sortOrder: "desc",
      });
      if (format === "JSON") {
        return {
          content: generateJsonExport(
            {
              organizationName,
              generatedAt: new Date().toISOString(),
              environment: process.env.APP_ENV ?? "development",
              exportType: type,
              filters,
              rowCount: entries.length,
            },
            entries,
          ),
          fileName: formatExportFileName(type, format),
          rowCount: entries.length,
          mimeType: "application/json",
        };
      }
      return {
        content: generateAccountingEntriesCsv(entries),
        fileName: formatExportFileName(type, format),
        rowCount: entries.length,
        mimeType: "text/csv",
      };
    }
    case "ACCOUNTING_ENTRY_LINES": {
      const entries = await getAccountingEntriesForExportQuery(organizationId, {
        dateFrom: filters?.startDate?.toISOString().slice(0, 10),
        dateTo: filters?.endDate?.toISOString().slice(0, 10),
        page: 1,
        pageSize: 10000,
        sortBy: "entryDate",
        sortOrder: "desc",
      });
      return {
        content: generateAccountingEntryLinesCsv(entries),
        fileName: formatExportFileName(type, format),
        rowCount: entries.reduce((s, e) => s + (e.lines?.length ?? 0), 0),
        mimeType: "text/csv",
      };
    }
    case "GENERAL_LEDGER": {
      const rows = await getGeneralLedgerQuery(organizationId, {
        dateFrom: filters?.startDate?.toISOString().slice(0, 10),
        dateTo: filters?.endDate?.toISOString().slice(0, 10),
      });
      return {
        content: generateGeneralLedgerCsv(rows),
        fileName: formatExportFileName(type, format),
        rowCount: rows.length,
        mimeType: "text/csv",
      };
    }
    case "TRIAL_BALANCE": {
      const rows = await getTrialBalanceQuery(organizationId, {
        dateFrom: filters?.startDate?.toISOString().slice(0, 10),
        dateTo: filters?.endDate?.toISOString().slice(0, 10),
      });
      return {
        content: generateTrialBalanceCsv(rows),
        fileName: formatExportFileName(type, format),
        rowCount: rows.length,
        mimeType: "text/csv",
      };
    }
    case "VAT_SUMMARY": {
      const vatResult = await getVatSummaryQuery(organizationId, {
        dateFrom: filters?.startDate?.toISOString().slice(0, 10),
        dateTo: filters?.endDate?.toISOString().slice(0, 10),
      });
      return {
        content: generateVatSummaryCsv(vatResult.rows),
        fileName: formatExportFileName(type, format),
        rowCount: vatResult.rows.length,
        mimeType: "text/csv",
      };
    }
    case "DASHBOARD_KPIS": {
      const period = getDateRangeFromPreset(
        "THIS_MONTH",
        filters?.startDate,
        filters?.endDate,
      );
      const data = await getDashboardData(organizationId, period);
      const kpiRows = dashboardDataToKpiRows(data).map((row) => ({
        ...row,
        periodStart: period.startDate.toISOString().slice(0, 10),
        periodEnd: period.endDate.toISOString().slice(0, 10),
        generatedAt: new Date().toISOString(),
      }));
      if (format === "JSON") {
        return {
          content: generateJsonExport(
            {
              organizationName,
              generatedAt: new Date().toISOString(),
              environment: process.env.APP_ENV ?? "development",
              exportType: type,
              filters,
              rowCount: kpiRows.length,
            },
            kpiRows,
          ),
          fileName: formatExportFileName(type, format),
          rowCount: kpiRows.length,
          mimeType: "application/json",
        };
      }
      return {
        content: generateDashboardKpisCsv(kpiRows),
        fileName: formatExportFileName(type, format),
        rowCount: kpiRows.length,
        mimeType: "text/csv",
      };
    }
    case "DOCUMENTS": {
      const documents = await prisma.document.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
      });
      const headers = ["title", "type", "status", "fileName", "entityType", "entityId", "createdAt"];
      const csv = generateCsv(
        headers,
        documents.map((d) => [
          d.title,
          d.type,
          d.status,
          d.fileName,
          d.entityType ?? "",
          d.entityId ?? "",
          d.createdAt.toISOString(),
        ]),
      );
      return {
        content: csv,
        fileName: formatExportFileName(type, format),
        rowCount: documents.length,
        mimeType: "text/csv",
      };
    }
    case "AUDIT_LOGS": {
      const logs = await prisma.auditLog.findMany({
        where: {
          organizationId,
          ...dateFilter("createdAt", filters),
        },
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: 5000,
      });
      const headers = ["createdAt", "action", "entityType", "entityLabel", "userName", "userEmail"];
      const csv = generateCsv(
        headers,
        logs.map((l) => [
          l.createdAt.toISOString(),
          l.action,
          l.entityType,
          l.entityLabel ?? "",
          l.user?.name ?? "",
          l.user?.email ?? "",
        ]),
      );
      return {
        content: csv,
        fileName: formatExportFileName(type, format),
        rowCount: logs.length,
        mimeType: "text/csv",
      };
    }
    default:
      throw new Error(`Export non implémenté : ${type}`);
  }
}

export async function estimateExportRowCount(
  organizationId: string,
  type: ExportType,
): Promise<number> {
  switch (type) {
    case "CUSTOMERS":
      return prisma.customer.count({ where: { organizationId, isArchived: false } });
    case "ITEMS":
      return prisma.item.count({ where: { organizationId, isArchived: false } });
    case "QUOTES":
      return prisma.quote.count({ where: { organizationId } });
    case "INVOICES":
      return prisma.invoice.count({ where: { organizationId } });
    case "PAYMENTS":
      return prisma.payment.count({ where: { organizationId, status: { not: "CANCELLED" } } });
    case "REMINDERS":
      return prisma.reminder.count({ where: { organizationId } });
    case "SUPPLIERS":
      return prisma.supplier.count({ where: { organizationId } });
    case "SUPPLIER_INVOICES":
      return prisma.supplierInvoice.count({ where: { organizationId } });
    case "ACCOUNTING_ACCOUNTS":
      return prisma.accountingAccount.count({ where: { organizationId } });
    case "ACCOUNTING_JOURNALS":
      return prisma.accountingJournal.count({ where: { organizationId } });
    case "ACCOUNTING_ENTRIES":
      return prisma.accountingEntry.count({ where: { organizationId } });
    case "DOCUMENTS":
      return prisma.document.count({ where: { organizationId } });
    case "AUDIT_LOGS":
      return prisma.auditLog.count({ where: { organizationId } });
    default:
      return 0;
  }
}
