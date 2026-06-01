export type DashboardPeriodPreset =
  | "THIS_MONTH"
  | "LAST_MONTH"
  | "THIS_QUARTER"
  | "LAST_QUARTER"
  | "THIS_YEAR"
  | "LAST_12_MONTHS"
  | "CUSTOM";

export type DateRange = {
  startDate: Date;
  endDate: Date;
  preset: DashboardPeriodPreset;
};

export type KpiValue = {
  key: string;
  label: string;
  value: number;
  previousValue?: number;
  changePercent?: number;
  format: "currency" | "number" | "percent";
  currency?: string;
};

export type TopCustomerRow = {
  id: string;
  name: string;
  amount: number;
};

export type TopSupplierRow = {
  id: string;
  name: string;
  amount: number;
};

export type TopItemRow = {
  id: string;
  name: string;
  amount: number;
};

export type MonthlyPoint = {
  month: string;
  label: string;
  value: number;
};

export type StatusSlice = {
  name: string;
  value: number;
  key: string;
};

export type OverdueBucket = {
  bucket: string;
  label: string;
  amount: number;
  count: number;
};

export type DashboardAlert = {
  id: string;
  type: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  title: string;
  description: string;
  entityType?: string;
  entityId?: string;
  href?: string;
};

export type RecentActivityItem = {
  id: string;
  date: Date;
  type: string;
  title: string;
  description?: string;
  userName?: string;
  href?: string;
};

export type DashboardOverview = {
  invoicedRevenue: number;
  cashCollected: number;
  amountToCollect: number;
  supplierExpenses: number;
  simplifiedResult: number;
  netVatIndicative: number;
};

export type CommercialKpis = {
  activeCustomers: number;
  newCustomers: number;
  prospects: number;
  quotesCount: number;
  quotesTotal: number;
  quotesAccepted: number;
  quoteAcceptanceRate: number;
  averageQuoteValue: number;
  topCustomers: TopCustomerRow[];
  topItems: TopItemRow[];
  quotesByStatus: StatusSlice[];
  quotesMonthly: MonthlyPoint[];
};

export type InvoiceKpis = {
  revenueExcludingTax: number;
  totalVat: number;
  totalIncludingTax: number;
  invoiceCount: number;
  draftCount: number;
  validatedCount: number;
  paidCount: number;
  overdueCount: number;
  amountToCollect: number;
  averageInvoiceValue: number;
  revenueMonthly: MonthlyPoint[];
  paymentStatusBreakdown: StatusSlice[];
};

export type PaymentKpis = {
  collectedAmount: number;
  paymentCount: number;
  allocatedAmount: number;
  unallocatedAmount: number;
  averagePayment: number;
  settledInvoices: number;
  byMethod: StatusSlice[];
  cashInMonthly: MonthlyPoint[];
  recentPayments: { id: string; number: string; customerName: string; amount: number; date: Date }[];
};

export type ReminderKpis = {
  invoicesToRemind: number;
  overdueAmount: number;
  averageOverdueDays: number;
  remindersSent: number;
  disputedCount: number;
  pausedCount: number;
  promisedCount: number;
  topOverdueCustomers: TopCustomerRow[];
  overdueBuckets: OverdueBucket[];
};

export type SupplierKpis = {
  activeSuppliers: number;
  preferredSuppliers: number;
  highRiskSuppliers: number;
  expensesAmount: number;
  amountToPay: number;
  overdueSupplierInvoices: number;
  expensesByCategory: StatusSlice[];
  topSuppliers: TopSupplierRow[];
  expensesMonthly: MonthlyPoint[];
};

export type AccountingKpis = {
  entryCount: number;
  draftCount: number;
  validatedCount: number;
  unbalancedCount: number;
  totalDebit: number;
  totalCredit: number;
  globalGap: number;
  vatCollected: number;
  vatDeductible: number;
  netVat: number;
  byJournal: StatusSlice[];
};

export type DashboardData = {
  period: DateRange;
  overview: DashboardOverview;
  commercial: CommercialKpis;
  invoices: InvoiceKpis;
  payments: PaymentKpis;
  reminders: ReminderKpis;
  suppliers: SupplierKpis;
  accounting: AccountingKpis;
  alerts: DashboardAlert[];
  recentActivity: RecentActivityItem[];
};
