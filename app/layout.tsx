import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "First Pass",
  description: "Open a homepage and the links in its header. Download the report of the pages that came back.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
