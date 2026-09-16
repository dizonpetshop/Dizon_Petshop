type IconName =
  | "dashboard" | "products" | "categories" | "inventory" | "orders"
  | "calendar" | "customers" | "services" | "clock" | "reports"
  | "admins" | "settings" | "bell" | "menu" | "close" | "logout"
  | "chevron" | "search" | "warning" | "sales" | "package";

const paths: Record<IconName, React.ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
  products: <><path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="m4 7 8 4 8-4v10l-8 4-8-4V7Z"/><path d="M12 11v10"/></>,
  categories: <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>,
  inventory: <><path d="M4 6h16v15H4z"/><path d="M8 3h8l2 3H6l2-3ZM9 11h6"/></>,
  orders: <><path d="M6 3h12l2 5-2 13H6L4 8l2-5Z"/><path d="M4 8h16M9 12v5M15 12v5"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></>,
  customers: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
  services: <path d="M14.7 6.3a4 4 0 0 0-5.66 5.66L3 18v3h3l6.04-6.04A4 4 0 0 0 17.7 9.3l-2.3 2.3-3-3 2.3-2.3Z"/>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  reports: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>,
  admins: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0M18 8l1.2 1.2L22 6.5"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a8 8 0 0 0-1.8-1L14.4 3h-4l-.4 3.1a8 8 0 0 0-1.8 1L5.8 6l-2 3.5 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a8 8 0 0 0 1.8 1l.4 3h4l.4-3a8 8 0 0 0 1.8-1l2.4 1 2-3.5-2-1.5a7 7 0 0 0 .1-1Z"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16"/>, close: <path d="m6 6 12 12M18 6 6 18"/>,
  logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/></>,
  chevron: <path d="m8 10 4 4 4-4"/>, search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  warning: <><path d="M10.3 3.6 2.5 18a2 2 0 0 0 1.8 3h15.4a2 2 0 0 0 1.8-3L13.7 3.6a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></>,
  sales: <><path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 6-7"/></>, package: <><path d="M5 8h14v12H5zM8 8V5a4 4 0 0 1 8 0v3"/></>,
};

export default function AdminIcon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg aria-hidden="true" className="adminIcon" fill="none" height={size} viewBox="0 0 24 24" width={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">{paths[name]}</svg>;
}
