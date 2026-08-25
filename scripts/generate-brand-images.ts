/**
 * REMEDIATION-PLAN.md PR 1 (SEO metadata, favicon, font preload): generates the three static
 * raster images derived from the brand mark that Seo.astro references —
 *
 *   - public/og-default.png      1200x630  site-wide Open Graph / Twitter card fallback
 *   - public/favicon.png         32x32     <link rel="icon">
 *   - public/apple-touch-icon.png 180x180  <link rel="apple-touch-icon">
 *
 * `sharp` is a transitive dependency of Astro's built-in image service already (see
 * package-lock.json), so this script adds no new dependency.
 *
 * The logo file itself (src/assets/logo-oris.png) is never modified or recoloured (CLAUDE.md
 * §2) — every output here only scales the untouched logo (proportional resize, same operation
 * <Image> already performs at render time elsewhere in the site, e.g. Header.astro) and
 * composites it onto a plain --color-indigo-500 (#071c9b) field. No pixel of the mark is
 * recoloured, cropped, or redrawn.
 *
 * Re-run with `npm run generate:brand-images` whenever src/assets/logo-oris.png changes. Output
 * is committed (like public/fonts/*.woff2) rather than generated at build time, so it survives
 * a `npm run build` without a network/tooling dependency and the PR that changes the logo can
 * show the regenerated files in its diff.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LOGO_PATH = join(ROOT, "src", "assets", "logo-oris.png");
const PUBLIC_DIR = join(ROOT, "public");

// --color-indigo-500 in src/styles/global.css — the one place this hex is allowed to live
// outside the @theme block is a byte-for-byte copy used to composite a raster the @theme block
// can't reach (CLAUDE.md: "Design tokens live in exactly one place").
const INDIGO_500 = "#071c9b";

interface Spec {
  file: string;
  width: number;
  height: number;
  /** Target width of the resized logo within the canvas; height follows the logo's own aspect
   *  ratio (280:111) automatically since only `width` is passed to sharp's resize. */
  logoWidth: number;
}

const SPECS: Spec[] = [
  { file: "og-default.png", width: 1200, height: 630, logoWidth: 640 },
  { file: "apple-touch-icon.png", width: 180, height: 180, logoWidth: 152 },
  { file: "favicon.png", width: 32, height: 32, logoWidth: 28 },
];

async function generate(spec: Spec): Promise<void> {
  const logo = await sharp(LOGO_PATH).resize({ width: spec.logoWidth }).toBuffer();

  const canvas = sharp({
    create: {
      width: spec.width,
      height: spec.height,
      channels: 4,
      background: INDIGO_500,
    },
  }).composite([{ input: logo, gravity: "center" }]);

  const outPath = join(PUBLIC_DIR, spec.file);
  await writeFile(outPath, await canvas.png().toBuffer());
  console.log(`  ${spec.file} — ${spec.width}x${spec.height}`);
}

async function main() {
  await mkdir(PUBLIC_DIR, { recursive: true });
  console.log(`Generating brand images from ${LOGO_PATH}:`);
  for (const spec of SPECS) {
    await generate(spec);
  }
  console.log(
    "\npublic/og-default.png needs human sign-off before it ships (REMEDIATION-PLAN.md D7) — " +
      "review the generated image before merging.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
