"use client";

import { useState } from "react";
import { AGENT_LABELS, AGENT_COLORS } from "@/lib/types";
import type { AgentRun } from "@/lib/types";

interface AgentChatLogProps {
  agentRuns: AgentRun[];
}

export function AgentChatLog({ agentRuns }: AgentChatLogProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const sorted = [...agentRuns].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="space-y-2 p-3">
      {sorted.length === 0 ? (
        <div className="text-center text-studio-muted text-xs py-8">
          No agent runs yet
        </div>
      ) : (
        sorted.map((run) => (
          <div
            key={run.id}
            className="bg-studio-surface2 rounded-xl border border-studio-border overflow-hidden"
          >
            <button
              onClick={() => setExpanded(expanded === run.id ? null : run.id)}
              className="w-full flex items-center justify-between p-3 hover:bg-studio-surface3 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: AGENT_COLORS[run.agent_type] }}
                />
                <span className="text-sm font-medium text-studio-text">
                  {AGENT_LABELS[run.agent_type]}
                </span>
                {run.duration_ms && (
                  <span className="text-xs font-mono text-studio-muted">
                    {(run.duration_ms / 1000).toFixed(1)}s
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {run.token_usage && (
                  <span className="text-xs font-mono text-studio-muted">
                    {run.token_usage.total_tokens.toLocaleString()} tok
                  </span>
                )}
                <svg
                  className={`w-3 h-3 text-studio-muted transition-transform ${expanded === run.id ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {expanded === run.id && (
              <div className="border-t border-studio-border p-3 space-y-3">
                {run.reasoning && (
                  <div>
                    <div className="text-xs font-mono text-studio-muted mb-1">REASONING</div>
                    <p className="text-xs text-studio-text-dim leading-relaxed font-mono bg-studio-surface rounded-lg p-2">
                      {run.reasoning}
                    </p>
                  </div>
                )}
                {run.output_data && (
                  <div>
                    <div className="text-xs font-mono text-studio-muted mb-1">OUTPUT PREVIEW</div>
                    <pre className="text-xs text-studio-text-dim font-mono bg-studio-surface rounded-lg p-2 overflow-auto max-h-48 whitespace-pre-wrap">
                      {JSON.stringify(run.output_data, null, 2).slice(0, 800)}
                      {JSON.stringify(run.output_data).length > 800 ? "\n... [truncated]" : ""}
                    </pre>
                  </div>
                )}
                {run.error_message && (
                  <div className="text-xs text-studio-red font-mono bg-studio-red/5 rounded-lg p-2">
                    ERROR: {run.error_message}
                  </div>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
