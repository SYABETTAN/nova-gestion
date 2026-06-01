import {
  Bell,
  BookOpen,
  ClipboardList,
  Contact,
  CreditCard,
  FileInput,
  FileOutput,
  FileStack,
  FileText,
  LayoutDashboard,
  Package,
  Receipt,
  Scale,
  Search,
  Settings,
  Star,
  Truck,
  UserPlus,
  Wallet,
  AlertCircle,
  RefreshCw,
  FilePlus,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Contact,
  FileText,
  Receipt,
  CreditCard,
  Bell,
  Truck,
  FileInput,
  Scale,
  FileOutput,
  FileStack,
  Settings,
  UserPlus,
  Package,
  FilePlus,
  Wallet,
  BookOpen,
  AlertCircle,
  ClipboardList,
  RefreshCw,
  Search,
  Star,
};

export function SearchTypeIcon({
  icon,
  type,
  className = "h-4 w-4",
}: {
  icon?: string;
  type?: string;
  className?: string;
}) {
  const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    CUSTOMER: Contact,
    ITEM: Package,
    QUOTE: FileText,
    INVOICE: Receipt,
    PAYMENT: CreditCard,
    REMINDER: Bell,
    SUPPLIER: Truck,
    SUPPLIER_INVOICE: FileInput,
    ACCOUNTING_ENTRY: Scale,
    DOCUMENT: FileStack,
    EXPORT_JOB: FileOutput,
    SETTING: Settings,
    AUDIT_LOG: ClipboardList,
    ACTION: Search,
  };
  const Icon = (icon && ICON_MAP[icon]) || (type && typeIcons[type]) || Search;
  return <Icon className={className} />;
}
