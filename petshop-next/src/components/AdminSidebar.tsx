"use client";

import { useEffect, useState } from "react";
import Brand from "@/components/Brand";

const navigation = [
  { id: "overview", icon: "⌂", label: "Overview" },
  { id: "clients", icon: "♙", label: "Clients" },
  { id: "inventory", icon: "▦", label: "Inventory" },
  { id: "packages", icon: "✂", label: "Packages & Prices" },
  { id: "reservations", icon: "◷", label: "Reservations" },
  { id: "reports", icon: "▥", label: "Reports" },
] as const;

type SectionId = (typeof navigation)[number]["id"];

function sectionFromHash(): SectionId {
  const id = window.location.hash.slice(1);
  return navigation.some((item) => item.id === id) ? (id as SectionId) : "overview";
}

export default function AdminSidebar() {
  const [activeSection, setActiveSection] = useState<SectionId>("overview");

  useEffect(() => {
    const syncHash = () => setActiveSection(sectionFromHash());
    syncHash();
    window.addEventListener("hashchange", syncHash);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible) setActiveSection(visible.target.id as SectionId);
      },
      { rootMargin: "-18% 0px -68% 0px" },
    );

    navigation.forEach(({ id }) => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });

    return () => {
      window.removeEventListener("hashchange", syncHash);
      observer.disconnect();
    };
  }, []);

  return (
    <aside className="dashSidebar">
      <Brand />
      <nav className="dashNav" aria-label="Admin dashboard">
        {navigation.map((item) => (
          <a
            aria-current={activeSection === item.id ? "page" : undefined}
            className={activeSection === item.id ? "active" : undefined}
            href={`#${item.id}`}
            key={item.id}
            onClick={() => setActiveSection(item.id)}
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </a>
        ))}
      </nav>
    </aside>
  );
}
