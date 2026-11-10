import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { usersT, roleMasterT } from "@/db/schema";
import { verifyPassword } from "@/lib/password";
import type { SessionUser } from "@/lib/session";

/**
 * Check a username/password against `users_t` and return the session user.
 *
 * Shared by the web login server action and the `/api/auth/login` endpoint the
 * mobile app uses, so the two can never drift on what counts as a valid
 * account (active `display = 'Y'`, bcrypt password, role name joined in).
 */
export async function authenticate(
  username: string,
  password: string
): Promise<SessionUser | null> {
  const [user] = await db
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

  if (!user || !(await verifyPassword(password, user.password))) return null;

  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    roleId: user.roleId,
    roleName: user.roleName ?? "User",
    profileImage: user.profileImage,
  };
}
