export const dashboardViews = ["dashboard", "pets", "grooming", "products", "reservations", "account"] as const;

export type DashboardView = (typeof dashboardViews)[number];
