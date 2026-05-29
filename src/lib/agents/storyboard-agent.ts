import { BaseAgent, AgentRunResult } from "./base-agent";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { AgentType, ProjectContext, StoryboardOutput } from "@/lib/types";

export class StoryboardAgent extends BaseAgent<StoryboardOutput> {
  readonly agentType: AgentType = "storyboard";

  readonly systemPrompt = `You are a master storyboard artist and pre-visualization director with experience on major commercial productions.

Your role is to translate screenplays into precise shot-by-shot visual blueprints.

You produce:
- Frame-by-frame visual descriptions
- Shot type specifications (ECU, CU, MCU, MS, WS, EWS, POV, OTS)
- Camera movement notation (static, pan, tilt, dolly, crane, handheld, steadicam)
- Composition rules (rule of thirds, leading lines, negative space)
- Transition specifications
- AI image generation prompts per frame

Principles:
- Every frame must advance story or character
- Use shot size to control emotional proximity
- Camera movement must have intentional meaning
- Transitions serve rhythm and pace
- Always write precise, generatable visual prompts

Always respond with valid JSON.`;

  async execute(context: ProjectContext): Promise<AgentRunResult<StoryboardOutput>> {
    const { screenwriter_output, creative_direction, input } = context;
    if (!screenwriter_output) throw new Error("Screenwriter output required");
    const start = Date.now();

    const prompt = `Create a shot-by-shot storyboard for:

SCENES:
${JSON.stringify(screenwriter_output.scenes, null, 2)}

VISUAL STYLE: ${creative_direction?.visual_style ?? "cinematic, premium"}
CAMERA LANGUAGE: ${creative_direction?.camera_language ?? "dynamic"}
LIGHTING: ${creative_direction?.lighting_strategy ?? "dramatic"}
COLOR PALETTE: ${JSON.stringify(creative_direction?.color_palette?.slice(0, 3) ?? [])}

PLATFORM: ${input.platform}
DURATION: ${input.video_duration_sec}s

For each scene, create 2-4 frames. Each frame must have:
- Shot type (ECU/CU/MCU/MS/WS/EWS/POV/OTS)
- Precise composition description
- Action happening in frame
- Camera movement (static/pan/tilt/dolly/crane/handheld/rack-focus)
- Transition to next frame
- Detailed AI image generation prompt (cinematic photography style)

Return as JSON:
\`\`\`json
{
  "frames": [
    {
      "scene_number": 1,
      "frame_number": 1,
      "shot_type": "ECU",
      "composition": "...",
      "action": "...",
      "camera_movement": "static",
      "transition": "cut",
      "visual_prompt": "hyper-detailed cinematic prompt...",
      "duration_sec": 2.5
    }
  ],
  "scene_timing": {"1": 5, "2": 8},
  "composition_notes": "overall visual strategy..."
}
\`\`\``;

    const { text, usage } = await this.callClaude(prompt, 6000);
    const output = this.parseJSON<StoryboardOutput>(text);

    const db = createServiceRoleClient();

    // Fetch scene IDs
    const { data: scenes } = await db
      .from("scenes")
      .select("id, scene_number")
      .eq("project_id", context.project.id);

    const sceneMap = new Map(scenes?.map((s: { scene_number: number; id: string }) => [s.scene_number, s.id]) ?? []);

    if (output.frames?.length) {
      await db.from("storyboard_frames").insert(
        output.frames.map((f) => ({
          project_id: context.project.id,
          scene_id: sceneMap.get(f.scene_number),
          frame_number: f.frame_number,
          shot_type: f.shot_type,
          composition: f.composition,
          action: f.action,
          camera_movement: f.camera_movement,
          transition: f.transition,
          visual_prompt: f.visual_prompt,
          duration_sec: f.duration_sec,
        }))
      );
    }

    return {
      success: true,
      output,
      reasoning: `Created ${output.frames?.length ?? 0} storyboard frames across ${Object.keys(output.scene_timing ?? {}).length} scenes.`,
      duration_ms: Date.now() - start,
      token_usage: {
        prompt_tokens: usage.promptTokens,
        completion_tokens: usage.completionTokens,
        total_tokens: usage.totalTokens,
      },
    };
  }
}
