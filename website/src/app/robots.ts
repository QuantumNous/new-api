import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/cdn-cgi/", "/_next/", "/dashboard/", "/models/"],
      },
    ],
    sitemap: "https://flatkey.ai/sitemap.xml",
  };
}
