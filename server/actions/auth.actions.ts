"use server";

import { redirect } from "next/navigation";
import {
  loginWithCredentials,
  loginAsDevOwner,
  logout,
  registerUser,
} from "@/lib/auth";
import { assertPublicOrganizationSignupAllowed } from "@/lib/registration";
import { loginSchema, registerSchema } from "@/lib/validators";

export async function loginAction(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = loginSchema.safeParse(raw);

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const result = await loginWithCredentials(parsed.data.email, parsed.data.password);
  if (!result.success) {
    return result;
  }

  redirect("/dashboard");
}

export async function devLoginAction() {
  const result = await loginAsDevOwner();
  if (!result.success) {
    return result;
  }
  redirect("/dashboard");
}

export async function registerAction(formData: FormData) {
  const signupCheck = assertPublicOrganizationSignupAllowed();
  if (!signupCheck.allowed) {
    return { success: false, error: signupCheck.error };
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = registerSchema.safeParse(raw);

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const result = await registerUser(
    parsed.data.name,
    parsed.data.email,
    parsed.data.password,
  );

  if (!result.success) {
    return result;
  }

  redirect("/dashboard");
}

export async function logoutAction() {
  await logout();
  redirect("/login");
}
