import type { PermissionKey } from "@prisma/client";
import type { QuickAction } from "@/lib/search/search-types";
import { hasPermission } from "@/lib/permissions";
import type { SessionUser } from "@/lib/permissions";

export const QUICK_ACTIONS: QuickAction[] = [
  { id: "nav-dashboard", label: "Tableau de bord", href: "/dashboard", icon: "LayoutDashboard", permission: "DASHBOARD_READ", moduleKey: "dashboard" },
  { id: "nav-customers", label: "Clients", href: "/customers", icon: "Contact", permission: "CUSTOMERS_READ", moduleKey: "customers" },
  { id: "nav-quotes", label: "Devis", href: "/quotes", icon: "FileText", permission: "QUOTES_READ", moduleKey: "quotes" },
  { id: "nav-invoices", label: "Factures", href: "/invoices", icon: "Receipt", permission: "INVOICES_READ", moduleKey: "invoices" },
  { id: "nav-payments", label: "Paiements", href: "/payments", icon: "CreditCard", permission: "PAYMENTS_READ", moduleKey: "payments" },
  { id: "nav-reminders", label: "Relances", href: "/reminders", icon: "Bell", permission: "REMINDERS_READ", moduleKey: "reminders" },
  { id: "nav-suppliers", label: "Fournisseurs", href: "/suppliers", icon: "Truck", permission: "SUPPLIERS_READ", moduleKey: "suppliers" },
  { id: "nav-supplier-invoices", label: "Factures fournisseurs", href: "/supplier-invoices", icon: "FileInput", permission: "SUPPLIER_INVOICES_READ", moduleKey: "supplierInvoices" },
  { id: "nav-accounting", label: "Comptabilité légère", href: "/accounting", icon: "Scale", permission: "ACCOUNTING_READ", moduleKey: "accounting" },
  { id: "nav-exports", label: "Exports", href: "/exports", icon: "FileOutput", permission: "EXPORTS_READ", moduleKey: "exports" },
  { id: "nav-documents", label: "Documents", href: "/documents", icon: "FileStack", permission: "DOCUMENTS_READ", moduleKey: "documents" },
  { id: "nav-settings", label: "Paramètres", href: "/settings", icon: "Settings", permission: "ADVANCED_SETTINGS_READ", moduleKey: "advancedSettings" },
  { id: "new-customer", label: "Nouveau client", href: "/customers/new", icon: "UserPlus", permission: "CUSTOMERS_CREATE", moduleKey: "customers" },
  { id: "new-item", label: "Nouvel article / service", href: "/items/new", icon: "Package", permission: "ITEMS_CREATE", moduleKey: "items" },
  { id: "new-quote", label: "Nouveau devis", href: "/quotes/new", icon: "FilePlus", permission: "QUOTES_CREATE", moduleKey: "quotes" },
  { id: "new-invoice", label: "Nouvelle facture", href: "/invoices/new", icon: "Receipt", permission: "INVOICES_CREATE", moduleKey: "invoices" },
  { id: "new-payment", label: "Nouveau paiement", href: "/payments/new", icon: "Wallet", permission: "PAYMENTS_CREATE", moduleKey: "payments" },
  { id: "new-supplier", label: "Nouveau fournisseur", href: "/suppliers/new", icon: "Truck", permission: "SUPPLIERS_CREATE", moduleKey: "suppliers" },
  { id: "new-supplier-invoice", label: "Nouvelle facture fournisseur", href: "/supplier-invoices/new", icon: "FileInput", permission: "SUPPLIER_INVOICES_CREATE", moduleKey: "supplierInvoices" },
  { id: "new-entry", label: "Nouvelle écriture OD", href: "/accounting/entries/new", icon: "BookOpen", permission: "ACCOUNTING_CREATE", moduleKey: "accounting" },
  { id: "overdue", label: "Voir factures en retard", href: "/reminders", icon: "AlertCircle", permission: "REMINDERS_READ", moduleKey: "reminders" },
  { id: "audit", label: "Journal d'audit", href: "/settings/audit-log", icon: "ClipboardList", permission: "AUDIT_LOG_READ" },
];

export function getQuickActions(
  user: Pick<SessionUser, "permissions">,
  enabledModules: Set<string>,
  query = "",
): QuickAction[] {
  const q = query.trim().toLowerCase();
  return QUICK_ACTIONS.filter((action) => {
    if (action.permission && !hasPermission(user, action.permission as PermissionKey)) return false;
    if (action.moduleKey && !enabledModules.has(action.moduleKey)) return false;
    if (!q) return true;
    return (
      action.label.toLowerCase().includes(q) ||
      (action.description?.toLowerCase().includes(q) ?? false)
    );
  });
}
