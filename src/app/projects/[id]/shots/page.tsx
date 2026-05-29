import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { StudioNav } from "@/components/layout/studio-nav";
import { ShotListManager } from "@/components/shots/shot-list-manager";
import type { Project, ShotListEntry } from "@/lib/types";

export default async function ShotsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createServiceRoleClient();

  const [{ data: project }, { data: shots }] = await Promise.all([
    db.from("projects").select("*").eq("id", id).single(),
    db.from("shot_lists").select("*").eq("project_id", id).order("shot_number"),
  ]);

  if (!project) notFound();

  return (
    <div className="h-screen flex flex-col bg-studio-bg">
      <StudioNav project={project as Project} />
      <div className="flex-1 overflow-hidden">
        <ShotListManager shots={(shots as ShotListEntry[]) ?? []} />
      </div>
    </div>
  );
}
