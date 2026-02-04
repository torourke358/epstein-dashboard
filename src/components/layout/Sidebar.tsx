"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Users,
  Scale,
  GitCompareArrows,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/compare", label: "Compare", icon: GitCompareArrows },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();

  const sidebarContent = (
    <aside
      className={cn(
        "flex w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar h-full",
        // Mobile: absolute overlay
        "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50",
        // Desktop: always visible. Mobile: controlled by mobileOpen
        mobileOpen === undefined
          ? "max-md:hidden md:flex"
          : mobileOpen
            ? "max-md:flex"
            : "max-md:hidden md:flex"
      )}
    >
      {/* Logo / title */}
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-5">
        <div className="flex items-center gap-2.5">
          <Scale className="h-5 w-5 text-gold" />
          <div className="flex flex-col">
            <span className="font-heading text-sm font-bold text-foreground leading-tight">
              Epstein Files
            </span>
            <span className="text-[10px] text-muted-foreground leading-tight">
              DOJ Document Analysis
            </span>
          </div>
        </div>
        {onMobileClose && (
          <button
            onClick={onMobileClose}
            className="md:hidden p-1 rounded-md hover:bg-sidebar-accent text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-3 py-4">
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Navigation
        </p>
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-gold font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}

        <div className="!mt-6">
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Entities
          </p>
          <Link
            href="/#entities"
            onClick={onMobileClose}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
              "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <Users className="h-4 w-4" />
            Entity Search
          </Link>
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border px-5 py-3">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Data sourced from publicly available DOJ releases under FOIA.
        </p>
      </div>
    </aside>
  );

  // Mobile: backdrop overlay
  if (mobileOpen) {
    return (
      <>
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onMobileClose}
        />
        {sidebarContent}
      </>
    );
  }

  return sidebarContent;
}
