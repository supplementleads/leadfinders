import { NextRequest, NextResponse } from "next/server";
import { MasterOrchestrator } from "@/lib/orchestrator/master-orchestrator";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { APIResponse } from "@/lib/types";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = createServiceRoleClient();

  const { data: project } = await db
    .from("projects")
    .select("status")
    .eq("id", id)
    .single();

  if (!project) {
    return NextResponse.json<APIResponse>({ success: false, error: "Project not found" }, { status: 404 });
  }

  if (project.status === "running") {
    return NextResponse.json<APIResponse>({ success: false, error: "Pipeline already running" }, { status: 409 });
  }

  // Fire-and-forget — orchestrator runs in background
  const orchestrator = new MasterOrchestrator();
  orchestrator.run(id).catch((err) => {
    console.error(`Orchestrator error for project ${id}:`, err);
  });

  return NextResponse.json<APIResponse>(
    { success: true, data: { message: "Pipeline started", project_id: id } },
    { status: 202 }
  );
}
