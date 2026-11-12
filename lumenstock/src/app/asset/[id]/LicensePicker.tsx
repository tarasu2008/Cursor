"use client";

import { useState } from "react";

export function LicensePicker() {
  const [license, setLicense] = useState<"standard" | "enhanced">("standard");

  return (
    <div>
      <h3 style={{ margin: "1.2rem 0 0.6rem", fontFamily: "var(--font-display)" }}>Choose license</h3>
      <div className="license-options">
        <button
          type="button"
          className={`license-option${license === "standard" ? " active" : ""}`}
          onClick={() => setLicense("standard")}
        >
          <strong>Standard</strong>
          <div style={{ color: "var(--muted)", fontSize: "0.9rem", marginTop: 4 }}>
            Web, social, and print up to 500,000 copies. No merchandise.
          </div>
        </button>
        <button
          type="button"
          className={`license-option${license === "enhanced" ? " active" : ""}`}
          onClick={() => setLicense("enhanced")}
        >
          <strong>Enhanced</strong>
          <div style={{ color: "var(--muted)", fontSize: "0.9rem", marginTop: 4 }}>
            Unlimited reproduction, merchandise, and templates.
          </div>
        </button>
      </div>
      <button className="btn btn-primary" style={{ width: "100%" }} type="button">
        Download with {license === "standard" ? "Standard" : "Enhanced"} license
      </button>
      <p style={{ color: "var(--faint)", fontSize: "0.82rem", marginTop: "0.75rem" }}>
        Demo checkout — payments (Stripe packs & subscriptions) wire up next.
      </p>
    </div>
  );
}
