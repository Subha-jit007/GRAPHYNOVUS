import { KanbanBoard } from "@/components/kanban/KanbanBoard";

export default function KanbanViewPage({
  params,
}: {
  params: { id: string };
}) {
  return <KanbanBoard projectId={params.id} />;
}
