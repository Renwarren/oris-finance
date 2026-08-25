// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import icon from "astro-icon";

// https://astro.build/config
export default defineConfig({
  output: "static",
  site: "https://oris-finance.com",
  i18n: {
    locales: ["fr", "en"],
    defaultLocale: "fr",
    routing: {
      prefixDefaultLocale: false,
    },
  },
  // astro-icon + Iconify (REMEDIATION-PLAN.md PR4 / BUILD-PLAN.md §7): inlines used icons as
  // SVG at build time, zero runtime JS, zero extra requests. `lucide` for UI/navigation icons,
  // `ph` (Phosphor, Regular weight — kept consistent everywhere it's used) for product/account
  // category icons.
  integrations: [icon()],
  vite: {
    plugins: [tailwindcss()],
  },
});
