import { SignJWT, jwtVerify } from "jose";

export const sessionCookieName = "petshop_session";

function sessionSecret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SECRET must contain at least 32 characters.");
  return new TextEncoder().encode(value);
}

export type SessionPayload = { userId: number; role: "SuperAdmin" | "Admin" | "User"; name: string };

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("8h").sign(sessionSecret());
}

export async function readSessionToken(token?: string): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, sessionSecret());
    if (typeof payload.userId !== "number" || !["SuperAdmin", "Admin", "User"].includes(String(payload.role))) return null;
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
