import { createServiceRoleClient } from "@/lib/supabase/server";
import type { GenerationJob, JobType } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";

export interface EnqueueOptions {
  project_id: string;
  job_type: JobType;
  payload: Record<string, unknown>;
  priority?: number;
  delay_ms?: number;
  max_attempts?: number;
}

export async function enqueueJob(opts: EnqueueOptions): Promise<GenerationJob> {
  const db = createServiceRoleClient();
  const scheduled_at = opts.delay_ms
    ? new Date(Date.now() + opts.delay_ms).toISOString()
    : new Date().toISOString();

  const { data, error } = await db
    .from("generation_jobs")
    .insert({
      id: uuidv4(),
      project_id: opts.project_id,
      job_type: opts.job_type,
      job_status: "pending",
      priority: opts.priority ?? 5,
      payload: opts.payload,
      max_attempts: opts.max_attempts ?? 3,
      scheduled_at,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to enqueue job: ${error.message}`);
  return data as GenerationJob;
}

export async function claimNextJob(workerId: string): Promise<GenerationJob | null> {
  const db = createServiceRoleClient();
  const { data } = await db.rpc("claim_next_job", { worker_id: workerId });
  if (!data || (Array.isArray(data) && data.length === 0)) return null;
  return (Array.isArray(data) ? data[0] : data) as GenerationJob;
}

export async function completeJob(
  jobId: string,
  result: Record<string, unknown>
): Promise<void> {
  const db = createServiceRoleClient();
  await db
    .from("generation_jobs")
    .update({
      job_status: "completed",
      completed_at: new Date().toISOString(),
      result,
    })
    .eq("id", jobId);
}

export async function failJob(
  jobId: string,
  error: string,
  job: GenerationJob
): Promise<void> {
  const db = createServiceRoleClient();
  const isDead = job.attempt >= job.max_attempts;
  await db
    .from("generation_jobs")
    .update({
      job_status: isDead ? "dead_letter" : "pending",
      error_message: error,
      scheduled_at: isDead
        ? new Date().toISOString()
        : new Date(Date.now() + Math.pow(2, job.attempt) * 1000).toISOString(),
      locked_until: null,
      locked_by: null,
    })
    .eq("id", jobId);
}

export async function getQueueStats(projectId: string): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  dead_letter: number;
}> {
  const db = createServiceRoleClient();
  const { data } = await db
    .from("generation_jobs")
    .select("job_status")
    .eq("project_id", projectId);

  const stats = { pending: 0, processing: 0, completed: 0, failed: 0, dead_letter: 0 };
  for (const job of data ?? []) {
    stats[job.job_status as keyof typeof stats]++;
  }
  return stats;
}
