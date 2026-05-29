"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SceneStatusBadge } from "@/components/ui/badge";
import type { Scene } from "@/lib/types";

interface SceneApprovalProps {
  scenes: Scene[];
  projectId: string;
  onApprove?: (sceneId: string) => void;
  onReject?: (sceneId: string, reason: string) => void;
}

export function SceneApproval({ scenes, projectId, onApprove, onReject }: SceneApprovalProps) {
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  async function handleApprove(scene: Scene) {
    setLoading(scene.id);
    try {
      await fetch(`/api/projects/${projectId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scene_id: scene.id, action: "approve" }),
      });
      onApprove?.(scene.id);
    } finally {
      setLoading(null);
    }
  }

  async function handleReject(sceneId: string) {
    if (!rejectionReason.trim()) return;
    setLoading(sceneId);
    try {
      await fetch(`/api/projects/${projectId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scene_id: sceneId,
          action: "reject",
          rejection_reason: rejectionReason,
        }),
      });
      onReject?.(sceneId, rejectionReason);
      setRejectingId(null);
      setRejectionReason("");
    } finally {
      setLoading(null);
    }
  }

  const pendingScenes = scenes.filter((s) => s.status === "generated");

  if (pendingScenes.length === 0) {
    return (
      <div className="text-center text-studio-muted text-xs py-8">
        No scenes awaiting approval
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pendingScenes.map((scene) => (
        <div key={scene.id} className="bg-studio-surface2 rounded-xl border border-studio-border p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono text-studio-muted">
                  SCENE {scene.scene_number}
                </span>
                <SceneStatusBadge status={scene.status} />
              </div>
              <h3 className="text-sm font-semibold text-studio-text">{scene.title}</h3>
            </div>
          </div>

          <p className="text-xs text-studio-text-dim mb-4 leading-relaxed">
            {scene.description}
          </p>

          {rejectingId === scene.id ? (
            <div className="space-y-2">
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Describe the issue (e.g. 'Rejected: lighting mismatch, too dark compared to scene 1')"
                className="w-full bg-studio-surface border border-studio-border rounded-lg p-2 text-xs text-studio-text placeholder-studio-muted resize-none h-16 focus:outline-none focus:border-studio-red/50"
              />
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleReject(scene.id)}
                  disabled={!rejectionReason.trim() || loading === scene.id}
                >
                  Confirm Reject
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setRejectingId(null); setRejectionReason(""); }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="success"
                size="sm"
                onClick={() => handleApprove(scene)}
                disabled={loading === scene.id}
              >
                {loading === scene.id ? "..." : "Approve"}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setRejectingId(scene.id)}
              >
                Reject
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
