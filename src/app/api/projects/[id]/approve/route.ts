import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { ApproveSceneRequest, APIResponse } from "@/lib/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await req.json()) as ApproveSceneRequest;
  const db = createServiceRoleClient();

  if (body.action === "approve") {
    await db
      .from("scenes")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: "human",
      })
      .eq("id", body.scene_id)
      .eq("project_id", id);
  } else {
    await db
      .from("scenes")
      .update({
        status: "rejected",
        rejection_reason: body.rejection_reason,
      })
      .eq("id", body.scene_id)
      .eq("project_id", id);

    // Enqueue regeneration
    await db.from("generation_jobs").insert({
      project_id: id,
      job_type: "REGENERATE_SCENE",
      priority: 9,
      payload: {
        scene_id: body.scene_id,
        rejection_reason: body.rejection_reason,
      },
    });
  }

  await db.from("studio_events").insert({
    project_id: id,
    event_type: body.action === "approve" ? "qc_scored" : "revision_requested",
    scene_id: body.scene_id,
    payload: { action: body.action, reason: body.rejection_reason },
    message: `Scene ${body.action === "approve" ? "approved" : "rejected"} by human reviewer`,
  });

  return NextResponse.json<APIResponse>({ success: true });
}

// Approve entire project (pipeline continue)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = createServiceRoleClient();

  await db
    .from("projects")
    .update({ status: "running" })
    .eq("id", id);

  // Re-trigger orchestrator from editing stage
  const { MasterOrchestrator } = await import("@/lib/orchestrator/master-orchestrator");
  const orchestrator = new MasterOrchestrator();
  orchestrator.run(id).catch(console.error);

  return NextResponse.json<APIResponse>({ success: true, data: { message: "Pipeline resumed" } });
}
