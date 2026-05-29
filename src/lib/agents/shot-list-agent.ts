import { BaseAgent, AgentRunResult } from "./base-agent";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { AgentType, ProjectContext, ShotListOutput } from "@/lib/types";

export class ShotListAgent extends BaseAgent<ShotListOutput> {
  readonly agentType: AgentType = "shot_list";

  readonly systemPrompt = `You are a Director of Photography and 1st Assistant Director creating production-ready shot lists.

Your shot lists are the definitive technical blueprint for every frame of the production.

You specify:
- Shot numbers (1A, 1B, 2A etc.)
- Shot types with precise camera setups
- Exact focal lengths (14mm, 24mm, 35mm, 50mm, 85mm, 135mm, 200mm)
- Aperture settings for depth of field control
- Camera movements with speed and rhythm
- Framing descriptions
- Action and dialogue per shot
- SFX and sound design notes
- Transitions between shots
- Technical notes (filters, rigs, special equipment)

Principles:
- Focal length determines emotional distance
- Wide angles create environment/context
- Telephoto creates intimacy and compression
- f/1.4-2.8 for creamy bokeh hero shots
- f/8-11 for technical/product clarity shots

Always respond with valid JSON.`;

  async execute(context: ProjectContext): Promise<AgentRunResult<ShotListOutput>> {
    const { storyboard_output, screenwriter_output, creative_direction, input } = context;
    if (!storyboard_output) throw new Error("Storyboard output required");
    const start = Date.now();

    const prompt = `Create a detailed shot list from this storyboard:

FRAMES:
${JSON.stringify(storyboard_output.frames?.slice(0, 20), null, 2)}

CINEMATOGRAPHY STYLE: ${creative_direction?.cinematography_style ?? "cinematic"}
PLATFORM: ${input.platform}
DURATION: ${input.video_duration_sec}s

For each storyboard frame, create a detailed technical shot entry.

Return as JSON:
\`\`\`json
{
  "shots": [
    {
      "shot_number": "1A",
      "scene_number": 1,
      "shot_type": "ECU",
      "lens_mm": 85,
      "aperture": "f/1.8",
      "movement": "static with micro-dolly push",
      "framing": "extreme close on product label, shallow DOF",
      "action": "Product rotates slowly revealing brand mark",
      "dialogue": null,
      "sfx": "ambient room tone, subtle product sound",
      "duration_sec": 2.5,
      "transition": "cut",
      "technical_notes": "Use macro lens, lock on tripod, 24fps for cinematic look"
    }
  ],
  "total_shots": 0,
  "total_duration_sec": ${input.video_duration_sec}
}
\`\`\``;

    const { text, usage } = await this.callClaude(prompt, 6000);
    const output = this.parseJSON<ShotListOutput>(text);

    const db = createServiceRoleClient();

    const { data: scenes } = await db
      .from("scenes")
      .select("id, scene_number")
      .eq("project_id", context.project.id);

    const sceneMap = new Map(scenes?.map((s: { scene_number: number; id: string }) => [s.scene_number, s.id]) ?? []);

    if (output.shots?.length) {
      await db.from("shot_lists").insert(
        output.shots.map((s) => ({
          project_id: context.project.id,
          scene_id: sceneMap.get(s.scene_number),
          shot_number: s.shot_number,
          shot_type: s.shot_type,
          lens_mm: s.lens_mm,
          aperture: s.aperture,
          movement: s.movement,
          framing: s.framing,
          action: s.action,
          dialogue: s.dialogue,
          sfx: s.sfx,
          duration_sec: s.duration_sec,
          transition: s.transition,
          technical_notes: s.technical_notes,
        }))
      );
    }

    return {
      success: true,
      output,
      reasoning: `Created ${output.total_shots ?? output.shots?.length ?? 0} shots totalling ${output.total_duration_sec}s`,
      duration_ms: Date.now() - start,
      token_usage: {
        prompt_tokens: usage.promptTokens,
        completion_tokens: usage.completionTokens,
        total_tokens: usage.totalTokens,
      },
    };
  }
}
