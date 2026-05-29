"use client";

import { AGENT_LABELS, AGENT_COLORS } from "@/lib/types";
import { AgentStatusBadge } from "@/components/ui/badge";
import type { StudioEvent, AgentRun } from "@/lib/types";

interface AgentActivityFeedProps {
  events: StudioEvent[];
  agentRuns: AgentRun[];
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 1000) return "now";
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

export function AgentActivityFeed({ events, agentRuns }: AgentActivityFeedProps) {
  const latestRunByAgent = new Map<string, AgentRun>();
  for (const run of agentRuns) {
    const existing = latestRunByAgent.get(run.agent_type);
    if (!existing || run.created_at > existing.created_at) {
      latestRunByAgent.set(run.agent_type, run);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Agent status grid */}
      <div className="grid grid-cols-2 gap-2 p-3 border-b border-studio-border">
        {Array.from(latestRunByAgent.entries()).map(([type, run]) => (
          <div
            key={type}
            className="flex items-center gap-2 bg-studio-surface2 rounded-lg p-2"
          >
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: AGENT_COLORS[run.agent_type] }}
            />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium text-studio-text truncate">
                {AGENT_LABELS[run.agent_type]}
              </div>
              <AgentStatusBadge status={run.status} />
            </div>
          </div>
        ))}
      </div>

      {/* Event log */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {events.length === 0 ? (
          <div className="text-center text-studio-muted text-xs py-8">
            Waiting for pipeline activity...
          </div>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className="flex items-start gap-2 text-xs animate-slide-up"
            >
              <div
                className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                style={{
                  backgroundColor: event.agent_type
                    ? AGENT_COLORS[event.agent_type]
                    : "#6B7280",
                }}
              />
              <div className="flex-1 min-w-0">
                <span className="text-studio-text-dim">{event.message}</span>
                <div className="flex items-center gap-2 mt-0.5">
                  {event.agent_type && (
                    <span className="font-mono text-studio-muted">
                      {AGENT_LABELS[event.agent_type]}
                    </span>
                  )}
                  <span className="font-mono text-studio-muted ml-auto">
                    {timeAgo(event.created_at)}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
