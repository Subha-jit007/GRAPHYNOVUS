"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Mail, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getBrowserSupabase } from "@/lib/supabase";

type Mode = "login" | "signup";

interface AuthFormProps {
  mode: Mode;
}

const COPY: Record<Mode, { title: string; subtitle: string; cta: string; switchHref: string; switchLabel: string }> = {
  login: {
    title: "Welcome back",
    subtitle: "Log in to your execution cortex.",
    cta: "Send magic link",
    switchHref: "/signup",
    switchLabel: "Don't have an account? Sign up",
  },
  signup: {
    title: "Create your account",
    subtitle: "Start executing goals, not managing tasks.",
    cta: "Send magic link",
    switchHref: "/login",
    switchLabel: "Already have an account? Log in",
  },
};

export function AuthForm({ mode }: AuthFormProps) {
  const copy = COPY[mode];
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState<"google" | "magic" | null>(null);
  const [message, setMessage] = useState<
    | { kind: "success"; text: string }
    | { kind: "error"; text: string }
    | null
  >(null);

  const callbackUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback`
      : undefined;

  async function handleGoogle() {
    setMessage(null);
    setPending("google");
    const supabase = getBrowserSupabase();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl,
      },
    });
    if (error) {
      setPending(null);
      setMessage({ kind: "error", text: error.message });
    }
    // On success Supabase performs a full-page redirect to Google.
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setMessage(null);
    setPending("magic");
    const supabase = getBrowserSupabase();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: callbackUrl,
        shouldCreateUser: mode === "signup",
      },
    });
    setPending(null);
    if (error) {
      setMessage({ kind: "error", text: error.message });
    } else {
      setMessage({
        kind: "success",
        text: `Check ${email} for a sign-in link.`,
      });
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 text-primary">
            <Sparkles className="h-5 w-5" />
            <span className="font-display text-sm uppercase tracking-[0.2em]">
              Graphynovus
            </span>
          </div>
          <h1 className="font-display text-3xl font-bold text-balance">
            {copy.title}
          </h1>
          <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
        </div>

        <div className="glass rounded-2xl p-6 sm:p-8 space-y-5 shadow-[0_0_40px_-20px_hsl(var(--primary))]">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            onClick={handleGoogle}
            disabled={pending !== null}
          >
            {pending === "google" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            Continue with Google
          </Button>

          <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or email
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleMagicLink} className="space-y-3">
            <label htmlFor="email" className="sr-only">
              Email
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={pending !== null}
            />
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={pending !== null || !email}
            >
              {pending === "magic" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              {copy.cta}
            </Button>
          </form>

          {message && (
            <p
              className={
                message.kind === "success"
                  ? "text-sm text-secondary"
                  : "text-sm text-destructive"
              }
              role="status"
            >
              {message.text}
            </p>
          )}
        </div>

        <p className="text-center text-sm text-muted-foreground">
          <Link
            href={copy.switchHref}
            className="text-primary underline-offset-4 hover:underline"
          >
            {copy.switchLabel}
          </Link>
        </p>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
    >
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.4 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.07-1.1-.16-1.6H12z"
      />
    </svg>
  );
}
