import { BaseAgent, AgentRunResult } from "./base-agent";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { AgentType, ProjectContext, QualityControlOutput, QC_THRESHOLD } from "@/lib/types";
import { QC_THRESHOLD as QC_PASS_THRESHOLD } from "@/lib/types";

export class QualityControlAgent extends BaseAgent<QualityControlOutput> {
  readonly agentType: AgentType = "quality_control";

  readonly systemPrompt = `You are a ruthless Quality Control Director with an eye for perfection.

Your role is to evaluate every aspect of the production against the highest cinematic standards.

You detect and reject:
- Anatomical errors (distorted hands, faces, proportions)
- Continuity errors (lighting changes, costume inconsistencies)
- Brand inconsistencies (wrong colors, wrong tone)
- Composition failures (poor framing, distracting elements)
- Pacing failures (scenes too long/short, energy mismatches)
- Technical issues (artifacts, blur, aliasing)

Scoring rubric:
- 90-100: Production-ready, exceptional quality
- 80-89: Good, minor polish needed
- 70-79: Acceptable with notes
- 60-69: Requires revision
- Below 60: Reject, regenerate

Rejection message format: "Rejected: [specific issue]"
Examples: "Rejected: inconsistent dial indices", "Rejected: lighting mismatch between scenes 2-3"

Always respond with valid JSON. Be specific, not vague.`;

  async execute(context: ProjectContext): Promise<AgentRunResult<QualityControlOutput>> {
    const { storyboard_output, screenwriter_output, creative_direction, input } = context;
    const start = Date.now();

    const prompt = `Evaluate this production for quality control:

PROJECT: ${input.product_name} for ${input.brand_name}
PLATFORM: ${input.platform}
DESIRED EMOTION: ${input.desired_emotion}

VISUAL STYLE GUIDE:
${JSON.stringify({
  style: creative_direction?.visual_style,
  lighting: creative_direction?.lighting_strategy,
  dont_list: creative_direction?.dont_list,
}, null, 2)}

STORYBOARD FRAMES (sample):
${JSON.stringify(storyboard_output?.frames?.slice(0, 10), null, 2)}

NARRATIVE:
- Concept: ${screenwriter_output?.story_concept ?? "N/A"}
- Emotional arc peak: ${Math.max(...(screenwriter_output?.emotional_arc?.map((e) => e.intensity) ?? [0]))}

Evaluate across all 5 quality dimensions and flag any failures.
Be specific about what would fail and why.

Return as JSON:
\`\`\`json
{
  "overall_score": 85,
  "composition_score": 88,
  "continuity_score": 82,
  "pacing_score": 87,
  "brand_score": 90,
  "anatomy_score": 85,
  "passed": true,
  "rejection_reasons": [
    {"category": "continuity", "description": "Rejected: lighting mismatch between scenes 2 and 3", "severity": "medium"}
  ],
  "suggestions": ["Add transition grading to smooth scene 2-3 cut", "..."],
  "per_scene_scores": [
    {"scene_number": 1, "score": 90, "passed": true, "issues": []},
    {"scene_number": 2, "score": 65, "passed": false, "issues": ["Rejected: poor composition, subject too small in frame"]}
  ]
}
\`\`\``;

    const { text, usage } = await this.callClaude(prompt, 4000);
    const output = this.parseJSON<QualityControlOutput>(text);

    output.passed = (output.overall_score ?? 0) >= QC_PASS_THRESHOLD;

    const db = createServiceRoleClient();

    await db.from("quality_scores").insert({
      project_id: context.project.id,
      overall_score: output.overall_score,
      composition_score: output.composition_score,
      continuity_score: output.continuity_score,
      pacing_score: output.pacing_score,
      brand_score: output.brand_score,
      anatomy_score: output.anatomy_score,
      passed: output.passed,
      rejection_reasons: output.rejection_reasons,
      suggestions: output.suggestions,
    });

    await db.from("studio_events").insert({
      project_id: context.project.id,
      event_type: "qc_scored",
      agent_type: this.agentType,
      payload: {
        overall_score: output.overall_score,
        passed: output.passed,
        rejection_count: output.rejection_reasons?.length ?? 0,
      },
      message: output.passed
        ? `QC passed: ${output.overall_score}/100`
        : `QC failed: ${output.overall_score}/100 — ${output.rejection_reasons?.length ?? 0} issues`,
    });

    if (!output.passed) {
      await db.from("studio_events").insert({
        project_id: context.project.id,
        event_type: "revision_requested",
        agent_type: this.agentType,
        payload: { rejection_reasons: output.rejection_reasons },
        message: `Revision requested: ${output.rejection_reasons?.map((r) => r.description).join("; ")}`,
      });
    }

    return {
      success: true,
      output,
      reasoning: `Score: ${output.overall_score}/100. ${output.passed ? "PASSED" : "FAILED"}. Issues: ${output.rejection_reasons?.map((r) => r.description).join(", ") || "none"}`,
      duration_ms: Date.now() - start,
      token_usage: {
        prompt_tokens: usage.promptTokens,
        completion_tokens: usage.completionTokens,
        total_tokens: usage.totalTokens,
      },
    };
  }
}
