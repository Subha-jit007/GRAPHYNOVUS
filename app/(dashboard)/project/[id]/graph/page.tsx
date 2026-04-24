import { TaskGraph } from "@/components/graph/TaskGraph";
import { CortexPanel } from "@/components/ai/CortexPanel";
import { ContextSidebar } from "@/components/ai/ContextSidebar";
import { ProjectEntropyBadge } from "@/components/ai/ProjectEntropyBadge";

export default function GraphViewPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4">
      <div className="flex-1 relative rounded-xl border border-border overflow-hidden">
        <TaskGraph projectId={params.id} />
        <div className="absolute top-4 right-4 z-10">
          <ProjectEntropyBadge projectId={params.id} />
        </div>
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[min(720px,90%)]">
          <CortexPanel projectId={params.id} />
        </div>
      </div>
      <ContextSidebar />
    </div>
  );
}
