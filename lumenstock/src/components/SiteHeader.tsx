"use client";

import Link from "next/link";
import { useState } from "react";
import { BrandWordmark } from "./BrandWordmark";

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="container nav">
        <Link href="/" className="brand" aria-label="Lumenstock home" onClick={() => setOpen(false)}>
          <span className="brand-mark" aria-hidden />
          <BrandWordmark />
        </Link>

        <button
          type="button"
          className="nav-toggle"
          aria-expanded={open}
          aria-controls="primary-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>

        <nav id="primary-nav" className={`nav-links${open ? " open" : ""}`} aria-label="Primary">
          <Link href="/browse" onClick={() => setOpen(false)}>
            Browse
          </Link>
          <Link href="/categories" onClick={() => setOpen(false)}>
            Categories
          </Link>
          <Link href="/pricing" onClick={() => setOpen(false)}>
            Pricing
          </Link>
          <Link href="/roadmap" onClick={() => setOpen(false)}>
            Studio roadmap
          </Link>
          <Link href="/browse" className="btn btn-primary nav-mobile-cta" onClick={() => setOpen(false)}>
            Explore images
          </Link>
        </nav>

        <div className="nav-cta nav-cta-desktop">
          <Link href="/pricing" className="btn btn-ghost">
            Plans
          </Link>
          <Link href="/browse" className="btn btn-primary">
            Explore images
          </Link>
        </div>
      </div>
    </header>
  );
}
