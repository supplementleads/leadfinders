"use client";

import type { GenerationJob } from "@/lib/types";

interface GenerationQueueProps {
  jobs: GenerationJob[];
}

const jobTypeLabel: Record<string, string> = {
  GENERATE_SCENE: "Generate Scene",
  REGENERATE_SCENE: "Regenerate Scene",
  RUN_QC: "Quality Control",
  EXPORT_FINAL: "Export Final",
  RUN_AGENT: "Run Agent",
};

const statusStyle: Record<string, string> = {
  pending: "bg-studio-amber/10 text-studio-amber",
  processing: "bg-studio-cyan/10 text-studio-cyan animate-pulse",
  completed: "bg-studio-green/10 text-studio-green",
  failed: "bg-studio-red/10 text-studio-red",
  dead_letter: "bg-studio-red/5 text-studio-red/60",
};

export function GenerationQueue({ jobs }: GenerationQueueProps) {
  const active = jobs.filter((j) => j.job_status === "processing");
  const pending = jobs.filter((j) => j.job_status === "pending");
  const recent = jobs
    .filter((j) => j.job_status === "completed" || j.job_status === "failed")
    .slice(0, 5);

  const stats = {
    pending: pending.length,
    processing: active.length,
    completed: jobs.filter((j) => j.job_status === "completed").length,
    failed: jobs.filter((j) => j.job_status === "failed" || j.job_status === "dead_letter").length,
  };

  return (
    <div className="p-3 space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2">
        {Object.entries(stats).map(([key, val]) => (
          <div key={key} className="bg-studio-surface2 rounded-lg p-2 text-center">
            <div className="text-lg font-bold font-mono text-studio-text">{val}</div>
            <div className="text-xs text-studio-muted capitalize">{key}</div>
          </div>
        ))}
      </div>

      {/* Active jobs */}
      {active.length > 0 && (
        <div>
          <div className="text-xs font-mono text-studio-muted mb-2">ACTIVE</div>
          <div className="space-y-1.5">
            {active.map((job) => (
              <div key={job.id} className="flex items-center justify-between bg-studio-surface2 rounded-lg px-3 py-2">
                <div>
                  <div className="text-xs font-medium text-studio-text">
                    {jobTypeLabel[job.job_type] ?? job.job_type}
                  </div>
                  <div className="text-xs text-studio-muted font-mono">
                    attempt {job.attempt}/{job.max_attempts}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-studio-cyan animate-pulse" />
                  <span className="text-xs text-studio-cyan font-mono">processing</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending jobs */}
      {pending.length > 0 && (
        <div>
          <div className="text-xs font-mono text-studio-muted mb-2">QUEUED ({pending.length})</div>
          <div className="space-y-1">
            {pending.slice(0, 8).map((job) => (
              <div key={job.id} className="flex items-center justify-between px-3 py-1.5 bg-studio-surface2 rounded-lg">
                <span className="text-xs text-studio-text-dim">
                  {jobTypeLabel[job.job_type] ?? job.job_type}
                </span>
                <span className="text-xs font-mono text-studio-muted">
                  P{job.priority}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent */}
      {recent.length > 0 && (
        <div>
          <div className="text-xs font-mono text-studio-muted mb-2">RECENT</div>
          <div className="space-y-1">
            {recent.map((job) => (
              <div key={job.id} className="flex items-center justify-between px-3 py-1.5 bg-studio-surface2 rounded-lg">
                <span className="text-xs text-studio-text-dim">
                  {jobTypeLabel[job.job_type] ?? job.job_type}
                </span>
                <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${statusStyle[job.job_status] ?? ""}`}>
                  {job.job_status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {jobs.length === 0 && (
        <div className="text-center text-studio-muted text-xs py-6">
          No jobs in queue
        </div>
      )}
    </div>
  );
}
