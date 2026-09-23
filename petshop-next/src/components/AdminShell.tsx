"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdminIcon from "@/components/AdminIcon";
import AdminSidebar from "@/components/AdminSidebar";
import ThemeToggle from "@/components/ThemeToggle";

type AdminShellProps = { activeView: string; adminName: string; adminRole: string; pageTitle: string; pageDescription: string; notificationCount: number | null; children: React.ReactNode };
type NotificationPreview = { id: string; title: string; message: string; type: string; link: string; createdAt: string };
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "AD";
const notificationTime = (value: string) => new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(new Date(value));

export default function AdminShell({ activeView, adminName, adminRole, pageTitle, pageDescription, notificationCount, children }: AdminShellProps) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingView, setPendingView] = useState<string | null>(null);
  const [displayedNotificationCount, setDisplayedNotificationCount] = useState(notificationCount || 0);
  const [notificationItems, setNotificationItems] = useState<NotificationPreview[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [openingNotification, setOpeningNotification] = useState<string | null>(null);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const notificationMenuRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    setNotificationsLoading(true);
    try {
      const response = await fetch("/api/admin/notifications", { cache: "no-store" });
      if (!response.ok) return;
      const result = await response.json() as { count: number; notifications: NotificationPreview[] };
      setDisplayedNotificationCount(result.count);
      setNotificationItems(result.notifications);
    } catch (error) {
      console.error("Could not load admin notifications", error);
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  useEffect(() => { if (logoutOpen) dialogRef.current?.showModal(); else dialogRef.current?.close(); }, [logoutOpen]);
  useEffect(() => { setPendingView((view) => view === activeView ? null : view); }, [activeView]);
  useEffect(() => {
    void loadNotifications();
    const interval = window.setInterval(() => void loadNotifications(), 30_000);
    const refresh = () => void loadNotifications();
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", refresh); };
  }, [loadNotifications]);
  useEffect(() => {
    if (!notificationsOpen) return;
    const close = (event: PointerEvent) => {
      if (!notificationMenuRef.current?.contains(event.target as Node)) setNotificationsOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [notificationsOpen]);

  async function openNotification(notification: NotificationPreview) {
    setOpeningNotification(notification.id);
    try {
      const response = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notification.id }),
      });
      if (!response.ok) throw new Error("Unable to open notification.");
      const result = await response.json() as { link: string };
      setNotificationItems((items) => items.filter((item) => item.id !== notification.id));
      setDisplayedNotificationCount((count) => Math.max(0, count - 1));
      setNotificationsOpen(false);
      router.push(result.link);
      router.refresh();
    } catch (error) {
      console.error("Could not open admin notification", error);
    } finally {
      setOpeningNotification(null);
    }
  }

  const displayedView = pendingView || activeView;
  const isNavigating = pendingView !== null && pendingView !== activeView;

  return <main className={`adminWorkspace ${collapsed ? "sidebarCollapsed" : ""}`}>
    <AdminSidebar activeView={displayedView} adminName={adminName} adminRole={adminRole} collapsed={collapsed} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} onLogout={() => setLogoutOpen(true)} onNavigate={(view) => setPendingView(view === activeView ? null : view)} />
    <section className="adminMain">
      <header className={`adminTopbar ${isNavigating ? "isNavigating" : ""}`}>
        <div className="adminTopbarTitle"><button aria-label="Open navigation" className="adminMenuButton mobileOnly" onClick={() => setMobileOpen(true)} type="button"><AdminIcon name="menu" /></button><button aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="adminMenuButton desktopOnly" onClick={() => setCollapsed((value) => !value)} type="button"><AdminIcon name="menu" /></button><div><h1>{pageTitle}</h1><p>{pageDescription}</p></div></div>
        <div className="adminTopbarActions">
          <ThemeToggle/>
          <div className="adminNotificationMenu" ref={notificationMenuRef}>
            <button aria-expanded={notificationsOpen} aria-haspopup="menu" aria-label={`${displayedNotificationCount} unread notifications`} className="adminNotification" onClick={() => { setProfileOpen(false); setNotificationsOpen((value) => !value); if (!notificationsOpen) void loadNotifications(); }} type="button"><AdminIcon name="bell"/>{displayedNotificationCount > 0 && <span>{displayedNotificationCount > 9 ? "9+" : displayedNotificationCount}</span>}</button>
            {notificationsOpen && <div className="adminNotificationDropdown" role="menu">
              <header><div><b>Notifications</b><small>{displayedNotificationCount} unread</small></div><Link href="/admin/dashboard?view=notifications" onClick={() => setNotificationsOpen(false)}>View all</Link></header>
              <div className="adminNotificationPreviewList">
                {notificationsLoading && !notificationItems.length ? <p className="adminNotificationEmpty">Loading notifications…</p> : notificationItems.length ? notificationItems.map((notification) => <button disabled={openingNotification === notification.id} key={notification.id} onClick={() => void openNotification(notification)} role="menuitem" type="button"><span><AdminIcon name="bell" size={15}/></span><span><b>{notification.title}</b><p>{notification.message}</p><small>{notificationTime(notification.createdAt)} · {notification.type.replaceAll("_", " ")}</small></span></button>) : <p className="adminNotificationEmpty">You&apos;re all caught up.</p>}
              </div>
              <Link className="adminNotificationFooter" href="/admin/dashboard?view=notifications" onClick={() => setNotificationsOpen(false)}>Open notification center</Link>
            </div>}
          </div>
          <div className="adminProfileMenu"><button aria-expanded={profileOpen} className="adminProfileTrigger" onClick={() => { setNotificationsOpen(false); setProfileOpen((value) => !value); }} type="button"><span className="adminAvatar">{initials(adminName)}</span><span className="adminProfileText"><b>{adminName}</b><small>{adminRole}</small></span><AdminIcon name="chevron" size={16}/></button>{profileOpen && <div className="adminProfileDropdown"><Link href="/admin/dashboard?view=profile" onClick={() => setProfileOpen(false)}>My Profile</Link><Link href="/admin/dashboard?view=settings" onClick={() => setProfileOpen(false)}>Account Settings</Link><button onClick={() => { setProfileOpen(false); setLogoutOpen(true); }} type="button">Logout</button></div>}</div>
        </div>
      </header>
      <div aria-busy={isNavigating} className={`adminPageContent ${isNavigating ? "isNavigating" : ""}`}>{children}</div>
    </section>
    <dialog className="adminConfirmDialog" onCancel={() => setLogoutOpen(false)} ref={dialogRef}><div className="adminDialogIcon"><AdminIcon name="logout" size={23}/></div><h2>Log out of Admin?</h2><p>Are you sure you want to log out? You will need to sign in again to access protected admin pages.</p><div><button className="adminSecondaryButton" onClick={() => setLogoutOpen(false)} type="button">Cancel</button><form action="/api/auth/logout" method="post"><input name="destination" type="hidden" value="admin"/><button className="adminDangerButton" type="submit"><AdminIcon name="logout" size={16}/>Logout</button></form></div></dialog>
  </main>;
}
