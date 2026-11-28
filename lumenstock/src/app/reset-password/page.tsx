"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || "Could not reset password.");
        return;
      }
      setDone(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 460, padding: "4rem 1.25rem" }}>
      <div className="modal-panel auth-modal-panel" style={{ position: "static", margin: "0 auto" }}>
        <p className="modal-kicker">Lumenstock</p>
        <h1 style={{ margin: "0.25rem 0 0.5rem", fontSize: "1.6rem" }}>Reset your password</h1>
        {!token ? (
          <p className="auth-error">Reset link is missing or malformed. Request a new password reset.</p>
        ) : done ? (
          <div className="auth-success">
            <strong>Password updated.</strong>
            <p>You can now sign in with your new password.</p>
            <Link href="/" className="btn btn-primary">
              Back to Lumenstock
            </Link>
          </div>
        ) : (
          <form className="auth-form" onSubmit={onSubmit}>
            <label>
              <span>New password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                placeholder="At least 8 characters"
                required
              />
            </label>
            <label>
              <span>Confirm new password</span>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={8}
                placeholder="Repeat password"
                required
              />
            </label>
            {error && <p className="auth-error">{error}</p>}
            <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={busy}>
              {busy ? "Saving…" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="container" style={{ padding: "4rem 1.25rem" }}>Loading…</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
