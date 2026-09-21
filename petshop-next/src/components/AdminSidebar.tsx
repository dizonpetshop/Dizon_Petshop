"use client";

import Link from "next/link";
import Brand from "@/components/Brand";
import AdminIcon from "@/components/AdminIcon";

type AdminSidebarProps = { activeView: string; adminName: string; adminRole: string; collapsed: boolean; mobileOpen: boolean; onClose: () => void; onLogout: () => void; onNavigate: (view: string) => void };

const groups = [
  { label: "", items: [{ view: "dashboard", icon: "dashboard" as const, label: "Dashboard" }] },
  { label: "Management", items: [
    { view: "products", icon: "products" as const, label: "Products" }, { view: "categories", icon: "categories" as const, label: "Categories" },
    { view: "inventory", icon: "inventory" as const, label: "Inventory" }, { view: "orders", icon: "orders" as const, label: "Orders" },
    { view: "reservations", icon: "calendar" as const, label: "Grooming Appointments" }, { view: "customers", icon: "customers" as const, label: "Customers" },
  ] },
  { label: "Services", items: [{ view: "groomers", icon: "admins" as const, label: "Groomers" }, { view: "services", icon: "services" as const, label: "Grooming Services" }, { view: "schedules", icon: "clock" as const, label: "Schedules" }] },
  { label: "Insights", items: [{ view: "notifications", icon: "bell" as const, label: "Notifications" }, { view: "reports", icon: "reports" as const, label: "Reports & Analytics" }, { view: "auditlogs", icon: "inventory" as const, label: "Audit Logs" }] },
  { label: "System", items: [{ view: "admins", icon: "admins" as const, label: "Admin Management" }, { view: "settings", icon: "settings" as const, label: "Settings" }] },
];

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "AD";

export default function AdminSidebar({ activeView, adminName, adminRole, collapsed, mobileOpen, onClose, onLogout, onNavigate }: AdminSidebarProps) {
  return <>
    <button aria-label="Close navigation" className={`adminNavBackdrop ${mobileOpen ? "isOpen" : ""}`} onClick={onClose} type="button" />
    <aside className={`adminSidebar ${collapsed ? "isCollapsed" : ""} ${mobileOpen ? "isOpen" : ""}`}>
      <div className="adminBrandRow"><Brand /><button aria-label="Close menu" className="adminMobileClose" onClick={onClose} type="button"><AdminIcon name="close" /></button></div>
      <nav aria-label="Admin dashboard" className="adminNav">
        {groups.map((group) => <div className="adminNavGroup" key={group.label || "main"}>
          {group.label && <p>{group.label}</p>}
          {group.items.map((item) => <Link aria-current={activeView === item.view ? "page" : undefined} className={activeView === item.view ? "active" : ""} href={`/admin/dashboard?view=${item.view}`} key={item.view} onClick={(event) => { onClose(); if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) onNavigate(item.view); }} title={collapsed ? item.label : undefined}>
            <AdminIcon name={item.icon} /><span>{item.label}</span>
          </Link>)}
        </div>)}
      </nav>
      <div className="adminSidebarAccount">
        <Link className="adminAccountSummary" href="/admin/dashboard?view=profile" onClick={(event) => { onClose(); if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) onNavigate("profile"); }} title={collapsed ? adminName : undefined}><span className="adminAvatar">{initials(adminName)}</span><span><b>{adminName}</b><small>{adminRole}</small></span></Link>
        <button className="adminLogout" onClick={onLogout} title={collapsed ? "Logout" : undefined} type="button"><AdminIcon name="logout"/><span>Logout</span></button>
      </div>
    </aside>
  </>;
}
