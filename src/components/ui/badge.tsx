import { clsx } from "clsx";
import type { AgentStatus, SceneStatus } from "@/lib/types";

const statusColors: Record<AgentStatus, string> = {
  idle: "bg-studio-surface2 text-studio-muted border border-studio-border",
  queued: "bg-studio-surface2 text-studio-amber border border-studio-amber/30",
  running: "bg-studio-amber/10 text-studio-amber border border-studio-amber/50 agent-pulse",
  completed: "bg-studio-green/10 text-studio-green border border-studio-green/30",
  failed: "bg-studio-red/10 text-studio-red border border-studio-red/30",
  awaiting_approval: "bg-studio-purple/10 text-studio-purple border border-studio-purple/30",
};

const sceneColors: Record<SceneStatus, string> = {
  pending: "bg-studio-surface2 text-studio-muted border border-studio-border",
  generating: "bg-studio-amber/10 text-studio-amber border border-studio-amber/50",
  generated: "bg-studio-cyan/10 text-studio-cyan border border-studio-cyan/30",
  approved: "bg-studio-green/10 text-studio-green border border-studio-green/30",
  rejected: "bg-studio-red/10 text-studio-red border border-studio-red/30",
  regenerating: "bg-studio-purple/10 text-studio-purple border border-studio-purple/30",
};

export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  return (
    <span className={clsx("inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono", statusColors[status])}>
      {status === "running" && <span className="w-1.5 h-1.5 rounded-full bg-studio-amber animate-pulse" />}
      {status}
    </span>
  );
}

export function SceneStatusBadge({ status }: { status: SceneStatus }) {
  return (
    <span className={clsx("inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono", sceneColors[status])}>
      {status}
    </span>
  );
}

export function QualityBadge({ score }: { score: number }) {
  const color =
    score >= 90 ? "bg-studio-green/10 text-studio-green border-studio-green/30" :
    score >= 70 ? "bg-studio-amber/10 text-studio-amber border-studio-amber/30" :
    "bg-studio-red/10 text-studio-red border-studio-red/30";
  return (
    <span className={clsx("inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border", color)}>
      {score}/100
    </span>
  );
}
