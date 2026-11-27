import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "First Pass",
  description: "Open a public URL and see the measurements that came back. Download the written report.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
