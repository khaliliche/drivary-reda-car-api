import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Drivary Car - Admin",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
