import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { readSessionToken, sessionCookieName } from "@/lib/session";

export async function GET() {
  const cookieStore = await cookies();
  const session = await readSessionToken(cookieStore.get(sessionCookieName)?.value);
  if (session?.role !== "Admin" && session?.role !== "SuperAdmin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [count, notifications] = await Promise.all([
    prisma.notification.count({ where: { recipientId: session.userId, isRead: false } }),
    prisma.notification.findMany({
      where: { recipientId: session.userId, isRead: false },
      orderBy: { createdAt: "desc" },
      select: { notificationId: true, title: true, message: true, type: true, link: true, createdAt: true },
      take: 5,
    }),
  ]);
  return Response.json({
    count,
    notifications: notifications.map((notification) => ({
      id: notification.notificationId.toString(),
      title: notification.title,
      message: notification.message,
      type: notification.type,
      link: notification.link,
      createdAt: notification.createdAt.toISOString(),
    })),
  }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = await readSessionToken(cookieStore.get(sessionCookieName)?.value);
  if (session?.role !== "Admin" && session?.role !== "SuperAdmin") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { id?: unknown } | null;
  if (typeof body?.id !== "string" || !/^\d+$/.test(body.id)) {
    return Response.json({ error: "Invalid notification" }, { status: 400 });
  }

  const notification = await prisma.notification.findFirst({
    where: { notificationId: BigInt(body.id), recipientId: session.userId },
    select: { notificationId: true, link: true },
  });
  if (!notification) return Response.json({ error: "Notification not found" }, { status: 404 });

  await prisma.notification.update({
    where: { notificationId: notification.notificationId },
    data: { isRead: true, readAt: new Date() },
  });
  return Response.json({ link: notification.link }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
