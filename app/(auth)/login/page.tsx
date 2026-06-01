import { LoginPageClient } from "@/components/auth/login-page-client";
import { getPublicSignupStatus } from "@/lib/registration";

export default function LoginPage() {
  const { allowed } = getPublicSignupStatus();
  return <LoginPageClient publicSignupAllowed={allowed} />;
}
