"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/components/AuthProvider";
import { deviceGroups, downloadSizes, type DeviceGroup, type DownloadSize } from "@/data/downloadSizes";

type Props = {
  imageUrl: string;
  title: string;
  width: number;
  height: number;
};

function SizePreviewModal({
  open,
  onClose,
  imageUrl,
  size,
}: {
  open: boolean;
  onClose: () => void;
  imageUrl: string;
  size: DownloadSize;
}) {
  const [mounted, setMounted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setLoaded(false);
    setError(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, imageUrl, size.id]);

  if (!open || !mounted) return null;

  const isPortrait = size.height > size.width;

  return createPortal(
    <div className="modal-root preview-modal-root" role="dialog" aria-modal="true" aria-label="Size preview">
      <button type="button" className="modal-backdrop" aria-label="Close preview" onClick={onClose} />
      <div className="modal-panel preview-modal-panel">
        <div className="modal-head">
          <div>
            <p className="modal-kicker">Size preview</p>
            <h2>
              {size.label} · {size.width}×{size.height}
            </h2>
            <p className="modal-sub">{size.hint}</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className={`preview-modal-stage${isPortrait ? " portrait" : ""}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={`${imageUrl}-${size.id}`}
            src={imageUrl}
            alt={`${size.label} crop preview`}
            className={`preview-modal-image${loaded ? " ready" : ""}`}
            style={{
              aspectRatio: `${size.width} / ${size.height}`,
              maxWidth: isPortrait ? "min(420px, 100%)" : "min(100%, 920px)",
              maxHeight: "min(70vh, 720px)",
              width: isPortrait ? "auto" : "100%",
              height: "auto",
              objectFit: "cover",
            }}
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
          />
          {!loaded && !error && <div className="preview-modal-status">Loading preview…</div>}
          {error && <div className="preview-modal-status">Couldn’t load preview.</div>}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function drawCoverCrop(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  destW: number,
  destH: number,
) {
  const targetRatio = destW / destH;
  const srcRatio = img.naturalWidth / img.naturalHeight;
  let sx = 0;
  let sy = 0;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  if (srcRatio > targetRatio) {
    sw = img.naturalHeight * targetRatio;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    sh = img.naturalWidth / targetRatio;
    sy = (img.naturalHeight - sh) / 2;
  }
  ctx.clearRect(0, 0, destW, destH);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, destW, destH);
}

export function AssetWorkspace({ imageUrl, title, width, height }: Props) {
  const { user, openAuth } = useAuth();
  const [license, setLicense] = useState<"standard" | "enhanced">("standard");
  const [device, setDevice] = useState<DeviceGroup>("desktop");
  const [sizeId, setSizeId] = useState("desk-hd");
  const [busy, setBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [gateMessage, setGateMessage] = useState("");

  const sizes = useMemo(() => downloadSizes.filter((s) => s.group === device), [device]);
  const selected = downloadSizes.find((s) => s.id === sizeId) ?? sizes[0];

  function pickDevice(next: DeviceGroup) {
    setDevice(next);
    const first = downloadSizes.find((s) => s.group === next);
    if (first) setSizeId(first.id);
  }

  async function download() {
    if (!selected) return;
    setGateMessage("");

    if (!user) {
      setGateMessage("Log in with a registered email to download images.");
      openAuth("login");
      return;
    }
    if (!user.canDownload) {
      setGateMessage("Your account is registered but not paid yet. Choose a plan to unlock downloads.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/download", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl,
          sizeId: selected.id,
          title,
          license,
        }),
      });

      if (res.status === 401) {
        setGateMessage("Log in with a registered email to download images.");
        openAuth("login");
        return;
      }
      if (res.status === 402) {
        setGateMessage("Downloads require an active paid plan.");
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setGateMessage(data?.error || "Download failed. Try again.");
        return;
      }

      const masterBlob = await res.blob();
      const objectUrl = URL.createObjectURL(masterBlob);
      try {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("Failed to load image"));
          img.src = objectUrl;
        });

        const canvas = document.createElement("canvas");
        canvas.width = selected.width;
        canvas.height = selected.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas unsupported");
        drawCoverCrop(ctx, img, selected.width, selected.height);

        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((b) => resolve(b), "image/jpeg", 0.95),
        );
        if (!blob) throw new Error("Export failed");

        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        const safe = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        a.download = `lumenstock-${safe}-${selected.id}-${license}.jpg`;
        a.click();
        URL.revokeObjectURL(a.href);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    } catch {
      setGateMessage("Download failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const downloadLabel = !user
    ? "Log in to download"
    : !user.canDownload
      ? "Paid plan required"
      : busy
        ? "Preparing…"
        : `Download ${selected?.label ?? ""} (${selected?.width}×${selected?.height})`;

  return (
    <div className="asset-workspace">
      <div className="detail-media-stack">
        <figure className="detail-media master-media">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt={title} />
          <figcaption>
            Master · {width}×{height}px
          </figcaption>
        </figure>
      </div>

      <div className="download-controls">
        <h3>License</h3>
        <div className="license-options">
          <button
            type="button"
            className={`license-option${license === "standard" ? " active" : ""}`}
            onClick={() => setLicense("standard")}
          >
            <strong>Standard</strong>
            <div className="option-hint">Web, social, and print up to 500,000 copies. No merchandise.</div>
          </button>
          <button
            type="button"
            className={`license-option${license === "enhanced" ? " active" : ""}`}
            onClick={() => setLicense("enhanced")}
          >
            <strong>Enhanced</strong>
            <div className="option-hint">Unlimited reproduction, merchandise, and templates.</div>
          </button>
        </div>

        <h3>Device</h3>
        <div className="device-tabs">
          {deviceGroups.map((g) => (
            <button
              key={g.id}
              type="button"
              className={`device-tab${device === g.id ? " active" : ""}`}
              onClick={() => pickDevice(g.id)}
            >
              <strong>{g.label}</strong>
              <span>{g.blurb}</span>
            </button>
          ))}
        </div>

        <h3>Image size</h3>
        <div className="license-options">
          {sizes.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`license-option${sizeId === s.id ? " active" : ""}`}
              onClick={() => setSizeId(s.id)}
            >
              <strong>
                {s.label} · {s.width}×{s.height}
              </strong>
              <div className="option-hint">{s.hint}</div>
            </button>
          ))}
        </div>

        <div className="download-actions">
          <button
            type="button"
            className="btn btn-ghost"
            style={{ width: "100%" }}
            onClick={() => setPreviewOpen(true)}
            disabled={!selected}
          >
            Preview size
          </button>
          <button
            className="btn btn-primary"
            style={{ width: "100%" }}
            type="button"
            onClick={() => void download()}
            disabled={busy || !selected}
          >
            {downloadLabel}
          </button>
        </div>

        {gateMessage && <p className="download-gate-msg">{gateMessage}</p>}
        {!user && (
          <p className="download-note">
            Preview is free.{" "}
            <button type="button" className="nav-text-btn" onClick={() => openAuth("login")}>
              Log in
            </button>{" "}
            with a registered email to download. New accounts need a paid plan first.
          </p>
        )}
        {user && !user.canDownload && (
          <p className="download-note">
            Signed in as {user.email}.{" "}
            <Link href="/pricing">View pricing</Link> to unlock downloads.
          </p>
        )}
        {user?.canDownload && (
          <p className="download-note">
            Signed in as {user.email}
            {user.role === "super_admin" ? " (super admin)" : ""} — downloads unlocked. Open Preview size
            to check the crop before downloading.
          </p>
        )}
      </div>

      {selected && (
        <SizePreviewModal
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          imageUrl={imageUrl}
          size={selected}
        />
      )}
    </div>
  );
}
