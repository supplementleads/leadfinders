// ============================================================
// CINEMATIC STUDIO — SHARED TYPES
// ============================================================

export type AgentType =
  | "orchestrator"
  | "screenwriter"
  | "creative_director"
  | "storyboard"
  | "production_planner"
  | "shot_list"
  | "music_sound"
  | "video_generation"
  | "quality_control"
  | "editor";

export type AgentStatus =
  | "idle"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "awaiting_approval";

export type PipelineStatus =
  | "draft"
  | "running"
  | "paused"
  | "awaiting_approval"
  | "completed"
  | "failed";

export type SceneStatus =
  | "pending"
  | "generating"
  | "generated"
  | "approved"
  | "rejected"
  | "regenerating";

export type PlatformType =
  | "tiktok"
  | "instagram_reels"
  | "instagram_feed"
  | "youtube"
  | "youtube_shorts"
  | "tvc"
  | "cinema";

export type JobType =
  | "GENERATE_SCENE"
  | "REGENERATE_SCENE"
  | "RUN_QC"
  | "EXPORT_FINAL"
  | "RUN_AGENT";

export type JobStatus = "pending" | "processing" | "completed" | "failed" | "dead_letter";

export type EventType =
  | "agent_started"
  | "agent_completed"
  | "agent_failed"
  | "scene_generated"
  | "qc_scored"
  | "revision_requested"
  | "approval_needed"
  | "pipeline_started"
  | "pipeline_completed"
  | "pipeline_failed"
  | "pipeline_paused";

// ============================================================
// DATABASE ROW TYPES
// ============================================================

export interface Project {
  id: string;
  name: string;
  status: PipelineStatus;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  autonomous: boolean;
  metadata: Record<string, unknown>;
}

export interface ProjectInput {
  id: string;
  project_id: string;
  product_name: string;
  product_description: string;
  brand_name: string;
  brand_identity: string;
  target_audience: string;
  desired_emotion: string;
  platform: PlatformType;
  video_duration_sec: number;
  reference_styles: string[];
  color_palette: string[];
  additional_notes?: string;
  created_at: string;
}

export interface AgentRun {
  id: string;
  project_id: string;
  agent_type: AgentType;
  status: AgentStatus;
  attempt: number;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  input_data?: Record<string, unknown>;
  output_data?: Record<string, unknown>;
  reasoning?: string;
  error_message?: string;
  token_usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  quality_score?: number;
  created_at: string;
}

export interface Scene {
  id: string;
  project_id: string;
  scene_number: number;
  title: string;
  description: string;
  duration_sec: number;
  status: SceneStatus;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  created_at: string;
}

export interface StoryboardFrame {
  id: string;
  scene_id: string;
  project_id: string;
  frame_number: number;
  shot_type: string;
  composition: string;
  action: string;
  camera_movement: string;
  transition?: string;
  visual_prompt: string;
  duration_sec: number;
  created_at: string;
}

export interface ShotListEntry {
  id: string;
  project_id: string;
  scene_id?: string;
  shot_number: string;
  shot_type: string;
  lens_mm?: number;
  aperture?: string;
  movement: string;
  framing: string;
  action: string;
  dialogue?: string;
  sfx?: string;
  duration_sec?: number;
  transition?: string;
  technical_notes?: string;
  created_at: string;
}

export interface MusicDirection {
  id: string;
  project_id: string;
  agent_run_id?: string;
  genre: string;
  tempo_bpm?: number;
  mood: string;
  instruments: string[];
  music_prompt: string;
  sound_cues: SoundCue[];
  audio_pacing_map: AudioPacingEntry[];
  vo_timing: VOTimingEntry[];
  created_at: string;
}

export interface VideoGeneration {
  id: string;
  project_id: string;
  scene_id: string;
  agent_run_id?: string;
  provider: "luma" | "veo" | "runway" | "kling" | "sora";
  prompt: string;
  negative_prompt?: string;
  model_params: Record<string, unknown>;
  video_url?: string;
  thumbnail_url?: string;
  duration_sec?: number;
  attempt: number;
  status: string;
  error_message?: string;
  created_at: string;
}

export interface QualityScore {
  id: string;
  project_id: string;
  scene_id?: string;
  agent_run_id?: string;
  overall_score: number;
  composition_score?: number;
  continuity_score?: number;
  pacing_score?: number;
  brand_score?: number;
  anatomy_score?: number;
  passed: boolean;
  rejection_reasons: RejectionReason[];
  suggestions: string[];
  created_at: string;
}

export interface GenerationJob {
  id: string;
  project_id: string;
  job_type: JobType;
  job_status: JobStatus;
  priority: number;
  payload: Record<string, unknown>;
  result?: Record<string, unknown>;
  error_message?: string;
  attempt: number;
  max_attempts: number;
  scheduled_at: string;
  started_at?: string;
  completed_at?: string;
  locked_until?: string;
  locked_by?: string;
  created_at: string;
}

export interface StudioEvent {
  id: string;
  project_id: string;
  event_type: EventType;
  agent_type?: AgentType;
  scene_id?: string;
  payload: Record<string, unknown>;
  message?: string;
  created_at: string;
}

// ============================================================
// AGENT OUTPUT TYPES
// ============================================================

export interface EmotionalArcPoint {
  timestamp_sec: number;
  emotion: string;
  intensity: number;
  description: string;
}

export interface NarrativeBeat {
  beat: string;
  description: string;
  timestamp_sec: number;
  visual_cue: string;
}

export interface ScreenwriterOutput {
  story_concept: string;
  logline: string;
  emotional_arc: EmotionalArcPoint[];
  narrative_beats: NarrativeBeat[];
  voiceover_script: string;
  scenes: SceneDraft[];
  platform_adaptations?: Record<string, string>;
}

export interface SceneDraft {
  scene_number: number;
  title: string;
  description: string;
  duration_sec: number;
  visual_description: string;
  dialogue?: string;
  action: string;
}

export interface CinematicReference {
  title: string;
  director: string;
  reason: string;
}

export interface CreativeDirectorOutput {
  visual_style: string;
  cinematography_style: string;
  color_palette: ColorEntry[];
  lighting_strategy: string;
  camera_language: string;
  cinematic_refs: CinematicReference[];
  moodboard_prompts: string[];
  brand_guidelines: BrandGuidelines;
  do_list: string[];
  dont_list: string[];
}

export interface ColorEntry {
  name: string;
  hex: string;
  usage: string;
}

export interface BrandGuidelines {
  primary_color: string;
  secondary_color: string;
  typography: string;
  tone: string;
  forbidden_elements: string[];
}

export interface StoryboardOutput {
  frames: StoryboardFrameDraft[];
  scene_timing: Record<number, number>;
  composition_notes: string;
}

export interface StoryboardFrameDraft {
  scene_number: number;
  frame_number: number;
  shot_type: string;
  composition: string;
  action: string;
  camera_movement: string;
  transition?: string;
  visual_prompt: string;
  duration_sec: number;
}

export interface ProductionPlanOutput {
  timeline: TimelinePhase[];
  dependency_graph: Record<string, string[]>;
  total_duration_sec: number;
  render_order: number[];
  asset_manifest: AssetManifestEntry[];
}

export interface TimelinePhase {
  phase: string;
  start_sec: number;
  end_sec: number;
  scenes: number[];
  parallel: boolean;
}

export interface AssetManifestEntry {
  asset_id: string;
  type: string;
  description: string;
  required_by: number[];
  status: string;
}

export interface ShotListOutput {
  shots: ShotDraft[];
  total_shots: number;
  total_duration_sec: number;
}

export interface ShotDraft {
  shot_number: string;
  scene_number: number;
  shot_type: string;
  lens_mm: number;
  aperture: string;
  movement: string;
  framing: string;
  action: string;
  dialogue?: string;
  sfx?: string;
  duration_sec: number;
  transition: string;
  technical_notes: string;
}

export interface SoundCue {
  time_sec: number;
  description: string;
  type: "sfx" | "music" | "ambient" | "voiceover";
  intensity: number;
}

export interface AudioPacingEntry {
  time_sec: number;
  energy_level: number;
  description: string;
}

export interface VOTimingEntry {
  start_sec: number;
  end_sec: number;
  text: string;
  emotion: string;
}

export interface MusicSoundOutput {
  genre: string;
  tempo_bpm: number;
  mood: string;
  instruments: string[];
  music_prompt: string;
  sound_cues: SoundCue[];
  audio_pacing_map: AudioPacingEntry[];
  vo_timing: VOTimingEntry[];
  sync_points: SyncPoint[];
}

export interface SyncPoint {
  time_sec: number;
  event: string;
  audio_action: string;
}

export interface VideoGenerationOutput {
  scenes: VideoScenePrompt[];
  continuity_notes: string;
  provider_recommendation: string;
}

export interface VideoScenePrompt {
  scene_number: number;
  prompt: string;
  negative_prompt: string;
  model_params: Record<string, unknown>;
  duration_sec: number;
  provider: string;
}

export interface RejectionReason {
  category: string;
  description: string;
  severity: "low" | "medium" | "high";
}

export interface QualityControlOutput {
  overall_score: number;
  composition_score: number;
  continuity_score: number;
  pacing_score: number;
  brand_score: number;
  anatomy_score: number;
  passed: boolean;
  rejection_reasons: RejectionReason[];
  suggestions: string[];
  per_scene_scores: PerSceneScore[];
}

export interface PerSceneScore {
  scene_number: number;
  score: number;
  passed: boolean;
  issues: string[];
}

export interface TimelineClip {
  clip_id: string;
  scene_number: number;
  start_sec: number;
  end_sec: number;
  video_url?: string;
  transition_in: string;
  transition_out: string;
  audio_gain: number;
}

export interface SocialCutdown {
  platform: PlatformType;
  duration_sec: number;
  scenes: number[];
  hook: string;
  caption_suggestion: string;
}

export interface EditorOutput {
  final_timeline: TimelineClip[];
  social_cutdowns: SocialCutdown[];
  alt_hooks: AltHook[];
  export_manifest: ExportManifest;
  total_duration: number;
}

export interface AltHook {
  version: string;
  opening_scene: number;
  hook_text: string;
  rationale: string;
}

export interface ExportManifest {
  master_file: string;
  formats: ExportFormat[];
}

export interface ExportFormat {
  platform: PlatformType;
  resolution: string;
  fps: number;
  codec: string;
  duration_sec: number;
  file_suffix: string;
}

// ============================================================
// PIPELINE STATE
// ============================================================

export type PipelineStage =
  | "INIT"
  | "CREATIVE_PARALLEL"
  | "STORYBOARD"
  | "PRODUCTION_PARALLEL"
  | "VIDEO_GENERATION"
  | "QUALITY_CONTROL"
  | "QC_REVISION"
  | "EDITING"
  | "APPROVAL"
  | "COMPLETE"
  | "FAILED";

export interface PipelineState {
  project_id: string;
  current_stage: PipelineStage;
  completed_stages: PipelineStage[];
  failed_agents: AgentType[];
  qc_revision_count: number;
  max_qc_revisions: number;
  autonomous: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectContext {
  project: Project;
  input: ProjectInput;
  pipeline_state: PipelineState;
  screenwriter_output?: ScreenwriterOutput;
  creative_direction?: CreativeDirectorOutput;
  storyboard_output?: StoryboardOutput;
  production_plan?: ProductionPlanOutput;
  shot_list?: ShotListOutput;
  music_direction?: MusicSoundOutput;
  video_output?: VideoGenerationOutput;
  qc_output?: QualityControlOutput;
  editor_output?: EditorOutput;
}

// ============================================================
// API TYPES
// ============================================================

export interface CreateProjectRequest {
  name: string;
  input: Omit<ProjectInput, "id" | "project_id" | "created_at">;
  autonomous?: boolean;
}

export interface ApproveSceneRequest {
  scene_id: string;
  action: "approve" | "reject";
  rejection_reason?: string;
}

export interface RunAgentRequest {
  agent_type: AgentType;
  force_rerun?: boolean;
}

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================
// UI STATE TYPES
// ============================================================

export interface AgentNode {
  id: AgentType;
  label: string;
  status: AgentStatus;
  x: number;
  y: number;
  dependencies: AgentType[];
}

export interface WorkflowEdge {
  from: AgentType;
  to: AgentType;
}

export const AGENT_LABELS: Record<AgentType, string> = {
  orchestrator: "Orchestrator",
  screenwriter: "Screenwriter",
  creative_director: "Creative Director",
  storyboard: "Storyboard",
  production_planner: "Production Planner",
  shot_list: "Shot List",
  music_sound: "Music & Sound",
  video_generation: "Video Generation",
  quality_control: "Quality Control",
  editor: "Editor",
};

export const AGENT_COLORS: Record<AgentType, string> = {
  orchestrator: "#F59E0B",
  screenwriter: "#8B5CF6",
  creative_director: "#EC4899",
  storyboard: "#06B6D4",
  production_planner: "#10B981",
  shot_list: "#3B82F6",
  music_sound: "#F97316",
  video_generation: "#EF4444",
  quality_control: "#14B8A6",
  editor: "#A855F7",
};

export const QC_THRESHOLD = 70;
