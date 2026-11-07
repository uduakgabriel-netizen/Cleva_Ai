"use client";

import { usePathname } from "next/navigation";
import { Nav } from "./nav";

export function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showNav = pathname !== "/" && !pathname.startsWith("/pay");

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      {showNav && <Nav />}
      <main className="pb-20">{children}</main>
    </div>
  );
}
