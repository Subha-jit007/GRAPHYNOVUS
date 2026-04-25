import { TimelineView } from "@/components/timeline/TimelineView";

export default function TimelineViewPage({
  params,
}: {
  params: { id: string };
}) {
  return <TimelineView projectId={params.id} />;
}
