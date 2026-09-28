import type { MetadataRoute } from "next";
import { getEnv } from "@/server/env";

export default function robots(): MetadataRoute.Robots {
  const base = getEnv().APP_URL;
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/admin", "/account", "/auth/", "/offline"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
