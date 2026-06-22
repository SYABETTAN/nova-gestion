
import { organizationNameForDocuments } from "@/lib/organization-display";

type Organization = {
  name: string;
  legalName?: string | null;
  slug?: string | null;
  addressLine1?: string | null;
  postalCode?: string | null;
  city?: string | null;
  email?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
};

type DocumentPrintLayoutProps = {
  organization: Organization;
  title: string;
  documentNumber: string;
  documentType?: string;
  footerText?: string;
  children: React.ReactNode;
};

export function DocumentPrintLayout({
  organization,
  title,
  documentNumber,
  documentType,
  footerText,
  children,
}: DocumentPrintLayoutProps) {
  const brandingName = organizationNameForDocuments(organization);

  return (
    <div className="mx-auto max-w-4xl bg-white p-8 text-slate-900 print:p-0">
      <header className="mb-8 flex items-start justify-between border-b pb-6">
        <div>
          <p className="text-lg font-bold">{brandingName}</p>
          <p className="mt-2 text-sm text-slate-600">
            {[organization.addressLine1, organization.postalCode, organization.city]
              .filter(Boolean)
              .join(" ")}
          </p>
          <p className="text-sm text-slate-600">
            {[organization.email, organization.phone].filter(Boolean).join(" — ")}
          </p>
        </div>
        <div className="text-right">
          <h1 className="mt-2 text-xl font-bold">{title}</h1>
          <p className="font-mono text-sm text-slate-600">{documentNumber}</p>
          {documentType ? <p className="text-xs text-slate-500">{documentType}</p> : null}
        </div>
      </header>
      <main>{children}</main>
      <footer className="mt-12 border-t pt-4 text-center text-xs text-slate-500">
        {footerText ??
          ""}
      </footer>
    </div>
  );
}
