"use client";

import { useState } from "react";
import type { ShotListEntry } from "@/lib/types";

interface ShotListManagerProps {
  shots: ShotListEntry[];
}

export function ShotListManager({ shots }: ShotListManagerProps) {
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = shots.filter(
    (s) =>
      !filter ||
      s.shot_number.toLowerCase().includes(filter.toLowerCase()) ||
      s.shot_type.toLowerCase().includes(filter.toLowerCase()) ||
      s.framing.toLowerCase().includes(filter.toLowerCase()) ||
      s.action.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-studio-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-studio-text">
            Shot List
            <span className="ml-2 text-xs font-mono text-studio-muted">
              {shots.length} shots
            </span>
          </h2>
        </div>
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter shots..."
          className="w-full bg-studio-surface2 border border-studio-border rounded-lg px-3 py-2 text-xs text-studio-text placeholder-studio-muted focus:outline-none focus:border-studio-amber/40"
        />
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-studio-border text-xs font-mono text-studio-muted bg-studio-surface">
        <div className="col-span-1">#</div>
        <div className="col-span-2">TYPE</div>
        <div className="col-span-1">LENS</div>
        <div className="col-span-2">MOVE</div>
        <div className="col-span-4">ACTION</div>
        <div className="col-span-1">DUR</div>
        <div className="col-span-1">TRANS</div>
      </div>

      {/* Shot rows */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-center text-studio-muted text-sm py-16">
            {shots.length === 0
              ? "No shots yet. Run the pipeline to generate the shot list."
              : "No shots match your filter."}
          </div>
        ) : (
          filtered.map((shot) => (
            <div key={shot.id}>
              <div
                onClick={() => setExpanded(expanded === shot.id ? null : shot.id)}
                className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-studio-border/50 cursor-pointer hover:bg-studio-surface2 transition-colors"
              >
                <div className="col-span-1 font-mono text-xs font-bold text-studio-amber">
                  {shot.shot_number}
                </div>
                <div className="col-span-2 font-mono text-xs text-studio-cyan">
                  {shot.shot_type}
                </div>
                <div className="col-span-1 font-mono text-xs text-studio-text-dim">
                  {shot.lens_mm ? `${shot.lens_mm}mm` : "—"}
                </div>
                <div className="col-span-2 text-xs text-studio-purple truncate">
                  {shot.movement}
                </div>
                <div className="col-span-4 text-xs text-studio-text truncate">
                  {shot.action}
                </div>
                <div className="col-span-1 font-mono text-xs text-studio-text-dim">
                  {shot.duration_sec ? `${shot.duration_sec}s` : "—"}
                </div>
                <div className="col-span-1 text-xs text-studio-muted truncate">
                  {shot.transition ?? "cut"}
                </div>
              </div>

              {expanded === shot.id && (
                <div className="px-4 py-3 bg-studio-surface2 border-b border-studio-border animate-slide-up">
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <div className="font-mono text-studio-muted mb-1">FRAMING</div>
                      <p className="text-studio-text-dim leading-relaxed">{shot.framing}</p>
                    </div>
                    <div>
                      <div className="font-mono text-studio-muted mb-1">TECHNICAL NOTES</div>
                      <p className="text-studio-text-dim leading-relaxed">{shot.technical_notes ?? "—"}</p>
                    </div>
                    {shot.dialogue && (
                      <div>
                        <div className="font-mono text-studio-muted mb-1">DIALOGUE</div>
                        <p className="text-studio-text-dim italic">{shot.dialogue}</p>
                      </div>
                    )}
                    {shot.sfx && (
                      <div>
                        <div className="font-mono text-studio-muted mb-1">SFX</div>
                        <p className="text-studio-text-dim">{shot.sfx}</p>
                      </div>
                    )}
                    <div>
                      <div className="font-mono text-studio-muted mb-1">APERTURE</div>
                      <p className="text-studio-text-dim">{shot.aperture ?? "—"}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
