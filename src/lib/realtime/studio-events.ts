import { createClient } from "@/lib/supabase/client";
import type { StudioEvent, AgentRun, Scene, GenerationJob } from "@/lib/types";

export type StudioEventCallback = (event: StudioEvent) => void;
export type AgentRunCallback = (run: AgentRun) => void;
export type SceneCallback = (scene: Scene) => void;
export type JobCallback = (job: GenerationJob) => void;

export class StudioRealtimeChannel {
  private channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;
  private readonly projectId: string;

  constructor(projectId: string) {
    this.projectId = projectId;
  }

  subscribe({
    onEvent,
    onAgentRun,
    onScene,
    onJob,
  }: {
    onEvent?: StudioEventCallback;
    onAgentRun?: AgentRunCallback;
    onScene?: SceneCallback;
    onJob?: JobCallback;
  }) {
    const supabase = createClient();
    this.channel = supabase.channel(`studio:${this.projectId}`);

    if (onEvent) {
      this.channel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "studio_events",
          filter: `project_id=eq.${this.projectId}`,
        },
        (payload) => onEvent(payload.new as StudioEvent)
      );
    }

    if (onAgentRun) {
      this.channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "agent_runs",
          filter: `project_id=eq.${this.projectId}`,
        },
        (payload) => onAgentRun(payload.new as AgentRun)
      );
    }

    if (onScene) {
      this.channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "scenes",
          filter: `project_id=eq.${this.projectId}`,
        },
        (payload) => onScene(payload.new as Scene)
      );
    }

    if (onJob) {
      this.channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "generation_jobs",
          filter: `project_id=eq.${this.projectId}`,
        },
        (payload) => onJob(payload.new as GenerationJob)
      );
    }

    this.channel.subscribe();
    return this;
  }

  unsubscribe() {
    if (this.channel) {
      this.channel.unsubscribe();
      this.channel = null;
    }
  }
}
