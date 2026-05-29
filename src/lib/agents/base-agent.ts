import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type {
  AgentType,
  AgentStatus,
  ProjectContext,
} from "@/lib/types";

export interface AgentRunResult<T> {
  success: boolean;
  output?: T;
  reasoning?: string;
  error?: string;
  duration_ms: number;
  token_usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export abstract class BaseAgent<TOutput> {
  abstract readonly agentType: AgentType;
  abstract readonly systemPrompt: string;

  protected readonly model = anthropic("claude-sonnet-4-6");

  protected async callClaude(
    userPrompt: string,
    maxTokens = 4096
  ): Promise<{ text: string; usage: { promptTokens: number; completionTokens: number; totalTokens: number } }> {
    const result = await generateText({
      model: this.model,
      system: this.systemPrompt,
      prompt: userPrompt,
      maxTokens,
    });
    return {
      text: result.text,
      usage: {
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
      },
    };
  }

  protected parseJSON<T>(text: string): T {
    const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) ??
      text.match(/\{[\s\S]*\}/) ??
      text.match(/\[[\s\S]*\]/);
    const jsonStr = jsonMatch ? (jsonMatch[1] ?? jsonMatch[0]) : text;
    return JSON.parse(jsonStr) as T;
  }

  abstract execute(context: ProjectContext): Promise<AgentRunResult<TOutput>>;

  async run(context: ProjectContext): Promise<AgentRunResult<TOutput>> {
    const db = createServiceRoleClient();
    const startedAt = Date.now();

    // Create agent run record
    const { data: runRecord } = await db
      .from("agent_runs")
      .insert({
        project_id: context.project.id,
        agent_type: this.agentType,
        status: "running" as AgentStatus,
        started_at: new Date().toISOString(),
        input_data: this.buildInputSummary(context),
      })
      .select()
      .single();

    // Emit agent_started event
    await db.from("studio_events").insert({
      project_id: context.project.id,
      event_type: "agent_started",
      agent_type: this.agentType,
      payload: { agent_run_id: runRecord?.id },
      message: `${this.agentType.replace("_", " ")} agent started`,
    });

    let result: AgentRunResult<TOutput>;
    try {
      result = await this.execute(context);
    } catch (err) {
      result = {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        duration_ms: Date.now() - startedAt,
      };
    }

    const duration_ms = Date.now() - startedAt;

    // Update agent run record
    if (runRecord) {
      await db
        .from("agent_runs")
        .update({
          status: result.success ? "completed" : ("failed" as AgentStatus),
          completed_at: new Date().toISOString(),
          duration_ms,
          output_data: result.output as Record<string, unknown>,
          reasoning: result.reasoning,
          error_message: result.error,
          token_usage: result.token_usage,
        })
        .eq("id", runRecord.id);
    }

    // Emit completion event
    await db.from("studio_events").insert({
      project_id: context.project.id,
      event_type: result.success ? "agent_completed" : "agent_failed",
      agent_type: this.agentType,
      payload: {
        agent_run_id: runRecord?.id,
        duration_ms,
        success: result.success,
      },
      message: result.success
        ? `${this.agentType.replace("_", " ")} completed successfully`
        : `${this.agentType.replace("_", " ")} failed: ${result.error}`,
    });

    return { ...result, duration_ms };
  }

  protected buildInputSummary(context: ProjectContext): Record<string, unknown> {
    return {
      project_id: context.project.id,
      product: context.input.product_name,
      platform: context.input.platform,
      duration: context.input.video_duration_sec,
    };
  }
}
