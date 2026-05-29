import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { AgentType, APIResponse } from "@/lib/types";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; agentId: string }> }
) {
  const { id, agentId } = await params;
  const agentType = agentId as AgentType;
  const db = createServiceRoleClient();

  // Load project context
  const { data: project } = await db
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (!project) {
    return NextResponse.json<APIResponse>({ success: false, error: "Project not found" }, { status: 404 });
  }

  const { data: input } = await db
    .from("project_inputs")
    .select("*")
    .eq("project_id", id)
    .single();

  if (!input) {
    return NextResponse.json<APIResponse>({ success: false, error: "Project input not found" }, { status: 404 });
  }

  // Load accumulated outputs
  const [
    { data: concepts },
    { data: directions },
    { data: storyboardFrames },
    { data: shotListEntries },
    { data: musicDir },
  ] = await Promise.all([
    db.from("story_concepts").select("*").eq("project_id", id).order("created_at", { ascending: false }).limit(1),
    db.from("creative_directions").select("*").eq("project_id", id).order("created_at", { ascending: false }).limit(1),
    db.from("storyboard_frames").select("*").eq("project_id", id),
    db.from("shot_lists").select("*").eq("project_id", id),
    db.from("music_directions").select("*").eq("project_id", id).order("created_at", { ascending: false }).limit(1),
  ]);

  const context = {
    project,
    input,
    pipeline_state: {
      project_id: id,
      current_stage: "INIT" as const,
      completed_stages: [],
      failed_agents: [],
      qc_revision_count: 0,
      max_qc_revisions: 3,
      autonomous: project.autonomous,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    screenwriter_output: concepts?.[0]
      ? {
          story_concept: concepts[0].concept,
          logline: concepts[0].logline,
          emotional_arc: concepts[0].emotional_arc,
          narrative_beats: concepts[0].narrative_beats,
          voiceover_script: concepts[0].voiceover,
          scenes: [],
        }
      : undefined,
    creative_direction: directions?.[0]
      ? {
          visual_style: directions[0].visual_style,
          cinematography_style: directions[0].cinematography,
          color_palette: directions[0].color_palette,
          lighting_strategy: directions[0].lighting_strategy,
          camera_language: directions[0].camera_language,
          cinematic_refs: directions[0].cinematic_refs,
          moodboard_prompts: directions[0].moodboard_prompts,
          brand_guidelines: directions[0].brand_guidelines,
          do_list: [],
          dont_list: [],
        }
      : undefined,
    storyboard_output: storyboardFrames?.length
      ? { frames: storyboardFrames, scene_timing: {}, composition_notes: "" }
      : undefined,
    shot_list: shotListEntries?.length
      ? { shots: shotListEntries as never, total_shots: shotListEntries.length, total_duration_sec: input.video_duration_sec }
      : undefined,
    music_direction: musicDir?.[0],
  };

  // Dynamically import and run the agent
  const { default: agentModule } = await importAgent(agentType);
  const agent = new agentModule();

  // Fire and return
  agent.run(context as never).catch(console.error);

  return NextResponse.json<APIResponse>(
    { success: true, data: { message: `Agent ${agentType} started` } },
    { status: 202 }
  );
}

async function importAgent(type: AgentType) {
  switch (type) {
    case "screenwriter": return { default: (await import("@/lib/agents/screenwriter-agent")).ScreenwriterAgent };
    case "creative_director": return { default: (await import("@/lib/agents/creative-director-agent")).CreativeDirectorAgent };
    case "storyboard": return { default: (await import("@/lib/agents/storyboard-agent")).StoryboardAgent };
    case "production_planner": return { default: (await import("@/lib/agents/production-planner-agent")).ProductionPlannerAgent };
    case "shot_list": return { default: (await import("@/lib/agents/shot-list-agent")).ShotListAgent };
    case "music_sound": return { default: (await import("@/lib/agents/music-sound-agent")).MusicSoundAgent };
    case "video_generation": return { default: (await import("@/lib/agents/video-generation-agent")).VideoGenerationAgent };
    case "quality_control": return { default: (await import("@/lib/agents/quality-control-agent")).QualityControlAgent };
    case "editor": return { default: (await import("@/lib/agents/editor-agent")).EditorAgent };
    default: throw new Error(`Unknown agent type: ${type}`);
  }
}
