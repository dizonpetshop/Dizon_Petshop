"use client";

import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import Brand from "@/components/Brand";
import ThemeToggle from "@/components/ThemeToggle";
import { dashboardViews, type DashboardView } from "@/lib/dashboard-views";

const navigation: { view: DashboardView; icon: string; label: string }[] = [
  { view: "dashboard", icon: "⌂", label: "Dashboard" },
  { view: "pets", icon: "🐾", label: "My Pets" },
  { view: "grooming", icon: "✂", label: "Grooming" },
  { view: "products", icon: "▣", label: "Products" },
  { view: "reservations", icon: "◷", label: "Reservations" },
  { view: "account", icon: "●", label: "My Account" },
];

function viewFromUrl(): DashboardView {
  const requested = new URLSearchParams(window.location.search).get("view");
  return dashboardViews.includes(requested as DashboardView) ? (requested as DashboardView) : "dashboard";
}

export default function ClientDashboardShell({
  initialView,
  children,
}: {
  initialView: DashboardView;
  children: ReactNode;
}) {
  const [view, setView] = useState<DashboardView>(initialView);

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  useEffect(() => {
    const syncWithHistory = () => setView(viewFromUrl());
    window.addEventListener("popstate", syncWithHistory);
    return () => window.removeEventListener("popstate", syncWithHistory);
  }, []);

  function openView(nextView: DashboardView) {
    if (nextView === view) return;
    const url = new URL(window.location.href);
    if (nextView === "dashboard") url.searchParams.delete("view");
    else url.searchParams.set("view", nextView);
    window.history.pushState(null, "", url);
    setView(nextView);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handlePanelLink(event: MouseEvent<HTMLDivElement>) {
    const link = (event.target as HTMLElement).closest<HTMLElement>("[data-dashboard-view]");
    if (!link) return;
    const nextView = link.dataset.dashboardView as DashboardView;
    if (!dashboardViews.includes(nextView)) return;
    event.preventDefault();
    openView(nextView);
  }

  return (
    <main className="dashShell">
      <aside className="dashSidebar">
        <Brand />
        <nav className="dashNav" aria-label="Client portal">
          {navigation.map((item) => (
            <a
              aria-current={view === item.view ? "page" : undefined}
              className={view === item.view ? "active" : undefined}
              href={item.view === "dashboard" ? "/client/dashboard" : `/client/dashboard?view=${item.view}`}
              key={item.view}
              onClick={(event) => {
                event.preventDefault();
                openView(item.view);
              }}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </a>
          ))}
        </nav>
      </aside>

      <section className="dashContent">
        <header className="dashTop">
          <div><small>CUSTOMER PORTAL</small><b>DIZON&apos;S Pet Grooming</b></div>
          <div className="clientTopActions"><ThemeToggle/><form action="/api/auth/logout" method="post"><button className="logoutButton">Logout</button></form></div>
        </header>
        <div className="dashboardPanels" data-active-view={view} onClick={handlePanelLink}>
          {children}
        </div>
      </section>
    </main>
  );
}
