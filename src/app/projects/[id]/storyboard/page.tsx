import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { StudioNav } from "@/components/layout/studio-nav";
import { StoryboardViewer } from "@/components/storyboard/storyboard-viewer";
import type { Project, Scene, StoryboardFrame } from "@/lib/types";

export default async function StoryboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createServiceRoleClient();

  const [{ data: project }, { data: scenes }, { data: frames }] = await Promise.all([
    db.from("projects").select("*").eq("id", id).single(),
    db.from("scenes").select("*").eq("project_id", id).order("scene_number"),
    db.from("storyboard_frames").select("*").eq("project_id", id).order("frame_number"),
  ]);

  if (!project) notFound();

  return (
    <div className="h-screen flex flex-col bg-studio-bg">
      <StudioNav project={project as Project} />
      <div className="flex-1 overflow-hidden">
        <StoryboardViewer
          frames={(frames as StoryboardFrame[]) ?? []}
          scenes={(scenes as Scene[]) ?? []}
        />
      </div>
    </div>
  );
}
