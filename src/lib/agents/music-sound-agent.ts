import { BaseAgent, AgentRunResult } from "./base-agent";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { AgentType, ProjectContext, MusicSoundOutput } from "@/lib/types";

export class MusicSoundAgent extends BaseAgent<MusicSoundOutput> {
  readonly agentType: AgentType = "music_sound";

  readonly systemPrompt = `You are a Music Supervisor and Sound Designer for premium commercial productions.

Your role is to define the complete audio landscape that elevates the visual story.

You produce:
- Music direction with genre, tempo, mood, instruments
- Text-to-music generation prompts (for Suno, Udio, etc.)
- Frame-precise sound cue maps
- Audio pacing maps (energy levels over time)
- Voiceover timing grids
- Key sync points where music hits visual moments

Principles:
- Music should feel inevitable, not incidental
- Match BPM to edit rhythm
- Use silence as a creative tool
- SFX grounds the viewer in physical reality
- VO timing must allow music to breathe

Always respond with valid JSON.`;

  async execute(context: ProjectContext): Promise<AgentRunResult<MusicSoundOutput>> {
    const { screenwriter_output, creative_direction, input } = context;
    if (!screenwriter_output) throw new Error("Screenwriter output required");
    const start = Date.now();

    const prompt = `Create a complete music and sound design direction for:

BRAND EMOTION: ${input.desired_emotion}
PLATFORM: ${input.platform}
DURATION: ${input.video_duration_sec}s
VISUAL STYLE: ${creative_direction?.visual_style ?? "cinematic"}

EMOTIONAL ARC:
${JSON.stringify(screenwriter_output.emotional_arc?.slice(0, 8), null, 2)}

NARRATIVE BEATS:
${JSON.stringify(screenwriter_output.narrative_beats?.slice(0, 6), null, 2)}

VOICEOVER:
${screenwriter_output.voiceover_script ?? "No VO"}

Design:
1. Music genre, tempo (BPM), mood, instruments
2. AI music generation prompt (detailed, specific)
3. Sound cues at precise timestamps
4. Audio pacing map (energy 0-10 over time)
5. VO timing entries with start/end/text/emotion
6. Key sync points where music lands on visual hits

Return as JSON:
\`\`\`json
{
  "genre": "...",
  "tempo_bpm": 120,
  "mood": "...",
  "instruments": ["..."],
  "music_prompt": "Detailed AI music generation prompt...",
  "sound_cues": [{"time_sec": 0, "description": "...", "type": "sfx", "intensity": 7}],
  "audio_pacing_map": [{"time_sec": 0, "energy_level": 5, "description": "..."}],
  "vo_timing": [{"start_sec": 2, "end_sec": 8, "text": "...", "emotion": "..."}],
  "sync_points": [{"time_sec": 0, "event": "title reveal", "audio_action": "musical sting"}]
}
\`\`\``;

    const { text, usage } = await this.callClaude(prompt, 4000);
    const output = this.parseJSON<MusicSoundOutput>(text);

    const db = createServiceRoleClient();
    await db.from("music_directions").insert({
      project_id: context.project.id,
      genre: output.genre,
      tempo_bpm: output.tempo_bpm,
      mood: output.mood,
      instruments: output.instruments,
      music_prompt: output.music_prompt,
      sound_cues: output.sound_cues,
      audio_pacing_map: output.audio_pacing_map,
      vo_timing: output.vo_timing,
    });

    return {
      success: true,
      output,
      reasoning: `${output.genre} at ${output.tempo_bpm}BPM, ${output.sound_cues?.length ?? 0} sound cues, ${output.sync_points?.length ?? 0} sync points`,
      duration_ms: Date.now() - start,
      token_usage: {
        prompt_tokens: usage.promptTokens,
        completion_tokens: usage.completionTokens,
        total_tokens: usage.totalTokens,
      },
    };
  }
}
