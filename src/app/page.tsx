import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import type { Project } from "@/lib/types";

async function getProjects(): Promise<Project[]> {
  try {
    const db = createServiceRoleClient();
    const { data } = await db
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    return (data as Project[]) ?? [];
  } catch {
    return [];
  }
}

const statusStyle: Record<string, { dot: string; text: string }> = {
  draft: { dot: "bg-studio-muted", text: "text-studio-muted" },
  running: { dot: "bg-studio-amber animate-pulse", text: "text-studio-amber" },
  paused: { dot: "bg-studio-purple", text: "text-studio-purple" },
  awaiting_approval: { dot: "bg-studio-purple animate-pulse", text: "text-studio-purple" },
  completed: { dot: "bg-studio-green", text: "text-studio-green" },
  failed: { dot: "bg-studio-red", text: "text-studio-red" },
};

export default async function DashboardPage() {
  const projects = await getProjects();

  return (
    <div className="min-h-screen bg-studio-bg">
      {/* Header */}
      <header className="border-b border-studio-border bg-studio-surface">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-studio-amber rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 24 24">
                <path d="M2 6a2 2 0 012-2h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold text-studio-text">Cinematic Studio</h1>
              <p className="text-xs text-studio-muted font-mono">AI Production Platform</p>
            </div>
          </div>
          <Link href="/projects/new">
            <Button variant="primary" size="sm">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Project
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Projects", value: projects.length },
            { label: "Running", value: projects.filter((p) => p.status === "running").length },
            { label: "Completed", value: projects.filter((p) => p.status === "completed").length },
            { label: "Awaiting Review", value: projects.filter((p) => p.status === "awaiting_approval").length },
          ].map((stat) => (
            <div key={stat.label} className="bg-studio-surface border border-studio-border rounded-xl p-4">
              <div className="text-2xl font-bold font-mono text-studio-text">{stat.value}</div>
              <div className="text-xs text-studio-muted mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Project grid */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-studio-text">Projects</h2>
          <span className="text-xs font-mono text-studio-muted">{projects.length} total</span>
        </div>

        {projects.length === 0 ? (
          <div className="border border-dashed border-studio-border rounded-2xl p-16 text-center">
            <div className="w-12 h-12 bg-studio-surface2 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-studio-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-studio-text mb-2">No projects yet</h3>
            <p className="text-sm text-studio-muted mb-4">
              Create your first cinematic AI production
            </p>
            <Link href="/projects/new">
              <Button variant="primary">Start a Project</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => {
              const s = statusStyle[project.status] ?? statusStyle.draft;
              return (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <div className="bg-studio-surface border border-studio-border rounded-xl p-4 hover:border-studio-amber/40 transition-all duration-200 group amber-glow hover:amber-glow cursor-pointer h-full">
                    {/* Thumbnail placeholder */}
                    <div className="aspect-video bg-studio-bg rounded-lg mb-4 flex items-center justify-center border border-studio-border/50 scanlines relative overflow-hidden">
                      <div className="text-studio-muted/30 font-mono text-xs">NO PREVIEW</div>
                      {project.status === "running" && (
                        <div className="absolute top-2 right-2 flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-studio-amber animate-pulse" />
                          <span className="text-xs font-mono text-studio-amber">LIVE</span>
                        </div>
                      )}
                    </div>

                    <h3 className="text-sm font-semibold text-studio-text mb-2 group-hover:text-studio-amber transition-colors">
                      {project.name}
                    </h3>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                        <span className={`text-xs font-mono capitalize ${s.text}`}>
                          {project.status.replace("_", " ")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {project.autonomous && (
                          <span className="text-xs font-mono text-studio-green/70">AUTO</span>
                        )}
                        <span className="text-xs font-mono text-studio-muted">
                          {new Date(project.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
