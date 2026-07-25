"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity } from "lucide-react";

import { cn } from "@/lib/utils";
import { primaryNav } from "@/lib/navigation";

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar",
        className,
      )}
    >
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Activity className="h-5 w-5" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">SBOS</span>
          <span className="text-xs text-muted-foreground">
            Behavioral Health OS
          </span>
        </div>
      </div>

      <nav
        aria-label="Primary"
        className="flex-1 space-y-1 overflow-y-auto p-3"
      >
        {primaryNav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.title}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Success Brand OS</p>
        <p>v0.1.0 · HIPAA-ready</p>
      </div>
    </aside>
  );
}
