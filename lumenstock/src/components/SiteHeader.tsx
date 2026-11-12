"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { AuthModal } from "./AuthModal";
import { BrandWordmark } from "./BrandWordmark";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  const openAuth = useCallback((mode: "login" | "signup") => {
    setAuthMode(mode);
    setAuthOpen(true);
    setOpen(false);
  }, []);

  const closeAuth = useCallback(() => setAuthOpen(false), []);

  return (
    <>
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
            <button type="button" className="nav-text-btn" onClick={() => openAuth("login")}>
              Log in
            </button>
            <button type="button" className="btn btn-soft nav-mobile-cta" onClick={() => openAuth("signup")}>
              Sign up
            </button>
            <Link href="/browse" className="btn btn-primary nav-mobile-cta" onClick={() => setOpen(false)}>
              Explore images
            </Link>
          </nav>

          <div className="nav-cta nav-cta-desktop">
            <button type="button" className="btn btn-ghost" onClick={() => openAuth("login")}>
              Log in
            </button>
            <button type="button" className="btn btn-soft" onClick={() => openAuth("signup")}>
              Sign up
            </button>
            <Link href="/browse" className="btn btn-primary">
              Explore images
            </Link>
          </div>
        </div>
      </header>

      <AuthModal open={authOpen} initialMode={authMode} onClose={closeAuth} />
    </>
  );
}
