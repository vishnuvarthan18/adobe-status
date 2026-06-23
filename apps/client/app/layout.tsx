import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MG Digital Portal",
  description: "MG Digital subscription management portal",
  icons: { icon: '/logo.png' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
