import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const form = await request.formData();
  const firstName = String(form.get("firstName") ?? "").trim();
  const surname = String(form.get("surname") ?? "").trim();
  const middleInitial = String(form.get("middleInitial") ?? "").trim().slice(0,2) || null;
  const phoneNumber = String(form.get("phone") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!firstName || !surname || !phoneNumber || !email.includes("@") || password.length < 8) return NextResponse.redirect(new URL("/client/register?error=invalid",request.url),303);
  try {
    await prisma.user.create({data:{role:"User",accountStatus:"Active",firstName,surname,middleInitial,phoneNumber,email,password:await hash(password,12)}});
    return NextResponse.redirect(new URL("/client/login?registered=1",request.url),303);
  } catch {
    return NextResponse.redirect(new URL("/client/register?error=exists",request.url),303);
  }
}
