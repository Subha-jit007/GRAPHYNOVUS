import { ListView } from "@/components/tasks/ListView";

export default function ListViewPage({
  params,
}: {
  params: { id: string };
}) {
  return <ListView projectId={params.id} />;
}
