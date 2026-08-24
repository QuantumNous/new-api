import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/origins";

const STAGING_WEBSITE_ORIGIN = "https://staging-website.flatkey.ai";

export function buildRobots(siteOrigin: string): MetadataRoute.Robots {
  if (siteOrigin === STAGING_WEBSITE_ORIGIN) {
    return {
      rules: [
        {
          userAgent: "*",
          disallow: "/",
        },
      ],
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/cdn-cgi/", "/_next/", "/dashboard/", "/lp/"],
      },
    ],
    sitemap: "https://flatkey.ai/sitemap.xml",
  };
}

export default function robots(): MetadataRoute.Robots {
  return buildRobots(SITE_ORIGIN);
}
