import { getBlogCategories, getBlogPosts } from "@/lib/blog";

export async function GET() {
  const [posts, categories] = await Promise.all([getBlogPosts(), getBlogCategories()]);
  const lines = [
    "# flatkey.ai",
    "",
    "flatkey.ai is a unified AI API gateway, model routing, billing, and operations platform.",
    "",
    "## Core Pages",
    "",
    "- Home: https://flatkey.ai/",
    "- Model pricing: https://flatkey.ai/pricing",
    "- Rankings: https://flatkey.ai/rankings",
    "- Blog: https://flatkey.ai/blog",
    "- Sitemap: https://flatkey.ai/sitemap.xml",
  ];

  if (categories.length > 0) {
    lines.push("", "## Blog Categories", "");
    for (const category of categories) {
      lines.push(`- ${category.name}: https://flatkey.ai/blog/category/${category.slug}`);
    }
  }

  if (posts.list.length > 0) {
    lines.push("", "## Blog Articles", "");
    for (const post of posts.list) {
      lines.push(`- ${post.title}: https://flatkey.ai/blog/${post.slug}${post.summary ? ` - ${post.summary}` : ""}`);
    }
  }

  return new Response(`${lines.join("\n")}\n`, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
