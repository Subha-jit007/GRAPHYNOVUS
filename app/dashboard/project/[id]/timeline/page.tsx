export default function TimelineViewPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Timeline</h1>
      <p className="text-sm text-muted-foreground">
        Drag-to-adjust timeline view. Phase 2 per PRD §9.
      </p>
      {/* TODO(Phase 2): Gantt-style timeline with cascade impact integration */}
    </div>
  );
}
