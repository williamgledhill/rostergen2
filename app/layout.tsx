import "./globals.css";
import React from "react";
import AppShell from "@/components/AppShell";
import { Poppins } from "next/font/google";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata = {
  title: "Roster Planner",
  description: "Roster planning app with Next.js + Postgres",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={poppins.className}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
