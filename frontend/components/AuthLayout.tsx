"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { AuthMascot } from "./AuthMascot";

type MascotSpec = {
  type: "sunny" | "cloudy" | "spark" | "wiggles";
  size: number;
};

export function AuthLayout({
  children,
  side,
}: {
  children: ReactNode;
  side: {
    eyebrow: string;
    title: string;
    subtitle: string;
    mascots: MascotSpec[];
    quote: string;
  };
}) {
  return (
    <div className="auth-shell">
      <div className="auth-form-panel">
        <Link href="/login" className="auth-brand" aria-label="MoodMate home">
          <span className="brand-mark"><span /><span /></span>
          <span>MoodMate</span>
        </Link>

        <div className="auth-form-wrap">{children}</div>

        <p className="auth-footer-note">
          A small pause for your brain. All feelings welcome.
        </p>
      </div>

      <aside className="auth-illustration">
        <div className="auth-orbit orbit-a" />
        <div className="auth-orbit orbit-b" />
        <span className="auth-sparkle s1">✦</span>
        <span className="auth-sparkle s2">✦</span>

        <div className="auth-illustration-copy">
          <span className="eyebrow">{side.eyebrow}</span>
          <h2>{side.title}</h2>
          <p>{side.subtitle}</p>
        </div>

        <div className="auth-mascot-row">
          {side.mascots.map((m, i) => (
            <div key={i} className={`auth-mascot-item item-${i}`}>
              <AuthMascot type={m.type} size={m.size} mood="excited" />
            </div>
          ))}
        </div>

        <blockquote className="auth-quote">
          <span className="quote-mark">“</span>
          {side.quote}
        </blockquote>
      </aside>
    </div>
  );
}