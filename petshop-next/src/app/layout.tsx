import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dizon's Petshop & Grooming",
  description: "Premium pet care, grooming, and essentials in one place.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
