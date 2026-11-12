"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function SearchForm({
  initialQuery = "",
  compact = false,
}: {
  initialQuery?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    router.push(`/browse?${params.toString()}`);
  }

  return (
    <form className="search-shell" onSubmit={onSubmit} role="search">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={compact ? "Search images…" : "Search cricket, Diwali, workspace, aerial…"}
        aria-label="Search images"
      />
      <button className="btn btn-primary" type="submit">
        Search
      </button>
    </form>
  );
}
