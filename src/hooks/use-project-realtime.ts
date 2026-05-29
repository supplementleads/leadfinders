"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { StudioRealtimeChannel } from "@/lib/realtime/studio-events";
import type { StudioEvent, AgentRun, Scene, GenerationJob } from "@/lib/types";

interface RealtimeState {
  events: StudioEvent[];
  agentRuns: Map<string, AgentRun>;
  scenes: Map<string, Scene>;
  jobs: Map<string, GenerationJob>;
}

export function useProjectRealtime(projectId: string | null) {
  const channelRef = useRef<StudioRealtimeChannel | null>(null);
  const [state, setState] = useState<RealtimeState>({
    events: [],
    agentRuns: new Map(),
    scenes: new Map(),
    jobs: new Map(),
  });

  const addEvent = useCallback((event: StudioEvent) => {
    setState((prev) => ({
      ...prev,
      events: [event, ...prev.events].slice(0, 200),
    }));
  }, []);

  const updateAgentRun = useCallback((run: AgentRun) => {
    setState((prev) => {
      const next = new Map(prev.agentRuns);
      next.set(run.id, run);
      return { ...prev, agentRuns: next };
    });
  }, []);

  const updateScene = useCallback((scene: Scene) => {
    setState((prev) => {
      const next = new Map(prev.scenes);
      next.set(scene.id, scene);
      return { ...prev, scenes: next };
    });
  }, []);

  const updateJob = useCallback((job: GenerationJob) => {
    setState((prev) => {
      const next = new Map(prev.jobs);
      next.set(job.id, job);
      return { ...prev, jobs: next };
    });
  }, []);

  useEffect(() => {
    if (!projectId) return;

    channelRef.current = new StudioRealtimeChannel(projectId).subscribe({
      onEvent: addEvent,
      onAgentRun: updateAgentRun,
      onScene: updateScene,
      onJob: updateJob,
    });

    return () => {
      channelRef.current?.unsubscribe();
      channelRef.current = null;
    };
  }, [projectId, addEvent, updateAgentRun, updateScene, updateJob]);

  return {
    events: state.events,
    agentRuns: Array.from(state.agentRuns.values()),
    scenes: Array.from(state.scenes.values()),
    jobs: Array.from(state.jobs.values()),
  };
}
