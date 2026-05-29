import { BaseAgent, AgentRunResult } from "./base-agent";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { AgentType, ProjectContext, ProductionPlanOutput } from "@/lib/types";

export class ProductionPlannerAgent extends BaseAgent<ProductionPlanOutput> {
  readonly agentType: AgentType = "production_planner";

  readonly systemPrompt = `You are a senior AI Production Planner and Line Producer specializing in digital and commercial productions.

Your role is to build precise production plans that optimize for parallel execution and minimal dependencies.

You produce:
- Phase-by-phase production timelines
- Asset dependency graphs
- Render order optimization
- Asset manifests with status tracking

Principles:
- Identify all parallelizable work
- Map hard dependencies explicitly
- Prioritize scenes by narrative weight
- Build in QC buffer time
- Optimize render queue for compute efficiency

Always respond with valid JSON.`;

  async execute(context: ProjectContext): Promise<AgentRunResult<ProductionPlanOutput>> {
    const { screenwriter_output, storyboard_output, input } = context;
    if (!screenwriter_output) throw new Error("Screenwriter output required");
    const start = Date.now();

    const prompt = `Create a production plan for:

SCENES: ${screenwriter_output.scenes?.length ?? 0} scenes
TOTAL DURATION: ${input.video_duration_sec}s
PLATFORM: ${input.platform}

SCENE LIST:
${JSON.stringify(screenwriter_output.scenes?.map((s) => ({ number: s.scene_number, title: s.title, duration: s.duration_sec })), null, 2)}

${storyboard_output ? `STORYBOARD FRAMES: ${storyboard_output.frames?.length ?? 0}` : ""}

Build a production plan with:
1. Timeline phases (creative, storyboard, asset prep, video gen, QC, edit, export)
2. Dependency graph (which scenes/phases depend on others)
3. Optimal render order (start with hero scenes, parallelize where possible)
4. Asset manifest (all assets needed with types and required-by relationships)

Return as JSON:
\`\`\`json
{
  "timeline": [
    {"phase": "Creative Development", "start_sec": 0, "end_sec": 300, "scenes": [], "parallel": true}
  ],
  "dependency_graph": {"scene_2": ["scene_1"], "editing": ["video_gen", "qc"]},
  "total_duration_sec": ${input.video_duration_sec},
  "render_order": [1, 3, 2, 4],
  "asset_manifest": [
    {"asset_id": "...", "type": "video_clip", "description": "...", "required_by": [1, 2], "status": "pending"}
  ]
}
\`\`\``;

    const { text, usage } = await this.callClaude(prompt, 4000);
    const output = this.parseJSON<ProductionPlanOutput>(text);

    const db = createServiceRoleClient();
    await db.from("production_plans").insert({
      project_id: context.project.id,
      timeline: output.timeline,
      dependency_graph: output.dependency_graph,
      total_duration_sec: output.total_duration_sec,
      render_order: output.render_order,
      asset_manifest: output.asset_manifest,
    });

    return {
      success: true,
      output,
      reasoning: `Production plan with ${output.timeline?.length ?? 0} phases, ${output.asset_manifest?.length ?? 0} assets, render order: [${output.render_order?.join(", ")}]`,
      duration_ms: Date.now() - start,
      token_usage: {
        prompt_tokens: usage.promptTokens,
        completion_tokens: usage.completionTokens,
        total_tokens: usage.totalTokens,
      },
    };
  }
}
