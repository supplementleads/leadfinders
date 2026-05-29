"use client";

import type { QualityScore } from "@/lib/types";
import { QualityBadge } from "@/components/ui/badge";

interface QualityDashboardProps {
  scores: QualityScore[];
}

function ScoreRing({ score, label, color }: { score: number; label: string; color: string }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-16 h-16">
        <svg viewBox="0 0 72 72" className="w-full h-full -rotate-90">
          <circle
            cx={36} cy={36} r={r}
            fill="none"
            stroke="#2A2A38"
            strokeWidth={5}
          />
          <circle
            cx={36} cy={36} r={r}
            fill="none"
            stroke={color}
            strokeWidth={5}
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="quality-ring"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold font-mono" style={{ color }}>
            {score}
          </span>
        </div>
      </div>
      <span className="text-xs text-studio-muted text-center leading-tight">{label}</span>
    </div>
  );
}

export function QualityDashboard({ scores }: QualityDashboardProps) {
  const latest = scores[0];

  if (!latest) {
    return (
      <div className="text-center text-studio-muted text-xs py-8">
        QC not yet run
      </div>
    );
  }

  const dimensions = [
    { key: "composition_score", label: "Composition", color: "#06B6D4" },
    { key: "continuity_score", label: "Continuity", color: "#8B5CF6" },
    { key: "pacing_score", label: "Pacing", color: "#F59E0B" },
    { key: "brand_score", label: "Brand", color: "#EC4899" },
    { key: "anatomy_score", label: "Anatomy", color: "#10B981" },
  ] as const;

  return (
    <div className="p-4 space-y-4">
      {/* Overall score */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-studio-muted font-mono">OVERALL</div>
          <div className="text-2xl font-bold font-mono mt-0.5">
            <span className={latest.overall_score >= 70 ? "text-studio-green" : "text-studio-red"}>
              {latest.overall_score}
            </span>
            <span className="text-studio-muted text-base">/100</span>
          </div>
        </div>
        <div className={`px-3 py-1.5 rounded-lg text-sm font-bold ${latest.passed ? "bg-studio-green/10 text-studio-green border border-studio-green/30" : "bg-studio-red/10 text-studio-red border border-studio-red/30"}`}>
          {latest.passed ? "PASSED" : "FAILED"}
        </div>
      </div>

      {/* Dimension rings */}
      <div className="grid grid-cols-5 gap-2">
        {dimensions.map((d) => (
          <ScoreRing
            key={d.key}
            score={latest[d.key] ?? 0}
            label={d.label}
            color={d.color}
          />
        ))}
      </div>

      {/* Rejection reasons */}
      {latest.rejection_reasons?.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-mono text-studio-muted">ISSUES</div>
          {latest.rejection_reasons.map((r, i) => (
            <div
              key={i}
              className={`text-xs p-2 rounded border ${
                r.severity === "high"
                  ? "bg-studio-red/10 border-studio-red/30 text-studio-red"
                  : r.severity === "medium"
                  ? "bg-studio-amber/10 border-studio-amber/30 text-studio-amber"
                  : "bg-studio-surface2 border-studio-border text-studio-text-dim"
              }`}
            >
              {r.description}
            </div>
          ))}
        </div>
      )}

      {/* Suggestions */}
      {latest.suggestions?.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-mono text-studio-muted">SUGGESTIONS</div>
          {latest.suggestions.slice(0, 3).map((s, i) => (
            <div key={i} className="text-xs text-studio-text-dim p-2 bg-studio-surface2 rounded border border-studio-border">
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
