"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { packs, pricingPlans } from "@/data/catalog";

type BillingCycle = "monthly" | "annual";

function PricingInteractiveInner() {
  const { user, openAuth, refresh } = useAuth();
  const searchParams = useSearchParams();
  const checkoutState = searchParams.get("checkout");
  const [cycle, setCycle] = useState<BillingCycle>("annual");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "error" | "ok"; text: string } | null>(null);

  useEffect(() => {
    if (checkoutState === "success") {
      setMessage({
        kind: "ok",
        text: "Payment submitted! Your HD download credits unlock automatically as soon as payment confirmation completes.",
      });
      void refresh();
    } else if (checkoutState === "cancelled") {
      setMessage({ kind: "error", text: "Checkout was cancelled. No charge was made." });
    }
  }, [checkoutState, refresh]);

  async function startCheckout(offerId: string, selectedCycle: BillingCycle = cycle) {
    setMessage(null);
    if (!user) {
      openAuth("signup");
      return;
    }
    setBusyId(offerId);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId, cycle: selectedCycle }),
      });
      const data = (await res.json()) as { checkoutUrl?: string; error?: string; code?: string };
      if (res.status === 401) {
        openAuth("login");
        return;
      }
      if (!res.ok || !data.checkoutUrl) {
        setMessage({ kind: "error", text: data.error || "Could not start checkout." });
        return;
      }
      window.location.href = data.checkoutUrl;
    } catch {
      setMessage({ kind: "error", text: "Network error starting checkout. Please try again." });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      {message && (
        <div
          className={message.kind === "ok" ? "billing-callout" : "auth-error"}
          style={{ marginBottom: "1.25rem", padding: "0.9rem 1.1rem", borderRadius: 10 }}
          role="status"
        >
          {message.text}
        </div>
      )}

      {user && (
        <p style={{ color: "var(--muted)", margin: "0 0 1rem", fontSize: "0.92rem" }}>
          Signed in as <strong style={{ color: "var(--ink)" }}>{user.email}</strong>
          {user.role === "super_admin"
            ? " · Super admin (unlimited HD downloads)"
            : user.canDownload
              ? ` · ${user.creditsRemaining ?? 0} HD download credits remaining`
              : " · Choose a plan or pack below to unlock HD downloads"}
        </p>
      )}

      <div className="chip-row" style={{ marginBottom: "1.25rem" }}>
        <button
          type="button"
          className={`chip${cycle === "annual" ? " active" : ""}`}
          onClick={() => setCycle("annual")}
        >
          Annual (save up to 25%)
        </button>
        <button
          type="button"
          className={`chip${cycle === "monthly" ? " active" : ""}`}
          onClick={() => setCycle("monthly")}
        >
          1-Month pass
        </button>
      </div>

      <section className="section" style={{ paddingTop: "0.5rem" }}>
        <div className="pricing-grid">
          {pricingPlans.map((plan) => {
            const shownPrice = cycle === "annual" ? plan.annual : plan.monthly;
            const totalToday = cycle === "annual" ? plan.annual * 12 : plan.monthly;
            const totalCredits = cycle === "annual" ? plan.downloads * 12 : plan.downloads;
            return (
              <article key={plan.id} className={`price-card${plan.featured ? " featured" : ""}`}>
                <div>
                  <h3>{plan.name}</h3>
                  <p style={{ color: "var(--muted)", margin: "0.35rem 0 0" }}>{plan.blurb}</p>
                </div>
                <div className="price">
                  ${shownPrice}
                  <span> /mo</span>
                </div>
                <div style={{ color: "var(--faint)", fontSize: "0.9rem" }}>
                  ${totalToday} one-time today · {totalCredits} HD downloads
                </div>
                <ul>
                  {plan.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <button
                  className={`btn ${plan.featured ? "btn-primary" : "btn-ghost"}`}
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => void startCheckout(plan.id, cycle)}
                >
                  {busyId === plan.id ? "Opening checkout…" : `Choose ${plan.name}`}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="section-head">
          <div>
            <h2>On-demand packs</h2>
            <p>Credits that do not expire — ideal for one-off projects.</p>
          </div>
        </div>
        <div className="packs">
          {packs.map((p) => (
            <div key={p.id} className="pack" style={{ display: "grid", gap: "0.6rem" }}>
              <div>
                <strong>
                  {p.count} images · ${p.price}
                </strong>
                <div style={{ color: "var(--muted)", fontSize: "0.88rem", marginTop: 4 }}>
                  ${(p.price / p.count).toFixed(2)} per image
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busyId !== null}
                onClick={() => void startCheckout(p.id, "monthly")}
              >
                {busyId === p.id ? "Opening checkout…" : `Buy ${p.count}-image pack`}
              </button>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

export function PricingClient() {
  return (
    <Suspense fallback={<div style={{ padding: "1rem 0", color: "var(--muted)" }}>Loading plans…</div>}>
      <PricingInteractiveInner />
    </Suspense>
  );
}
