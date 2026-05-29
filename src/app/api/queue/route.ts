import { NextRequest, NextResponse } from "next/server";
import { getQueueStats, enqueueJob } from "@/lib/queue/job-queue";
import type { APIResponse } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("project_id");

  if (!projectId) {
    return NextResponse.json<APIResponse>({ success: false, error: "project_id required" }, { status: 400 });
  }

  const stats = await getQueueStats(projectId);
  return NextResponse.json<APIResponse<typeof stats>>({ success: true, data: stats });
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const job = await enqueueJob({
    project_id: body.project_id,
    job_type: body.job_type,
    payload: body.payload ?? {},
    priority: body.priority,
    delay_ms: body.delay_ms,
  });

  return NextResponse.json<APIResponse<typeof job>>({ success: true, data: job }, { status: 201 });
}
