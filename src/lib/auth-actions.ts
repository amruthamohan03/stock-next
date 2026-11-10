"use server";

import { redirect } from "next/navigation";
import { authenticate } from "@/lib/auth-user";
import {
  createSessionToken,
  setSessionCookie,
  clearSessionCookie,
} from "@/lib/session";

export type LoginState = { error?: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const rememberMe = formData.get("remember") === "on";

  if (!username || !password) {
    return { error: "Please enter your username and password." };
  }

  const user = await authenticate(username, password);
  if (!user) {
    return { error: "Invalid username or password." };
  }

  await setSessionCookie(await createSessionToken(user, rememberMe), rememberMe);

  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
