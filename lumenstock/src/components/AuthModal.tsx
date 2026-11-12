"use client";

import { FormEvent, useEffect, useState } from "react";

type Mode = "login" | "signup";

type Props = {
  open: boolean;
  initialMode?: Mode;
  onClose: () => void;
};

export function AuthModal({ open, initialMode = "login", onClose }: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setDone(false);
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

  function submit(e: FormEvent) {
    e.preventDefault();
    // Demo auth — no backend yet; store a lightweight session marker
    try {
      localStorage.setItem(
        "lumenstock-auth",
        JSON.stringify({
          email: email.trim(),
          name: (name || email.split("@")[0]).trim(),
          mode,
          at: Date.now(),
        }),
      );
    } catch {
      /* ignore */
    }
    setDone(true);
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
                ? "Log in to save downloads, licenses, and collections."
                : "Join to license HD stock and sync your studio later."}
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
              setDone(false);
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
              setDone(false);
            }}
          >
            Sign up
          </button>
        </div>

        {done ? (
          <div className="auth-success">
            <strong>{mode === "login" ? "You’re logged in." : "Account ready."}</strong>
            <p>Demo session saved in this browser. Full auth wiring comes with checkout.</p>
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
            <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>
              {mode === "login" ? "Log in" : "Create account"}
            </button>
            <p className="auth-footnote">
              By continuing you agree to demo terms. No password is sent to a server yet.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
