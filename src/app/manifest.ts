import type { MetadataRoute } from "next";

/** Installable PWA: "Add to Home screen" gives a full-screen app that opens offline. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Zimcamsec Hub",
    short_name: "Zimcamsec",
    description: "Heritage-Based Curriculum resources for Zimbabwean learners and educators — works offline.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5f5f4",
    theme_color: "#3f6135",
    lang: "en-ZW",
    categories: ["education"],
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
