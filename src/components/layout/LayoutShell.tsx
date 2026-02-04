"use client";

import { useState, useCallback } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { Footer } from "./Footer";

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={closeMobile} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuClick={openMobile} />
        <main className="flex-1 overflow-y-auto px-6 py-5">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
