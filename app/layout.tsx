import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BJJ First Month Simulator",
  description: "Brazilian Jiu Jitsu life simulator for Weeks 1 to 4"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
