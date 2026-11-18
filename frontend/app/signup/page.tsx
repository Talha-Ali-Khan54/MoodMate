"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { signUp } from "@/lib/auth";
import "../auth.css";

type Strength = 0 | 1 | 2 | 3 | 4;

function strengthOf(pw: string): Strength {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s as Strength;
}

const STRENGTH_LABEL = ["Too short", "Weak", "Okay", "Good", "Strong"];

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const strength = strengthOf(password);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (name.trim().length < 2) return setError("Please tell us your name.");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("That email doesn’t look right.");
    if (password.length < 8) return setError("Use at least 8 characters for your password.");
    if (password !== confirm) return setError("Passwords don’t match yet.");
    if (!agreed) return setError("Please agree to the wellbeing note to continue.");

    setLoading(true);
    const result = await signUp(name, email, password);
    setLoading(false);
    if (!result.ok) return setError(result.error);
    router.push("/app");
  }

  return (
    <AuthLayout
      side={{
        eyebrow: "JOIN MOODMATE",
        title: "Meet your inner weather.",
        subtitle:
          "A gentle, playful companion for the small feelings and the big ones. No scorecards. No fixing required.",
        mascots: [
          { type: "spark", size: 110 },
          { type: "sunny", size: 150 },
          { type: "cloudy", size: 120 },
        ],
        quote: "You don’t need to untangle everything right now. Just start.",
      }}
    >
      <div className="auth-head">
        <span className="pill mint">SIGN UP</span>
        <h1>Let’s make a little <em>space.</em></h1>
        <p>Create an account to save check-ins, activities and gentle wins.</p>
      </div>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <label className="auth-field">
          <span>What should we call you?</span>
          <input
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Alex"
          />
        </label>

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
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
            <button
              type="button"
              className="auth-peek"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <div className={`auth-strength s-${strength}`} aria-hidden="true">
            {[1, 2, 3, 4].map((i) => (
              <i key={i} className={i <= strength ? "on" : ""} />
            ))}
            <small>{password ? STRENGTH_LABEL[strength] : "Use 8+ characters, a number and a symbol."}</small>
          </div>
        </label>

        <label className="auth-field">
          <span>Confirm password</span>
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Type it again"
          />
          {confirm && confirm !== password && (
            <small className="auth-inline-warn">Passwords don’t match yet.</small>
          )}
        </label>

        <label className="auth-check top">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span>
            I understand MoodMate is a wellbeing companion, not a medical or crisis tool, and I can pause camera access at any time.
          </span>
        </label>

        {error && <p className="auth-error" role="alert">{error}</p>}

        <button type="submit" className="primary auth-submit" disabled={loading}>
          {loading ? "Creating your space…" : "Create my account"}
        </button>
      </form>

      <p className="auth-switch">
        Already have an account?{" "}
        <Link href="/login" className="auth-link strong">Log in</Link>
      </p>
    </AuthLayout>
  );
}