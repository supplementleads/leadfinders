-- ============================================================
-- CINEMATIC STUDIO — DATABASE SCHEMA
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE agent_type AS ENUM (
  'orchestrator',
  'screenwriter',
  'creative_director',
  'storyboard',
  'production_planner',
  'shot_list',
  'music_sound',
  'video_generation',
  'quality_control',
  'editor'
);

CREATE TYPE agent_status AS ENUM (
  'idle',
  'queued',
  'running',
  'completed',
  'failed',
  'awaiting_approval'
);

CREATE TYPE pipeline_status AS ENUM (
  'draft',
  'running',
  'paused',
  'awaiting_approval',
  'completed',
  'failed'
);

CREATE TYPE scene_status AS ENUM (
  'pending',
  'generating',
  'generated',
  'approved',
  'rejected',
  'regenerating'
);

CREATE TYPE job_type AS ENUM (
  'GENERATE_SCENE',
  'REGENERATE_SCENE',
  'RUN_QC',
  'EXPORT_FINAL',
  'RUN_AGENT'
);

CREATE TYPE job_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed',
  'dead_letter'
);

CREATE TYPE platform_type AS ENUM (
  'tiktok',
  'instagram_reels',
  'instagram_feed',
  'youtube',
  'youtube_shorts',
  'tvc',
  'cinema'
);

CREATE TYPE event_type AS ENUM (
  'agent_started',
  'agent_completed',
  'agent_failed',
  'scene_generated',
  'qc_scored',
  'revision_requested',
  'approval_needed',
  'pipeline_started',
  'pipeline_completed',
  'pipeline_failed',
  'pipeline_paused'
);

-- ============================================================
-- PROJECTS
-- ============================================================

CREATE TABLE projects (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  status        pipeline_status NOT NULL DEFAULT 'draft',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,
  autonomous    BOOLEAN NOT NULL DEFAULT FALSE,
  metadata      JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE project_inputs (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id         UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  product_name       TEXT NOT NULL,
  product_description TEXT NOT NULL,
  brand_name         TEXT NOT NULL,
  brand_identity     TEXT NOT NULL,
  target_audience    TEXT NOT NULL,
  desired_emotion    TEXT NOT NULL,
  platform           platform_type NOT NULL DEFAULT 'youtube',
  video_duration_sec INTEGER NOT NULL DEFAULT 30,
  reference_styles   TEXT[] NOT NULL DEFAULT '{}',
  color_palette      TEXT[] NOT NULL DEFAULT '{}',
  additional_notes   TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AGENT RUNS
-- ============================================================

CREATE TABLE agent_runs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  agent_type      agent_type NOT NULL,
  status          agent_status NOT NULL DEFAULT 'idle',
  attempt         INTEGER NOT NULL DEFAULT 1,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  duration_ms     INTEGER,
  input_data      JSONB,
  output_data     JSONB,
  reasoning       TEXT,
  error_message   TEXT,
  token_usage     JSONB,
  quality_score   INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_runs_project ON agent_runs(project_id);
CREATE INDEX idx_agent_runs_status ON agent_runs(status);

-- ============================================================
-- CREATIVE OUTPUTS
-- ============================================================

CREATE TABLE story_concepts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  agent_run_id    UUID REFERENCES agent_runs(id),
  concept         TEXT NOT NULL,
  logline         TEXT NOT NULL,
  emotional_arc   JSONB NOT NULL DEFAULT '[]',
  narrative_beats JSONB NOT NULL DEFAULT '[]',
  voiceover       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE creative_directions (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id         UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  agent_run_id       UUID REFERENCES agent_runs(id),
  visual_style       TEXT NOT NULL,
  cinematography     TEXT NOT NULL,
  color_palette      JSONB NOT NULL DEFAULT '[]',
  lighting_strategy  TEXT NOT NULL,
  camera_language    TEXT NOT NULL,
  cinematic_refs     JSONB NOT NULL DEFAULT '[]',
  moodboard_prompts  JSONB NOT NULL DEFAULT '[]',
  brand_guidelines   JSONB NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SCENES AND STORYBOARDS
-- ============================================================

CREATE TABLE scenes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scene_number    INTEGER NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  duration_sec    NUMERIC(5,2) NOT NULL DEFAULT 3,
  status          scene_status NOT NULL DEFAULT 'pending',
  approved_by     TEXT,
  approved_at     TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, scene_number)
);

CREATE INDEX idx_scenes_project ON scenes(project_id, scene_number);

CREATE TABLE storyboard_frames (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scene_id         UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  frame_number     INTEGER NOT NULL,
  shot_type        TEXT NOT NULL,
  composition      TEXT NOT NULL,
  action           TEXT NOT NULL,
  camera_movement  TEXT NOT NULL,
  transition       TEXT,
  visual_prompt    TEXT NOT NULL,
  duration_sec     NUMERIC(5,2) NOT NULL DEFAULT 2,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_storyboard_project ON storyboard_frames(project_id);
CREATE INDEX idx_storyboard_scene ON storyboard_frames(scene_id);

-- ============================================================
-- SHOT LISTS
-- ============================================================

CREATE TABLE shot_lists (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scene_id        UUID REFERENCES scenes(id) ON DELETE CASCADE,
  shot_number     TEXT NOT NULL,
  shot_type       TEXT NOT NULL,
  lens_mm         INTEGER,
  aperture        TEXT,
  movement        TEXT NOT NULL,
  framing         TEXT NOT NULL,
  action          TEXT NOT NULL,
  dialogue        TEXT,
  sfx             TEXT,
  duration_sec    NUMERIC(5,2),
  transition      TEXT,
  technical_notes TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shot_lists_project ON shot_lists(project_id);

-- ============================================================
-- PRODUCTION PLAN
-- ============================================================

CREATE TABLE production_plans (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id         UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  agent_run_id       UUID REFERENCES agent_runs(id),
  timeline           JSONB NOT NULL DEFAULT '[]',
  dependency_graph   JSONB NOT NULL DEFAULT '{}',
  total_duration_sec INTEGER NOT NULL DEFAULT 0,
  render_order       JSONB NOT NULL DEFAULT '[]',
  asset_manifest     JSONB NOT NULL DEFAULT '[]',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- MUSIC & SOUND
-- ============================================================

CREATE TABLE music_directions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  agent_run_id     UUID REFERENCES agent_runs(id),
  genre            TEXT NOT NULL,
  tempo_bpm        INTEGER,
  mood             TEXT NOT NULL,
  instruments      TEXT[] NOT NULL DEFAULT '{}',
  music_prompt     TEXT NOT NULL,
  sound_cues       JSONB NOT NULL DEFAULT '[]',
  audio_pacing_map JSONB NOT NULL DEFAULT '[]',
  vo_timing        JSONB NOT NULL DEFAULT '[]',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- VIDEO GENERATION
-- ============================================================

CREATE TABLE video_generations (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scene_id         UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  agent_run_id     UUID REFERENCES agent_runs(id),
  provider         TEXT NOT NULL DEFAULT 'luma',
  prompt           TEXT NOT NULL,
  negative_prompt  TEXT,
  model_params     JSONB NOT NULL DEFAULT '{}',
  video_url        TEXT,
  thumbnail_url    TEXT,
  duration_sec     NUMERIC(5,2),
  attempt          INTEGER NOT NULL DEFAULT 1,
  status           TEXT NOT NULL DEFAULT 'pending',
  error_message    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_video_gen_project ON video_generations(project_id);
CREATE INDEX idx_video_gen_scene ON video_generations(scene_id);

-- ============================================================
-- QUALITY CONTROL
-- ============================================================

CREATE TABLE quality_scores (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scene_id          UUID REFERENCES scenes(id) ON DELETE CASCADE,
  agent_run_id      UUID REFERENCES agent_runs(id),
  overall_score     INTEGER NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  composition_score INTEGER CHECK (composition_score BETWEEN 0 AND 100),
  continuity_score  INTEGER CHECK (continuity_score BETWEEN 0 AND 100),
  pacing_score      INTEGER CHECK (pacing_score BETWEEN 0 AND 100),
  brand_score       INTEGER CHECK (brand_score BETWEEN 0 AND 100),
  anatomy_score     INTEGER CHECK (anatomy_score BETWEEN 0 AND 100),
  passed            BOOLEAN NOT NULL DEFAULT FALSE,
  rejection_reasons JSONB NOT NULL DEFAULT '[]',
  suggestions       JSONB NOT NULL DEFAULT '[]',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- REVISION HISTORY
-- ============================================================

CREATE TABLE revision_history (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scene_id        UUID REFERENCES scenes(id) ON DELETE CASCADE,
  agent_type      agent_type NOT NULL,
  revision_number INTEGER NOT NULL DEFAULT 1,
  reason          TEXT NOT NULL,
  previous_output JSONB,
  new_output      JSONB,
  triggered_by    TEXT NOT NULL DEFAULT 'qc',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- EDITOR OUTPUTS
-- ============================================================

CREATE TABLE editor_outputs (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  agent_run_id     UUID REFERENCES agent_runs(id),
  final_timeline   JSONB NOT NULL DEFAULT '[]',
  social_cutdowns  JSONB NOT NULL DEFAULT '[]',
  alt_hooks        JSONB NOT NULL DEFAULT '[]',
  export_manifest  JSONB NOT NULL DEFAULT '{}',
  total_duration   NUMERIC(6,2),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- JOB QUEUE
-- ============================================================

CREATE TABLE generation_jobs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  job_type        job_type NOT NULL,
  job_status      job_status NOT NULL DEFAULT 'pending',
  priority        INTEGER NOT NULL DEFAULT 5,
  payload         JSONB NOT NULL DEFAULT '{}',
  result          JSONB,
  error_message   TEXT,
  attempt         INTEGER NOT NULL DEFAULT 0,
  max_attempts    INTEGER NOT NULL DEFAULT 3,
  scheduled_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  locked_until    TIMESTAMPTZ,
  locked_by       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_jobs_status_priority ON generation_jobs(job_status, priority DESC, scheduled_at ASC);
CREATE INDEX idx_jobs_project ON generation_jobs(project_id);

-- ============================================================
-- REALTIME EVENT LOG
-- ============================================================

CREATE TABLE studio_events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  event_type  event_type NOT NULL,
  agent_type  agent_type,
  scene_id    UUID REFERENCES scenes(id) ON DELETE SET NULL,
  payload     JSONB NOT NULL DEFAULT '{}',
  message     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_project ON studio_events(project_id, created_at DESC);

-- ============================================================
-- REALTIME PUBLICATIONS
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE studio_events;
ALTER PUBLICATION supabase_realtime ADD TABLE agent_runs;
ALTER PUBLICATION supabase_realtime ADD TABLE scenes;
ALTER PUBLICATION supabase_realtime ADD TABLE generation_jobs;

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- QUEUE CLAIM FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION claim_next_job(worker_id TEXT)
RETURNS SETOF generation_jobs AS $$
  UPDATE generation_jobs
  SET
    job_status  = 'processing',
    started_at  = NOW(),
    locked_until = NOW() + INTERVAL '5 minutes',
    locked_by   = worker_id,
    attempt     = attempt + 1
  WHERE id = (
    SELECT id FROM generation_jobs
    WHERE job_status = 'pending'
      AND scheduled_at <= NOW()
      AND (locked_until IS NULL OR locked_until < NOW())
    ORDER BY priority DESC, scheduled_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$ LANGUAGE sql;
