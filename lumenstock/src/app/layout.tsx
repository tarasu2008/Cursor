import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Lumenstock — Royalty-free images to license",
    template: "%s · Lumenstock",
  },
  description:
    "Lumenstock is a stock image marketplace with Shutterstock-style licensing, extended categories, and a roadmap for Canva-like creative tools.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
