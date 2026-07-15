"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { usersT, roleMasterT } from "@/db/schema";
import { verifyPassword } from "@/lib/password";
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

  const rows = await db
    .select({
      id: usersT.id,
      username: usersT.username,
      fullName: usersT.full_name,
      email: usersT.email,
      password: usersT.password,
      profileImage: usersT.profile_image,
      roleId: usersT.role_id,
      roleName: roleMasterT.role_name,
    })
    .from(usersT)
    .leftJoin(roleMasterT, eq(usersT.role_id, roleMasterT.id))
    .where(and(eq(usersT.username, username), eq(usersT.display, "Y")))
    .limit(1);

  const user = rows[0];
  if (!user || !(await verifyPassword(password, user.password))) {
    return { error: "Invalid username or password." };
  }

  const token = await createSessionToken({
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    roleId: user.roleId,
    roleName: user.roleName ?? "User",
    profileImage: user.profileImage,
  }, rememberMe);
  await setSessionCookie(token, rememberMe);

  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
