import { getBlogCategories, getBlogPosts } from "@/lib/blog";
import { ROUTER_ORIGIN, SITE_ORIGIN } from "@/lib/origins";
import { getDocsUrl } from "@/lib/public-site-settings";

export async function GET() {
  const [posts, categories, docsUrl] = await Promise.all([getBlogPosts(), getBlogCategories(), getDocsUrl()]);
  const docsOrigin = docsUrl ? new URL(docsUrl).origin : null;
  const lines = [
    "# flatkey.ai",
    "",
    "flatkey.ai is a unified AI API gateway, model routing, billing, and operations platform.",
    "",
    "## API Protocols",
    "",
    `- Router base URL: ${ROUTER_ORIGIN}`,
    `- OpenAI-compatible Chat Completions: POST ${ROUTER_ORIGIN}/v1/chat/completions`,
    `- OpenAI-compatible Responses: POST ${ROUTER_ORIGIN}/v1/responses`,
    `- Anthropic Messages: POST ${ROUTER_ORIGIN}/v1/messages`,
    `- Gemini native generateContent: POST ${ROUTER_ORIGIN}/v1beta/models/{model}:generateContent`,
    `- Asynchronous video generation: POST ${ROUTER_ORIGIN}/v1/videos`,
    "",
    "## Gemini Image Models",
    "",
    "- nano-banana-pro-preview supports both Gemini native generateContent and OpenAI-compatible Chat Completions.",
    "- With Gemini native generateContent, generated images are returned in candidates[].content.parts[].inlineData.",
    "- With Chat Completions, generated images are returned in choices[0].message.content as Markdown data URIs.",
    "- These Gemini image-model paths currently do not use /v1/images/generations; do not infer lack of Gemini support from that endpoint.",
    "",
    "## Seedance Video Models",
    "",
    "- Seedance models use the official multimodal content[] request format.",
    `- Create a video task with POST ${ROUTER_ORIGIN}/v1/videos.`,
    `- Poll task status with GET ${ROUTER_ORIGIN}/v1/videos/{task_id}.`,
    `- Download completed video content with GET ${ROUTER_ORIGIN}/v1/videos/{task_id}/content.`,
    "- Use GET /v1/models to discover the Seedance model IDs currently available to your account.",
    ...(docsOrigin
      ? [
          `- Documentation: ${docsOrigin}/api-reference/seedance-video-generation`,
          `- Chinese documentation: ${docsOrigin}/zh/api-reference/seedance-video-generation`,
        ]
      : []),
    "",
    "## Core Pages",
    "",
    `- Home: ${SITE_ORIGIN}/`,
    `- Model pricing: ${SITE_ORIGIN}/pricing`,
    `- Rankings: ${SITE_ORIGIN}/rankings`,
    `- Blog: ${SITE_ORIGIN}/blog`,
    `- Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
  ];

  if (categories.length > 0) {
    lines.push("", "## Blog Categories", "");
    for (const category of categories) {
      lines.push(`- ${category.name}: ${SITE_ORIGIN}/blog/category/${category.slug}`);
    }
  }

  if (posts.list.length > 0) {
    lines.push("", "## Blog Articles", "");
    for (const post of posts.list) {
      lines.push(`- ${post.title}: ${SITE_ORIGIN}/blog/${post.slug}${post.summary ? ` - ${post.summary}` : ""}`);
    }
  }

  return new Response(`${lines.join("\n")}\n`, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
