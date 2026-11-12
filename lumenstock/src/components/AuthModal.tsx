"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAuth, type AuthUser } from "./AuthProvider";

export function AuthModal() {
  const { authOpen: open, authMode: initialMode, closeAuth: onClose, setUser: onAuthed } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setError("");
    setUser(null);
    setBusy(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, initialMode, onClose]);

  if (!open) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
        }),
      });
      const data = (await res.json()) as { user?: AuthUser; error?: string };
      if (!res.ok || !data.user) {
        setError(data.error || "Something went wrong. Try again.");
        return;
      }
      onAuthed(data.user);
      setUser(data.user);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-root" role="dialog" aria-modal="true" aria-label={mode === "login" ? "Log in" : "Sign up"}>
      <button type="button" className="modal-backdrop" aria-label="Close" onClick={onClose} />
      <div className="modal-panel auth-modal-panel">
        <button type="button" className="modal-close auth-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className="auth-hero">
          <span className="brand-mark" aria-hidden />
          <div>
            <p className="modal-kicker">Lumenstock</p>
            <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
            <p className="modal-sub">
              {mode === "login"
                ? "Log in with a registered email. Downloads need a paid plan (or super admin)."
                : "Create an account to license HD stock. We only store your name, email, and hashed password."}
            </p>
          </div>
        </div>

        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            className={mode === "login" ? "active" : ""}
            onClick={() => {
              setMode("login");
              setError("");
              setUser(null);
            }}
          >
            Log in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signup"}
            className={mode === "signup" ? "active" : ""}
            onClick={() => {
              setMode("signup");
              setError("");
              setUser(null);
            }}
          >
            Sign up
          </button>
        </div>

        {user ? (
          <div className="auth-success">
            <strong>{mode === "login" ? `Welcome back, ${user.name}.` : `Welcome, ${user.name}.`}</strong>
            {user.role === "super_admin" ? (
              <p>Super admin access — downloads are unlocked.</p>
            ) : user.canDownload ? (
              <p>Paid plan active — you can download HD sizes.</p>
            ) : (
              <ul className="auth-policy">
                <li>You’re signed in and can browse and preview freely.</li>
                <li>Downloads unlock after a paid plan — see Pricing.</li>
                <li>We never store card details; renewals are email-only.</li>
              </ul>
            )}
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Continue browsing
            </button>
          </div>
        ) : (
          <form className="auth-form" onSubmit={submit}>
            {mode === "signup" && (
              <label>
                <span>Name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                  required
                />
              </label>
            )}
            <label>
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@studio.com"
                autoComplete="email"
                required
              />
            </label>
            <label>
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={8}
                required
              />
            </label>

            {mode === "signup" && (
              <div className="auth-notice" role="note">
                <strong>Billing, simply:</strong>
                <ul className="auth-policy">
                  <li>We don’t store card details.</li>
                  <li>No auto-renewal. We’ll email you a pay link when it’s time to renew.</li>
                  <li>Downloads require a paid plan after signup.</li>
                </ul>
              </div>
            )}

            {error && <p className="auth-error">{error}</p>}

            <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={busy}>
              {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
            </button>
            <p className="auth-footnote">
              Passwords are stored hashed for login validation. Card numbers are never saved on Lumenstock.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
