import { CustomerForm } from "@/components/customers/customer-form";
import { requireAuth } from "@/lib/auth";
import { getCustomerTagsAction } from "@/server/actions/customer.actions";

export default async function NewCustomerPage() {
  await requireAuth();
  const tags = await getCustomerTagsAction();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nouveau client</h1>
        <p className="text-[var(--color-muted-foreground)]">
          Créez un client dans votre répertoire
        </p>
      </div>
      <CustomerForm mode="create" tags={tags} />
    </div>
  );
}
