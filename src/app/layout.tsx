import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MAI Finance - Warsun Distributor",
  description: "Warsun Türkiye Distribütör Finansal Yönetim Sistemi",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className="antialiased">{children}</body>
    </html>
  );
}