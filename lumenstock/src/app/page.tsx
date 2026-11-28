import { randomInt } from "crypto";
import Link from "next/link";
import { RefreshGalleryButton } from "@/components/RefreshGalleryButton";
import { SearchForm } from "@/components/SearchForm";
import { assetPath, assets, categories, type Asset } from "@/data/catalog";
import styles from "./apple-home.module.css";

/** Render dynamically on every request so every page load shows fresh HD imagery */
export const dynamic = "force-dynamic";
export const revalidate = 0;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i + 1);
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

/** Pick `count` unique assets with category variety so no image repeats on the page */
function pickDiverse(pool: Asset[], count: number, usedIds: Set<string>, spreadByCategory = true) {
  const candidates = shuffle(pool).filter((a) => !usedIds.has(a.id));
  const picked: Asset[] = [];
  const usedCats = new Set<string>();

  if (spreadByCategory) {
    for (const a of candidates) {
      if (picked.length >= count) break;
      const key = a.subcategoryId || a.categoryIds[0] || a.id;
      if (usedCats.has(key)) continue;
      usedCats.add(key);
      usedIds.add(a.id);
      picked.push(a);
    }
  }

  for (const a of candidates) {
    if (picked.length >= count) break;
    if (usedIds.has(a.id)) continue;
    usedIds.add(a.id);
    picked.push(a);
  }
  return picked;
}

const AI_3D_IDS = new Set([
  "ai-generated",
  "ai-surreal",
  "ai-futuristic",
  "technology-ai",
  "renders-3d",
  "3d-products",
  "3d-characters",
]);

function BentoTile({ asset, sizeClass }: { asset: Asset; sizeClass: string }) {
  return (
    <Link href={assetPath(asset)} className={`${styles.bentoCard} ${sizeClass}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={asset.imageUrl} alt={asset.title} loading="lazy" referrerPolicy="no-referrer" />
      <div className={styles.bentoOverlay}>
        <h3>{asset.title}</h3>
        <p>
          HD {asset.width}×{asset.height}
        </p>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const usedIds = new Set<string>();

  const horizontalPool = assets.filter(
    (a) =>
      a.orientation === "horizontal" &&
      !a.categoryIds.includes("phone-wallpapers") &&
      !a.categoryIds.includes("cutouts"),
  );
  const aiPool = assets.filter(
    (a) =>
      a.categoryIds.some((id) => AI_3D_IDS.has(id)) ||
      (a.subcategoryId && AI_3D_IDS.has(a.subcategoryId)),
  );
  const phonePool = assets.filter((a) => a.categoryIds.includes("phone-wallpapers"));
  const desktopPool = assets.filter((a) => a.categoryIds.includes("desktop-wallpapers"));

  // Prefer crisp high-impact horizontal shots for the cinema hero banner
  const heroCandidates = horizontalPool.filter(
    (a) =>
      a.categoryIds.some((c) =>
        ["nature", "aerial", "night", "desktop-wallpapers", "cultural", "buildings", "underwater", "science"].includes(
          c,
        ),
      ),
  );
  const [heroAsset] = pickDiverse(heroCandidates.length ? heroCandidates : horizontalPool, 1, usedIds);

  const trending = pickDiverse(horizontalPool, 8, usedIds, true);
  const phoneSpotlights = pickDiverse(phonePool, 3, usedIds, true);
  const [desktopSpotlight] = pickDiverse(desktopPool, 1, usedIds, true);
  const aiShowcase = pickDiverse(aiPool, 6, usedIds, true);
  const mostDownloaded = pickDiverse(horizontalPool, 6, usedIds, true);
  const mostViewed = pickDiverse(assets, 6, usedIds, true);

  const trendingSpans = [
    styles.spanHero,
    styles.spanTall,
    styles.spanThird,
    styles.spanThird,
    styles.spanThird,
    styles.spanHalf,
    styles.spanHalf,
    styles.spanWide,
  ];
  const sixSpans = [
    styles.spanWide,
    styles.spanNarrow,
    styles.spanThird,
    styles.spanThird,
    styles.spanThird,
    styles.spanHero,
  ];
  const balancedSixSpans = [
    styles.spanHalf,
    styles.spanHalf,
    styles.spanThird,
    styles.spanThird,
    styles.spanThird,
    styles.spanHalf,
  ];

  const featuredCategories = categories.slice(0, 24);

  return (
    <div className={styles.appleHome}>
      {/* 1. Apple Flagship Cinema Hero */}
      <section className={styles.hero}>
        <div className={styles.inner}>
          <p className={styles.heroEyebrow}>
            <span className={styles.heroDot} aria-hidden />
            Lumenstock · {assets.length.toLocaleString()} HD Images
          </p>
          <h1 className={styles.heroTitle}>
            Luminous stock.
            <br />
            Built for every screen.
          </h1>
          <p className={styles.heroLead}>
            50 unique HD visuals across every category and subcategory. Preview device crops in full
            clarity, license cleanly, and refresh for a new gallery every visit.
          </p>

          <div className={styles.heroSearchWrap}>
            <SearchForm />
          </div>

          <div className={styles.heroActions}>
            <Link href="/browse" className={styles.applePillPrimary}>
              Explore all images
            </Link>
            <Link href="/categories" className={styles.applePillOutlineDark}>
              Browse categories
            </Link>
            <RefreshGalleryButton className={styles.applePillOutlineDark} />
          </div>

          {heroAsset && (
            <Link href={assetPath(heroAsset)} className={styles.heroStage}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={heroAsset.imageUrl}
                alt={heroAsset.title}
                fetchPriority="high"
                decoding="async"
                referrerPolicy="no-referrer"
              />
              <div className={styles.heroStageCaption}>
                <div>
                  <strong>{heroAsset.title}</strong>
                  <span>
                    Featured dynamically · HD {heroAsset.width}×{heroAsset.height}
                  </span>
                </div>
                <span className={styles.heroStageLink}>License image ›</span>
              </div>
            </Link>
          )}
        </div>
      </section>

      {/* 2. Trending Now — Apple Light Bento Grid */}
      <section className={styles.bandLight}>
        <div className={styles.inner}>
          <div className={styles.bandHead}>
            <p className={styles.eyebrow}>Curated dynamically</p>
            <h2 className={styles.bandTitle}>Trending now.</h2>
            <p className={styles.bandSub}>
              A fresh cross-section from nature, culture, architecture, aerials, and lifestyle on
              every page load.
            </p>
            <Link href="/browse" className={styles.appleLink}>
              Explore all {assets.length.toLocaleString()} images ›
            </Link>
          </div>
          <div className={styles.bentoGrid}>
            {trending.slice(0, 7).map((asset, i) => (
              <BentoTile key={asset.id} asset={asset} sizeClass={trendingSpans[i] || styles.spanThird} />
            ))}
          </div>
        </div>
      </section>

      {/* 3. Apple Twin Spotlight Cards — Phone & Desktop Wallpapers */}
      <section className={styles.promoBand}>
        <div className={styles.inner}>
          <div className={styles.promoGrid}>
            <div className={styles.promoTileDark}>
              <h2>Phone Wallpapers</h2>
              <p>Portrait lock-screen and home-screen art sized for iPhone and Android.</p>
              <div className={styles.promoLinks}>
                <Link href="/browse?category=phone-wallpapers">Browse Phone ›</Link>
                <Link href="/categories">See Frames ›</Link>
              </div>
              <div className={styles.phoneTrio}>
                {phoneSpotlights[1] && (
                  <Link href={assetPath(phoneSpotlights[1])} className={styles.phoneSide}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={phoneSpotlights[1].imageUrl}
                      alt={phoneSpotlights[1].title}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  </Link>
                )}
                {phoneSpotlights[0] && (
                  <Link href={assetPath(phoneSpotlights[0])} className={styles.phoneMain}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={phoneSpotlights[0].imageUrl}
                      alt={phoneSpotlights[0].title}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                    <span className={styles.phoneClock} aria-hidden>
                      9:41
                    </span>
                  </Link>
                )}
                {phoneSpotlights[2] && (
                  <Link href={assetPath(phoneSpotlights[2])} className={styles.phoneSide}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={phoneSpotlights[2].imageUrl}
                      alt={phoneSpotlights[2].title}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  </Link>
                )}
              </div>
            </div>

            <div className={styles.promoTileLight}>
              <h2>Desktop Wallpapers</h2>
              <p>Crisp 2560×1440 and 3440×1440 ultrawide panoramas for monitors and laptops.</p>
              <div className={styles.promoLinks}>
                <Link href="/browse?category=desktop-wallpapers">Browse Desktop ›</Link>
                <Link href="/browse?category=desktop-wallpapers&subcategory=desktop-wallpapers-ultrawide">
                  Ultrawide ›
                </Link>
              </div>
              {desktopSpotlight && (
                <div className={styles.displayShowcase}>
                  <Link href={assetPath(desktopSpotlight)} className={styles.displayBezel}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={desktopSpotlight.imageUrl}
                      alt={desktopSpotlight.title}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  </Link>
                  <div className={styles.displayStand} aria-hidden />
                  <div className={styles.displayBase} aria-hidden />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 4. Apple Pro Cinema Dark Band — AI & 3D Studio */}
      <section className={styles.bandDark}>
        <div className={styles.inner}>
          <div className={styles.bandHead}>
            <p className={styles.eyebrowGradient}>Generative & CGI Studio</p>
            <h2 className={styles.bandTitle}>AI & 3D. Reimagined.</h2>
            <p className={styles.bandSub}>
              Surreal dreamscapes, futuristic skylines, studio 3D products, and neural concepts —
              clearly labeled and ready to license.
            </p>
            <Link href="/browse?category=ai-generated" className={styles.appleLink}>
              Explore AI Generated ›
            </Link>
          </div>
          <div className={styles.bentoGrid}>
            {aiShowcase.slice(0, 5).map((asset, i) => (
              <BentoTile key={asset.id} asset={asset} sizeClass={sixSpans[i] || styles.spanThird} />
            ))}
          </div>
        </div>
      </section>

      {/* 5. Most Downloaded — Pure White Gallery */}
      <section className={styles.bandWhite}>
        <div className={styles.inner}>
          <div className={styles.bandHead}>
            <p className={styles.eyebrow}>Popular licenses</p>
            <h2 className={styles.bandTitle}>Most downloaded.</h2>
            <p className={styles.bandSub}>
              High-impact frames licensed for brand decks, campaigns, editorial spreads, and apps.
            </p>
            <Link href="/browse" className={styles.appleLink}>
              Browse full catalog ›
            </Link>
          </div>
          <div className={styles.bentoGrid}>
            {mostDownloaded.slice(0, 5).map((asset, i) => (
              <BentoTile
                key={asset.id}
                asset={asset}
                sizeClass={balancedSixSpans[i] || styles.spanThird}
              />
            ))}
          </div>
        </div>
      </section>

      {/* 6. Most Viewed — Soft Apple Gray */}
      <section className={styles.bandLight}>
        <div className={styles.inner}>
          <div className={styles.bandHead}>
            <p className={styles.eyebrow}>Discover across 178 subcategories</p>
            <h2 className={styles.bandTitle}>Most viewed.</h2>
            <p className={styles.bandSub}>
              Reload anytime to surface brand-new discoveries from all 11,300 HD images.
            </p>
            <Link href="/categories" className={styles.appleLink}>
              Explore all categories ›
            </Link>
          </div>
          <div className={styles.bentoGrid}>
            {mostViewed.slice(0, 5).map((asset, i) => (
              <BentoTile key={asset.id} asset={asset} sizeClass={sixSpans[i] || styles.spanThird} />
            ))}
          </div>
        </div>
      </section>

      {/* 7. Categories & Simple Licensing Strip */}
      <section className={styles.bandWhite}>
        <div className={styles.inner}>
          <div className={styles.bandHead}>
            <p className={styles.eyebrow}>48 Categories · 178 Subcategories</p>
            <h2 className={styles.bandTitle}>Every subject. 50 HD frames each.</h2>
            <Link href="/categories" className={styles.appleLink}>
              See all 48 categories ›
            </Link>
          </div>

          <div className={styles.categoryRail}>
            {featuredCategories.map((c) => (
              <Link key={c.id} href={`/browse?category=${c.id}`} className={styles.catPill}>
                {c.name}
              </Link>
            ))}
          </div>

          <div className={styles.trustCard}>
            <h3>Transparent licensing. Zero surprises.</h3>
            <p>
              Preview desktop, tablet, and phone crops free. We never store card details and never
              auto-renew — renew only when you choose.
            </p>
            <Link href="/pricing" className={styles.applePillPrimary}>
              View pricing & packs
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
