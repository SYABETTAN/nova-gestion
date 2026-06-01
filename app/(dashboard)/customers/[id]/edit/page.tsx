import { notFound } from "next/navigation";
import { CustomerForm } from "@/components/customers/customer-form";
import { requireAuth } from "@/lib/auth";
import {
  getCustomerByIdAction,
  getCustomerTagsAction,
} from "@/server/actions/customer.actions";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditCustomerPage({ params }: PageProps) {
  await requireAuth();
  const { id } = await params;

  const [customer, tags] = await Promise.all([
    getCustomerByIdAction(id),
    getCustomerTagsAction(),
  ]);

  if (!customer) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Modifier le client</h1>
        <p className="text-[var(--color-muted-foreground)]">{customer.customerNumber} — {customer.name}</p>
      </div>
      <CustomerForm
        mode="edit"
        customerId={customer.id}
        customer={{
          ...customer,
          tagAssignments: customer.tagAssignments.map((a) => ({ tagId: a.tagId })),
        }}
        tags={tags}
      />
    </div>
  );
}
