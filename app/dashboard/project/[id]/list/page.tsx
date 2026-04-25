export default function ListViewPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">List</h1>
      <p className="text-sm text-muted-foreground">
        Dense table view for power users.
      </p>
      {/* TODO(MVP): sortable, filterable task table */}
    </div>
  );
}
