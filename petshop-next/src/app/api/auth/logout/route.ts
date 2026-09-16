import { NextResponse } from "next/server";
import { sessionCookieName } from "@/lib/session";

export async function POST(request: Request) {
  const form = await request.formData();
  const destination = String(form.get("destination") ?? "");
  const path = destination === "admin" ? "/admin/login?loggedOut=1" : destination === "superadmin" ? "/superadmin/login?loggedOut=1" : "/";
  const response = NextResponse.redirect(new URL(path, request.url), 303);
  response.cookies.set(sessionCookieName, "", { expires: new Date(0), httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/" });
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
