import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase";
import { UserMenu } from "@/components/dashboard/UserMenu";
import { SidebarProjectList } from "@/components/dashboard/SidebarProjectList";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defense-in-depth: middleware already gates this group, but verifying here
  // means the layout never renders for an unauthenticated user even if the
  // matcher misses an edge case.
  const supabase = getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 border-r border-border bg-surface/40 p-4 space-y-4">
        <Link href="/dashboard" className="font-display text-xl font-bold block">
          Graphynovus
        </Link>
        <nav className="space-y-1 text-sm">
          <p className="text-muted-foreground text-xs uppercase tracking-wider pt-4 pb-1">
            Projects
          </p>
          <SidebarProjectList />
        </nav>
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="h-14 border-b border-border flex items-center px-6 justify-between">
          <div className="text-sm text-muted-foreground">Dashboard</div>
          <UserMenu email={user.email} />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
