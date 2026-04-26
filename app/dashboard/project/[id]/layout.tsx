"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Graph",    href: "graph" },
  { label: "Kanban",   href: "kanban" },
  { label: "List",     href: "list" },
  { label: "Timeline", href: "timeline" },
] as const;

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const pathname = usePathname();
  const base = `/dashboard/project/${params.id}`;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 border-b border-border px-2 shrink-0">
        {TABS.map((tab) => {
          const href = `${base}/${tab.href}`;
          const active = pathname.startsWith(href);
          return (
            <Link
              key={tab.href}
              href={href}
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
                active
                  ? "border-[#6C63FF] text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
      <div className="flex-1 overflow-hidden p-4">{children}</div>
    </div>
  );
}
