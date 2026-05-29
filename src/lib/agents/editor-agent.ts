import { BaseAgent, AgentRunResult } from "./base-agent";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { AgentType, ProjectContext, EditorOutput } from "@/lib/types";

export class EditorAgent extends BaseAgent<EditorOutput> {
  readonly agentType: AgentType = "editor";

  readonly systemPrompt = `You are a world-class editor trained on commercial and cinematic productions.

Your role is to assemble the final edit — crafting a viewing experience that maximizes retention and drives emotion.

You produce:
- Final timeline assembly with precise clip ordering
- Pacing optimization (cut rhythm, breath points)
- Transition specifications
- Platform-specific social cutdowns
- Alternative opening hooks for A/B testing
- Retention-optimized versions with re-edit notes

Edit principles:
- Cut on action, not after
- Build rhythm through consistent or deliberate-breaking patterns
- Use L-cuts and J-cuts for audio flow
- Protect the opening 3 seconds on every platform
- End on a held image that lets the message land

Always respond with valid JSON.`;

  async execute(context: ProjectContext): Promise<AgentRunResult<EditorOutput>> {
    const { screenwriter_output, music_direction, qc_output, input } = context;
    if (!screenwriter_output) throw new Error("Screenwriter output required");
    const start = Date.now();

    const prompt = `Assemble the final edit for:

PLATFORM: ${input.platform}
DURATION: ${input.video_duration_sec}s
BRAND: ${input.brand_name}

SCENES:
${JSON.stringify(screenwriter_output.scenes?.map((s) => ({
  scene_number: s.scene_number,
  title: s.title,
  duration: s.duration_sec,
})), null, 2)}

MUSIC: ${music_direction?.genre ?? "TBD"} at ${music_direction?.tempo_bpm ?? 120}BPM
AUDIO PACING:
${JSON.stringify(music_direction?.audio_pacing_map?.slice(0, 6), null, 2)}

QC SUGGESTIONS:
${JSON.stringify(qc_output?.suggestions?.slice(0, 5), null, 2)}

Create:
1. Final timeline assembly
2. Social cutdowns for 3 platforms
3. 2-3 alternate opening hooks
4. Export manifest

Return as JSON:
\`\`\`json
{
  "final_timeline": [
    {"clip_id": "scene_1", "scene_number": 1, "start_sec": 0, "end_sec": 5, "transition_in": "fade", "transition_out": "cut", "audio_gain": 1.0}
  ],
  "social_cutdowns": [
    {"platform": "tiktok", "duration_sec": 15, "scenes": [1, 3, 5], "hook": "opening hook text...", "caption_suggestion": "..."}
  ],
  "alt_hooks": [
    {"version": "A", "opening_scene": 1, "hook_text": "...", "rationale": "..."}
  ],
  "export_manifest": {
    "master_file": "master_${input.product_name}_${input.video_duration_sec}s.mp4",
    "formats": [
      {"platform": "${input.platform}", "resolution": "1920x1080", "fps": 24, "codec": "h264", "duration_sec": ${input.video_duration_sec}, "file_suffix": "_master"}
    ]
  },
  "total_duration": ${input.video_duration_sec}
}
\`\`\``;

    const { text, usage } = await this.callClaude(prompt, 5000);
    const output = this.parseJSON<EditorOutput>(text);

    const db = createServiceRoleClient();
    await db.from("editor_outputs").insert({
      project_id: context.project.id,
      final_timeline: output.final_timeline,
      social_cutdowns: output.social_cutdowns,
      alt_hooks: output.alt_hooks,
      export_manifest: output.export_manifest,
      total_duration: output.total_duration,
    });

    return {
      success: true,
      output,
      reasoning: `Final edit: ${output.final_timeline?.length ?? 0} clips, ${output.social_cutdowns?.length ?? 0} social cutdowns, ${output.alt_hooks?.length ?? 0} alt hooks`,
      duration_ms: Date.now() - start,
      token_usage: {
        prompt_tokens: usage.promptTokens,
        completion_tokens: usage.completionTokens,
        total_tokens: usage.totalTokens,
      },
    };
  }
}
