import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { CreateProjectRequest, APIResponse, Project } from "@/lib/types";

export async function GET(req: NextRequest) {
  const db = createServiceRoleClient();
  const { searchParams } = new URL(req.url);
  const limit = Number(searchParams.get("limit") ?? "20");
  const offset = Number(searchParams.get("offset") ?? "0");

  const { data, error } = await db
    .from("projects")
    .select("*, project_inputs(*)")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json<APIResponse>({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json<APIResponse<unknown>>({ success: true, data });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as CreateProjectRequest;
  const db = createServiceRoleClient();

  const { data: project, error: projectError } = await db
    .from("projects")
    .insert({
      name: body.name,
      status: "draft",
      autonomous: body.autonomous ?? false,
    })
    .select()
    .single();

  if (projectError || !project) {
    return NextResponse.json<APIResponse>(
      { success: false, error: projectError?.message ?? "Failed to create project" },
      { status: 500 }
    );
  }

  const { error: inputError } = await db.from("project_inputs").insert({
    project_id: project.id,
    ...body.input,
  });

  if (inputError) {
    await db.from("projects").delete().eq("id", project.id);
    return NextResponse.json<APIResponse>(
      { success: false, error: inputError.message },
      { status: 500 }
    );
  }

  return NextResponse.json<APIResponse<Project>>(
    { success: true, data: project as Project },
    { status: 201 }
  );
}
