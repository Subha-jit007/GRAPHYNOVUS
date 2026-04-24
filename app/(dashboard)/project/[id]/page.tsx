import { redirect } from "next/navigation";

export default function ProjectDefaultPage({
  params,
}: {
  params: { id: string };
}) {
  // Primary view per PRD §7.2 is the Neural Task Graph
  redirect(`/project/${params.id}/graph`);
}
