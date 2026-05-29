import type { PipelineStage, AgentType } from "@/lib/types";

// Pipeline stage transitions
export const STAGE_TRANSITIONS: Record<PipelineStage, PipelineStage[]> = {
  INIT: ["CREATIVE_PARALLEL"],
  CREATIVE_PARALLEL: ["STORYBOARD"],
  STORYBOARD: ["PRODUCTION_PARALLEL"],
  PRODUCTION_PARALLEL: ["VIDEO_GENERATION"],
  VIDEO_GENERATION: ["QUALITY_CONTROL"],
  QUALITY_CONTROL: ["EDITING", "QC_REVISION"],
  QC_REVISION: ["QUALITY_CONTROL"],
  EDITING: ["APPROVAL"],
  APPROVAL: ["COMPLETE"],
  COMPLETE: [],
  FAILED: [],
};

// Agents that run in each stage
export const STAGE_AGENTS: Record<PipelineStage, AgentType[]> = {
  INIT: [],
  CREATIVE_PARALLEL: ["screenwriter", "creative_director"],
  STORYBOARD: ["storyboard"],
  PRODUCTION_PARALLEL: ["production_planner", "shot_list", "music_sound"],
  VIDEO_GENERATION: ["video_generation"],
  QUALITY_CONTROL: ["quality_control"],
  QC_REVISION: ["video_generation"],
  EDITING: ["editor"],
  APPROVAL: [],
  COMPLETE: [],
  FAILED: [],
};

// Stages that can run agents in parallel
export const PARALLEL_STAGES = new Set<PipelineStage>([
  "CREATIVE_PARALLEL",
  "PRODUCTION_PARALLEL",
]);

export function canTransition(
  from: PipelineStage,
  to: PipelineStage
): boolean {
  return STAGE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getNextStage(
  current: PipelineStage,
  qcPassed: boolean
): PipelineStage {
  if (current === "QUALITY_CONTROL") {
    return qcPassed ? "EDITING" : "QC_REVISION";
  }
  const next = STAGE_TRANSITIONS[current];
  return next?.[0] ?? "FAILED";
}
