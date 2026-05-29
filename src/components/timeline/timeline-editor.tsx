"use client";

import { useRef, useState } from "react";
import type { Scene } from "@/lib/types";
import { SceneStatusBadge } from "@/components/ui/badge";

interface TimelineEditorProps {
  scenes: Scene[];
  totalDuration: number;
}

const SCENE_COLORS = [
  "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4",
  "#10B981", "#3B82F6", "#F97316", "#EF4444",
];

export function TimelineEditor({ scenes, totalDuration }: TimelineEditorProps) {
  const [selectedScene, setSelectedScene] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const total = totalDuration || scenes.reduce((s, c) => s + c.duration_sec, 0) || 30;
  const PX_PER_SEC = 40;
  const totalWidth = total * PX_PER_SEC;

  // Lay out scenes sequentially
  let cursor = 0;
  const laid = scenes.map((s, i) => {
    const startPx = cursor * PX_PER_SEC;
    const widthPx = s.duration_sec * PX_PER_SEC;
    cursor += s.duration_sec;
    return { scene: s, startPx, widthPx, color: SCENE_COLORS[i % SCENE_COLORS.length] };
  });

  function formatTime(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${m}:${s.toString().padStart(2, "0")}.${ms}`;
  }

  return (
    <div className="h-full flex flex-col bg-studio-bg">
      {/* Scene list panel */}
      <div className="flex-shrink-0 p-4 space-y-2 border-b border-studio-border max-h-48 overflow-y-auto">
        <div className="text-xs font-mono text-studio-muted mb-3">SCENES</div>
        {scenes.map((scene, i) => (
          <div
            key={scene.id}
            onClick={() => setSelectedScene(selectedScene === scene.id ? null : scene.id)}
            className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
              selectedScene === scene.id
                ? "bg-studio-surface3 border border-studio-amber/30"
                : "bg-studio-surface2 border border-studio-border hover:border-studio-border2"
            }`}
          >
            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: SCENE_COLORS[i % SCENE_COLORS.length] }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-studio-muted">S{scene.scene_number}</span>
                <span className="text-xs font-medium text-studio-text truncate">{scene.title}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs font-mono text-studio-muted">{scene.duration_sec}s</span>
              <SceneStatusBadge status={scene.status} />
            </div>
          </div>
        ))}
      </div>

      {/* Timeline track */}
      <div className="flex-1 overflow-auto p-4" ref={containerRef}>
        <div className="text-xs font-mono text-studio-muted mb-2">TIMELINE</div>

        {/* Time ruler */}
        <div className="relative mb-2" style={{ width: totalWidth + 40 }}>
          <div className="flex">
            {Array.from({ length: Math.ceil(total) + 1 }, (_, i) => (
              <div key={i} className="flex-shrink-0" style={{ width: PX_PER_SEC }}>
                <div className="h-3 border-l border-studio-border" />
                <div className="text-xs font-mono text-studio-muted ml-1" style={{ fontSize: 9 }}>
                  {formatTime(i)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Video track */}
        <div className="relative h-16 bg-studio-surface rounded-lg border border-studio-border timeline-track overflow-hidden mb-2"
             style={{ width: totalWidth + 40 }}>
          {laid.map(({ scene, startPx, widthPx, color }) => (
            <div
              key={scene.id}
              onClick={() => setSelectedScene(selectedScene === scene.id ? null : scene.id)}
              className="absolute top-1 bottom-1 rounded cursor-pointer border-2 border-transparent transition-all"
              style={{
                left: startPx + 2,
                width: widthPx - 4,
                backgroundColor: color + "20",
                borderColor: selectedScene === scene.id ? color : color + "60",
              }}
            >
              <div className="px-2 py-1 h-full flex flex-col justify-center overflow-hidden">
                <div className="text-xs font-mono font-bold truncate" style={{ color }}>
                  S{scene.scene_number}
                </div>
                {widthPx > 60 && (
                  <div className="text-xs text-studio-text-dim truncate" style={{ fontSize: 9 }}>
                    {scene.title}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Audio track placeholder */}
        <div className="relative h-8 bg-studio-surface rounded-lg border border-studio-border/50 overflow-hidden"
             style={{ width: totalWidth + 40 }}>
          <div className="absolute inset-0 flex items-center px-3">
            <span className="text-xs font-mono text-studio-muted/50">AUDIO — pending music generation</span>
          </div>
          {/* Waveform placeholder */}
          <svg className="absolute inset-0 w-full h-full opacity-20" preserveAspectRatio="none">
            {Array.from({ length: Math.floor(totalWidth / 3) }, (_, i) => (
              <rect
                key={i}
                x={i * 3}
                y={Math.random() * 24 + 4}
                width={2}
                height={Math.random() * 16 + 4}
                fill="#F59E0B"
              />
            ))}
          </svg>
        </div>

        {/* Selected scene detail */}
        {selectedScene && (
          <div className="mt-4 p-3 bg-studio-surface2 rounded-xl border border-studio-border animate-slide-up">
            {(() => {
              const scene = scenes.find((s) => s.id === selectedScene);
              if (!scene) return null;
              return (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-studio-amber">SCENE {scene.scene_number}</span>
                    <SceneStatusBadge status={scene.status} />
                  </div>
                  <div className="text-sm font-medium text-studio-text">{scene.title}</div>
                  <p className="text-xs text-studio-text-dim leading-relaxed">{scene.description}</p>
                  <div className="text-xs font-mono text-studio-muted">Duration: {scene.duration_sec}s</div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
