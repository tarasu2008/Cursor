/**
 * Subcategory taxonomy inspired by Adobe Stock category trees +
 * Shutterstock/Freepik browse patterns (Animals→Mammals/Birds/Marine,
 * Nature→Mountains/Forests/Skies, Business→Finance/Office, etc.).
 * Shutterstock's public /images page is bot-protected here; industry trees
 * were cross-checked via Adobe Stock CategoryTree + Freepik photo themes.
 */
export interface Subcategory {
  id: string;
  parentId: string;
  name: string;
  description: string;
}

export const subcategories: Subcategory[] = [
  // Animals/Wildlife
  { id: "animals-mammals", parentId: "animals", name: "Mammals", description: "Lions, elephants, deer, and land mammals" },
  { id: "animals-birds", parentId: "animals", name: "Birds", description: "Songbirds, raptors, and exotic birds" },
  { id: "animals-marine", parentId: "animals", name: "Aquatic & Marine", description: "Fish, whales, and ocean wildlife" },
  // Nature
  { id: "nature-mountains", parentId: "nature", name: "Mountains", description: "Peaks, ridges, and alpine vistas" },
  { id: "nature-forests", parentId: "nature", name: "Forests", description: "Woodlands, trees, and forest paths" },
  { id: "nature-skies", parentId: "nature", name: "Skies & Clouds", description: "Dramatic skies and cloudscapes" },
  // People
  { id: "people-portraits", parentId: "people", name: "Portraits", description: "Individual headshots and close-ups" },
  { id: "people-families", parentId: "people", name: "Families", description: "Parents, kids, and family life" },
  { id: "people-work", parentId: "people", name: "People at Work", description: "Professionals in workplace moments" },
  // Business/Finance
  { id: "business-office", parentId: "business", name: "Office & Meetings", description: "Teamwork and corporate spaces" },
  { id: "business-finance", parentId: "business", name: "Finance", description: "Money, banking, and markets" },
  { id: "business-startup", parentId: "business", name: "Startup & Innovation", description: "Founders, pitches, and growth" },
  // Food and Drink
  { id: "food-meals", parentId: "food", name: "Meals & Plates", description: "Plated dishes and dining scenes" },
  { id: "food-ingredients", parentId: "food", name: "Ingredients", description: "Fresh produce and pantry staples" },
  { id: "food-drinks", parentId: "food", name: "Drinks & Coffee", description: "Beverages, coffee, and cocktails" },
  // Sports/Recreation
  { id: "sports-team", parentId: "sports", name: "Team Sports", description: "Football, basketball, and team play" },
  { id: "sports-fitness", parentId: "sports", name: "Fitness & Gym", description: "Training, yoga, and workouts" },
  { id: "sports-outdoor", parentId: "sports", name: "Outdoor Sports", description: "Running, cycling, hiking sports" },
  // Technology
  { id: "technology-devices", parentId: "technology", name: "Devices", description: "Phones, laptops, and gadgets" },
  { id: "technology-ai", parentId: "technology", name: "AI & Data", description: "Artificial intelligence concepts" },
  { id: "technology-networks", parentId: "technology", name: "Networks & Cloud", description: "Connectivity and infrastructure" },
  // Buildings/Landmarks
  { id: "buildings-urban", parentId: "buildings", name: "Urban Architecture", description: "City buildings and skylines" },
  { id: "buildings-monuments", parentId: "buildings", name: "Monuments", description: "Landmarks and historic structures" },
  { id: "buildings-homes", parentId: "buildings", name: "Homes & Housing", description: "Residential architecture" },
  // Travel-ish via Parks/Outdoor + Transport split already
  { id: "parks-camping", parentId: "parks", name: "Camping", description: "Tents, campfires, and outdoor stays" },
  { id: "parks-hiking", parentId: "parks", name: "Hiking Trails", description: "Paths and trail recreation" },
  { id: "parks-gardens", parentId: "parks", name: "Gardens & Parks", description: "Public parks and gardens" },
  // Healthcare
  { id: "healthcare-clinic", parentId: "healthcare", name: "Clinics & Hospitals", description: "Care facilities and corridors" },
  { id: "healthcare-wellness", parentId: "healthcare", name: "Wellness", description: "Healthy living and recovery" },
  { id: "healthcare-medical", parentId: "healthcare", name: "Medical Tools", description: "Equipment and clinical tools" },
  // Education
  { id: "education-classroom", parentId: "education", name: "Classroom", description: "Schools and learning spaces" },
  { id: "education-books", parentId: "education", name: "Books & Study", description: "Reading and study still lifes" },
  { id: "education-graduation", parentId: "education", name: "Graduation", description: "Academic milestones" },
  // Beauty/Fashion
  { id: "beauty-makeup", parentId: "beauty", name: "Makeup", description: "Beauty editorial and cosmetics" },
  { id: "beauty-fashion", parentId: "beauty", name: "Fashion", description: "Apparel and runway-style looks" },
  { id: "beauty-skincare", parentId: "beauty", name: "Skincare", description: "Skin and self-care rituals" },
  // Interiors
  { id: "interiors-living", parentId: "interiors", name: "Living Rooms", description: "Home living spaces" },
  { id: "interiors-kitchen", parentId: "interiors", name: "Kitchens", description: "Modern kitchen interiors" },
  { id: "interiors-office", parentId: "interiors", name: "Office Interiors", description: "Indoor workplaces" },
  // Industrial
  { id: "industrial-construction", parentId: "industrial", name: "Construction", description: "Sites, beams, and builds" },
  { id: "industrial-factory", parentId: "industrial", name: "Factories", description: "Manufacturing floors" },
  { id: "industrial-tools", parentId: "industrial", name: "Tools & Machinery", description: "Industrial tools and gear" },
  // Science
  { id: "science-lab", parentId: "science", name: "Laboratory", description: "Lab benches and experiments" },
  { id: "science-space", parentId: "science", name: "Outer Space", description: "Planets, stars, and cosmos" },
  { id: "science-research", parentId: "science", name: "Research", description: "Scientific discovery moments" },
  // Transportation
  { id: "transport-road", parentId: "transport", name: "On the Road", description: "Cars, highways, and driving" },
  { id: "transport-air", parentId: "transport", name: "Aviation", description: "Planes and airports" },
  { id: "transport-rail", parentId: "transport", name: "Rail & Transit", description: "Trains and public transit" },
  // Holidays
  { id: "holidays-christmas", parentId: "holidays", name: "Christmas & Winter", description: "Winter holiday scenes" },
  { id: "holidays-festive", parentId: "holidays", name: "Festive Parties", description: "Celebration and party decor" },
  { id: "holidays-seasonal", parentId: "holidays", name: "Seasonal Decor", description: "Seasonal styling props" },
  // Abstract
  { id: "abstract-gradients", parentId: "abstract", name: "Gradients & Light", description: "Soft abstract light forms" },
  { id: "abstract-geometry", parentId: "abstract", name: "Geometry", description: "Shapes and geometric art" },
  { id: "abstract-motion", parentId: "abstract", name: "Motion Blur", description: "Dynamic abstract motion" },
  // Backgrounds/Textures
  { id: "backgrounds-fabric", parentId: "backgrounds", name: "Fabric Textures", description: "Cloth and linen surfaces" },
  { id: "backgrounds-paper", parentId: "backgrounds", name: "Paper & Walls", description: "Paper and painted walls" },
  { id: "backgrounds-stone", parentId: "backgrounds", name: "Stone & Wood", description: "Natural material textures" },
  // Arts
  { id: "arts-painting", parentId: "arts", name: "Painting", description: "Paint, brushes, and canvases" },
  { id: "arts-sculpture", parentId: "arts", name: "Sculpture", description: "Sculptural forms and studios" },
  { id: "arts-crafts", parentId: "arts", name: "Crafts", description: "Handmade creative crafts" },
  // Objects
  { id: "objects-product", parentId: "objects", name: "Product Still Life", description: "Commerce-ready object shots" },
  { id: "objects-everyday", parentId: "objects", name: "Everyday Objects", description: "Common household items" },
  { id: "objects-luxury", parentId: "objects", name: "Luxury Objects", description: "Premium styled products" },
  // Signs/Symbols
  { id: "signs-neon", parentId: "signs", name: "Neon Signs", description: "Glowing urban neon symbols" },
  { id: "signs-icons", parentId: "signs", name: "Icons & Marks", description: "Simple graphic symbols" },
  { id: "signs-wayfinding", parentId: "signs", name: "Wayfinding", description: "Directional and street signs" },
  // Religion
  { id: "religion-ritual", parentId: "religion", name: "Rituals", description: "Candles, incense, ceremonies" },
  { id: "religion-architecture", parentId: "religion", name: "Sacred Architecture", description: "Temples and spiritual spaces" },
  { id: "religion-symbols", parentId: "religion", name: "Faith Symbols", description: "Respectful spiritual symbols" },
  // Celebrities (event atmosphere, not real celebs)
  { id: "celebrities-redcarpet", parentId: "celebrities", name: "Red Carpet", description: "Premiere night atmospheres" },
  { id: "celebrities-stage", parentId: "celebrities", name: "Stage Lights", description: "Spotlight and stage glamour" },
  { id: "celebrities-paparazzi", parentId: "celebrities", name: "Flash & Cameras", description: "Event photography energy" },
  // Vintage
  { id: "vintage-retro", parentId: "vintage", name: "Retro Props", description: "Typewriters and classic props" },
  { id: "vintage-sepia", parentId: "vintage", name: "Sepia Scenes", description: "Warm aged tonal scenes" },
  { id: "vintage-film", parentId: "vintage", name: "Film Aesthetic", description: "Analog film looks" },
  // Miscellaneous
  { id: "misc-celebration", parentId: "misc", name: "Celebration Props", description: "Balloons and party objects" },
  { id: "misc-concepts", parentId: "misc", name: "Concept Stills", description: "Flexible conceptual shots" },
  { id: "misc-colorful", parentId: "misc", name: "Color Pop", description: "Bright playful compositions" },

  // Extended parents — 2 each
  { id: "ai-surreal", parentId: "ai-generated", name: "Surreal Worlds", description: "Dreamlike generative scenes" },
  { id: "ai-futuristic", parentId: "ai-generated", name: "Futuristic Concepts", description: "Sci-fi generative visuals" },
  { id: "3d-products", parentId: "renders-3d", name: "3D Products", description: "CGI product visualizations" },
  { id: "3d-characters", parentId: "renders-3d", name: "3D Characters", description: "Stylized CGI characters" },
  { id: "patterns-botanical", parentId: "patterns", name: "Botanical Patterns", description: "Leaf and floral repeats" },
  { id: "patterns-geometric", parentId: "patterns", name: "Geometric Patterns", description: "Tileable geometric prints" },
  { id: "ui-phone", parentId: "ui-mockups", name: "Phone Mockups", description: "Smartphone UI frames" },
  { id: "ui-desktop", parentId: "ui-mockups", name: "Desktop Mockups", description: "Laptop and desktop frames" },
  { id: "cutouts-fashion", parentId: "cutouts", name: "Fashion Cutouts", description: "Isolated apparel and shoes" },
  { id: "cutouts-objects", parentId: "cutouts", name: "Object Cutouts", description: "Isolated product subjects" },
  { id: "aerial-coast", parentId: "aerial", name: "Coastal Aerials", description: "Shorelines from above" },
  { id: "aerial-city", parentId: "aerial", name: "City Aerials", description: "Urban drone perspectives" },
  { id: "macro-nature", parentId: "macro", name: "Nature Macro", description: "Dew, insects, plant detail" },
  { id: "macro-texture", parentId: "macro", name: "Texture Macro", description: "Extreme surface detail" },
  { id: "night-astro", parentId: "night", name: "Astrophotography", description: "Stars and Milky Way" },
  { id: "night-city", parentId: "night", name: "City Nights", description: "Urban night lights" },
  { id: "underwater-reef", parentId: "underwater", name: "Coral Reefs", description: "Reef and marine gardens" },
  { id: "underwater-light", parentId: "underwater", name: "Underwater Light", description: "Sunbeams through water" },
  { id: "cultural-festivals", parentId: "cultural", name: "Festivals", description: "Cultural celebration scenes" },
  { id: "cultural-traditions", parentId: "cultural", name: "Traditions", description: "Heritage and ritual details" },
  { id: "wedding-details", parentId: "wedding", name: "Wedding Details", description: "Rings and ceremony props" },
  { id: "wedding-venues", parentId: "wedding", name: "Venues", description: "Reception and venue atmospheres" },
  { id: "pets-dogs", parentId: "pets", name: "Dogs", description: "Dog portraits and lifestyle" },
  { id: "pets-cats", parentId: "pets", name: "Cats", description: "Cat portraits and cozy moments" },
  { id: "workspace-desk", parentId: "workspace", name: "Desk Setups", description: "Creative desks and tools" },
  { id: "workspace-remote", parentId: "workspace", name: "Remote Work", description: "Home-office productivity" },
  { id: "esg-energy", parentId: "esg", name: "Clean Energy", description: "Wind, solar, renewables" },
  { id: "esg-nature", parentId: "esg", name: "Climate Nature", description: "Protected landscapes" },
  { id: "infographic-charts", parentId: "infographic", name: "Charts", description: "Bars, pies, and data visuals" },
  { id: "infographic-icons", parentId: "infographic", name: "Icon Sets", description: "Simple presentation icons" },
  { id: "medical-anatomy", parentId: "medical-illust", name: "Anatomy", description: "Anatomical illustrations" },
  { id: "medical-clinical", parentId: "medical-illust", name: "Clinical Diagrams", description: "Healthcare educational art" },
  { id: "foodstyling-editorial", parentId: "food-styling", name: "Editorial Plates", description: "Gourmet plated styling" },
  { id: "foodstyling-ingredients", parentId: "food-styling", name: "Styled Ingredients", description: "Ingredient hero boards" },
  { id: "seasonal-autumn", parentId: "seasonal", name: "Autumn", description: "Fall campaign looks" },
  { id: "seasonal-spring", parentId: "seasonal", name: "Spring", description: "Fresh spring campaigns" },
  { id: "genz-street", parentId: "genz", name: "Street Style", description: "Youth fashion outdoors" },
  { id: "genz-social", parentId: "genz", name: "Social Moments", description: "Friends and nightlife energy" },
  { id: "arch-facades", parentId: "arch-detail", name: "Facades", description: "Building face geometry" },
  { id: "arch-materials", parentId: "arch-detail", name: "Materials", description: "Concrete, glass, metal detail" },
];

export function getSubcategory(id: string) {
  return subcategories.find((s) => s.id === id);
}

export function getSubcategoriesForParent(parentId: string) {
  return subcategories.filter((s) => s.parentId === parentId);
}
