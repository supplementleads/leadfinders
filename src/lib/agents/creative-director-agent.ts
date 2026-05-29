import { BaseAgent, AgentRunResult } from "./base-agent";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { AgentType, ProjectContext, CreativeDirectorOutput } from "@/lib/types";

export class CreativeDirectorAgent extends BaseAgent<CreativeDirectorOutput> {
  readonly agentType: AgentType = "creative_director";

  readonly systemPrompt = `You are a world-class Creative Director and Cinematographer with credits at top-tier agencies.

Your role is to define the complete visual identity and cinematic language for a production.

You establish:
- Visual style and aesthetic direction
- Cinematography language (lens choices, camera movements, shot composition)
- Color palette with precise hex values and usage rules
- Lighting strategy and mood
- Cinematic references (films, directors, visual movements)
- Moodboard prompts for AI image generation
- Brand coherence guidelines

Style principles:
- Every visual choice serves the story and brand
- Color tells an emotional story
- Lighting creates the psychological world
- Camera movement expresses character psychology
- References should be specific, not generic

Always respond with valid JSON matching the CreativeDirectorOutput schema.`;

  async execute(context: ProjectContext): Promise<AgentRunResult<CreativeDirectorOutput>> {
    const { input, screenwriter_output } = context;
    const start = Date.now();

    const prompt = `Define the complete visual identity for:

BRAND: ${input.brand_name}
BRAND IDENTITY: ${input.brand_identity}
PRODUCT: ${input.product_name}
DESIRED EMOTION: ${input.desired_emotion}
PLATFORM: ${input.platform}
REFERENCE STYLES: ${input.reference_styles.join(", ")}
COLOR PALETTE HINTS: ${input.color_palette.join(", ")}

${screenwriter_output ? `STORY CONCEPT: ${screenwriter_output.story_concept}` : ""}
${screenwriter_output ? `LOGLINE: ${screenwriter_output.logline}` : ""}

Define a cinematic visual direction including:
1. Visual style (aesthetic movement, influences)
2. Cinematography style (lens language, shot types, movement vocabulary)
3. Color palette (4-6 colors with hex, name, and usage)
4. Lighting strategy (key light quality, shadows, time of day mood)
5. Camera language (signature moves, forbidden moves)
6. 3-4 specific cinematic references
7. 5-8 moodboard prompt descriptions for AI image generation
8. Brand guidelines (primary/secondary colors, typography, forbidden elements)

Return as JSON:
\`\`\`json
{
  "visual_style": "...",
  "cinematography_style": "...",
  "color_palette": [{"name": "...", "hex": "#...", "usage": "..."}],
  "lighting_strategy": "...",
  "camera_language": "...",
  "cinematic_refs": [{"title": "...", "director": "...", "reason": "..."}],
  "moodboard_prompts": ["detailed visual prompt 1", "..."],
  "brand_guidelines": {"primary_color": "#...", "secondary_color": "#...", "typography": "...", "tone": "...", "forbidden_elements": ["..."]},
  "do_list": ["..."],
  "dont_list": ["..."]
}
\`\`\``;

    const { text, usage } = await this.callClaude(prompt, 5000);
    const output = this.parseJSON<CreativeDirectorOutput>(text);

    const db = createServiceRoleClient();
    await db.from("creative_directions").insert({
      project_id: context.project.id,
      visual_style: output.visual_style,
      cinematography: output.cinematography_style,
      color_palette: output.color_palette,
      lighting_strategy: output.lighting_strategy,
      camera_language: output.camera_language,
      cinematic_refs: output.cinematic_refs,
      moodboard_prompts: output.moodboard_prompts,
      brand_guidelines: output.brand_guidelines,
    });

    return {
      success: true,
      output,
      reasoning: `Established visual identity with ${output.color_palette?.length ?? 0} colors, ${output.cinematic_refs?.length ?? 0} cinematic references, and ${output.moodboard_prompts?.length ?? 0} moodboard prompts.`,
      duration_ms: Date.now() - start,
      token_usage: {
        prompt_tokens: usage.promptTokens,
        completion_tokens: usage.completionTokens,
        total_tokens: usage.totalTokens,
      },
    };
  }
}
