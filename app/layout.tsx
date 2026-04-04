import "./globals.css";
import React from "react";
import AppShell from "@/components/AppShell";
import { Inter } from "next/font/google";
import { getSessionContext } from "@/lib/apiAuth";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata = {
  title: "Roster Planner",
  description: "Roster planning app with Next.js + Postgres",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionContext();
  return (
    <html lang="en">
      <body className={inter.className}>
        <AppShell initialUserName={session?.user.name ?? null}>{children}</AppShell>
      </body>
    </html>
  );
}
