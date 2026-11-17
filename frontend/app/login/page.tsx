"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { signIn } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import "../auth.css";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim()) return setError("Please enter your email address.");
    if (!password) return setError("Please enter your password.");

    setLoading(true);
    const result = await signIn(email, password);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/app");
  }

  async function handleGoogleLogin() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <AuthLayout
      side={{
        eyebrow: "WELCOME BACK",
        title: "Your inner weather is waiting.",
        subtitle:
          "Pick up where you left off — your check-ins, activities and gentle little wins are all here.",
        mascots: [
          { type: "sunny", size: 120 },
          { type: "cloudy", size: 150 },
          { type: "wiggles", size: 110 },
        ],
        quote: "Every feeling belongs. Even the cloudy ones.",
      }}
    >
      <div className="auth-head">
        <span className="pill lavender">LOG IN</span>
        <h1>
          Good to see you <em>again.</em>
        </h1>
        <p>Log in to continue your check-ins with MoodMate.</p>
      </div>

      <button type="button" className="auth-google" onClick={handleGoogleLogin}>
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C41.4 35.3 44 30.1 44 24c0-1.3-.1-2.3-.4-3.5z" />
        </svg>
        Continue with Google
      </button>

      <div className="auth-divider"><span>or</span></div>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <label className="auth-field">
          <span>Email address</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </label>

        <label className="auth-field">
          <span>Password</span>
          <div className="auth-input-wrap">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
            />
            <button
              type="button"
              className="auth-peek"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </label>

        <div className="auth-row">
          <label className="auth-check">
            <input type="checkbox" defaultChecked />
            <span>Keep me signed in</span>
          </label>
          <Link href="/forgot-password" className="auth-link">
            Forgot password?
          </Link>
        </div>

        {error && <p className="auth-error" role="alert">{error}</p>}

        <button type="submit" className="primary auth-submit" disabled={loading}>
          {loading ? "Logging in…" : "Log in"}
        </button>

        <button type="button" className="auth-ghost" onClick={() => router.push("/checkin")}>
          Continue without an account
        </button>
      </form>

      <p className="auth-switch">
        New to MoodMate?{" "}
        <Link href="/signup" className="auth-link strong">Create an account</Link>
      </p>
    </AuthLayout>
  );
}