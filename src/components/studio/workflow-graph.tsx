"use client";

import { AGENT_LABELS, AGENT_COLORS } from "@/lib/types";
import type { AgentType, AgentStatus, AgentRun } from "@/lib/types";

interface WorkflowGraphProps {
  agentRuns: AgentRun[];
  currentStage?: string;
}

// Graph layout positions (normalized 0-1)
const AGENT_POSITIONS: Record<AgentType, { x: number; y: number }> = {
  orchestrator:      { x: 0.5,  y: 0.05 },
  screenwriter:      { x: 0.25, y: 0.22 },
  creative_director: { x: 0.75, y: 0.22 },
  storyboard:        { x: 0.5,  y: 0.42 },
  production_planner:{ x: 0.15, y: 0.60 },
  shot_list:         { x: 0.5,  y: 0.60 },
  music_sound:       { x: 0.85, y: 0.60 },
  video_generation:  { x: 0.5,  y: 0.75 },
  quality_control:   { x: 0.3,  y: 0.88 },
  editor:            { x: 0.7,  y: 0.88 },
};

const EDGES: Array<[AgentType, AgentType]> = [
  ["orchestrator", "screenwriter"],
  ["orchestrator", "creative_director"],
  ["screenwriter", "storyboard"],
  ["creative_director", "storyboard"],
  ["storyboard", "production_planner"],
  ["storyboard", "shot_list"],
  ["storyboard", "music_sound"],
  ["shot_list", "video_generation"],
  ["music_sound", "video_generation"],
  ["video_generation", "quality_control"],
  ["quality_control", "editor"],
];

const STATUS_COLORS: Record<AgentStatus, string> = {
  idle: "#2A2A38",
  queued: "#92400E",
  running: "#F59E0B",
  completed: "#10B981",
  failed: "#EF4444",
  awaiting_approval: "#8B5CF6",
};

export function WorkflowGraph({ agentRuns }: WorkflowGraphProps) {
  const W = 340;
  const H = 420;

  const agentStatusMap = new Map<AgentType, AgentStatus>();
  for (const run of agentRuns) {
    agentStatusMap.set(run.agent_type, run.status);
  }

  function getPos(type: AgentType) {
    const p = AGENT_POSITIONS[type];
    return { x: p.x * W, y: p.y * H };
  }

  return (
    <div className="w-full aspect-[340/420] relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-full"
        style={{ fontFamily: "'DM Mono', monospace" }}
      >
        {/* Edges */}
        {EDGES.map(([from, to]) => {
          const f = getPos(from);
          const t = getPos(to);
          const fromStatus = agentStatusMap.get(from) ?? "idle";
          const toStatus = agentStatusMap.get(to) ?? "idle";
          const isActive = fromStatus === "completed" || toStatus === "running";
          return (
            <line
              key={`${from}-${to}`}
              x1={f.x} y1={f.y}
              x2={t.x} y2={t.y}
              stroke={isActive ? "#F59E0B" : "#2A2A38"}
              strokeWidth={isActive ? 1.5 : 1}
              strokeDasharray={toStatus === "idle" ? "4 4" : undefined}
              opacity={isActive ? 0.8 : 0.4}
            />
          );
        })}

        {/* Nodes */}
        {(Object.entries(AGENT_POSITIONS) as [AgentType, { x: number; y: number }][]).map(([type, pos]) => {
          const x = pos.x * W;
          const y = pos.y * H;
          const status = agentStatusMap.get(type) ?? "idle";
          const color = STATUS_COLORS[status];
          const agentColor = AGENT_COLORS[type];
          const isRunning = status === "running";
          const label = AGENT_LABELS[type];

          return (
            <g key={type}>
              {isRunning && (
                <circle
                  cx={x} cy={y} r={18}
                  fill="none"
                  stroke={agentColor}
                  strokeWidth={1.5}
                  opacity={0.3}
                >
                  <animate
                    attributeName="r"
                    values="12;22;12"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.4;0;0.4"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}
              <circle
                cx={x} cy={y} r={12}
                fill={color}
                stroke={status !== "idle" ? agentColor : "#383848"}
                strokeWidth={status !== "idle" ? 1.5 : 1}
              />
              {status === "completed" && (
                <path
                  d={`M ${x - 4} ${y} L ${x - 1} ${y + 3} L ${x + 5} ${y - 4}`}
                  fill="none"
                  stroke="#10B981"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              )}
              {status === "running" && (
                <circle cx={x} cy={y} r={3} fill="#F59E0B">
                  <animate
                    attributeName="opacity"
                    values="1;0.3;1"
                    dur="1s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}
              <text
                x={x}
                y={y + 22}
                textAnchor="middle"
                fontSize={8}
                fill={status !== "idle" ? "#F0EFEA" : "#6B7280"}
                fontWeight={status === "running" ? "bold" : "normal"}
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
