"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { deviceGroups, downloadSizes, type DeviceGroup, type DownloadSize } from "@/data/downloadSizes";

type Props = {
  imageUrl: string;
  title: string;
  width: number;
  height: number;
};

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setReady(false);
    setError(false);

    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Keep true pixel aspect; scale down for display budget
      const maxEdge = 1100;
      const scale = Math.min(1, maxEdge / Math.max(size.width, size.height));
      const pw = Math.max(1, Math.round(size.width * scale));
      const ph = Math.max(1, Math.round(size.height * scale));
      canvas.width = pw;
      canvas.height = ph;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      drawCoverCrop(ctx, img, pw, ph);
      setReady(true);
    };
    img.onerror = () => {
      if (!cancelled) setError(true);
    };
    img.src = imageUrl;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      cancelled = true;
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, imageUrl, size, onClose]);

  if (!open) return null;

  const isPortrait = size.height > size.width;

  return (
    <div className="modal-root" role="dialog" aria-modal="true" aria-label="Size preview">
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
          <canvas
            ref={canvasRef}
            className={`preview-modal-canvas${ready ? " ready" : ""}`}
            style={{
              aspectRatio: `${size.width} / ${size.height}`,
              maxWidth: isPortrait ? "min(420px, 100%)" : "100%",
              maxHeight: "min(70vh, 720px)",
              width: "auto",
              height: "auto",
            }}
          />
          {!ready && !error && <div className="preview-modal-status">Rendering crop…</div>}
          {error && <div className="preview-modal-status">Couldn’t load preview.</div>}
        </div>
      </div>
    </div>
  );
}

export function AssetWorkspace({ imageUrl, title, width, height }: Props) {
  const [license, setLicense] = useState<"standard" | "enhanced">("standard");
  const [device, setDevice] = useState<DeviceGroup>("desktop");
  const [sizeId, setSizeId] = useState("desk-hd");
  const [busy, setBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const sizes = useMemo(() => downloadSizes.filter((s) => s.group === device), [device]);
  const selected = downloadSizes.find((s) => s.id === sizeId) ?? sizes[0];

  function pickDevice(next: DeviceGroup) {
    setDevice(next);
    const first = downloadSizes.find((s) => s.group === next);
    if (first) setSizeId(first.id);
  }

  async function download() {
    if (!selected) return;
    setBusy(true);
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = imageUrl;
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
    } catch {
      window.open(imageUrl, "_blank", "noopener,noreferrer");
    } finally {
      setBusy(false);
    }
  }

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
            onClick={download}
            disabled={busy || !selected}
          >
            {busy
              ? "Preparing…"
              : `Download ${selected?.label ?? ""} (${selected?.width}×${selected?.height})`}
          </button>
        </div>
        <p className="download-note">Open Preview size to check the exact crop before downloading.</p>
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
