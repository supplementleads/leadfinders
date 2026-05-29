import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { APIResponse } from "@/lib/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = createServiceRoleClient();

  const { data, error } = await db
    .from("projects")
    .select(`
      *,
      project_inputs(*),
      agent_runs(* ORDER BY created_at DESC),
      scenes(* ORDER BY scene_number ASC),
      quality_scores(* ORDER BY created_at DESC LIMIT 1),
      generation_jobs(* ORDER BY created_at DESC LIMIT 20)
    `)
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json<APIResponse>(
      { success: false, error: error.message },
      { status: error.code === "PGRST116" ? 404 : 500 }
    );
  }

  return NextResponse.json<APIResponse<unknown>>({ success: true, data });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const db = createServiceRoleClient();

  const { data, error } = await db
    .from("projects")
    .update({ name: body.name, autonomous: body.autonomous })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json<APIResponse>({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json<APIResponse<unknown>>({ success: true, data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = createServiceRoleClient();

  const { error } = await db.from("projects").delete().eq("id", id);

  if (error) {
    return NextResponse.json<APIResponse>({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json<APIResponse>({ success: true });
}
