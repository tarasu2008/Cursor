export type MediaType = "photo" | "illustration" | "vector";

export type LicenseTier = "standard" | "enhanced";

export interface Category {
  id: string;
  name: string;
  group: "core" | "extended";
  description: string;
}

export interface Asset {
  id: string;
  title: string;
  description: string;
  type: MediaType;
  categoryIds: string[];
  keywords: string[];
  orientation: "horizontal" | "vertical";
  width: number;
  height: number;
  contributor: string;
  priceHint: string;
  imageUrl: string;
  color: string;
  people: number;
  editorial?: boolean;
}

/** Shutterstock-aligned core + Lumenstock extended categories */
export const categories: Category[] = [
  { id: "abstract", name: "Abstract", group: "core", description: "Patterns, blurs, conceptual forms" },
  { id: "animals", name: "Animals/Wildlife", group: "core", description: "Domestic and wild animals" },
  { id: "arts", name: "Arts", group: "core", description: "Art-making, paintings, illustrations" },
  { id: "backgrounds", name: "Backgrounds/Textures", group: "core", description: "Wallpapers, flat lays, surfaces" },
  { id: "beauty", name: "Beauty/Fashion", group: "core", description: "Beauty, style, apparel" },
  { id: "buildings", name: "Buildings/Landmarks", group: "core", description: "Architecture and landmarks" },
  { id: "business", name: "Business/Finance", group: "core", description: "Workplaces, money, commerce" },
  { id: "celebrities", name: "Celebrities", group: "core", description: "Public figures and red carpet" },
  { id: "education", name: "Education", group: "core", description: "Schools, books, learning" },
  { id: "food", name: "Food and Drink", group: "core", description: "Cuisine, cooking, beverages" },
  { id: "healthcare", name: "Healthcare/Medical", group: "core", description: "Health, wellness, medicine" },
  { id: "holidays", name: "Holidays", group: "core", description: "Festivals, seasons, celebrations" },
  { id: "industrial", name: "Industrial", group: "core", description: "Construction, tools, trades" },
  { id: "interiors", name: "Interiors", group: "core", description: "Indoor spaces and design" },
  { id: "misc", name: "Miscellaneous", group: "core", description: "Everything else" },
  { id: "nature", name: "Nature", group: "core", description: "Landscapes, plants, weather" },
  { id: "objects", name: "Objects", group: "core", description: "Product and object focus" },
  { id: "parks", name: "Parks/Outdoor", group: "core", description: "Outdoors, camping, recreation" },
  { id: "people", name: "People", group: "core", description: "Portraits, groups, lifestyle" },
  { id: "religion", name: "Religion", group: "core", description: "Faith and spiritual themes" },
  { id: "science", name: "Science", group: "core", description: "Lab, research, space" },
  { id: "signs", name: "Signs/Symbols", group: "core", description: "Icons, flags, gestures" },
  { id: "sports", name: "Sports/Recreation", group: "core", description: "Fitness, sport, hobbies" },
  { id: "technology", name: "Technology", group: "core", description: "Devices, code, AI concepts" },
  { id: "transport", name: "Transportation", group: "core", description: "Vehicles, roads, travel" },
  { id: "vintage", name: "Vintage", group: "core", description: "Retro and period looks" },
  // Extended beyond typical stock sites
  { id: "ai-generated", name: "AI Generated", group: "extended", description: "Prompt-created visuals with clear labeling" },
  { id: "renders-3d", name: "3D Renders", group: "extended", description: "CGI products, scenes, characters" },
  { id: "patterns", name: "Seamless Patterns", group: "extended", description: "Tileable prints for packaging & fabric" },
  { id: "ui-mockups", name: "UI Mockups", group: "extended", description: "Device frames and interface scenes" },
  { id: "cutouts", name: "Transparent Cutouts", group: "extended", description: "Isolated subjects on transparent BG" },
  { id: "aerial", name: "Aerial / Drone", group: "extended", description: "Top-down and aerial perspectives" },
  { id: "macro", name: "Macro", group: "extended", description: "Extreme close-up detail" },
  { id: "night", name: "Night & Astro", group: "extended", description: "Nightscapes and star fields" },
  { id: "underwater", name: "Underwater", group: "extended", description: "Ocean and submerged scenes" },
  { id: "cultural", name: "Cultural & Festivals", group: "extended", description: "Regional culture and festivities" },
  { id: "wedding", name: "Wedding & Events", group: "extended", description: "Ceremonies and celebrations" },
  { id: "pets", name: "Pets", group: "extended", description: "Companion animals at home" },
  { id: "workspace", name: "Workspace & Desk", group: "extended", description: "Creative desks and offices" },
  { id: "esg", name: "Sustainability / ESG", group: "extended", description: "Green energy and climate themes" },
  { id: "infographic", name: "Infographic Elements", group: "extended", description: "Charts, icons, diagram parts" },
  { id: "medical-illust", name: "Medical Illustration", group: "extended", description: "Anatomical and clinical art" },
  { id: "food-styling", name: "Food Styling", group: "extended", description: "Editorial food photography" },
  { id: "seasonal", name: "Seasonal Campaigns", group: "extended", description: "Holiday marketing sets" },
  { id: "genz", name: "Gen Z Lifestyle", group: "extended", description: "Youth culture and trends" },
  { id: "arch-detail", name: "Architecture Detail", group: "extended", description: "Facades, materials, geometry" },
];

export const assets: Asset[] = [
  {
    id: "ls-1001",
    title: "Golden hour skyline over the bay",
    description: "Warm dusk light across a coastal city skyline with reflective water.",
    type: "photo",
    categoryIds: ["buildings", "nature", "aerial"],
    keywords: ["skyline", "sunset", "city", "bay", "travel", "architecture", "golden hour", "urban"],
    orientation: "horizontal",
    width: 6000,
    height: 4000,
    contributor: "Maya Chen",
    priceHint: "From plan",
    imageUrl: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80",
    color: "E8A54B",
    people: 0,
  },
  {
    id: "ls-1002",
    title: "Cricket batsman mid cover drive",
    description: "Stadium-lit action shot of a batsman striking through the line.",
    type: "photo",
    categoryIds: ["sports", "people"],
    keywords: ["cricket", "batting", "stadium", "sport", "athlete", "action", "helmet", "bat"],
    orientation: "horizontal",
    width: 3840,
    height: 2160,
    contributor: "Arjun Mehta",
    priceHint: "From plan",
    imageUrl: "/samples/cricket-batting-shot.jpg",
    color: "1E5AA8",
    people: 1,
  },
  {
    id: "ls-1003",
    title: "Diwali diyas with marigold flat lay",
    description: "Festival of lights still life — clay lamps, flowers, and rangoli powders.",
    type: "photo",
    categoryIds: ["holidays", "cultural", "seasonal", "backgrounds"],
    keywords: ["diwali", "diya", "marigold", "festival", "india", "lights", "celebration", "flat lay"],
    orientation: "horizontal",
    width: 2400,
    height: 1800,
    contributor: "Priya Nair",
    priceHint: "From plan",
    imageUrl: "/samples/diwali-greeting.jpg",
    color: "C87941",
    people: 0,
  },
  {
    id: "ls-1004",
    title: "Minimal desk workspace with laptop",
    description: "Clean creative desk setup with soft daylight and plant accents.",
    type: "photo",
    categoryIds: ["workspace", "business", "technology", "objects"],
    keywords: ["desk", "laptop", "workspace", "office", "minimal", "productivity", "remote", "plant"],
    orientation: "horizontal",
    width: 5600,
    height: 3733,
    contributor: "Noah Blake",
    priceHint: "From plan",
    imageUrl: "https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1600&q=80",
    color: "8B95A8",
    people: 0,
  },
  {
    id: "ls-1005",
    title: "Fresh citrus food styling board",
    description: "Bright citrus slices arranged for editorial food photography.",
    type: "photo",
    categoryIds: ["food", "food-styling", "macro"],
    keywords: ["citrus", "food", "styling", "orange", "fresh", "editorial", "kitchen", "color"],
    orientation: "horizontal",
    width: 5000,
    height: 3333,
    contributor: "Elena Rossi",
    priceHint: "From plan",
    imageUrl: "https://images.unsplash.com/photo-1490474418585-ba9bad8fd0ea?auto=format&fit=crop&w=1600&q=80",
    color: "F0A020",
    people: 0,
  },
  {
    id: "ls-1006",
    title: "Mountain trail under alpine light",
    description: "Hiker silhouette on a ridge with dramatic mountain weather.",
    type: "photo",
    categoryIds: ["parks", "nature", "people"],
    keywords: ["hiking", "mountains", "trail", "outdoor", "adventure", "ridge", "clouds", "travel"],
    orientation: "horizontal",
    width: 5500,
    height: 3667,
    contributor: "Sam Okonkwo",
    priceHint: "From plan",
    imageUrl: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=80",
    color: "5B7C99",
    people: 1,
  },
  {
    id: "ls-1007",
    title: "Neon night street reflections",
    description: "Rain-soaked city street with neon signs and motion blur.",
    type: "photo",
    categoryIds: ["night", "buildings", "transport"],
    keywords: ["night", "neon", "rain", "street", "urban", "city", "reflections", "mood"],
    orientation: "vertical",
    width: 3000,
    height: 4500,
    contributor: "Yuki Tanaka",
    priceHint: "From plan",
    imageUrl: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1200&q=80",
    color: "2A1F4D",
    people: 0,
  },
  {
    id: "ls-1008",
    title: "Soft abstract paper texture",
    description: "Neutral layered paper folds ideal for backgrounds and decks.",
    type: "photo",
    categoryIds: ["abstract", "backgrounds", "patterns"],
    keywords: ["texture", "paper", "abstract", "background", "neutral", "folds", "minimal", "studio"],
    orientation: "horizontal",
    width: 4800,
    height: 3200,
    contributor: "Studio Lumen",
    priceHint: "From plan",
    imageUrl: "https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=1600&q=80",
    color: "D4C4B0",
    people: 0,
  },
  {
    id: "ls-1009",
    title: "Solar farm sustainability aerial",
    description: "Drone view of solar panels stretching across open land.",
    type: "photo",
    categoryIds: ["esg", "aerial", "technology", "industrial"],
    keywords: ["solar", "energy", "sustainability", "drone", "panels", "green", "climate", "renewable"],
    orientation: "horizontal",
    width: 6000,
    height: 4000,
    contributor: "Greenfield Aerial",
    priceHint: "From plan",
    imageUrl: "https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1600&q=80",
    color: "3D7A4A",
    people: 0,
  },
  {
    id: "ls-1010",
    title: "Portrait in soft window light",
    description: "Natural-light headshot with shallow depth of field.",
    type: "photo",
    categoryIds: ["people", "beauty"],
    keywords: ["portrait", "person", "window light", "face", "lifestyle", "model", "soft", "studio"],
    orientation: "vertical",
    width: 3500,
    height: 5250,
    contributor: "Camila Ortiz",
    priceHint: "From plan",
    imageUrl: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=1200&q=80",
    color: "C4A484",
    people: 1,
  },
  {
    id: "ls-1011",
    title: "3D product pedestal mock scene",
    description: "Clean CGI pedestal with soft gradient for product placement.",
    type: "illustration",
    categoryIds: ["renders-3d", "objects", "ui-mockups"],
    keywords: ["3d", "render", "pedestal", "product", "mockup", "cgi", "studio", "gradient"],
    orientation: "horizontal",
    width: 4000,
    height: 3000,
    contributor: "Render Lab",
    priceHint: "From plan",
    imageUrl: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?auto=format&fit=crop&w=1600&q=80",
    color: "6C8CFF",
    people: 0,
  },
  {
    id: "ls-1012",
    title: "Seamless botanical pattern tile",
    description: "Leaf motif designed for packaging and textile repeats.",
    type: "illustration",
    categoryIds: ["patterns", "arts", "backgrounds"],
    keywords: ["pattern", "botanical", "seamless", "leaves", "textile", "packaging", "green", "print"],
    orientation: "horizontal",
    width: 4000,
    height: 4000,
    contributor: "Pattern Atelier",
    priceHint: "From plan",
    imageUrl: "https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=1600&q=80",
    color: "2F6B3A",
    people: 0,
  },
];

export const pricingPlans = [
  {
    id: "starter",
    name: "Starter",
    blurb: "For occasional projects",
    monthly: 29,
    annual: 25,
    downloads: 10,
    features: ["10 images / month", "Standard license", "HD & web sizes", "Cancel anytime*"],
  },
  {
    id: "creator",
    name: "Creator",
    blurb: "For freelancers & studios",
    monthly: 99,
    annual: 75,
    downloads: 50,
    featured: true,
    features: ["50 images / month", "Standard license", "Enhanced upgrade available", "Collections & history"],
  },
  {
    id: "team",
    name: "Studio",
    blurb: "For high-volume teams",
    monthly: 199,
    annual: 149,
    downloads: 750,
    features: ["750 images / month", "Priority support", "Team seats (soon)", "Commercial RF terms"],
  },
];

export const packs = [
  { id: "pack-2", count: 2, price: 29 },
  { id: "pack-5", count: 5, price: 49 },
  { id: "pack-25", count: 25, price: 229 },
];

export function getAsset(id: string) {
  return assets.find((a) => a.id === id);
}

export function getCategory(id: string) {
  return categories.find((c) => c.id === id);
}

export function searchAssets(opts: {
  q?: string;
  type?: string;
  orientation?: string;
  category?: string;
  people?: string;
}) {
  const q = (opts.q || "").trim().toLowerCase();
  return assets.filter((a) => {
    if (opts.type && opts.type !== "all" && a.type !== opts.type) return false;
    if (opts.orientation && opts.orientation !== "all" && a.orientation !== opts.orientation) return false;
    if (opts.category && opts.category !== "all" && !a.categoryIds.includes(opts.category)) return false;
    if (opts.people === "none" && a.people > 0) return false;
    if (opts.people === "with" && a.people < 1) return false;
    if (!q) return true;
    const hay = [a.title, a.description, a.contributor, ...a.keywords, ...a.categoryIds].join(" ").toLowerCase();
    return hay.includes(q);
  });
}
