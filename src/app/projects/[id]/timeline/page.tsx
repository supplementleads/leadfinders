import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { StudioNav } from "@/components/layout/studio-nav";
import { TimelineEditor } from "@/components/timeline/timeline-editor";
import type { Project, Scene } from "@/lib/types";

export default async function TimelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createServiceRoleClient();

  const [{ data: project }, { data: scenes }, { data: input }] = await Promise.all([
    db.from("projects").select("*").eq("id", id).single(),
    db.from("scenes").select("*").eq("project_id", id).order("scene_number"),
    db.from("project_inputs").select("video_duration_sec").eq("project_id", id).single(),
  ]);

  if (!project) notFound();

  return (
    <div className="h-screen flex flex-col bg-studio-bg">
      <StudioNav project={project as Project} />
      <div className="flex-1 overflow-hidden">
        <TimelineEditor
          scenes={(scenes as Scene[]) ?? []}
          totalDuration={input?.video_duration_sec ?? 30}
        />
      </div>
    </div>
  );
}
