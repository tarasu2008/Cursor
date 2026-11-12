export type DeviceGroup = "desktop" | "tablet" | "phone";

export interface DownloadSize {
  id: string;
  group: DeviceGroup;
  label: string;
  width: number;
  height: number;
  hint: string;
}

/** Preset export sizes customers can pick after choosing a device class */
export const downloadSizes: DownloadSize[] = [
  // Desktop
  { id: "desk-hd", group: "desktop", label: "Desktop HD", width: 1920, height: 1080, hint: "Full HD displays" },
  { id: "desk-qhd", group: "desktop", label: "Desktop QHD", width: 2560, height: 1440, hint: "2K monitors" },
  { id: "desk-4k", group: "desktop", label: "Desktop 4K", width: 3840, height: 2160, hint: "UHD / large screens" },
  // Tablet
  { id: "tab-standard", group: "tablet", label: "Tablet", width: 1024, height: 768, hint: "iPad landscape" },
  { id: "tab-retina", group: "tablet", label: "Tablet Retina", width: 2048, height: 1536, hint: "High-density tablets" },
  { id: "tab-pro", group: "tablet", label: "Tablet Pro", width: 2732, height: 2048, hint: "Large tablet / Pro" },
  // Phone
  { id: "phone-standard", group: "phone", label: "Phone", width: 390, height: 844, hint: "Modern phone portrait" },
  { id: "phone-hd", group: "phone", label: "Phone HD", width: 1170, height: 2532, hint: "Retina phone screens" },
  { id: "phone-wide", group: "phone", label: "Phone Landscape", width: 1920, height: 1080, hint: "Phone landscape / Stories landscape" },
];

export const deviceGroups: { id: DeviceGroup; label: string; blurb: string }[] = [
  { id: "desktop", label: "Desktop", blurb: "Monitors & large screens" },
  { id: "tablet", label: "Tablet", blurb: "iPad & Android tablets" },
  { id: "phone", label: "Phone", blurb: "Mobile screens & stories" },
];
