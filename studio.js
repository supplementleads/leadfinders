#!/usr/bin/env node
/**
 * CINEMATIC STUDIO — Standalone
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... node studio.js
 *   Then open: http://localhost:3333
 *
 * Requires: Node.js 18+ (uses built-in fetch — no npm install needed)
 */

'use strict';

const http  = require('http');
const PORT  = process.env.PORT || 3333;

// ---------------------------------------------------------------------------
// CLAUDE API (raw fetch — zero extra dependencies)
// ---------------------------------------------------------------------------

async function callClaude(system, user, apiKey, maxTokens = 5000) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return {
    text: data.content[0].text,
    usage: data.usage,
  };
}

function parseJSON(text) {
  const m = text.match(/```json\n?([\s\S]*?)\n?```/) ||
            text.match(/(\{[\s\S]*\})/) ||
            text.match(/(\[[\s\S]*\])/);
  return JSON.parse(m ? (m[1] ?? m[0]) : text);
}

// ---------------------------------------------------------------------------
// AGENTS
// ---------------------------------------------------------------------------

const AGENTS = {
  screenwriter: {
    label: 'Screenwriter',
    color: '#8B5CF6',
    system: `You are an award-winning screenwriter specialising in cinematic advertising.
Craft emotionally resonant, platform-optimised scripts. Every second must earn its place.
Always respond with valid JSON only — no prose outside the JSON block.`,
    prompt: (inp) => `Write a cinematic screenplay for:
PRODUCT: ${inp.product_name}
DESCRIPTION: ${inp.product_description}
BRAND: ${inp.brand_name} — ${inp.brand_identity}
AUDIENCE: ${inp.target_audience}
EMOTION: ${inp.desired_emotion}
PLATFORM: ${inp.platform}
DURATION: ${inp.duration}s
REFERENCES: ${inp.references || 'none'}

Return JSON:
\`\`\`json
{
  "story_concept": "...",
  "logline": "...",
  "emotional_arc": [{"sec": 0, "emotion": "...", "intensity": 8}],
  "narrative_beats": [{"beat": "Hook", "sec": 0, "description": "..."}],
  "voiceover_script": "...",
  "scenes": [{"n": 1, "title": "...", "description": "...", "duration_sec": 5, "action": "...", "dialogue": "..."}]
}
\`\`\``,
  },

  creative_director: {
    label: 'Creative Director',
    color: '#EC4899',
    system: `You are a world-class Creative Director defining visual identity for premium productions.
Always respond with valid JSON only.`,
    prompt: (inp, ctx) => `Define the visual identity for:
BRAND: ${inp.brand_name}
PRODUCT: ${inp.product_name}
EMOTION: ${inp.desired_emotion}
STORY: ${ctx.screenwriter?.logline || ''}
REFERENCES: ${inp.references || 'none'}

Return JSON:
\`\`\`json
{
  "visual_style": "...",
  "cinematography": "...",
  "color_palette": [{"name": "...", "hex": "#...", "usage": "..."}],
  "lighting_strategy": "...",
  "camera_language": "...",
  "cinematic_refs": [{"title": "...", "director": "...", "reason": "..."}],
  "moodboard_prompts": ["detailed AI image prompt 1", "..."],
  "do_list": ["..."],
  "dont_list": ["..."]
}
\`\`\``,
  },

  storyboard: {
    label: 'Storyboard',
    color: '#06B6D4',
    system: `You are a master storyboard artist. Translate screenplays into precise shot-by-shot visual blueprints.
Always respond with valid JSON only.`,
    prompt: (inp, ctx) => `Create a storyboard for these scenes:
${JSON.stringify(ctx.screenwriter?.scenes?.slice(0, 8) ?? [], null, 2)}

VISUAL STYLE: ${ctx.creative_director?.visual_style ?? 'cinematic'}
CAMERA: ${ctx.creative_director?.camera_language ?? 'dynamic'}

For each scene create 2–3 frames. Return JSON:
\`\`\`json
{
  "frames": [
    {
      "scene_n": 1,
      "frame_n": 1,
      "shot_type": "ECU",
      "composition": "...",
      "action": "...",
      "camera_movement": "slow dolly push",
      "transition": "cut",
      "visual_prompt": "hyper-detailed cinematic photography prompt...",
      "duration_sec": 2.5
    }
  ],
  "composition_notes": "..."
}
\`\`\``,
  },

  production_planner: {
    label: 'Production Planner',
    color: '#10B981',
    system: `You are a Line Producer building optimised production plans. Always respond with valid JSON only.`,
    prompt: (inp, ctx) => `Build a production plan for ${ctx.screenwriter?.scenes?.length ?? 0} scenes, ${inp.duration}s total.
SCENES: ${JSON.stringify(ctx.screenwriter?.scenes?.map(s => ({ n: s.n, title: s.title, dur: s.duration_sec })) ?? [], null, 2)}

Return JSON:
\`\`\`json
{
  "phases": [{"phase": "Creative", "duration_min": 5, "parallel": true}],
  "render_order": [1, 3, 2],
  "asset_manifest": [{"type": "video_clip", "scene": 1, "description": "...", "status": "pending"}],
  "notes": "..."
}
\`\`\``,
  },

  shot_list: {
    label: 'Shot List',
    color: '#3B82F6',
    system: `You are a Director of Photography creating production-ready shot lists. Always respond with valid JSON only.`,
    prompt: (inp, ctx) => `Create detailed shot list from storyboard:
${JSON.stringify(ctx.storyboard?.frames?.slice(0, 12) ?? [], null, 2)}
CINEMATOGRAPHY: ${ctx.creative_director?.cinematography ?? 'cinematic'}

Return JSON:
\`\`\`json
{
  "shots": [
    {
      "shot_id": "1A",
      "scene_n": 1,
      "shot_type": "ECU",
      "lens_mm": 85,
      "aperture": "f/1.8",
      "movement": "static micro-push",
      "framing": "...",
      "action": "...",
      "sfx": "...",
      "duration_sec": 2.5,
      "transition": "cut",
      "notes": "..."
    }
  ],
  "total_shots": 0
}
\`\`\``,
  },

  music_sound: {
    label: 'Music & Sound',
    color: '#F97316',
    system: `You are a Music Supervisor and Sound Designer for premium commercial productions. Always respond with valid JSON only.`,
    prompt: (inp, ctx) => `Design the complete audio landscape for:
EMOTION: ${inp.desired_emotion}
PLATFORM: ${inp.platform}
DURATION: ${inp.duration}s
VISUAL: ${ctx.creative_director?.visual_style ?? 'cinematic'}
EMOTIONAL ARC: ${JSON.stringify(ctx.screenwriter?.emotional_arc?.slice(0, 6) ?? [])}

Return JSON:
\`\`\`json
{
  "genre": "...",
  "tempo_bpm": 120,
  "mood": "...",
  "instruments": ["..."],
  "music_prompt": "Detailed text-to-music generation prompt...",
  "sound_cues": [{"sec": 0, "type": "sfx", "description": "...", "intensity": 7}],
  "vo_timing": [{"start_sec": 2, "end_sec": 8, "text": "...", "emotion": "calm"}],
  "sync_points": [{"sec": 0, "event": "title reveal", "action": "musical sting"}]
}
\`\`\``,
  },

  video_generation: {
    label: 'Video Generation',
    color: '#EF4444',
    system: `You are a Video Generation Director crafting AI video prompts. Always respond with valid JSON only.`,
    prompt: (inp, ctx) => `Create video generation prompts for each scene:
FRAMES:
${JSON.stringify(ctx.storyboard?.frames?.slice(0, 10) ?? [], null, 2)}
VISUAL STYLE: ${ctx.creative_director?.visual_style ?? 'cinematic'}
LIGHTING: ${ctx.creative_director?.lighting_strategy ?? 'dramatic'}

Return JSON:
\`\`\`json
{
  "scenes": [
    {
      "scene_n": 1,
      "prompt": "ECU, 85mm, f/1.8, golden hour side lighting, slow dolly push...",
      "negative_prompt": "blurry, distorted, watermark, amateur...",
      "params": {"duration_sec": 5, "fps": 24, "aspect_ratio": "16:9", "motion_strength": 0.7},
      "provider": "luma"
    }
  ],
  "continuity_notes": "...",
  "recommended_provider": "luma"
}
\`\`\``,
  },

  quality_control: {
    label: 'Quality Control',
    color: '#14B8A6',
    system: `You are a ruthless Quality Control Director. Score 0–100. Reject below 70.
Be specific: "Rejected: inconsistent lighting between scenes 2-3". Always respond with valid JSON only.`,
    prompt: (inp, ctx) => `Evaluate this production:
BRAND: ${inp.brand_name} | EMOTION: ${inp.desired_emotion}
STYLE GUIDE: ${JSON.stringify({ style: ctx.creative_director?.visual_style, lighting: ctx.creative_director?.lighting_strategy, dont: ctx.creative_director?.dont_list })}
STORY CONCEPT: ${ctx.screenwriter?.story_concept ?? ''}
SCENES: ${ctx.screenwriter?.scenes?.length ?? 0}

Return JSON:
\`\`\`json
{
  "overall_score": 85,
  "composition_score": 88,
  "continuity_score": 82,
  "pacing_score": 87,
  "brand_score": 90,
  "anatomy_score": 85,
  "passed": true,
  "rejection_reasons": [{"category": "continuity", "description": "Rejected: ...", "severity": "medium"}],
  "suggestions": ["..."],
  "per_scene": [{"scene_n": 1, "score": 90, "passed": true, "issues": []}]
}
\`\`\``,
  },

  editor: {
    label: 'Editor',
    color: '#A855F7',
    system: `You are a world-class editor for premium commercial productions. Always respond with valid JSON only.`,
    prompt: (inp, ctx) => `Assemble the final edit:
PLATFORM: ${inp.platform} | DURATION: ${inp.duration}s
SCENES: ${JSON.stringify(ctx.screenwriter?.scenes?.map(s => ({ n: s.n, title: s.title, dur: s.duration_sec })) ?? [])}
MUSIC: ${ctx.music_sound?.genre ?? 'TBD'} @ ${ctx.music_sound?.tempo_bpm ?? 120}BPM
QC SUGGESTIONS: ${JSON.stringify(ctx.quality_control?.suggestions?.slice(0, 3) ?? [])}

Return JSON:
\`\`\`json
{
  "timeline": [{"clip": "scene_1", "scene_n": 1, "start_sec": 0, "end_sec": 5, "transition_in": "fade", "transition_out": "cut"}],
  "social_cutdowns": [
    {"platform": "tiktok", "duration_sec": 15, "scenes": [1, 3], "hook": "...", "caption": "..."}
  ],
  "alt_hooks": [{"version": "A", "opening_scene": 1, "hook_text": "...", "rationale": "..."}],
  "export_formats": [{"platform": "${inp.platform}", "resolution": "1920x1080", "fps": 24, "codec": "h264"}],
  "total_duration_sec": ${inp.duration},
  "edit_notes": "..."
}
\`\`\``,
  },
};

const PIPELINE_ORDER = [
  ['screenwriter', 'creative_director'],   // parallel
  ['storyboard'],
  ['production_planner', 'shot_list', 'music_sound'], // parallel
  ['video_generation'],
  ['quality_control'],
  ['editor'],
];

// ---------------------------------------------------------------------------
// PIPELINE RUNNER (streams SSE events)
// ---------------------------------------------------------------------------

async function runPipeline(input, apiKey, send) {
  const ctx = {};

  send('pipeline_start', { message: `Starting pipeline for "${input.product_name}"`, stages: PIPELINE_ORDER.length });

  for (const stage of PIPELINE_ORDER) {
    // Run stage agents in parallel
    await Promise.all(stage.map(async (agentId) => {
      const agent = AGENTS[agentId];
      send('agent_start', { agent: agentId, label: agent.label, color: agent.color });
      try {
        const prompt = agent.prompt(input, ctx);
        const { text, usage } = await callClaude(agent.system, prompt, apiKey, 5000);
        const output = parseJSON(text);
        ctx[agentId] = output;
        send('agent_complete', {
          agent: agentId,
          label: agent.label,
          output,
          tokens: usage?.output_tokens,
          reasoning: buildReasoning(agentId, output),
        });
      } catch (err) {
        send('agent_error', { agent: agentId, label: agent.label, error: err.message });
        throw err;
      }
    }));
  }

  const qc = ctx.quality_control;
  send('pipeline_complete', {
    message: 'Pipeline complete!',
    qc_score: qc?.overall_score,
    qc_passed: qc?.passed,
    outputs: ctx,
  });

  return ctx;
}

function buildReasoning(agentId, output) {
  switch (agentId) {
    case 'screenwriter': return `${output.scenes?.length ?? 0} scenes | "${output.logline}"`;
    case 'creative_director': return `${output.color_palette?.length ?? 0} colors | ${output.cinematic_refs?.length ?? 0} refs | ${output.moodboard_prompts?.length ?? 0} moodboards`;
    case 'storyboard': return `${output.frames?.length ?? 0} frames`;
    case 'production_planner': return `${output.phases?.length ?? 0} phases | render order: [${output.render_order?.join(', ')}]`;
    case 'shot_list': return `${output.total_shots ?? output.shots?.length ?? 0} shots`;
    case 'music_sound': return `${output.genre} @ ${output.tempo_bpm}BPM | ${output.sound_cues?.length ?? 0} cues`;
    case 'video_generation': return `${output.scenes?.length ?? 0} prompts via ${output.recommended_provider}`;
    case 'quality_control': return `Score: ${output.overall_score}/100 — ${output.passed ? 'PASSED ✓' : 'FAILED ✗'}`;
    case 'editor': return `${output.timeline?.length ?? 0} clips | ${output.social_cutdowns?.length ?? 0} social cutdowns`;
    default: return 'complete';
  }
}

// ---------------------------------------------------------------------------
// HTML UI
// ---------------------------------------------------------------------------

const HTML = /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>🎬 Cinematic Studio</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0A0A0F;--s1:#111118;--s2:#1A1A24;--s3:#22222E;
  --border:#2A2A38;--border2:#383848;
  --amber:#F59E0B;--amber-d:#92400E;
  --purple:#8B5CF6;--cyan:#06B6D4;--green:#10B981;--red:#EF4444;--pink:#EC4899;
  --text:#F0EFEA;--muted:#6B7280;--dim:#A0A0B0;
  --font:'Syne',system-ui,sans-serif;--mono:'DM Mono',monospace;
}
html,body{height:100%;background:var(--bg);color:var(--text);font-family:var(--font);overflow:hidden}
::-webkit-scrollbar{width:4px;height:4px}
::-webkit-scrollbar-track{background:var(--s1)}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}

/* ── LAYOUT ── */
.app{display:grid;grid-template-rows:56px 1fr;height:100vh}

header{
  display:flex;align-items:center;gap:16px;padding:0 20px;
  background:var(--s1);border-bottom:1px solid var(--border);
  position:relative;z-index:10;
}
.logo{display:flex;align-items:center;gap:10px;flex-shrink:0}
.logo-icon{width:32px;height:32px;background:var(--amber);border-radius:8px;
  display:flex;align-items:center;justify-content:center;font-size:16px}
.logo-text{font-size:14px;font-weight:800;letter-spacing:.05em}
.logo-sub{font-size:10px;color:var(--muted);font-family:var(--mono)}

#apiKeyWrap{display:flex;align-items:center;gap:8px;margin-left:auto}
#apiKeyWrap label{font-size:11px;color:var(--muted);font-family:var(--mono)}
#apiKey{
  background:var(--s2);border:1px solid var(--border);border-radius:8px;
  padding:6px 12px;font-size:12px;font-family:var(--mono);color:var(--text);
  width:240px;outline:none;transition:.15s;
}
#apiKey:focus{border-color:var(--amber)}
.status-dot{width:8px;height:8px;border-radius:50%;background:var(--muted);flex-shrink:0;transition:.3s}
.status-dot.running{background:var(--amber);animation:pulse 1.5s infinite}
.status-dot.done{background:var(--green)}
.status-dot.error{background:var(--red)}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}

.body{display:grid;grid-template-columns:300px 1fr;height:100%;overflow:hidden}

/* ── SIDEBAR ── */
.sidebar{
  background:var(--s1);border-right:1px solid var(--border);
  display:flex;flex-direction:column;overflow:hidden;
}
.sidebar-scroll{flex:1;overflow-y:auto;padding:16px}

.section-title{font-size:10px;font-family:var(--mono);color:var(--muted);
  text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px}

.field{margin-bottom:12px}
.field label{display:block;font-size:10px;font-family:var(--mono);color:var(--muted);
  text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px}
.field input,.field textarea,.field select{
  width:100%;background:var(--s2);border:1px solid var(--border);border-radius:8px;
  padding:8px 10px;font-size:12px;color:var(--text);font-family:var(--font);outline:none;
  transition:.15s;resize:vertical;
}
.field input:focus,.field textarea:focus,.field select:focus{border-color:var(--amber)}
.field textarea{min-height:60px}
.field select option{background:var(--s2)}

.platform-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.platform-btn{
  background:var(--s2);border:1px solid var(--border);border-radius:8px;
  padding:8px 6px;font-size:11px;font-family:var(--mono);color:var(--muted);
  cursor:pointer;transition:.15s;text-align:center;
}
.platform-btn.active{background:rgba(245,158,11,.1);border-color:var(--amber);color:var(--amber)}
.platform-btn .dur{font-size:10px;color:var(--muted);margin-top:2px}

.dur-row{display:flex;align-items:center;gap:8px}
.dur-row input[type=range]{flex:1;accent-color:var(--amber)}
.dur-val{font-size:13px;font-family:var(--mono);color:var(--amber);width:36px;text-align:right}

.emotion-grid{display:flex;flex-wrap:wrap;gap:5px}
.emotion-btn{
  background:var(--s2);border:1px solid var(--border);border-radius:6px;
  padding:5px 8px;font-size:10px;color:var(--muted);cursor:pointer;transition:.15s;
}
.emotion-btn.active{background:rgba(245,158,11,.1);border-color:var(--amber);color:var(--amber)}

.launch-btn{
  width:100%;padding:12px;background:var(--amber);color:#000;border:none;
  border-radius:10px;font-size:13px;font-weight:800;font-family:var(--font);
  cursor:pointer;transition:.15s;letter-spacing:.02em;
}
.launch-btn:hover{background:#fbbf24}
.launch-btn:disabled{opacity:.4;cursor:not-allowed}

/* Workflow graph */
.graph-wrap{padding:16px;border-top:1px solid var(--border)}
svg.graph{width:100%;display:block}

/* ── MAIN ── */
.main{display:flex;flex-direction:column;overflow:hidden;background:var(--bg)}

.tabs{
  display:flex;background:var(--s1);border-bottom:1px solid var(--border);
  overflow-x:auto;flex-shrink:0;
}
.tabs::-webkit-scrollbar{height:0}
.tab-btn{
  flex-shrink:0;padding:12px 16px;font-size:11px;font-family:var(--mono);
  color:var(--muted);border:none;background:none;cursor:pointer;
  border-bottom:2px solid transparent;transition:.15s;white-space:nowrap;
}
.tab-btn.active{color:var(--text);border-bottom-color:var(--amber)}
.tab-btn .score-pill{
  display:inline-flex;align-items:center;padding:1px 5px;border-radius:4px;
  font-size:10px;margin-left:4px;
}

.content{flex:1;overflow-y:auto;padding:20px}

/* ── LOG VIEW ── */
.log-entry{
  display:flex;align-items:flex-start;gap:10px;padding:8px 0;
  border-bottom:1px solid var(--border);animation:slideIn .2s ease;
}
@keyframes slideIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
.log-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;margin-top:5px}
.log-body .log-agent{font-size:10px;font-family:var(--mono);color:var(--muted)}
.log-body .log-msg{font-size:12px;color:var(--dim);line-height:1.4}
.log-body .log-reason{font-size:11px;font-family:var(--mono);color:var(--text);margin-top:2px}
.log-tokens{font-size:10px;font-family:var(--mono);color:var(--muted);margin-left:auto;flex-shrink:0}

/* ── RESULT PANELS ── */
.result-section{margin-bottom:24px}
.result-title{
  font-size:11px;font-family:var(--mono);color:var(--muted);
  text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px;
  padding-bottom:6px;border-bottom:1px solid var(--border);
}
.card{background:var(--s1);border:1px solid var(--border);border-radius:12px;
  padding:16px;margin-bottom:10px}
.card-label{font-size:10px;font-family:var(--mono);color:var(--muted);margin-bottom:4px}
.card-value{font-size:13px;color:var(--text);line-height:1.6}
.card-value.mono{font-family:var(--mono);font-size:12px}
.tag{display:inline-flex;align-items:center;padding:3px 8px;border-radius:6px;
  font-size:11px;font-family:var(--mono);margin:2px;border:1px solid var(--border)}
.scene-card{
  background:var(--s1);border:1px solid var(--border);border-radius:12px;
  padding:14px;margin-bottom:8px;
}
.scene-num{font-size:10px;font-family:var(--mono);color:var(--amber);font-weight:700}
.scene-title{font-size:14px;font-weight:600;margin:4px 0}
.scene-desc{font-size:12px;color:var(--dim);line-height:1.5}
.shot-row{
  display:grid;grid-template-columns:48px 64px 52px 1fr;gap:8px;
  align-items:start;padding:8px 0;border-bottom:1px solid var(--border);font-size:12px;
}
.shot-id{font-family:var(--mono);font-weight:700;color:var(--amber)}
.shot-type{font-family:var(--mono);color:var(--cyan)}
.shot-lens{font-family:var(--mono);color:var(--dim)}

/* QC Score rings */
.qc-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:16px}
.qc-ring-wrap{display:flex;flex-direction:column;align-items:center;gap:6px}
.qc-ring-wrap span{font-size:10px;color:var(--muted);text-align:center}
.qc-overall{
  display:flex;align-items:center;justify-content:space-between;
  background:var(--s1);border:1px solid var(--border);border-radius:12px;padding:16px;
  margin-bottom:16px;
}
.qc-score-big{font-size:36px;font-family:var(--mono);font-weight:700}
.qc-badge{padding:6px 14px;border-radius:8px;font-size:12px;font-weight:700;font-family:var(--mono)}
.qc-badge.pass{background:rgba(16,185,129,.1);color:var(--green);border:1px solid rgba(16,185,129,.3)}
.qc-badge.fail{background:rgba(239,68,68,.1);color:var(--red);border:1px solid rgba(239,68,68,.3)}
.issue-card{
  padding:8px 12px;border-radius:8px;font-size:12px;margin-bottom:6px;
  border-left:3px solid;
}
.issue-high{background:rgba(239,68,68,.08);border-color:var(--red);color:#fca5a5}
.issue-med{background:rgba(245,158,11,.08);border-color:var(--amber);color:#fcd34d}
.issue-low{background:var(--s2);border-color:var(--border);color:var(--dim)}

.timeline-bar{
  height:40px;background:var(--s2);border-radius:8px;overflow:hidden;
  display:flex;margin-bottom:4px;
}
.timeline-clip{height:100%;display:flex;align-items:center;padding:0 8px;
  font-size:10px;font-family:var(--mono);overflow:hidden;border-right:1px solid var(--border)}

.copy-btn{
  padding:4px 10px;background:var(--s2);border:1px solid var(--border);border-radius:6px;
  font-size:10px;font-family:var(--mono);color:var(--muted);cursor:pointer;transition:.15s;float:right;
}
.copy-btn:hover{color:var(--text);border-color:var(--border2)}

.empty-state{
  text-align:center;padding:60px 20px;color:var(--muted);
  font-size:13px;line-height:1.6;
}
.empty-state .icon{font-size:40px;margin-bottom:12px}

/* Storyboard frames */
.frame-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
.frame-card{
  background:var(--s1);border:1px solid var(--border);border-radius:10px;overflow:hidden;
  transition:.15s;cursor:default;
}
.frame-preview{
  aspect-ratio:16/9;background:var(--bg);display:flex;align-items:center;
  justify-content:center;padding:10px;text-align:center;position:relative;
}
.frame-shot{
  position:absolute;top:6px;left:6px;background:rgba(0,0,0,.6);
  padding:2px 6px;border-radius:4px;font-size:10px;font-family:var(--mono);color:var(--amber);
}
.frame-dur{
  position:absolute;bottom:6px;right:6px;background:rgba(0,0,0,.6);
  padding:2px 6px;border-radius:4px;font-size:10px;font-family:var(--mono);color:var(--dim);
}
.frame-body{padding:10px}
.frame-move{font-size:10px;font-family:var(--mono);color:var(--purple);margin-bottom:3px}
.frame-action{font-size:11px;color:var(--dim);line-height:1.4}

pre.json-out{
  background:var(--s2);border:1px solid var(--border);border-radius:8px;
  padding:12px;font-family:var(--mono);font-size:11px;color:var(--dim);
  overflow:auto;max-height:300px;white-space:pre-wrap;word-break:break-word;
}
</style>
</head>
<body>
<div class="app">

<!-- HEADER -->
<header>
  <div class="logo">
    <div class="logo-icon">🎬</div>
    <div>
      <div class="logo-text">CINEMATIC STUDIO</div>
      <div class="logo-sub">AI Production Platform</div>
    </div>
  </div>
  <div id="apiKeyWrap">
    <label for="apiKey">ANTHROPIC KEY</label>
    <input type="password" id="apiKey" placeholder="sk-ant-..." autocomplete="off" />
    <div class="status-dot" id="statusDot"></div>
    <span id="statusText" style="font-size:11px;font-family:var(--mono);color:var(--muted)">idle</span>
  </div>
</header>

<div class="body">

<!-- SIDEBAR -->
<aside class="sidebar">
  <div class="sidebar-scroll">
    <div class="section-title">Product Brief</div>

    <div class="field"><label>Product Name</label>
      <input id="productName" placeholder="e.g. KratomLyte Energy" /></div>

    <div class="field"><label>Product Description</label>
      <textarea id="productDesc" placeholder="Key benefits, what makes it unique..."></textarea></div>

    <div class="field"><label>Brand Name</label>
      <input id="brandName" placeholder="e.g. KratomLyte" /></div>

    <div class="field"><label>Brand Identity</label>
      <textarea id="brandIdentity" placeholder="Premium, natural, energising..."></textarea></div>

    <div class="field"><label>Target Audience</label>
      <input id="audience" placeholder="e.g. 25-35 health-conscious professionals" /></div>

    <div class="field"><label>Platform</label>
      <div class="platform-grid" id="platformGrid">
        <button class="platform-btn" data-val="tiktok">TikTok<div class="dur">15s</div></button>
        <button class="platform-btn" data-val="instagram_reels">Reels<div class="dur">30s</div></button>
        <button class="platform-btn active" data-val="youtube">YouTube<div class="dur">30s</div></button>
        <button class="platform-btn" data-val="youtube_shorts">YT Shorts<div class="dur">60s</div></button>
        <button class="platform-btn" data-val="tvc">TVC<div class="dur">30s</div></button>
        <button class="platform-btn" data-val="cinema">Cinema<div class="dur">120s</div></button>
      </div>
    </div>

    <div class="field"><label>Duration</label>
      <div class="dur-row">
        <input type="range" id="durationRange" min="5" max="180" value="30" />
        <span class="dur-val" id="durationVal">30s</span>
      </div>
    </div>

    <div class="field"><label>Desired Emotion</label>
      <div class="emotion-grid" id="emotionGrid">
        <button class="emotion-btn active" data-val="Aspirational">Aspirational</button>
        <button class="emotion-btn" data-val="Nostalgic">Nostalgic</button>
        <button class="emotion-btn" data-val="Energetic">Energetic</button>
        <button class="emotion-btn" data-val="Calm">Calm</button>
        <button class="emotion-btn" data-val="Empowering">Empowering</button>
        <button class="emotion-btn" data-val="Playful">Playful</button>
        <button class="emotion-btn" data-val="Luxurious">Luxurious</button>
        <button class="emotion-btn" data-val="Urgent">Urgent</button>
      </div>
    </div>

    <div class="field"><label>Reference Styles (optional)</label>
      <input id="references" placeholder="e.g. Apple iPhone 15 Pro, Dior J'adore..." /></div>

    <button class="launch-btn" id="launchBtn" onclick="launch()">Launch Pipeline</button>
  </div>

  <!-- SVG Workflow Graph -->
  <div class="graph-wrap">
    <div class="section-title">Pipeline</div>
    <svg class="graph" id="workflowSvg" viewBox="0 0 260 320" xmlns="http://www.w3.org/2000/svg"
         style="font-family:'DM Mono',monospace">
      <!-- Edges -->
      <g id="edges" stroke="#2A2A38" stroke-width="1" fill="none">
        <line x1="65" y1="24" x2="38" y2="70"/>
        <line x1="65" y1="24" x2="92" y2="70"/>
        <line x1="38" y1="86" x2="65" y2="130"/>
        <line x1="92" y1="86" x2="65" y2="130"/>
        <line x1="65" y1="146" x2="22" y2="190"/>
        <line x1="65" y1="146" x2="65" y2="190"/>
        <line x1="65" y1="146" x2="108" y2="190"/>
        <line x1="22" y1="206" x2="65" y2="250"/>
        <line x1="65" y1="206" x2="65" y2="250"/>
        <line x1="108" y1="206" x2="65" y2="250"/>
        <line x1="65" y1="266" x2="38" y2="302"/>
        <line x1="65" y1="266" x2="92" y2="302"/>
        <line x1="38" y1="318" x2="65" y2="370"/>
        <line x1="92" y1="318" x2="65" y2="370"/>
      </g>
      <!-- Nodes -->
      <!-- screenwriter 38,78 -->
      <g id="node-screenwriter" class="graph-node">
        <circle cx="38" cy="78" r="10" fill="#2A2A38" stroke="#383848" stroke-width="1"/>
        <text x="38" y="96" text-anchor="middle" font-size="7" fill="#6B7280">Writer</text>
      </g>
      <!-- creative_director 92,78 -->
      <g id="node-creative_director" class="graph-node">
        <circle cx="92" cy="78" r="10" fill="#2A2A38" stroke="#383848" stroke-width="1"/>
        <text x="92" y="96" text-anchor="middle" font-size="7" fill="#6B7280">Director</text>
      </g>
      <!-- storyboard 65,138 -->
      <g id="node-storyboard" class="graph-node">
        <circle cx="65" cy="138" r="10" fill="#2A2A38" stroke="#383848" stroke-width="1"/>
        <text x="65" y="156" text-anchor="middle" font-size="7" fill="#6B7280">Board</text>
      </g>
      <!-- production_planner 22,198 -->
      <g id="node-production_planner" class="graph-node">
        <circle cx="22" cy="198" r="10" fill="#2A2A38" stroke="#383848" stroke-width="1"/>
        <text x="22" y="216" text-anchor="middle" font-size="7" fill="#6B7280">Planner</text>
      </g>
      <!-- shot_list 65,198 -->
      <g id="node-shot_list" class="graph-node">
        <circle cx="65" cy="198" r="10" fill="#2A2A38" stroke="#383848" stroke-width="1"/>
        <text x="65" y="216" text-anchor="middle" font-size="7" fill="#6B7280">Shots</text>
      </g>
      <!-- music_sound 108,198 -->
      <g id="node-music_sound" class="graph-node">
        <circle cx="108" cy="198" r="10" fill="#2A2A38" stroke="#383848" stroke-width="1"/>
        <text x="108" y="216" text-anchor="middle" font-size="7" fill="#6B7280">Music</text>
      </g>
      <!-- video_generation 65,258 -->
      <g id="node-video_generation" class="graph-node">
        <circle cx="65" cy="258" r="10" fill="#2A2A38" stroke="#383848" stroke-width="1"/>
        <text x="65" y="276" text-anchor="middle" font-size="7" fill="#6B7280">Video</text>
      </g>
      <!-- quality_control 38,310 -->
      <g id="node-quality_control" class="graph-node">
        <circle cx="38" cy="310" r="10" fill="#2A2A38" stroke="#383848" stroke-width="1"/>
        <text x="38" y="328" text-anchor="middle" font-size="7" fill="#6B7280">QC</text>
      </g>
      <!-- editor 92,310 -->
      <g id="node-editor" class="graph-node">
        <circle cx="92" cy="310" r="10" fill="#2A2A38" stroke="#383848" stroke-width="1"/>
        <text x="92" y="328" text-anchor="middle" font-size="7" fill="#6B7280">Editor</text>
      </g>
    </svg>
  </div>
</aside>

<!-- MAIN CONTENT -->
<div class="main">
  <div class="tabs" id="tabs">
    <button class="tab-btn active" data-tab="log">Pipeline Log</button>
    <button class="tab-btn" data-tab="script">Script</button>
    <button class="tab-btn" data-tab="visual">Visual</button>
    <button class="tab-btn" data-tab="storyboard">Storyboard</button>
    <button class="tab-btn" data-tab="shots">Shot List</button>
    <button class="tab-btn" data-tab="music">Music</button>
    <button class="tab-btn" data-tab="video">Video Prompts</button>
    <button class="tab-btn" data-tab="qc">QC <span class="score-pill" id="qcPill"></span></button>
    <button class="tab-btn" data-tab="edit">Final Edit</button>
  </div>

  <div class="content" id="content">
    <!-- Log panel (default) -->
    <div id="panel-log">
      <div class="empty-state">
        <div class="icon">🎬</div>
        <div>Fill in your brief and click <strong>Launch Pipeline</strong><br>to start the AI production studio.</div>
      </div>
    </div>

    <!-- Other panels -->
    <div id="panel-script" style="display:none"></div>
    <div id="panel-visual" style="display:none"></div>
    <div id="panel-storyboard" style="display:none"></div>
    <div id="panel-shots" style="display:none"></div>
    <div id="panel-music" style="display:none"></div>
    <div id="panel-video" style="display:none"></div>
    <div id="panel-qc" style="display:none"></div>
    <div id="panel-edit" style="display:none"></div>
  </div>
</div>

</div><!-- /.body -->
</div><!-- /.app -->

<script>
// ─── STATE ───────────────────────────────────────────────────────────────────
let state = {
  platform: 'youtube',
  duration: 30,
  emotion: 'Aspirational',
  running: false,
  outputs: {},
};

// ─── FORM CONTROLS ───────────────────────────────────────────────────────────
const PLATFORM_DURATIONS = {
  tiktok: 15, instagram_reels: 30, youtube: 30,
  youtube_shorts: 60, tvc: 30, cinema: 120,
};

document.querySelectorAll('.platform-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.platform-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.platform = btn.dataset.val;
    const d = PLATFORM_DURATIONS[state.platform] || 30;
    document.getElementById('durationRange').value = d;
    document.getElementById('durationVal').textContent = d + 's';
    state.duration = d;
  });
});

document.getElementById('durationRange').addEventListener('input', e => {
  state.duration = +e.target.value;
  document.getElementById('durationVal').textContent = state.duration + 's';
});

document.querySelectorAll('.emotion-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.emotion-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.emotion = btn.dataset.val;
  });
});

// ─── TABS ────────────────────────────────────────────────────────────────────
let activeTab = 'log';
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    showTab(btn.dataset.tab);
  });
});

function showTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('[id^="panel-"]').forEach(p =>
    p.style.display = 'none');
  const panel = document.getElementById('panel-' + tab);
  if (panel) panel.style.display = 'block';
}

// ─── WORKFLOW GRAPH ──────────────────────────────────────────────────────────
const NODE_COLORS = {
  screenwriter:'#8B5CF6', creative_director:'#EC4899', storyboard:'#06B6D4',
  production_planner:'#10B981', shot_list:'#3B82F6', music_sound:'#F97316',
  video_generation:'#EF4444', quality_control:'#14B8A6', editor:'#A855F7',
};
const STATUS_FILL = {
  idle:'#2A2A38', running:'#F59E0B', completed:'#10B981', error:'#EF4444',
};

function setNodeStatus(agentId, status) {
  const g = document.getElementById('node-' + agentId);
  if (!g) return;
  const circle = g.querySelector('circle');
  const txt = g.querySelector('text');
  const color = NODE_COLORS[agentId] || '#F59E0B';
  circle.setAttribute('fill', STATUS_FILL[status] || STATUS_FILL.idle);
  circle.setAttribute('stroke', status === 'idle' ? '#383848' : color);
  circle.setAttribute('stroke-width', status === 'idle' ? '1' : '2');
  txt.setAttribute('fill', status === 'idle' ? '#6B7280' : '#F0EFEA');
  if (status === 'running') {
    circle.innerHTML = '<animate attributeName="r" values="10;14;10" dur="1.5s" repeatCount="indefinite"/>';
  } else {
    // remove animation
    const oldAnim = circle.querySelector('animate');
    if (oldAnim) circle.removeChild(oldAnim);
    circle.setAttribute('r', '10');
  }
}

// ─── LOG ─────────────────────────────────────────────────────────────────────
function appendLog(dot_color, agent_label, message, reasoning, tokens) {
  const panel = document.getElementById('panel-log');
  // Remove empty state
  const es = panel.querySelector('.empty-state');
  if (es) es.remove();

  const div = document.createElement('div');
  div.className = 'log-entry';
  div.innerHTML = \`
    <div class="log-dot" style="background:\${dot_color}"></div>
    <div class="log-body">
      <div class="log-agent">\${agent_label || 'PIPELINE'}</div>
      <div class="log-msg">\${escHtml(message)}</div>
      \${reasoning ? \`<div class="log-reason">\${escHtml(reasoning)}</div>\` : ''}
    </div>
    \${tokens ? \`<div class="log-tokens">\${tokens} tok</div>\` : ''}
  \`;
  panel.appendChild(div);
  panel.scrollTop = panel.scrollHeight;
}

// ─── RENDER OUTPUTS ──────────────────────────────────────────────────────────
function renderAll(outputs) {
  renderScript(outputs.screenwriter);
  renderVisual(outputs.creative_director);
  renderStoryboard(outputs.storyboard);
  renderShots(outputs.shot_list);
  renderMusic(outputs.music_sound);
  renderVideo(outputs.video_generation);
  renderQC(outputs.quality_control);
  renderEdit(outputs.editor, outputs.screenwriter);
}

function renderScript(d) {
  if (!d) return;
  const p = document.getElementById('panel-script');
  p.innerHTML = \`
    <div class="result-section">
      <div class="result-title">Concept & Logline</div>
      <div class="card">
        <div class="card-label">STORY CONCEPT</div>
        <div class="card-value">\${escHtml(d.story_concept || '')}</div>
      </div>
      <div class="card">
        <div class="card-label">LOGLINE</div>
        <div class="card-value" style="font-style:italic;color:var(--amber)">\${escHtml(d.logline || '')}</div>
      </div>
    </div>
    <div class="result-section">
      <div class="result-title">Voiceover Script</div>
      <div class="card">
        <div class="card-value mono">\${escHtml(d.voiceover_script || 'No voiceover')}</div>
      </div>
    </div>
    <div class="result-section">
      <div class="result-title">Scenes (\${(d.scenes||[]).length})</div>
      \${(d.scenes||[]).map(s => \`
        <div class="scene-card">
          <div class="scene-num">SCENE \${s.n || ''}</div>
          <div class="scene-title">\${escHtml(s.title||'')}</div>
          <div class="scene-desc">\${escHtml(s.description||'')}</div>
          \${s.dialogue ? \`<div style="font-style:italic;color:var(--purple);font-size:12px;margin-top:6px">"${escHtml(s.dialogue)}"</div>\` : ''}
          <div style="font-size:10px;font-family:var(--mono);color:var(--muted);margin-top:6px">\${s.duration_sec}s</div>
        </div>
      \`).join('')}
    </div>
    <div class="result-section">
      <div class="result-title">Emotional Arc</div>
      <div class="card">
        \${renderArc(d.emotional_arc||[])}
      </div>
    </div>
  \`;
}

function renderArc(arc) {
  if (!arc.length) return '<div style="color:var(--muted);font-size:12px">No arc data</div>';
  const max = Math.max(...arc.map(p => p.intensity || 0), 1);
  return \`<div style="display:flex;align-items:flex-end;gap:4px;height:60px">
    \${arc.map(p => \`
      <div title="\${p.emotion} (\${p.sec}s)" style="
        flex:1;background:var(--amber);opacity:\${0.3 + 0.7*(p.intensity/max)};
        border-radius:3px 3px 0 0;height:\${Math.max(4,(p.intensity/max)*100)}%;
      "></div>
    \`).join('')}
  </div>
  <div style="display:flex;gap:4px;margin-top:4px">
    \${arc.map(p => \`<div style="flex:1;font-size:9px;font-family:var(--mono);color:var(--muted);text-align:center;overflow:hidden">\${p.sec}s</div>\`).join('')}
  </div>\`;
}

function renderVisual(d) {
  if (!d) return;
  const p = document.getElementById('panel-visual');
  p.innerHTML = \`
    <div class="result-section">
      <div class="result-title">Visual Style</div>
      <div class="card"><div class="card-value">\${escHtml(d.visual_style||'')}</div></div>
      <div class="card"><div class="card-label">CINEMATOGRAPHY</div><div class="card-value">\${escHtml(d.cinematography||'')}</div></div>
      <div class="card"><div class="card-label">LIGHTING</div><div class="card-value">\${escHtml(d.lighting_strategy||'')}</div></div>
      <div class="card"><div class="card-label">CAMERA LANGUAGE</div><div class="card-value">\${escHtml(d.camera_language||'')}</div></div>
    </div>
    <div class="result-section">
      <div class="result-title">Color Palette</div>
      <div class="card" style="display:flex;flex-wrap:wrap;gap:12px">
        \${(d.color_palette||[]).map(c => \`
          <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
            <div style="width:40px;height:40px;border-radius:8px;background:\${c.hex};border:1px solid rgba(255,255,255,.1)"></div>
            <div style="font-size:10px;font-family:var(--mono);color:var(--muted)">\${c.hex}</div>
            <div style="font-size:10px;color:var(--dim);text-align:center;max-width:60px">\${c.name}</div>
          </div>
        \`).join('')}
      </div>
    </div>
    <div class="result-section">
      <div class="result-title">Cinematic References</div>
      \${(d.cinematic_refs||[]).map(r => \`
        <div class="card">
          <div style="font-size:13px;font-weight:600">\${escHtml(r.title||'')} <span style="color:var(--muted);font-weight:400;font-size:12px">dir. \${escHtml(r.director||'')}</span></div>
          <div style="font-size:12px;color:var(--dim);margin-top:4px">\${escHtml(r.reason||'')}</div>
        </div>
      \`).join('')}
    </div>
    <div class="result-section">
      <div class="result-title">Moodboard Prompts (for AI image gen)</div>
      \${(d.moodboard_prompts||[]).map((m,i) => \`
        <div class="card">
          <div class="card-label">PROMPT \${i+1}</div>
          <div class="card-value mono">\${escHtml(m)}</div>
          <button class="copy-btn" onclick="copy(\${JSON.stringify(m)},this)">Copy</button>
        </div>
      \`).join('')}
    </div>
  \`;
}

function renderStoryboard(d) {
  if (!d) return;
  const p = document.getElementById('panel-storyboard');
  p.innerHTML = \`
    <div class="result-section">
      <div class="result-title">Storyboard Frames (\${(d.frames||[]).length})</div>
      \${d.composition_notes ? \`<div class="card"><div class="card-label">COMPOSITION NOTES</div><div class="card-value">\${escHtml(d.composition_notes)}</div></div>\` : ''}
      <div class="frame-grid">
        \${(d.frames||[]).map(f => \`
          <div class="frame-card">
            <div class="frame-preview">
              <div class="frame-shot">\${escHtml(f.shot_type||'')}</div>
              <div style="font-size:10px;color:var(--dim);line-height:1.4;text-align:center">\${escHtml((f.composition||'').slice(0,80))}</div>
              <div class="frame-dur">\${f.duration_sec}s</div>
            </div>
            <div class="frame-body">
              <div class="frame-move">\${escHtml(f.camera_movement||'')}</div>
              <div class="frame-action">\${escHtml((f.action||'').slice(0,80))}</div>
              \${f.transition ? \`<div style="font-size:10px;font-family:var(--mono);color:var(--purple);margin-top:4px">→ \${f.transition}</div>\` : ''}
            </div>
          </div>
        \`).join('')}
      </div>
    </div>
    <div class="result-section">
      <div class="result-title">Visual Prompts (for AI video gen)</div>
      \${(d.frames||[]).map((f,i) => \`
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
            <div class="card-label">FRAME \${i+1} — \${f.shot_type||''}</div>
            <button class="copy-btn" onclick="copy(\${JSON.stringify(f.visual_prompt||'')},this)">Copy</button>
          </div>
          <div class="card-value mono">\${escHtml(f.visual_prompt||'')}</div>
        </div>
      \`).join('')}
    </div>
  \`;
}

function renderShots(d) {
  if (!d) return;
  const p = document.getElementById('panel-shots');
  p.innerHTML = \`
    <div class="result-section">
      <div class="result-title">Shot List (\${d.total_shots || (d.shots||[]).length} shots)</div>
      <div style="background:var(--s1);border:1px solid var(--border);border-radius:10px;overflow:hidden">
        <div class="shot-row" style="border-bottom:1px solid var(--border2);opacity:.6">
          <div style="font-size:10px;font-family:var(--mono);color:var(--muted)">#</div>
          <div style="font-size:10px;font-family:var(--mono);color:var(--muted)">TYPE</div>
          <div style="font-size:10px;font-family:var(--mono);color:var(--muted)">LENS</div>
          <div style="font-size:10px;font-family:var(--mono);color:var(--muted)">ACTION</div>
        </div>
        \${(d.shots||[]).map(s => \`
          <div class="shot-row">
            <div class="shot-id">\${escHtml(s.shot_id||s.shot_number||'')}</div>
            <div class="shot-type">\${escHtml(s.shot_type||'')}</div>
            <div class="shot-lens">\${s.lens_mm ? s.lens_mm+'mm' : '—'}</div>
            <div>
              <div style="color:var(--text)">\${escHtml((s.action||'').slice(0,60))}</div>
              <div style="font-size:10px;color:var(--muted);font-family:var(--mono);margin-top:2px">\${escHtml(s.movement||'')} \${s.duration_sec ? '· '+s.duration_sec+'s' : ''}</div>
            </div>
          </div>
        \`).join('')}
      </div>
    </div>
  \`;
}

function renderMusic(d) {
  if (!d) return;
  const p = document.getElementById('panel-music');
  p.innerHTML = \`
    <div class="result-section">
      <div class="result-title">Music Direction</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <div class="card"><div class="card-label">GENRE</div><div class="card-value">\${escHtml(d.genre||'')}</div></div>
        <div class="card"><div class="card-label">TEMPO</div><div class="card-value mono" style="color:var(--amber)">\${d.tempo_bpm} BPM</div></div>
        <div class="card"><div class="card-label">MOOD</div><div class="card-value">\${escHtml(d.mood||'')}</div></div>
        <div class="card"><div class="card-label">INSTRUMENTS</div><div class="card-value">\${(d.instruments||[]).join(', ')}</div></div>
      </div>
    </div>
    <div class="result-section">
      <div class="result-title">AI Music Generation Prompt</div>
      <div class="card">
        <button class="copy-btn" onclick="copy(\${JSON.stringify(d.music_prompt||'')},this)">Copy</button>
        <div class="card-value mono">\${escHtml(d.music_prompt||'')}</div>
      </div>
    </div>
    <div class="result-section">
      <div class="result-title">Sound Cues (\${(d.sound_cues||[]).length})</div>
      \${(d.sound_cues||[]).map(c => \`
        <div class="card" style="display:flex;align-items:center;gap:12px;padding:10px 14px">
          <div style="font-size:14px;font-family:var(--mono);font-weight:700;color:var(--amber);flex-shrink:0">\${c.sec}s</div>
          <div style="flex:1">
            <div style="font-size:12px;color:var(--text)">\${escHtml(c.description||'')}</div>
            <div style="font-size:10px;font-family:var(--mono);color:var(--muted);margin-top:2px">\${c.type||''} · intensity \${c.intensity||0}/10</div>
          </div>
        </div>
      \`).join('')}
    </div>
    <div class="result-section">
      <div class="result-title">Voiceover Timing</div>
      \${(d.vo_timing||[]).map(v => \`
        <div class="card">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <div style="font-family:var(--mono);font-size:11px;color:var(--amber)">\${v.start_sec}s – \${v.end_sec}s</div>
            <div style="font-family:var(--mono);font-size:10px;color:var(--purple)">\${v.emotion||''}</div>
          </div>
          <div style="font-style:italic;color:var(--dim);font-size:13px">"\${escHtml(v.text||'')}"</div>
        </div>
      \`).join('')}
    </div>
  \`;
}

function renderVideo(d) {
  if (!d) return;
  const p = document.getElementById('panel-video');
  p.innerHTML = \`
    <div class="result-section">
      <div class="result-title">Video Generation Prompts</div>
      <div class="card" style="margin-bottom:14px">
        <div class="card-label">RECOMMENDED PROVIDER</div>
        <div class="card-value mono" style="color:var(--amber)">\${escHtml(d.recommended_provider||d.provider_recommendation||'luma')}</div>
        \${d.continuity_notes ? \`<div class="card-label" style="margin-top:10px">CONTINUITY NOTES</div>
        <div class="card-value">\${escHtml(d.continuity_notes||'')}</div>\` : ''}
      </div>
      \${(d.scenes||[]).map((s,i) => \`
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
            <div class="card-label">SCENE \${s.scene_n||i+1} — \${escHtml(s.provider||'')}</div>
            <button class="copy-btn" onclick="copy(\${JSON.stringify(s.prompt||'')},this)">Copy Prompt</button>
          </div>
          <div class="card-value mono" style="margin-bottom:8px">\${escHtml(s.prompt||'')}</div>
          \${s.negative_prompt ? \`
            <div class="card-label">NEGATIVE</div>
            <div style="font-size:11px;font-family:var(--mono);color:var(--muted)">\${escHtml(s.negative_prompt)}</div>
          \` : ''}
          \${s.params ? \`
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">
              \${Object.entries(s.params).map(([k,v]) => \`<span class="tag" style="color:var(--cyan)">\${k}: \${v}</span>\`).join('')}
            </div>
          \` : ''}
        </div>
      \`).join('')}
    </div>
  \`;
}

function renderQC(d) {
  if (!d) return;
  const p = document.getElementById('panel-qc');
  const scoreColor = d.overall_score >= 90 ? 'var(--green)' : d.overall_score >= 70 ? 'var(--amber)' : 'var(--red)';
  const dims = [
    {key:'composition_score',label:'Composition',color:'#06B6D4'},
    {key:'continuity_score',label:'Continuity',color:'#8B5CF6'},
    {key:'pacing_score',label:'Pacing',color:'#F59E0B'},
    {key:'brand_score',label:'Brand',color:'#EC4899'},
    {key:'anatomy_score',label:'Anatomy',color:'#10B981'},
  ];
  p.innerHTML = \`
    <div class="qc-overall">
      <div>
        <div style="font-size:11px;font-family:var(--mono);color:var(--muted);margin-bottom:4px">OVERALL SCORE</div>
        <div class="qc-score-big" style="color:\${scoreColor}">\${d.overall_score}<span style="font-size:18px;color:var(--muted)">/100</span></div>
      </div>
      <div class="\${d.passed?'qc-badge pass':'qc-badge fail'}">\${d.passed?'PASSED ✓':'FAILED ✗'}</div>
    </div>
    <div class="qc-grid">
      \${dims.map(dim => renderRing(d[dim.key]||0, dim.label, dim.color)).join('')}
    </div>
    \${(d.rejection_reasons||[]).length > 0 ? \`
      <div class="result-title" style="margin-bottom:10px">ISSUES (\${d.rejection_reasons.length})</div>
      \${d.rejection_reasons.map(r => \`
        <div class="issue-card issue-\${r.severity||'low'}">\${escHtml(r.description||'')}</div>
      \`).join('')}
    \` : ''}
    \${(d.suggestions||[]).length > 0 ? \`
      <div class="result-title" style="margin-top:16px;margin-bottom:10px">SUGGESTIONS</div>
      \${d.suggestions.map(s => \`
        <div class="card" style="padding:10px 14px;font-size:12px;color:var(--dim)">\${escHtml(s)}</div>
      \`).join('')}
    \` : ''}
    \${(d.per_scene||[]).length > 0 ? \`
      <div class="result-title" style="margin-top:16px;margin-bottom:10px">PER SCENE</div>
      \${d.per_scene.map(s => \`
        <div class="card" style="display:flex;align-items:center;gap:12px;padding:10px 14px">
          <div style="font-family:var(--mono);font-weight:700;color:var(--amber);flex-shrink:0">S\${s.scene_n}</div>
          <div style="flex:1;font-size:12px;color:var(--dim)">\${(s.issues||[]).join(', ')||'No issues'}</div>
          <div style="font-family:var(--mono);font-weight:700;\${s.score>=70?'color:var(--green)':'color:var(--red)'}">\${s.score}/100</div>
        </div>
      \`).join('')}
    \` : ''}
  \`;
  // Update tab pill
  const pill = document.getElementById('qcPill');
  if (pill) {
    pill.textContent = d.overall_score;
    pill.style.background = d.passed ? 'rgba(16,185,129,.2)' : 'rgba(239,68,68,.2)';
    pill.style.color = d.passed ? 'var(--green)' : 'var(--red)';
  }
}

function renderRing(score, label, color) {
  const r = 24, circ = 2*Math.PI*r;
  const offset = circ * (1 - score/100);
  return \`<div class="qc-ring-wrap">
    <svg viewBox="0 0 56 56" width="56" height="56" style="transform:rotate(-90deg)">
      <circle cx="28" cy="28" r="\${r}" fill="none" stroke="#2A2A38" stroke-width="4"/>
      <circle cx="28" cy="28" r="\${r}" fill="none" stroke="\${color}" stroke-width="4"
        stroke-dasharray="\${circ}" stroke-dashoffset="\${offset}" stroke-linecap="round"/>
    </svg>
    <span style="font-family:var(--mono);font-size:11px;font-weight:700;color:\${color};\
      position:relative;top:-38px;display:block;text-align:center;">\${score}</span>
    <span style="margin-top:-28px">\${label}</span>
  </div>\`;
}

function renderEdit(d, script) {
  if (!d) return;
  const p = document.getElementById('panel-edit');
  const total = d.total_duration_sec || 30;
  const clips = d.timeline || [];
  const COLORS = ['#F59E0B','#8B5CF6','#EC4899','#06B6D4','#10B981','#3B82F6','#F97316','#EF4444'];
  p.innerHTML = \`
    <div class="result-section">
      <div class="result-title">Final Timeline (\${d.total_duration_sec}s)</div>
      <div class="timeline-bar">
        \${clips.map((c,i) => {
          const dur = (c.end_sec||0)-(c.start_sec||0);
          const pct = (dur/total*100).toFixed(1);
          return \`<div class="timeline-clip" style="width:\${pct}%;background:\${COLORS[i%COLORS.length]}22;color:\${COLORS[i%COLORS.length]}">S\${c.scene_n||i+1}</div>\`;
        }).join('')}
      </div>
      \${d.edit_notes ? \`<div class="card" style="margin-top:10px"><div class="card-label">EDITOR NOTES</div><div class="card-value">\${escHtml(d.edit_notes)}</div></div>\` : ''}
    </div>
    <div class="result-section">
      <div class="result-title">Social Cutdowns</div>
      \${(d.social_cutdowns||[]).map(c => \`
        <div class="card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div style="font-weight:700;font-size:13px">\${escHtml(c.platform||'')} <span style="font-weight:400;color:var(--muted);font-size:12px">\${c.duration_sec}s</span></div>
            <div style="font-family:var(--mono);font-size:10px;color:var(--cyan)">scenes [\${(c.scenes||[]).join(',')}]</div>
          </div>
          <div style="font-size:12px;color:var(--amber);font-weight:600;margin-bottom:4px">Hook: \${escHtml(c.hook||'')}</div>
          \${c.caption ? \`<div style="font-size:12px;color:var(--dim);font-style:italic">\${escHtml(c.caption)}</div>\` : ''}
        </div>
      \`).join('')}
    </div>
    <div class="result-section">
      <div class="result-title">Alt Opening Hooks (A/B Test)</div>
      \${(d.alt_hooks||[]).map(h => \`
        <div class="card">
          <div style="font-family:var(--mono);color:var(--amber);font-size:11px;margin-bottom:4px">VERSION \${escHtml(h.version||'')}</div>
          <div style="font-size:13px;font-weight:600;margin-bottom:4px">\${escHtml(h.hook_text||'')}</div>
          <div style="font-size:12px;color:var(--dim)">\${escHtml(h.rationale||'')}</div>
        </div>
      \`).join('')}
    </div>
    <div class="result-section">
      <div class="result-title">Export Formats</div>
      \${(d.export_formats||[]).map(f => \`
        <div class="card" style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px">
          <div style="font-weight:600">\${escHtml(f.platform||'')}</div>
          <div style="font-family:var(--mono);font-size:11px;color:var(--muted)">
            \${f.resolution||''} · \${f.fps||24}fps · \${f.codec||'h264'}
          </div>
        </div>
      \`).join('')}
    </div>
  \`;
}

// ─── PIPELINE LAUNCH ─────────────────────────────────────────────────────────
async function launch() {
  const apiKey = document.getElementById('apiKey').value.trim();
  if (!apiKey) { alert('Enter your Anthropic API key first.'); return; }

  const input = {
    product_name: document.getElementById('productName').value.trim(),
    product_description: document.getElementById('productDesc').value.trim(),
    brand_name: document.getElementById('brandName').value.trim(),
    brand_identity: document.getElementById('brandIdentity').value.trim(),
    target_audience: document.getElementById('audience').value.trim(),
    desired_emotion: state.emotion,
    platform: state.platform,
    duration: state.duration,
    references: document.getElementById('references').value.trim(),
  };

  if (!input.product_name || !input.brand_name) {
    alert('Product name and brand name are required.'); return;
  }

  // Reset
  state.running = true;
  state.outputs = {};
  document.getElementById('launchBtn').disabled = true;
  document.getElementById('launchBtn').textContent = 'Running...';
  setStatus('running', 'running');

  // Clear log
  const logPanel = document.getElementById('panel-log');
  logPanel.innerHTML = '';
  showTab('log');

  // Reset graph
  Object.keys(NODE_COLORS).forEach(id => setNodeStatus(id, 'idle'));

  const body = JSON.stringify({ input, apiKey });

  try {
    const res = await fetch('/api/run', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body,
    });

    if (!res.ok) throw new Error('Server error: ' + res.status);
    if (!res.body) throw new Error('No stream');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const evt = JSON.parse(line.slice(6));
            handleEvent(evt);
          } catch {}
        }
      }
    }
  } catch (err) {
    appendLog('var(--red)', 'PIPELINE', 'Error: ' + err.message, '', '');
    setStatus('error', 'error');
  } finally {
    state.running = false;
    document.getElementById('launchBtn').disabled = false;
    document.getElementById('launchBtn').textContent = 'Launch Pipeline';
  }
}

function handleEvent(evt) {
  switch (evt.type) {
    case 'pipeline_start':
      appendLog('var(--amber)', 'PIPELINE', evt.message, '', '');
      break;
    case 'agent_start':
      setNodeStatus(evt.agent, 'running');
      appendLog(evt.color, evt.label, 'Starting...', '', '');
      break;
    case 'agent_complete':
      setNodeStatus(evt.agent, 'completed');
      state.outputs[evt.agent] = evt.output;
      // Render output tab
      renderAgentTab(evt.agent, evt.output);
      appendLog(evt.color, evt.label, 'Complete', evt.reasoning, evt.tokens);
      break;
    case 'agent_error':
      setNodeStatus(evt.agent, 'error');
      appendLog('var(--red)', evt.label, 'Error: ' + evt.error, '', '');
      break;
    case 'pipeline_complete':
      setStatus('done', 'complete');
      appendLog('var(--green)', 'PIPELINE', evt.message, '', '');
      if (evt.qc_score !== undefined) {
        appendLog('var(--green)', 'QC', \`Score: \${evt.qc_score}/100 — \${evt.qc_passed ? 'PASSED ✓' : 'FAILED ✗'}\`, '', '');
      }
      // Show QC tab
      if (evt.outputs?.quality_control) {
        renderQC(evt.outputs.quality_control);
      }
      break;
  }
}

function renderAgentTab(agentId, output) {
  const map = {
    screenwriter: () => renderScript(output),
    creative_director: () => renderVisual(output),
    storyboard: () => renderStoryboard(output),
    shot_list: () => renderShots(output),
    music_sound: () => renderMusic(output),
    video_generation: () => renderVideo(output),
    quality_control: () => renderQC(output),
    editor: () => renderEdit(output, state.outputs.screenwriter),
  };
  map[agentId]?.();
}

// ─── UTILS ───────────────────────────────────────────────────────────────────
function setStatus(dotClass, text) {
  const dot = document.getElementById('statusDot');
  const txt = document.getElementById('statusText');
  dot.className = 'status-dot ' + dotClass;
  txt.textContent = text;
}

function escHtml(str) {
  return String(str||'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function copy(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const old = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = old, 1500);
  });
}

// Load API key from localStorage
const savedKey = localStorage.getItem('cs_api_key');
if (savedKey) document.getElementById('apiKey').value = savedKey;
document.getElementById('apiKey').addEventListener('change', e => {
  localStorage.setItem('cs_api_key', e.target.value);
});
</script>
</body>
</html>`;

// ---------------------------------------------------------------------------
// HTTP SERVER
// ---------------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/run') {
    let body = '';
    for await (const chunk of req) body += chunk;
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      res.writeHead(400);
      res.end('Bad request');
      return;
    }

    const { input, apiKey } = parsed;
    if (!apiKey) {
      res.writeHead(401);
      res.end('API key required');
      return;
    }

    // SSE response
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    function send(type, data) {
      const payload = JSON.stringify({ type, ...data });
      res.write(`data: ${payload}\n\n`);
    }

    try {
      await runPipeline(input, apiKey, send);
    } catch (err) {
      send('agent_error', { agent: 'pipeline', label: 'PIPELINE', error: err.message });
    }

    res.end();
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║   🎬  CINEMATIC STUDIO                     ║
║   Autonomous AI Production Platform        ║
╠════════════════════════════════════════════╣
║   Running at  http://localhost:${PORT}        ║
║                                            ║
║   Set ANTHROPIC_API_KEY env var OR         ║
║   paste your key in the browser UI         ║
╚════════════════════════════════════════════╝
`);
});
