"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import type { Project } from "@/lib/types";

interface StudioNavProps {
  project: Project;
}

const tabs = [
  { label: "Studio", href: "" },
  { label: "Storyboard", href: "/storyboard" },
  { label: "Timeline", href: "/timeline" },
  { label: "Shot List", href: "/shots" },
];

export function StudioNav({ project }: StudioNavProps) {
  const pathname = usePathname();
  const base = `/projects/${project.id}`;

  const statusColor = {
    draft: "text-studio-muted",
    running: "text-studio-amber",
    paused: "text-studio-purple",
    awaiting_approval: "text-studio-purple",
    completed: "text-studio-green",
    failed: "text-studio-red",
  }[project.status] ?? "text-studio-muted";

  return (
    <div className="border-b border-studio-border bg-studio-surface">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-studio-muted hover:text-studio-text transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-sm font-bold text-studio-text">{project.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={clsx("text-xs font-mono", statusColor)}>
                {project.status}
              </span>
              {project.status === "running" && (
                <span className="w-1.5 h-1.5 rounded-full bg-studio-amber animate-pulse" />
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-studio-muted">
            {project.autonomous ? "AUTO" : "SUPERVISED"}
          </span>
          <div className={clsx(
            "w-2 h-2 rounded-full",
            project.autonomous ? "bg-studio-green" : "bg-studio-amber"
          )} />
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex px-6">
        {tabs.map((tab) => {
          const href = base + tab.href;
          const isActive = tab.href === "" ? pathname === base : pathname.startsWith(href);
          return (
            <Link
              key={tab.label}
              href={href}
              className={clsx(
                "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                isActive
                  ? "border-studio-amber text-studio-text"
                  : "border-transparent text-studio-muted hover:text-studio-text"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
