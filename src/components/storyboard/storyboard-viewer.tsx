"use client";

import { useState } from "react";
import type { StoryboardFrame, Scene } from "@/lib/types";

interface StoryboardViewerProps {
  frames: StoryboardFrame[];
  scenes: Scene[];
}

function FrameCard({ frame, sceneTitle }: { frame: StoryboardFrame; sceneTitle?: string }) {
  return (
    <div className="bg-studio-surface2 rounded-xl border border-studio-border overflow-hidden group hover:border-studio-amber/30 transition-colors">
      {/* Frame preview area */}
      <div className="aspect-video bg-studio-bg relative scanlines">
        <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center">
          <div className="text-xs font-mono text-studio-amber mb-1">{frame.shot_type}</div>
          <p className="text-xs text-studio-text-dim leading-relaxed line-clamp-3">
            {frame.composition}
          </p>
        </div>
        <div className="absolute bottom-2 right-2 bg-black/60 rounded px-1.5 py-0.5 font-mono text-xs text-studio-text-dim">
          {frame.duration_sec}s
        </div>
        <div className="absolute bottom-2 left-2 bg-black/60 rounded px-1.5 py-0.5 font-mono text-xs text-studio-amber">
          {frame.camera_movement}
        </div>
      </div>

      {/* Frame metadata */}
      <div className="p-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-studio-muted">
            S{frame.scene_id?.slice(-4) ?? "?"} · F{frame.frame_number}
          </span>
          {frame.transition && (
            <span className="text-xs font-mono text-studio-purple">
              → {frame.transition}
            </span>
          )}
        </div>
        <p className="text-xs text-studio-text leading-relaxed line-clamp-2">
          {frame.action}
        </p>
        {sceneTitle && (
          <div className="text-xs text-studio-amber/70 font-medium">{sceneTitle}</div>
        )}
      </div>
    </div>
  );
}

export function StoryboardViewer({ frames, scenes }: StoryboardViewerProps) {
  const [selectedScene, setSelectedScene] = useState<string | null>(null);

  const sceneMap = new Map(scenes.map((s) => [s.id, s]));

  const grouped = new Map<string, StoryboardFrame[]>();
  for (const frame of frames) {
    const key = frame.scene_id ?? "unknown";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(frame);
  }

  const filteredFrames = selectedScene
    ? frames.filter((f) => f.scene_id === selectedScene)
    : frames;

  return (
    <div className="h-full flex flex-col">
      {/* Scene filter */}
      <div className="flex gap-2 p-4 border-b border-studio-border overflow-x-auto">
        <button
          onClick={() => setSelectedScene(null)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            !selectedScene
              ? "bg-studio-amber text-black"
              : "bg-studio-surface2 text-studio-muted hover:text-studio-text border border-studio-border"
          }`}
        >
          All Scenes
        </button>
        {scenes.map((scene) => (
          <button
            key={scene.id}
            onClick={() => setSelectedScene(selectedScene === scene.id ? null : scene.id)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedScene === scene.id
                ? "bg-studio-amber text-black"
                : "bg-studio-surface2 text-studio-muted hover:text-studio-text border border-studio-border"
            }`}
          >
            Scene {scene.scene_number}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredFrames.length === 0 ? (
          <div className="text-center text-studio-muted text-sm py-16">
            No storyboard frames yet. Run the pipeline to generate them.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredFrames
              .sort((a, b) => a.frame_number - b.frame_number)
              .map((frame) => (
                <FrameCard
                  key={frame.id}
                  frame={frame}
                  sceneTitle={sceneMap.get(frame.scene_id)?.title}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
