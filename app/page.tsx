import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <div className="max-w-3xl space-y-6">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-secondary">
          Gemini AI Project Board
        </p>
        <h1 className="font-display text-5xl sm:text-7xl font-bold text-balance">
          Stop managing tasks.{" "}
          <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Start executing goals.
          </span>
        </h1>
        <p className="text-lg text-muted-foreground text-balance">
          Graphynovus turns raw ideas into executable plans using a neural graph engine
          powered by Google Gemini.
        </p>
        <div className="flex items-center justify-center gap-3 pt-4">
          <Link
            href="/signup"
            className="rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground hover:opacity-90 transition"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-border px-6 py-3 font-medium hover:bg-surface transition"
          >
            Log in
          </Link>
        </div>
      </div>
    </main>
  );
}
