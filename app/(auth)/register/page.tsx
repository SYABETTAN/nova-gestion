import { RegisterClosedClient } from "@/components/auth/register-closed-client";
import { RegisterFormClient } from "@/components/auth/register-form-client";
import { getPublicSignupStatus } from "@/lib/registration";

export default function RegisterPage() {
  const status = getPublicSignupStatus();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      {status.allowed ? (
        <RegisterFormClient />
      ) : (
        <RegisterClosedClient message={status.message ?? "Inscription indisponible."} />
      )}
    </div>
  );
}
