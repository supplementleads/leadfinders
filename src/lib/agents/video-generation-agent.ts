import { BaseAgent, AgentRunResult } from "./base-agent";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { AgentType, ProjectContext, VideoGenerationOutput } from "@/lib/types";

export class VideoGenerationAgent extends BaseAgent<VideoGenerationOutput> {
  readonly agentType: AgentType = "video_generation";

  readonly systemPrompt = `You are a Video Generation Director specializing in AI-native cinematography.

Your role is to craft the definitive generation prompts for each scene that will be submitted to video generation APIs.

You support:
- Luma Dream Machine
- Google Veo
- Runway Gen-3
- Kling
- OpenAI Sora (when available)

You craft:
- Scene-specific generation prompts with full cinematic detail
- Negative prompts to avoid quality issues
- Model-specific parameters per provider
- Continuity notes to maintain visual consistency
- Character consistency instructions

Prompt principles:
- Start with shot type and lens: "ECU, 85mm, f/1.8"
- Include lighting: "golden hour, side-lit, soft shadows"
- Describe motion precisely: "slow dolly push, 2s"
- Add quality markers: "8K, RAW, film grain, Alexa Mini"
- Specify mood: "melancholic, contemplative"

Always respond with valid JSON.`;

  async execute(context: ProjectContext): Promise<AgentRunResult<VideoGenerationOutput>> {
    const { storyboard_output, shot_list, creative_direction, music_direction, input } = context;
    if (!storyboard_output) throw new Error("Storyboard output required");
    const start = Date.now();

    const prompt = `Generate production-ready video prompts for each scene:

STORYBOARD FRAMES:
${JSON.stringify(storyboard_output.frames?.slice(0, 20), null, 2)}

SHOT LIST SAMPLE:
${JSON.stringify(shot_list?.shots?.slice(0, 8), null, 2)}

VISUAL STYLE: ${creative_direction?.visual_style ?? "cinematic, premium"}
LIGHTING: ${creative_direction?.lighting_strategy ?? "dramatic natural light"}
COLOR PALETTE: ${creative_direction?.color_palette?.map((c) => c.hex).join(", ") ?? ""}
PLATFORM: ${input.platform}

For each scene, create a precise video generation prompt with:
- Full cinematic description
- Technical specs (lens, aperture, movement, duration)
- Lighting and color grading direction
- Negative prompt (what to avoid)
- Provider recommendation and params
- Continuity notes for cross-scene consistency

Return as JSON:
\`\`\`json
{
  "scenes": [
    {
      "scene_number": 1,
      "prompt": "Extreme close-up, 85mm lens, f/1.8, golden hour side lighting...",
      "negative_prompt": "blurry, distorted faces, watermark, amateur...",
      "model_params": {"duration": 5, "fps": 24, "aspect_ratio": "16:9", "motion_strength": 0.7},
      "duration_sec": 5,
      "provider": "luma"
    }
  ],
  "continuity_notes": "Maintain consistent warm color grade across all scenes...",
  "provider_recommendation": "luma"
}
\`\`\``;

    const { text, usage } = await this.callClaude(prompt, 6000);
    const output = this.parseJSON<VideoGenerationOutput>(text);

    const db = createServiceRoleClient();

    const { data: scenes } = await db
      .from("scenes")
      .select("id, scene_number")
      .eq("project_id", context.project.id);

    const sceneMap = new Map(scenes?.map((s: { scene_number: number; id: string }) => [s.scene_number, s.id]) ?? []);

    if (output.scenes?.length) {
      await db.from("video_generations").insert(
        output.scenes.map((s) => ({
          project_id: context.project.id,
          scene_id: sceneMap.get(s.scene_number),
          provider: s.provider,
          prompt: s.prompt,
          negative_prompt: s.negative_prompt,
          model_params: s.model_params,
          duration_sec: s.duration_sec,
          status: "pending",
          attempt: 1,
        }))
      );

      // Update scenes to generating status
      for (const s of output.scenes) {
        const sceneId = sceneMap.get(s.scene_number);
        if (sceneId) {
          await db
            .from("scenes")
            .update({ status: "generating" })
            .eq("id", sceneId);
        }
      }
    }

    // Enqueue generation jobs
    if (output.scenes?.length) {
      await db.from("generation_jobs").insert(
        output.scenes.map((s) => ({
          project_id: context.project.id,
          job_type: "GENERATE_SCENE" as const,
          priority: 7,
          payload: {
            scene_number: s.scene_number,
            provider: s.provider,
            prompt: s.prompt,
            model_params: s.model_params,
          },
        }))
      );
    }

    await db.from("studio_events").insert({
      project_id: context.project.id,
      event_type: "scene_generated",
      agent_type: this.agentType,
      payload: {
        scene_count: output.scenes?.length ?? 0,
        provider: output.provider_recommendation,
      },
      message: `${output.scenes?.length ?? 0} video generation prompts queued`,
    });

    return {
      success: true,
      output,
      reasoning: `Generated ${output.scenes?.length ?? 0} scene prompts for ${output.provider_recommendation}. Continuity: ${output.continuity_notes?.substring(0, 100)}...`,
      duration_ms: Date.now() - start,
      token_usage: {
        prompt_tokens: usage.promptTokens,
        completion_tokens: usage.completionTokens,
        total_tokens: usage.totalTokens,
      },
    };
  }
}
