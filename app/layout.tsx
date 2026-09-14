import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lead Vault — Contact Workspace",
  description: "Search, filter, contact, and export your business leads.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
