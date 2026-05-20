import "server-only";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";

const COOKIE = "spark_admin";

export function isAdminEnabled(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function expectedToken(): string | null {
  const pwd = process.env.ADMIN_PASSWORD;
  if (!pwd) return null;
  // Hash the password so the cookie value isn't the plaintext.
  return createHash("sha256").update(`spark-admin:${pwd}`).digest("hex");
}

export async function isAdmin(): Promise<boolean> {
  const token = expectedToken();
  if (!token) return false;
  const jar = await cookies();
  return jar.get(COOKIE)?.value === token;
}

export const ADMIN_COOKIE_NAME = COOKIE;
