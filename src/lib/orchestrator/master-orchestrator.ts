import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  ScreenwriterAgent,
  CreativeDirectorAgent,
  StoryboardAgent,
  ProductionPlannerAgent,
  ShotListAgent,
  MusicSoundAgent,
  VideoGenerationAgent,
  QualityControlAgent,
  EditorAgent,
} from "@/lib/agents";
import { getNextStage, STAGE_AGENTS, PARALLEL_STAGES } from "./pipeline-state";
import type {
  ProjectContext,
  PipelineStage,
  AgentType,
  ScreenwriterOutput,
  CreativeDirectorOutput,
  StoryboardOutput,
  ProductionPlanOutput,
  ShotListOutput,
  MusicSoundOutput,
  VideoGenerationOutput,
  QualityControlOutput,
  EditorOutput,
} from "@/lib/types";

export class MasterOrchestrator {
  private readonly maxQCRevisions = 3;

  async run(projectId: string): Promise<void> {
    const db = createServiceRoleClient();

    // Load project and input
    const { data: project } = await db
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (!project) throw new Error(`Project ${projectId} not found`);

    const { data: input } = await db
      .from("project_inputs")
      .select("*")
      .eq("project_id", projectId)
      .single();

    if (!input) throw new Error(`Project input not found for ${projectId}`);

    // Build initial context
    const context: ProjectContext = {
      project,
      input,
      pipeline_state: {
        project_id: projectId,
        current_stage: "INIT",
        completed_stages: [],
        failed_agents: [],
        qc_revision_count: 0,
        max_qc_revisions: this.maxQCRevisions,
        autonomous: project.autonomous,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    };

    // Update project status to running
    await db
      .from("projects")
      .update({ status: "running" })
      .eq("id", projectId);

    await db.from("studio_events").insert({
      project_id: projectId,
      event_type: "pipeline_started",
      payload: { autonomous: project.autonomous },
      message: `Pipeline started for "${project.name}"`,
    });

    try {
      await this.runPipeline(context);
    } catch (err) {
      await db
        .from("projects")
        .update({ status: "failed" })
        .eq("id", projectId);

      await db.from("studio_events").insert({
        project_id: projectId,
        event_type: "pipeline_failed",
        payload: { error: err instanceof Error ? err.message : String(err) },
        message: `Pipeline failed: ${err instanceof Error ? err.message : String(err)}`,
      });

      throw err;
    }
  }

  private async runPipeline(context: ProjectContext): Promise<void> {
    const db = createServiceRoleClient();
    let stage: PipelineStage = "CREATIVE_PARALLEL";

    while (stage !== "COMPLETE" && stage !== "FAILED") {
      context.pipeline_state.current_stage = stage;
      context.pipeline_state.updated_at = new Date().toISOString();

      const agents = STAGE_AGENTS[stage];
      const isParallel = PARALLEL_STAGES.has(stage);

      if (agents.length > 0) {
        if (isParallel) {
          await this.runAgentsParallel(agents, context);
        } else {
          await this.runAgentsSequential(agents, context);
        }
      }

      // Handle approval gate for non-autonomous mode
      if (stage === "EDITING" && !context.pipeline_state.autonomous) {
        await db
          .from("projects")
          .update({ status: "awaiting_approval" })
          .eq("id", context.project.id);

        await db.from("studio_events").insert({
          project_id: context.project.id,
          event_type: "approval_needed",
          payload: { stage },
          message: "Human approval required before finalizing",
        });

        // Pause and wait — the API will resume when approved
        return;
      }

      context.pipeline_state.completed_stages.push(stage);

      const qcPassed = context.qc_output?.passed ?? true;
      const nextStage = getNextStage(stage, qcPassed);

      if (stage === "QC_REVISION") {
        context.pipeline_state.qc_revision_count++;
        if (context.pipeline_state.qc_revision_count >= this.maxQCRevisions) {
          // Force pass after max revisions
          stage = "EDITING";
          continue;
        }
      }

      stage = nextStage;
    }

    if (stage === "COMPLETE") {
      await db
        .from("projects")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", context.project.id);

      await db.from("studio_events").insert({
        project_id: context.project.id,
        event_type: "pipeline_completed",
        payload: {
          stages_completed: context.pipeline_state.completed_stages,
          qc_revisions: context.pipeline_state.qc_revision_count,
        },
        message: `Pipeline completed successfully for "${context.project.name}"`,
      });
    }
  }

  private async runAgentsParallel(
    agentTypes: AgentType[],
    context: ProjectContext
  ): Promise<void> {
    const promises = agentTypes.map((type) =>
      this.runAgent(type, context).catch((err) => {
        context.pipeline_state.failed_agents.push(type);
        console.error(`Agent ${type} failed:`, err);
      })
    );
    await Promise.all(promises);
  }

  private async runAgentsSequential(
    agentTypes: AgentType[],
    context: ProjectContext
  ): Promise<void> {
    for (const type of agentTypes) {
      try {
        await this.runAgent(type, context);
      } catch (err) {
        context.pipeline_state.failed_agents.push(type);
        throw err;
      }
    }
  }

  private async runAgent(type: AgentType, context: ProjectContext): Promise<void> {
    switch (type) {
      case "screenwriter": {
        const agent = new ScreenwriterAgent();
        const result = await agent.run(context);
        if (result.success && result.output) {
          context.screenwriter_output = result.output as ScreenwriterOutput;
        }
        break;
      }
      case "creative_director": {
        const agent = new CreativeDirectorAgent();
        const result = await agent.run(context);
        if (result.success && result.output) {
          context.creative_direction = result.output as CreativeDirectorOutput;
        }
        break;
      }
      case "storyboard": {
        const agent = new StoryboardAgent();
        const result = await agent.run(context);
        if (result.success && result.output) {
          context.storyboard_output = result.output as StoryboardOutput;
        }
        break;
      }
      case "production_planner": {
        const agent = new ProductionPlannerAgent();
        const result = await agent.run(context);
        if (result.success && result.output) {
          context.production_plan = result.output as ProductionPlanOutput;
        }
        break;
      }
      case "shot_list": {
        const agent = new ShotListAgent();
        const result = await agent.run(context);
        if (result.success && result.output) {
          context.shot_list = result.output as ShotListOutput;
        }
        break;
      }
      case "music_sound": {
        const agent = new MusicSoundAgent();
        const result = await agent.run(context);
        if (result.success && result.output) {
          context.music_direction = result.output as MusicSoundOutput;
        }
        break;
      }
      case "video_generation": {
        const agent = new VideoGenerationAgent();
        const result = await agent.run(context);
        if (result.success && result.output) {
          context.video_output = result.output as VideoGenerationOutput;
        }
        break;
      }
      case "quality_control": {
        const agent = new QualityControlAgent();
        const result = await agent.run(context);
        if (result.success && result.output) {
          context.qc_output = result.output as QualityControlOutput;
        }
        break;
      }
      case "editor": {
        const agent = new EditorAgent();
        const result = await agent.run(context);
        if (result.success && result.output) {
          context.editor_output = result.output as EditorOutput;
        }
        break;
      }
    }
  }
}
