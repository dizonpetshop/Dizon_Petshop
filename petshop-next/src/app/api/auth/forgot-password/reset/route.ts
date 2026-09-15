import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStrongPassword, passwordResetCodeMatches, readPasswordResetToken, withFailedAttempt } from "@/lib/password-reset";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: unknown; code?: unknown; password?: unknown; confirmPassword?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const confirmPassword = typeof body?.confirmPassword === "string" ? body.confirmPassword : "";

  if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: "Enter the six-digit verification code." }, { status: 400 });
  if (password !== confirmPassword) return NextResponse.json({ error: "The new passwords do not match." }, { status: 400 });
  if (!isStrongPassword(password)) return NextResponse.json({ error: "Use at least 8 characters with uppercase, lowercase, a number, and a special character." }, { status: 400 });

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true, role: true, resetToken: true, resetExpires: true },
  });
  const parsed = readPasswordResetToken(user?.resetToken);
  if (!user || user.role.toLowerCase() === "admin" || !parsed || !user.resetToken || !user.resetExpires || user.resetExpires.getTime() <= Date.now()) {
    if (user?.resetToken) await prisma.user.updateMany({ where: { id: user.id, resetToken: user.resetToken }, data: { resetToken: null, resetExpires: null } });
    return NextResponse.json({ error: "That verification code is invalid or has expired. Request a new code." }, { status: 400 });
  }

  if (!passwordResetCodeMatches(user.id, user.email.toLowerCase(), code, parsed.hash)) {
    const attempts = parsed.attempts + 1;
    const nextToken = attempts >= 5 ? null : withFailedAttempt(user.resetToken, attempts);
    await prisma.user.updateMany({ where: { id: user.id, resetToken: user.resetToken }, data: { resetToken: nextToken, resetExpires: nextToken ? user.resetExpires : null } });
    return NextResponse.json({ error: attempts >= 5 ? "Too many incorrect attempts. Request a new code." : "That verification code is incorrect." }, { status: 400 });
  }

  const result = await prisma.user.updateMany({
    where: { id: user.id, resetToken: user.resetToken },
    data: { password: await hash(password, 12), resetToken: null, resetExpires: null },
  });
  if (result.count !== 1) return NextResponse.json({ error: "This code was already used. Request a new code." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
