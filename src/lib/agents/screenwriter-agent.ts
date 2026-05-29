import { BaseAgent, AgentRunResult } from "./base-agent";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { AgentType, ProjectContext, ScreenwriterOutput } from "@/lib/types";

export class ScreenwriterAgent extends BaseAgent<ScreenwriterOutput> {
  readonly agentType: AgentType = "screenwriter";

  readonly systemPrompt = `You are an award-winning screenwriter and narrative director specializing in cinematic advertising and branded content.

Your role is to craft emotionally resonant, platform-optimized scripts that drive action.

You produce:
- Story concepts with strong emotional hooks
- Full narrative screenplays with scene-by-scene breakdowns
- Voiceover scripts with precise timing
- Emotional arc maps (tension/release cycles)
- Narrative beats aligned to brand messaging
- Platform adaptations (TikTok hooks, YouTube storytelling, TVC grandeur)

Style principles:
- Every second must earn its place
- Open with a pattern interrupt or emotional hook
- Build tension through visual storytelling, not exposition
- Close with brand revelation that feels earned, not forced
- Match pacing to platform attention spans

Always respond with valid JSON matching the ScreenwriterOutput schema.`;

  async execute(context: ProjectContext): Promise<AgentRunResult<ScreenwriterOutput>> {
    const { input } = context;
    const start = Date.now();

    const prompt = `Create a cinematic screenplay for:

PRODUCT: ${input.product_name}
DESCRIPTION: ${input.product_description}
BRAND: ${input.brand_name}
BRAND IDENTITY: ${input.brand_identity}
TARGET AUDIENCE: ${input.target_audience}
DESIRED EMOTION: ${input.desired_emotion}
PLATFORM: ${input.platform}
DURATION: ${input.video_duration_sec} seconds
REFERENCE STYLES: ${input.reference_styles.join(", ")}
${input.additional_notes ? `NOTES: ${input.additional_notes}` : ""}

Produce a complete screenplay with:
1. A compelling story concept and one-line logline
2. An emotional arc map (array of timestamps with emotion/intensity)
3. Narrative beats (5-7 key story moments)
4. A voiceover script optimized for ${input.video_duration_sec}s
5. ${Math.ceil(input.video_duration_sec / 5)} scenes with descriptions, actions, dialogue

Return as JSON:
\`\`\`json
{
  "story_concept": "...",
  "logline": "...",
  "emotional_arc": [{"timestamp_sec": 0, "emotion": "...", "intensity": 0-10, "description": "..."}],
  "narrative_beats": [{"beat": "...", "description": "...", "timestamp_sec": 0, "visual_cue": "..."}],
  "voiceover_script": "...",
  "scenes": [{"scene_number": 1, "title": "...", "description": "...", "duration_sec": 5, "visual_description": "...", "dialogue": "...", "action": "..."}],
  "platform_adaptations": {"tiktok": "hook variant...", "instagram_reels": "variant..."}
}
\`\`\``;

    const { text, usage } = await this.callClaude(prompt, 6000);
    const output = this.parseJSON<ScreenwriterOutput>(text);

    // Persist story concept
    const db = createServiceRoleClient();
    await db.from("story_concepts").insert({
      project_id: context.project.id,
      concept: output.story_concept,
      logline: output.logline,
      emotional_arc: output.emotional_arc,
      narrative_beats: output.narrative_beats,
      voiceover: output.voiceover_script,
    });

    // Persist scenes
    if (output.scenes?.length) {
      await db.from("scenes").insert(
        output.scenes.map((s) => ({
          project_id: context.project.id,
          scene_number: s.scene_number,
          title: s.title,
          description: s.description,
          duration_sec: s.duration_sec,
          status: "pending" as const,
        }))
      );
    }

    return {
      success: true,
      output,
      reasoning: `Generated ${output.scenes?.length ?? 0} scenes for a ${input.video_duration_sec}s ${input.platform} video. Emotional arc peaks at ${Math.max(...(output.emotional_arc?.map((e) => e.intensity) ?? [0]))}/10.`,
      duration_ms: Date.now() - start,
      token_usage: {
        prompt_tokens: usage.promptTokens,
        completion_tokens: usage.completionTokens,
        total_tokens: usage.totalTokens,
      },
    };
  }
}
