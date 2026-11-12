"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useDeferredValue, useEffect, useId, useRef, useState } from "react";
import { assetPath, searchAssets } from "@/data/catalog";

export function SearchForm({
  initialQuery = "",
  compact = false,
}: {
  initialQuery?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const deferredQ = useDeferredValue(q.trim());

  const suggestions =
    deferredQ.length >= 2
      ? searchAssets({ q: deferredQ }).slice(0, compact ? 6 : 8)
      : [];

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    setOpen(false);
    router.push(`/browse?${params.toString()}`);
  }

  return (
    <div className={`search-wrap${compact ? " compact" : ""}`} ref={wrapRef}>
      <form className="search-shell" onSubmit={onSubmit} role="search" autoComplete="off">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={compact ? "Search images…" : "Search cricket, Diwali, workspace, aerial…"}
          aria-label="Search images"
          aria-autocomplete="list"
          aria-controls={listId}
        />
        <button className="btn btn-primary" type="submit">
          Search
        </button>
      </form>

      {open && deferredQ.length >= 2 && (
        <div className="search-suggest" id={listId} role="listbox" aria-label="Matching images">
          {suggestions.length === 0 ? (
            <p className="search-suggest-empty">No images match “{deferredQ}”.</p>
          ) : (
            <>
              <div className="search-suggest-grid">
                {suggestions.map((asset) => (
                  <Link
                    key={asset.id}
                    href={assetPath(asset)}
                    className="search-suggest-card"
                    role="option"
                    onClick={() => setOpen(false)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={asset.imageUrl} alt="" loading="lazy" />
                    <span>{asset.title}</span>
                  </Link>
                ))}
              </div>
              <button
                type="button"
                className="search-suggest-all"
                onClick={() => {
                  const params = new URLSearchParams();
                  params.set("q", deferredQ);
                  setOpen(false);
                  router.push(`/browse?${params.toString()}`);
                }}
              >
                See all results for “{deferredQ}”
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
