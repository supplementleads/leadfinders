"use client";

import { useState } from "react";
import { useProjectRealtime } from "@/hooks/use-project-realtime";
import { WorkflowGraph } from "@/components/studio/workflow-graph";
import { AgentActivityFeed } from "@/components/studio/agent-activity-feed";
import { QualityDashboard } from "@/components/studio/quality-dashboard";
import { SceneApproval } from "@/components/studio/scene-approval";
import { AgentChatLog } from "@/components/studio/agent-chat-log";
import { GenerationQueue } from "@/components/studio/generation-queue";
import { Button } from "@/components/ui/button";
import { SceneStatusBadge } from "@/components/ui/badge";
import type {
  Project, ProjectInput, AgentRun, Scene,
  QualityScore, GenerationJob, StudioEvent,
} from "@/lib/types";

type RightTab = "activity" | "qc" | "logs" | "queue";
type CenterTab = "overview" | "scenes" | "approval";

interface StudioViewProps {
  project: Project;
  input: ProjectInput;
  initialAgentRuns: AgentRun[];
  initialScenes: Scene[];
  initialQualityScores: QualityScore[];
  initialJobs: GenerationJob[];
  initialEvents: StudioEvent[];
}

export function StudioView({
  project,
  input,
  initialAgentRuns,
  initialScenes,
  initialQualityScores,
  initialJobs,
  initialEvents,
}: StudioViewProps) {
  const [rightTab, setRightTab] = useState<RightTab>("activity");
  const [centerTab, setCenterTab] = useState<CenterTab>("overview");
  const [launching, setLaunching] = useState(false);

  const rt = useProjectRealtime(project.id);

  // Merge initial data with realtime updates
  const agentRuns = [...rt.agentRuns, ...initialAgentRuns.filter(
    (r) => !rt.agentRuns.find((rr) => rr.id === r.id)
  )];
  const scenes = [...rt.scenes, ...initialScenes.filter(
    (s) => !rt.scenes.find((ss) => ss.id === s.id)
  )];
  const events = [...rt.events, ...initialEvents.filter(
    (e) => !rt.events.find((ee) => ee.id === e.id)
  )];
  const jobs = [...rt.jobs, ...initialJobs.filter(
    (j) => !rt.jobs.find((jj) => jj.id === j.id)
  )];

  async function launchPipeline() {
    setLaunching(true);
    try {
      await fetch(`/api/projects/${project.id}/run`, { method: "POST" });
    } finally {
      setLaunching(false);
    }
  }

  const latestQC = initialQualityScores[0];

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* LEFT PANEL — Workflow Graph */}
      <div className="w-72 flex-shrink-0 border-r border-studio-border flex flex-col bg-studio-surface">
        <div className="p-3 border-b border-studio-border">
          <div className="text-xs font-mono text-studio-muted uppercase tracking-wider mb-2">Pipeline</div>
          <WorkflowGraph agentRuns={agentRuns} />
        </div>

        {/* Pipeline controls */}
        <div className="p-3 space-y-2">
          {(project.status === "draft" || project.status === "failed") && (
            <Button
              variant="primary"
              size="sm"
              className="w-full"
              onClick={launchPipeline}
              disabled={launching}
            >
              {launching ? "Launching..." : "Launch Pipeline"}
            </Button>
          )}
          {project.status === "awaiting_approval" && (
            <div className="text-xs text-studio-purple bg-studio-purple/10 border border-studio-purple/30 rounded-lg p-2 text-center">
              Awaiting your approval
            </div>
          )}
          {project.status === "running" && (
            <div className="flex items-center gap-2 text-xs text-studio-amber">
              <div className="w-1.5 h-1.5 rounded-full bg-studio-amber animate-pulse" />
              Pipeline running...
            </div>
          )}
          {project.status === "completed" && (
            <div className="text-xs text-studio-green bg-studio-green/10 border border-studio-green/30 rounded-lg p-2 text-center">
              ✓ Production complete
            </div>
          )}
        </div>

        {/* Brief summary */}
        {input && (
          <div className="p-3 border-t border-studio-border mt-auto">
            <div className="text-xs font-mono text-studio-muted mb-2">BRIEF</div>
            <div className="space-y-1 text-xs">
              <div className="text-studio-text">{input.product_name}</div>
              <div className="text-studio-muted">{input.platform} · {input.video_duration_sec}s</div>
              <div className="text-studio-amber/70">{input.desired_emotion}</div>
            </div>
          </div>
        )}
      </div>

      {/* CENTER PANEL — Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Center tabs */}
        <div className="flex border-b border-studio-border bg-studio-surface">
          {([
            { key: "overview", label: "Overview" },
            { key: "scenes", label: `Scenes (${scenes.length})` },
            { key: "approval", label: "Approval" },
          ] as { key: CenterTab; label: string }[]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setCenterTab(tab.key)}
              className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                centerTab === tab.key
                  ? "border-studio-amber text-studio-text"
                  : "border-transparent text-studio-muted hover:text-studio-text"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {centerTab === "overview" && (
            <div className="space-y-4 animate-fade-in">
              {/* Pipeline status card */}
              <div className="bg-studio-surface border border-studio-border rounded-xl p-4">
                <div className="text-xs font-mono text-studio-muted mb-3">PIPELINE STATUS</div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <div className="text-xl font-bold font-mono text-studio-text">{agentRuns.filter((r) => r.status === "completed").length}</div>
                    <div className="text-xs text-studio-green">Completed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold font-mono text-studio-amber">{agentRuns.filter((r) => r.status === "running").length}</div>
                    <div className="text-xs text-studio-muted">Running</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold font-mono text-studio-text">{scenes.length}</div>
                    <div className="text-xs text-studio-muted">Scenes</div>
                  </div>
                </div>
              </div>

              {/* QC summary */}
              {latestQC && (
                <div className="bg-studio-surface border border-studio-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-mono text-studio-muted">QUALITY CONTROL</div>
                    <div className={`px-2 py-0.5 rounded text-xs font-mono ${latestQC.passed ? "bg-studio-green/10 text-studio-green" : "bg-studio-red/10 text-studio-red"}`}>
                      {latestQC.passed ? "PASSED" : "FAILED"}
                    </div>
                  </div>
                  <div className="text-3xl font-bold font-mono text-studio-text">
                    {latestQC.overall_score}<span className="text-studio-muted text-lg">/100</span>
                  </div>
                </div>
              )}

              {/* Recent events */}
              <div className="bg-studio-surface border border-studio-border rounded-xl overflow-hidden">
                <div className="p-3 border-b border-studio-border text-xs font-mono text-studio-muted">RECENT ACTIVITY</div>
                <div className="p-3 space-y-2">
                  {events.slice(0, 8).map((e) => (
                    <div key={e.id} className="text-xs text-studio-text-dim py-1 border-b border-studio-border/30 last:border-0">
                      {e.message}
                    </div>
                  ))}
                  {events.length === 0 && (
                    <div className="text-xs text-studio-muted text-center py-4">No activity yet</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {centerTab === "scenes" && (
            <div className="space-y-2 animate-fade-in">
              {scenes.length === 0 ? (
                <div className="text-center text-studio-muted text-sm py-16">
                  Scenes will appear here after the Screenwriter agent runs
                </div>
              ) : (
                scenes.map((scene) => (
                  <div key={scene.id} className="bg-studio-surface border border-studio-border rounded-xl p-4 hover:border-studio-border2 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-studio-amber font-bold">
                          #{scene.scene_number}
                        </span>
                        <SceneStatusBadge status={scene.status} />
                      </div>
                      <span className="text-xs font-mono text-studio-muted">{scene.duration_sec}s</span>
                    </div>
                    <h3 className="text-sm font-semibold text-studio-text mb-1">{scene.title}</h3>
                    <p className="text-xs text-studio-text-dim leading-relaxed">{scene.description}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {centerTab === "approval" && (
            <div className="animate-fade-in">
              <SceneApproval scenes={scenes} projectId={project.id} />
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL — Agent logs, QC, queue */}
      <div className="w-80 flex-shrink-0 border-l border-studio-border flex flex-col bg-studio-surface">
        {/* Right tabs */}
        <div className="flex border-b border-studio-border">
          {([
            { key: "activity", label: "Activity" },
            { key: "qc", label: "QC" },
            { key: "logs", label: "Logs" },
            { key: "queue", label: "Queue" },
          ] as { key: RightTab; label: string }[]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setRightTab(tab.key)}
              className={`flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                rightTab === tab.key
                  ? "border-studio-amber text-studio-text"
                  : "border-transparent text-studio-muted hover:text-studio-text"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {rightTab === "activity" && (
            <AgentActivityFeed events={events} agentRuns={agentRuns} />
          )}
          {rightTab === "qc" && (
            <QualityDashboard scores={initialQualityScores} />
          )}
          {rightTab === "logs" && (
            <AgentChatLog agentRuns={agentRuns} />
          )}
          {rightTab === "queue" && (
            <GenerationQueue jobs={jobs} />
          )}
        </div>
      </div>
    </div>
  );
}
