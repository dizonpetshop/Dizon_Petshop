"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ClientNotification = {
  id: string;
  title: string;
  message: string;
  type: string;
  link: string;
  isRead: boolean;
  createdAt: string;
};

export const notificationUpdatedEvent = "client-notifications-updated";

export function notificationTime(value: string) {
  const elapsed = new Date(value).getTime() - Date.now();
  const absolute = Math.abs(elapsed);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (absolute < 60_000) return "just now";
  if (absolute < 3_600_000) return formatter.format(Math.round(elapsed / 60_000), "minute");
  if (absolute < 86_400_000) return formatter.format(Math.round(elapsed / 3_600_000), "hour");
  if (absolute < 604_800_000) return formatter.format(Math.round(elapsed / 86_400_000), "day");
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(new Date(value));
}

export default function ClientNotificationMenu({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);
  const [items, setItems] = useState<ClientNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/client/notifications?take=6", { cache: "no-store" });
      const result = await response.json() as { count?: number; notifications?: ClientNotification[]; error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to load notifications.");
      setCount(result.count || 0);
      setItems(result.notifications || []);
      setError("");
    } catch (loadError) {
      console.error("Could not load client notifications.", loadError);
      setError("Notifications are temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 20_000);
    const refresh = () => void load();
    window.addEventListener("focus", refresh);
    window.addEventListener(notificationUpdatedEvent, refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(notificationUpdatedEvent, refresh);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  async function markAllRead() {
    try {
      const response = await fetch("/api/client/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
      if (!response.ok) throw new Error();
      setCount(0);
      setItems((current) => current.map((item) => ({ ...item, isRead: true })));
      window.dispatchEvent(new Event(notificationUpdatedEvent));
    } catch {
      setError("Notifications could not be updated.");
    }
  }

  async function openNotification(item: ClientNotification) {
    try {
      const response = await fetch("/api/client/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id }) });
      const result = await response.json() as { count?: number; link?: string; error?: string };
      if (!response.ok) throw new Error(result.error);
      setCount(result.count || 0);
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, isRead: true } : entry));
      window.dispatchEvent(new Event(notificationUpdatedEvent));
      window.location.assign(result.link || "/client/dashboard?view=notifications");
    } catch {
      setError("This notification could not be opened.");
    }
  }

  return <div className="clientNotificationMenu" ref={menuRef}>
    <button aria-expanded={open} aria-haspopup="menu" aria-label={`${count} unread notifications`} className="clientNotificationBell" onClick={() => { setOpen((value) => !value); if (!open) { setLoading(true); void load(); } }} type="button">
      <span aria-hidden="true">{"\uD83D\uDD14"}</span>{count > 0 && <b>{count > 99 ? "99+" : count}</b>}
    </button>
    {open && <section className="clientNotificationDropdown" aria-label="Notifications">
      <header><div><strong>Notifications</strong><small>{count ? `${count} unread` : "You're all caught up"}</small></div>{count > 0 && <button onClick={() => void markAllRead()} type="button">Mark all as read</button>}</header>
      <div className="clientNotificationPreview">
        {loading && !items.length ? <p className="clientNotificationMessage">Loading notifications...</p> : error && !items.length ? <p className="clientNotificationMessage error">{error}</p> : items.length ? items.map((item) => <button className={item.isRead ? "isRead" : "isUnread"} key={item.id} onClick={() => void openNotification(item)} type="button"><i aria-hidden="true"/><span><strong>{item.title}</strong><p>{item.message}</p><small>{notificationTime(item.createdAt)} - {item.type.replaceAll("_", " ").toLowerCase()}</small></span></button>) : <p className="clientNotificationMessage">No notifications yet.</p>}
      </div>
      {error && items.length > 0 && <p className="clientNotificationInlineError">{error}</p>}
      <a className="clientNotificationFooter" href="/client/dashboard?view=notifications">View All Notifications</a>
    </section>}
  </div>;
}
