import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { StudioNav } from "@/components/layout/studio-nav";
import { StudioView } from "./studio-view";
import type { Project, AgentRun, Scene, QualityScore, GenerationJob, StudioEvent, ProjectInput } from "@/lib/types";

async function getProjectData(id: string) {
  const db = createServiceRoleClient();
  const [
    { data: project },
    { data: input },
    { data: agentRuns },
    { data: scenes },
    { data: qualityScores },
    { data: jobs },
    { data: events },
  ] = await Promise.all([
    db.from("projects").select("*").eq("id", id).single(),
    db.from("project_inputs").select("*").eq("project_id", id).single(),
    db.from("agent_runs").select("*").eq("project_id", id).order("created_at", { ascending: false }),
    db.from("scenes").select("*").eq("project_id", id).order("scene_number"),
    db.from("quality_scores").select("*").eq("project_id", id).order("created_at", { ascending: false }),
    db.from("generation_jobs").select("*").eq("project_id", id).order("created_at", { ascending: false }).limit(50),
    db.from("studio_events").select("*").eq("project_id", id).order("created_at", { ascending: false }).limit(100),
  ]);

  return { project, input, agentRuns, scenes, qualityScores, jobs, events };
}

export default async function ProjectStudioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { project, input, agentRuns, scenes, qualityScores, jobs, events } =
    await getProjectData(id);

  if (!project) notFound();

  return (
    <div className="h-screen flex flex-col bg-studio-bg">
      <StudioNav project={project as Project} />
      <StudioView
        project={project as Project}
        input={input as ProjectInput}
        initialAgentRuns={(agentRuns as AgentRun[]) ?? []}
        initialScenes={(scenes as Scene[]) ?? []}
        initialQualityScores={(qualityScores as QualityScore[]) ?? []}
        initialJobs={(jobs as GenerationJob[]) ?? []}
        initialEvents={(events as StudioEvent[]) ?? []}
      />
    </div>
  );
}
