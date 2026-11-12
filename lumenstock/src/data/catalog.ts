import { getSubcategory, subcategories } from "./subcategories";
import { subcategorySeeds } from "./subcategorySeeds";

export const siteConfig = {
  name: "Lumenstock",
  tagline: "Royalty-free stock images to license",
  description:
    "License HD royalty-free stock photos and illustrations from Lumenstock. Browse categories and subcategories, then download desktop, tablet, and phone sizes.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://lumenstock.cursor.app",
  locale: "en_US",
};

export type MediaType = "photo" | "illustration" | "vector";

export interface Category {
  id: string;
  name: string;
  group: "core" | "extended";
  description: string;
}

export interface Asset {
  id: string;
  /** SEO-friendly URL segment from the image title, e.g. artist-palette-with-wet-oil-paints */
  slug: string;
  title: string;
  description: string;
  type: MediaType;
  categoryIds: string[];
  subcategoryId?: string;
  keywords: string[];
  orientation: "horizontal" | "vertical";
  width: number;
  height: number;
  owner: string;
  priceHint: string;
  imageUrl: string;
  color: string;
  people: number;
  editorial?: boolean;
}

export function slugifyTitle(title: string) {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function uniqueSlug(title: string, used: Set<string>, fallback: string) {
  const base = slugifyTitle(title) || fallback;
  let slug = base;
  let n = 2;
  while (used.has(slug)) {
    slug = `${base}-${n}`;
    n += 1;
  }
  used.add(slug);
  return slug;
}

/** Industry-standard core categories + Lumenstock extended categories */
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
  {
    id: "phone-wallpapers",
    name: "Phone Wallpapers",
    group: "extended",
    description: "Lock screen and home screen wallpapers for iPhone and Android",
  },
  {
    id: "desktop-wallpapers",
    name: "Desktop Wallpapers",
    group: "extended",
    description: "HD and ultrawide wallpapers for monitors and laptops",
  },
];

type Seed = {
  title: string;
  description: string;
  type: MediaType;
  keywords: string[];
  orientation: "horizontal" | "vertical";
  color: string;
  people: number;
  width: number;
  height: number;
};

const seeds: Record<string, Seed> = {
  abstract: {
    title: "Fluid amber abstract light forms",
    description: "Soft luminous abstract shapes for backgrounds and brand decks.",
    type: "photo",
    keywords: ["abstract", "light", "forms", "amber", "gradient", "background", "modern", "glow"],
    orientation: "horizontal",
    color: "E8A54B",
    people: 0,
    width: 1920,
    height: 1080,
  },
  animals: {
    title: "Lion portrait in golden savanna light",
    description: "Close wildlife portrait with warm rim light and shallow depth.",
    type: "photo",
    keywords: ["lion", "wildlife", "animal", "savanna", "portrait", "nature", "mammal", "africa"],
    orientation: "horizontal",
    color: "C9891F",
    people: 0,
    width: 1920,
    height: 1080,
  },
  arts: {
    title: "Artist palette with wet oil paints",
    description: "Creative still life of brushes and vivid oil paint textures.",
    type: "photo",
    keywords: ["art", "paint", "palette", "brushes", "creative", "studio", "color", "oils"],
    orientation: "horizontal",
    color: "D45D4A",
    people: 0,
    width: 1920,
    height: 1080,
  },
  backgrounds: {
    title: "Soft linen texture background",
    description: "Neutral fabric texture ideal for product and presentation backdrops.",
    type: "photo",
    keywords: ["texture", "linen", "background", "neutral", "fabric", "surface", "soft", "studio"],
    orientation: "horizontal",
    color: "D4C4B0",
    people: 0,
    width: 1920,
    height: 1080,
  },
  beauty: {
    title: "Beauty editorial makeup close-up",
    description: "High-fashion beauty detail with clean studio lighting.",
    type: "photo",
    keywords: ["beauty", "makeup", "fashion", "editorial", "skin", "glamour", "studio", "portrait"],
    orientation: "vertical",
    color: "E8B4B8",
    people: 1,
    width: 1440,
    height: 1920,
  },
  buildings: {
    title: "Modern glass landmark at dusk",
    description: "Contemporary architecture with warm sky reflections.",
    type: "photo",
    keywords: ["architecture", "building", "landmark", "glass", "dusk", "city", "modern", "skyline"],
    orientation: "horizontal",
    color: "5B7C99",
    people: 0,
    width: 1920,
    height: 1080,
  },
  business: {
    title: "Team meeting in bright office",
    description: "Professional workplace scene for business and finance stories.",
    type: "photo",
    keywords: ["business", "office", "meeting", "team", "finance", "workplace", "corporate", "laptop"],
    orientation: "horizontal",
    color: "4A6FA5",
    people: 3,
    width: 1920,
    height: 1080,
  },
  celebrities: {
    title: "Red carpet premiere night atmosphere",
    description: "Glamorous event lighting and carpet without identifiable celebrities.",
    type: "photo",
    keywords: ["red carpet", "premiere", "event", "glamour", "lights", "fashion", "night", "stage"],
    orientation: "horizontal",
    color: "B3261E",
    people: 0,
    width: 1920,
    height: 1080,
  },
  education: {
    title: "Open books on a study desk",
    description: "Learning still life with notebooks and soft daylight.",
    type: "photo",
    keywords: ["education", "books", "study", "learning", "school", "desk", "knowledge", "notes"],
    orientation: "horizontal",
    color: "8B7355",
    people: 0,
    width: 1920,
    height: 1080,
  },
  food: {
    title: "Artisan coffee and pastry flat lay",
    description: "Cafe tabletop scene for food and drink campaigns.",
    type: "photo",
    keywords: ["coffee", "pastry", "food", "drink", "cafe", "breakfast", "flat lay", "artisan"],
    orientation: "horizontal",
    color: "A67C52",
    people: 0,
    width: 1920,
    height: 1080,
  },
  healthcare: {
    title: "Clean medical clinic corridor",
    description: "Bright healthcare environment with calm professional tone.",
    type: "photo",
    keywords: ["healthcare", "clinic", "medical", "hospital", "wellness", "care", "clean", "health"],
    orientation: "horizontal",
    color: "6BA3B8",
    people: 0,
    width: 1920,
    height: 1080,
  },
  holidays: {
    title: "Festive lights and gift wrap scene",
    description: "Warm holiday still life with lights and seasonal decor.",
    type: "photo",
    keywords: ["holiday", "festive", "lights", "gifts", "celebration", "season", "decorate", "warm"],
    orientation: "horizontal",
    color: "C0392B",
    people: 0,
    width: 1920,
    height: 1080,
  },
  industrial: {
    title: "Steel construction site at sunrise",
    description: "Industrial beams and hard-hat safety gear in morning light.",
    type: "photo",
    keywords: ["industrial", "construction", "steel", "site", "trade", "engineering", "tools", "sunrise"],
    orientation: "horizontal",
    color: "7A8A99",
    people: 0,
    width: 1920,
    height: 1080,
  },
  interiors: {
    title: "Sunlit modern living room interior",
    description: "Designed interior with natural light and soft furnishings.",
    type: "photo",
    keywords: ["interior", "living room", "design", "home", "furniture", "sunlight", "modern", "space"],
    orientation: "horizontal",
    color: "C4B7A6",
    people: 0,
    width: 1920,
    height: 1080,
  },
  misc: {
    title: "Colorful balloon cluster still life",
    description: "Playful miscellaneous object arrangement for versatile use.",
    type: "photo",
    keywords: ["balloons", "colorful", "objects", "party", "misc", "fun", "still life", "bright"],
    orientation: "horizontal",
    color: "F4A261",
    people: 0,
    width: 1920,
    height: 1080,
  },
  nature: {
    title: "Misty mountain lake at dawn",
    description: "Serene landscape with water, pines, and soft morning fog.",
    type: "photo",
    keywords: ["nature", "mountain", "lake", "dawn", "mist", "landscape", "forest", "scenic"],
    orientation: "horizontal",
    color: "5D7A68",
    people: 0,
    width: 1920,
    height: 1080,
  },
  objects: {
    title: "Minimal product on stone pedestal",
    description: "Object-focused product shot with clean studio styling.",
    type: "photo",
    keywords: ["product", "object", "pedestal", "minimal", "studio", "still life", "commerce", "packaging"],
    orientation: "horizontal",
    color: "9AA0A6",
    people: 0,
    width: 1920,
    height: 1080,
  },
  parks: {
    title: "Trail through a green national park",
    description: "Outdoor recreation path lined with trees and soft light.",
    type: "photo",
    keywords: ["park", "trail", "outdoor", "hiking", "trees", "recreation", "green", "path"],
    orientation: "horizontal",
    color: "3F7D4E",
    people: 0,
    width: 1920,
    height: 1080,
  },
  people: {
    title: "Lifestyle friends laughing outdoors",
    description: "Natural candid people moment for lifestyle campaigns.",
    type: "photo",
    keywords: ["people", "friends", "lifestyle", "laughing", "outdoors", " candid", "group", "joy"],
    orientation: "horizontal",
    color: "E0A878",
    people: 3,
    width: 1920,
    height: 1080,
  },
  religion: {
    title: "Quiet temple candles and incense",
    description: "Respectful spiritual atmosphere with soft candlelight.",
    type: "photo",
    keywords: ["temple", "candles", "spiritual", "religion", "incense", "faith", "quiet", "ritual"],
    orientation: "horizontal",
    color: "B08968",
    people: 0,
    width: 1920,
    height: 1080,
  },
  science: {
    title: "Laboratory glassware with blue reagents",
    description: "Science research still life with beakers and cool light.",
    type: "photo",
    keywords: ["science", "lab", "chemistry", "research", "glassware", "experiment", "blue", "stem"],
    orientation: "horizontal",
    color: "3D7EA6",
    people: 0,
    width: 1920,
    height: 1080,
  },
  signs: {
    title: "Neon arrow sign on brick wall",
    description: "Bold symbol graphic for wayfinding and campaign concepts.",
    type: "photo",
    keywords: ["sign", "neon", "arrow", "symbol", "urban", "graphic", "wayfinding", "night"],
    orientation: "vertical",
    color: "FF5A36",
    people: 0,
    width: 1440,
    height: 1920,
  },
  sports: {
    title: "Sprinter exploding from starting blocks",
    description: "High-energy athletics action for sports and fitness brands.",
    type: "photo",
    keywords: ["sports", "sprint", "athlete", "track", "fitness", "action", "running", "stadium"],
    orientation: "horizontal",
    color: "E85D04",
    people: 1,
    width: 1920,
    height: 1080,
  },
  technology: {
    title: "Circuit board with luminous traces",
    description: "Macro tech detail for AI, electronics, and innovation stories.",
    type: "photo",
    keywords: ["technology", "circuit", "electronics", "ai", "innovation", "chip", "digital", "macro"],
    orientation: "horizontal",
    color: "2A9D8F",
    people: 0,
    width: 1920,
    height: 1080,
  },
  transport: {
    title: "High-speed train blurring through station",
    description: "Motion-rich transportation scene with modern rail design.",
    type: "photo",
    keywords: ["train", "transport", "rail", "vehicle", "travel", "motion", "modern", "transit"],
    orientation: "horizontal",
    color: "457B9D",
    people: 0,
    width: 1920,
    height: 1080,
  },
  vintage: {
    title: "Sepia typewriter on wooden desk",
    description: "Retro still life with vintage props and warm tones.",
    type: "photo",
    keywords: ["vintage", "typewriter", "retro", "sepia", "desk", "antique", "nostalgia", "classic"],
    orientation: "horizontal",
    color: "A98467",
    people: 0,
    width: 1920,
    height: 1080,
  },
  "ai-generated": {
    title: "Surreal crystalline city of light",
    description: "Clearly fantastical AI-style cityscape for generative art collections.",
    type: "illustration",
    keywords: ["ai", "generated", "surreal", "crystal", "city", "fantasy", "digital", "concept"],
    orientation: "horizontal",
    color: "7B68EE",
    people: 0,
    width: 1920,
    height: 1080,
  },
  "renders-3d": {
    title: "Glossy 3D product orb on podium",
    description: "CGI product visualization with studio reflections.",
    type: "illustration",
    keywords: ["3d", "render", "cgi", "product", "orb", "podium", "studio", "glossy"],
    orientation: "horizontal",
    color: "6C8CFF",
    people: 0,
    width: 1920,
    height: 1080,
  },
  patterns: {
    title: "Seamless botanical leaf pattern",
    description: "Tile-ready pattern for packaging, textiles, and walls.",
    type: "illustration",
    keywords: ["pattern", "seamless", "botanical", "leaves", "textile", "print", "repeat", "green"],
    orientation: "horizontal",
    color: "2F6B3A",
    people: 0,
    width: 1920,
    height: 1080,
  },
  "ui-mockups": {
    title: "Smartphone UI mockup on desk",
    description: "Device frame scene for app and SaaS marketing.",
    type: "photo",
    keywords: ["ui", "mockup", "phone", "app", "screen", "device", "saas", "interface"],
    orientation: "horizontal",
    color: "4C6EF5",
    people: 0,
    width: 1920,
    height: 1080,
  },
  cutouts: {
    title: "Isolated sneakers cutout on white",
    description: "Clean product cutout style for compositing and catalogs.",
    type: "photo",
    keywords: ["cutout", "sneakers", "product", "isolated", "white background", "commerce", "shoes", "clean"],
    orientation: "horizontal",
    color: "F1F3F5",
    people: 0,
    width: 1920,
    height: 1080,
  },
  aerial: {
    title: "Aerial coastline curves at noon",
    description: "Drone perspective of shoreline geometry and turquoise water.",
    type: "photo",
    keywords: ["aerial", "drone", "coast", "ocean", "topdown", "landscape", "travel", "blue"],
    orientation: "horizontal",
    color: "1D8A99",
    people: 0,
    width: 1920,
    height: 1080,
  },
  macro: {
    title: "Macro dew on a green leaf",
    description: "Extreme close-up water droplets with crisp detail.",
    type: "photo",
    keywords: ["macro", "dew", "leaf", "droplet", "closeup", "detail", "nature", "green"],
    orientation: "horizontal",
    color: "40916C",
    people: 0,
    width: 1920,
    height: 1080,
  },
  night: {
    title: "Milky Way over silent desert",
    description: "Astrophotography nightscape with dense star field.",
    type: "photo",
    keywords: ["night", "astro", "milky way", "stars", "desert", "sky", "long exposure", "cosmos"],
    orientation: "horizontal",
    color: "1B263B",
    people: 0,
    width: 1920,
    height: 1080,
  },
  underwater: {
    title: "Sunbeams through turquoise reef",
    description: "Underwater scene with coral and cascading light rays.",
    type: "photo",
    keywords: ["underwater", "reef", "ocean", "coral", "dive", "blue", "marine", "sunbeams"],
    orientation: "horizontal",
    color: "0077B6",
    people: 0,
    width: 1920,
    height: 1080,
  },
  cultural: {
    title: "Diwali lamps and marigold garlands",
    description: "Cultural festival still life with diyas and flowers.",
    type: "photo",
    keywords: ["diwali", "culture", "festival", "marigold", "lamps", "india", "celebration", "tradition"],
    orientation: "horizontal",
    color: "E09F3E",
    people: 0,
    width: 1920,
    height: 1080,
  },
  wedding: {
    title: "Wedding rings on soft linen",
    description: "Elegant event detail for wedding and celebration brands.",
    type: "photo",
    keywords: ["wedding", "rings", "event", "romance", "ceremony", "detail", "elegant", "linen"],
    orientation: "horizontal",
    color: "DDBEA9",
    people: 0,
    width: 1920,
    height: 1080,
  },
  pets: {
    title: "Golden retriever on a sunny porch",
    description: "Friendly pet portrait for lifestyle and family brands.",
    type: "photo",
    keywords: ["pet", "dog", "retriever", "home", "companion", "animal", "portrait", "sunny"],
    orientation: "horizontal",
    color: "D4A373",
    people: 0,
    width: 1920,
    height: 1080,
  },
  workspace: {
    title: "Creative desk with laptop and coffee",
    description: "Workspace flat lay for remote work and productivity.",
    type: "photo",
    keywords: ["workspace", "desk", "laptop", "coffee", "creative", "office", "remote", "productivity"],
    orientation: "horizontal",
    color: "8B95A8",
    people: 0,
    width: 1920,
    height: 1080,
  },
  esg: {
    title: "Wind turbines on green hills",
    description: "Sustainability visual for climate and ESG storytelling.",
    type: "photo",
    keywords: ["wind", "turbines", "sustainability", "esg", "energy", "green", "climate", "renewable"],
    orientation: "horizontal",
    color: "2A9D8F",
    people: 0,
    width: 1920,
    height: 1080,
  },
  infographic: {
    title: "Clean chart and icon elements set",
    description: "Infographic parts on a dark board for presentations.",
    type: "illustration",
    keywords: ["infographic", "chart", "icons", "data", "diagram", "presentation", "elements", "vector"],
    orientation: "horizontal",
    color: "4EA8DE",
    people: 0,
    width: 1920,
    height: 1080,
  },
  "medical-illust": {
    title: "Anatomical heart medical illustration",
    description: "Clinical-style medical illustration for healthcare education.",
    type: "illustration",
    keywords: ["medical", "illustration", "anatomy", "heart", "clinical", "education", "science", "diagram"],
    orientation: "horizontal",
    color: "E63946",
    people: 0,
    width: 1920,
    height: 1080,
  },
  "food-styling": {
    title: "Editorial citrus food styling board",
    description: "High-end food styling with citrus, herbs, and ceramic plates.",
    type: "photo",
    keywords: ["food styling", "citrus", "editorial", "cuisine", "herbs", "plate", "fresh", "gourmet"],
    orientation: "horizontal",
    color: "F4A261",
    people: 0,
    width: 1920,
    height: 1080,
  },
  seasonal: {
    title: "Autumn campaign leaves and scarf",
    description: "Seasonal marketing still life with warm fall palette.",
    type: "photo",
    keywords: ["seasonal", "autumn", "leaves", "campaign", "fall", "scarf", "marketing", "warm"],
    orientation: "horizontal",
    color: "BC6C25",
    people: 0,
    width: 1920,
    height: 1080,
  },
  genz: {
    title: "Gen Z street style night out",
    description: "Youth lifestyle fashion moment with neon city energy.",
    type: "photo",
    keywords: ["gen z", "street style", "youth", "fashion", "night", "lifestyle", "urban", "trend"],
    orientation: "vertical",
    color: "F72585",
    people: 1,
    width: 1440,
    height: 1920,
  },
  "arch-detail": {
    title: "Geometric facade architecture detail",
    description: "Close architectural geometry with repeating patterns.",
    type: "photo",
    keywords: ["architecture", "detail", "facade", "geometry", "pattern", "building", "modern", "structure"],
    orientation: "vertical",
    color: "6C757D",
    people: 0,
    width: 1440,
    height: 1920,
  },
  "phone-wallpapers": {
    title: "Soft aurora phone lock screen wallpaper",
    description: "Portrait wallpaper made for phone lock screens and home screens.",
    type: "photo",
    keywords: [
      "phone wallpaper",
      "lock screen",
      "home screen",
      "iphone wallpaper",
      "android wallpaper",
      "mobile wallpaper",
      "samsung wallpaper",
      "phone background",
    ],
    orientation: "vertical",
    color: "7B68EE",
    people: 0,
    width: 1170,
    height: 2532,
  },
  "desktop-wallpapers": {
    title: "Mountain lake desktop wallpaper panorama",
    description: "Wide desktop wallpaper for monitors, laptops, and ultrawide screens.",
    type: "photo",
    keywords: [
      "desktop wallpaper",
      "monitor wallpaper",
      "laptop wallpaper",
      "pc wallpaper",
      "ultrawide",
      "desktop background",
      "screen wallpaper",
    ],
    orientation: "horizontal",
    color: "457B9D",
    people: 0,
    width: 2560,
    height: 1440,
  },
};

const usedSlugs = new Set<string>();

/** One HD catalog image per category — owned/sold by Lumenstock */
const categoryAssets: Asset[] = categories.map((cat, index) => {
  const seed = seeds[cat.id];
  const id = `ls-${String(index + 1).padStart(4, "0")}`;
  return {
    id,
    slug: uniqueSlug(seed.title, usedSlugs, id),
    title: seed.title,
    description: seed.description,
    type: seed.type,
    categoryIds: [cat.id],
    keywords: seed.keywords,
    orientation: seed.orientation,
    width: seed.width,
    height: seed.height,
    owner: "Lumenstock",
    priceHint: "From plan",
    imageUrl: `/samples/categories/${cat.id}.jpg`,
    color: seed.color,
    people: seed.people,
  };
});

/** One HD image per subcategory */
const subcategoryAssets: Asset[] = subcategories.map((sub, index) => {
  const seed = subcategorySeeds[sub.id];
  const id = `ls-sub-${String(index + 1).padStart(4, "0")}`;
  return {
    id,
    slug: uniqueSlug(seed.title, usedSlugs, id),
    title: seed.title,
    description: seed.description,
    type: seed.type,
    categoryIds: [sub.parentId],
    subcategoryId: sub.id,
    keywords: [...seed.keywords, sub.name.toLowerCase(), sub.parentId],
    orientation: seed.orientation,
    width: seed.width,
    height: seed.height,
    owner: "Lumenstock",
    priceHint: "From plan",
    imageUrl: `/samples/subcategories/${sub.id}.jpg`,
    color: seed.color,
    people: seed.people,
  };
});

export const assets: Asset[] = [...categoryAssets, ...subcategoryAssets];

export function assetPath(asset: Pick<Asset, "slug">) {
  return `/asset/${asset.slug}`;
}

export { subcategories };
export { getSubcategory, getSubcategoriesForParent } from "./subcategories";

export const pricingPlans = [
  {
    id: "starter",
    name: "Starter",
    blurb: "For occasional projects",
    monthly: 29,
    annual: 25,
    downloads: 10,
    features: ["10 images / month", "Standard license", "Desktop / tablet / phone sizes", "Cancel anytime*"],
  },
  {
    id: "creator",
    name: "Creator",
    blurb: "For freelancers & studios",
    monthly: 99,
    annual: 75,
    downloads: 50,
    featured: true,
    features: ["50 images / month", "Standard license", "Enhanced upgrade available", "All device size exports"],
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

/** Resolve by SEO slug or legacy id (ls-0003 / ls-sub-0001). */
export function getAsset(slugOrId: string) {
  return assets.find((a) => a.slug === slugOrId || a.id === slugOrId);
}

export function getCategory(id: string) {
  return categories.find((c) => c.id === id);
}

function tokenizeQuery(q: string) {
  return q
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

function wordMatch(hay: string, token: string) {
  const text = hay.toLowerCase();
  if (!token) return false;
  // Prefer whole-word / keyword matches so parent categories don't leak unrelated hits
  if (text === token) return true;
  if (text.startsWith(`${token}-`) || text.endsWith(`-${token}`) || text.includes(`-${token}-`)) return true;
  return new RegExp(`(^|[^a-z0-9])${token}([^a-z0-9]|$)`).test(text);
}

function assetMatchesToken(a: Asset, token: string) {
  const sub = a.subcategoryId ? getSubcategory(a.subcategoryId) : undefined;
  const fields = [
    a.title,
    a.description,
    a.slug,
    a.subcategoryId || "",
    sub?.name || "",
    sub?.description || "",
    ...a.keywords,
  ];
  // Only match category names (not raw ids alone) to avoid noisy hits
  for (const catId of a.categoryIds) {
    const cat = getCategory(catId);
    if (cat) fields.push(cat.name, cat.description);
  }
  return fields.some((f) => wordMatch(f, token));
}

function relevanceScore(a: Asset, tokens: string[]) {
  let score = 0;
  const title = a.title.toLowerCase();
  const keywords = a.keywords.map((k) => k.toLowerCase());
  const sub = a.subcategoryId ? getSubcategory(a.subcategoryId) : undefined;
  for (const token of tokens) {
    if (wordMatch(title, token)) score += 8;
    if (keywords.some((k) => wordMatch(k, token))) score += 5;
    if (sub && (wordMatch(sub.name, token) || wordMatch(sub.id, token))) score += 6;
    if (wordMatch(a.description, token)) score += 2;
  }
  return score;
}

export function searchAssets(opts: {
  q?: string;
  type?: string;
  orientation?: string;
  category?: string;
  subcategory?: string;
  people?: string;
}) {
  const q = (opts.q || "").trim().toLowerCase();
  const tokens = tokenizeQuery(q);

  const filtered = assets.filter((a) => {
    if (opts.type && opts.type !== "all" && a.type !== opts.type) return false;
    if (opts.orientation && opts.orientation !== "all" && a.orientation !== opts.orientation) return false;
    if (opts.category && opts.category !== "all" && !a.categoryIds.includes(opts.category)) return false;
    if (opts.subcategory && opts.subcategory !== "all" && a.subcategoryId !== opts.subcategory) return false;
    if (opts.people === "none" && a.people > 0) return false;
    if (opts.people === "with" && a.people < 1) return false;
    if (!tokens.length) return true;
    return tokens.every((token) => assetMatchesToken(a, token));
  });

  if (!tokens.length) return filtered;
  return filtered.sort((a, b) => relevanceScore(b, tokens) - relevanceScore(a, tokens));
}
