"use client";

import { useMemo, useState } from "react";
import { deviceGroups, downloadSizes, type DeviceGroup } from "@/data/downloadSizes";

export function DownloadPicker({
  imageUrl,
  title,
}: {
  imageUrl: string;
  title: string;
}) {
  const [license, setLicense] = useState<"standard" | "enhanced">("standard");
  const [device, setDevice] = useState<DeviceGroup>("desktop");
  const [sizeId, setSizeId] = useState("desk-hd");
  const [busy, setBusy] = useState(false);

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

      // Cover-fit crop into target aspect
      const targetRatio = selected.width / selected.height;
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
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, selected.width, selected.height);

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
      // Fallback: open original if canvas blocked (e.g. remote CORS)
      window.open(imageUrl, "_blank", "noopener,noreferrer");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h3 style={{ margin: "1.2rem 0 0.6rem", fontFamily: "var(--font-display)" }}>License</h3>
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

      <h3 style={{ margin: "1.2rem 0 0.6rem", fontFamily: "var(--font-display)" }}>Device</h3>
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

      <h3 style={{ margin: "1.2rem 0 0.6rem", fontFamily: "var(--font-display)" }}>Image size</h3>
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
            <div style={{ color: "var(--muted)", fontSize: "0.9rem", marginTop: 4 }}>{s.hint}</div>
          </button>
        ))}
      </div>

      <button className="btn btn-primary" style={{ width: "100%" }} type="button" onClick={download} disabled={busy}>
        {busy
          ? "Preparing…"
          : `Download ${selected?.label ?? ""} (${selected?.width}×${selected?.height})`}
      </button>
      <p style={{ color: "var(--faint)", fontSize: "0.82rem", marginTop: "0.75rem" }}>
        HD master cropped to your device size. Checkout wiring comes next.
      </p>
    </div>
  );
}
