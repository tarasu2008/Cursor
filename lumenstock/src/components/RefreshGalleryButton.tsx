"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function RefreshGalleryButton({ className }: { className?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className={className}
      disabled={isPending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {isPending ? "Refreshing…" : "Shuffle gallery ↻"}
    </button>
  );
}
