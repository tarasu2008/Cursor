"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthModal } from "./AuthModal";
import { useAuth } from "./AuthProvider";
import { BrandWordmark } from "./BrandWordmark";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { user, openAuth, logout } = useAuth();

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
            {user ? (
              <>
                <span className="nav-user-label nav-mobile-cta">
                  {user.role === "super_admin" ? "Admin · " : ""}
                  {user.email}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost nav-mobile-cta"
                  onClick={() => {
                    void logout();
                    setOpen(false);
                  }}
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn btn-ghost nav-mobile-cta" onClick={() => openAuth("login")}>
                  Log in
                </button>
                <button type="button" className="btn btn-soft nav-mobile-cta" onClick={() => openAuth("signup")}>
                  Sign up
                </button>
              </>
            )}
            <Link href="/browse" className="btn btn-primary nav-mobile-cta" onClick={() => setOpen(false)}>
              Explore images
            </Link>
          </nav>

          <div className="nav-cta nav-cta-desktop">
            {user ? (
              <>
                <span className="nav-user-label" title={user.email}>
                  {user.role === "super_admin" ? "Super admin" : user.name}
                </span>
                <button type="button" className="btn btn-ghost" onClick={() => void logout()}>
                  Log out
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn btn-ghost" onClick={() => openAuth("login")}>
                  Log in
                </button>
                <button type="button" className="btn btn-soft" onClick={() => openAuth("signup")}>
                  Sign up
                </button>
              </>
            )}
            <Link href="/browse" className="btn btn-primary">
              Explore images
            </Link>
          </div>
        </div>
      </header>

      <AuthModal />
    </>
  );
}
