import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { readSessionToken, sessionCookieName } from "@/lib/session";

export async function GET() {
  const cookieStore = await cookies();
  const session = await readSessionToken(cookieStore.get(sessionCookieName)?.value);
  if (session?.role !== "Admin" && session?.role !== "SuperAdmin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const count = await prisma.notification.count({ where: { recipientId: session.userId, isRead: false } });
  return Response.json({ count }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
