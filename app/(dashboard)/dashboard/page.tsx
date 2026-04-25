import { NewProjectDialog } from "@/components/dashboard/NewProjectDialog";
import { ProjectGrid } from "@/components/dashboard/ProjectGrid";
import { TodayFocus } from "@/components/dashboard/TodayFocus";

export default function DashboardHomePage() {
  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-display text-3xl font-bold">Today&apos;s Focus</h1>
        <p className="text-sm text-muted-foreground">
          AI-curated 3–5 most important tasks across all projects.
        </p>
        <div className="mt-4">
          <TodayFocus />
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold">Projects</h2>
          <NewProjectDialog />
        </div>
        <div className="mt-4">
          <ProjectGrid />
        </div>
      </section>
    </div>
  );
}
