"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { categories } from "@/data/catalog";
import { AuthModal } from "./AuthModal";
import { useAuth } from "./AuthProvider";
import { BrandWordmark } from "./BrandWordmark";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);
  const { user, openAuth, logout } = useAuth();
  const menuId = useId();
  const catsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!catsOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (!catsRef.current?.contains(e.target as Node)) setCatsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCatsOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [catsOpen]);

  function closeAll() {
    setOpen(false);
    setCatsOpen(false);
  }

  return (
    <>
      <header className="site-header">
        <div className="container nav">
          <Link href="/" className="brand" aria-label="Lumenstock home" onClick={closeAll}>
            <span className="brand-mark" aria-hidden />
            <BrandWordmark />
          </Link>

          <button
            type="button"
            className="nav-toggle"
            aria-expanded={open}
            aria-controls="primary-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => {
              setOpen((v) => !v);
              setCatsOpen(false);
            }}
          >
            <span />
            <span />
            <span />
          </button>

          <nav id="primary-nav" className={`nav-links${open ? " open" : ""}`} aria-label="Primary">
            <Link href="/browse" onClick={closeAll}>
              All images
            </Link>

            <div className={`nav-dropdown${catsOpen ? " open" : ""}`} ref={catsRef}>
              <button
                type="button"
                className="nav-dropdown-trigger"
                aria-expanded={catsOpen}
                aria-controls={menuId}
                onClick={() => setCatsOpen((v) => !v)}
              >
                Categories
                <span className="nav-dropdown-caret" aria-hidden>
                  ▾
                </span>
              </button>

              <div id={menuId} className="nav-dropdown-panel" hidden={!catsOpen}>
                <ul className="nav-dropdown-list nav-dropdown-list-flat">
                  {categories.map((c) => (
                    <li key={c.id}>
                      <Link href={`/browse?category=${c.id}`} onClick={closeAll}>
                        {c.name}
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link href="/categories" className="nav-dropdown-footer" onClick={closeAll}>
                  View all categories →
                </Link>
              </div>
            </div>

            <Link href="/pricing" onClick={closeAll}>
              Pricing
            </Link>
            <Link href="/roadmap" onClick={closeAll}>
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
                    closeAll();
                  }}
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-ghost nav-mobile-cta"
                  onClick={() => {
                    openAuth("login");
                    closeAll();
                  }}
                >
                  Log in
                </button>
                <button
                  type="button"
                  className="btn btn-soft nav-mobile-cta"
                  onClick={() => {
                    openAuth("signup");
                    closeAll();
                  }}
                >
                  Sign up
                </button>
              </>
            )}
            <Link href="/browse" className="btn btn-primary nav-mobile-cta" onClick={closeAll}>
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
