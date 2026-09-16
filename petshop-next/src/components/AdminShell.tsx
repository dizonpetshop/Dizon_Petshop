"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import AdminIcon from "@/components/AdminIcon";
import AdminSidebar from "@/components/AdminSidebar";

type AdminShellProps = { activeView: string; adminName: string; adminRole: string; pageTitle: string; pageDescription: string; notificationCount: number; children: React.ReactNode };
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "AD";

export default function AdminShell({ activeView, adminName, adminRole, pageTitle, pageDescription, notificationCount, children }: AdminShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => { if (logoutOpen) dialogRef.current?.showModal(); else dialogRef.current?.close(); }, [logoutOpen]);

  return <main className={`adminWorkspace ${collapsed ? "sidebarCollapsed" : ""}`}>
    <AdminSidebar activeView={activeView} adminName={adminName} adminRole={adminRole} collapsed={collapsed} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} onLogout={() => setLogoutOpen(true)} />
    <section className="adminMain">
      <header className="adminTopbar">
        <div className="adminTopbarTitle"><button aria-label="Open navigation" className="adminMenuButton mobileOnly" onClick={() => setMobileOpen(true)} type="button"><AdminIcon name="menu" /></button><button aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="adminMenuButton desktopOnly" onClick={() => setCollapsed((value) => !value)} type="button"><AdminIcon name="menu" /></button><div><h1>{pageTitle}</h1><p>{pageDescription}</p></div></div>
        <div className="adminTopbarActions"><Link aria-label={`${notificationCount} important notifications`} className="adminNotification" href="/admin/dashboard?view=dashboard#attention"><AdminIcon name="bell"/>{notificationCount > 0 && <span>{notificationCount > 9 ? "9+" : notificationCount}</span>}</Link><div className="adminProfileMenu"><button aria-expanded={profileOpen} className="adminProfileTrigger" onClick={() => setProfileOpen((value) => !value)} type="button"><span className="adminAvatar">{initials(adminName)}</span><span className="adminProfileText"><b>{adminName}</b><small>{adminRole}</small></span><AdminIcon name="chevron" size={16}/></button>{profileOpen && <div className="adminProfileDropdown"><Link href="/admin/dashboard?view=profile" onClick={() => setProfileOpen(false)}>My Profile</Link><Link href="/admin/dashboard?view=settings" onClick={() => setProfileOpen(false)}>Account Settings</Link><button onClick={() => { setProfileOpen(false); setLogoutOpen(true); }} type="button">Logout</button></div>}</div></div>
      </header>
      <div className="adminPageContent">{children}</div>
    </section>
    <dialog className="adminConfirmDialog" onCancel={() => setLogoutOpen(false)} ref={dialogRef}><div className="adminDialogIcon"><AdminIcon name="logout" size={23}/></div><h2>Log out of Admin?</h2><p>Are you sure you want to log out? You will need to sign in again to access protected admin pages.</p><div><button className="adminSecondaryButton" onClick={() => setLogoutOpen(false)} type="button">Cancel</button><form action="/api/auth/logout" method="post"><input name="destination" type="hidden" value="admin"/><button className="adminDangerButton" type="submit"><AdminIcon name="logout" size={16}/>Logout</button></form></div></dialog>
  </main>;
}
