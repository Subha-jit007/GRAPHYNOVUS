import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/(dashboard)/actions";

interface UserMenuProps {
  email?: string | null;
}

export function UserMenu({ email }: UserMenuProps) {
  return (
    <div className="flex items-center gap-3">
      {email && (
        <span className="text-sm text-muted-foreground hidden sm:inline">
          {email}
        </span>
      )}
      <form action={signOutAction}>
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-surface transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </form>
    </div>
  );
}
