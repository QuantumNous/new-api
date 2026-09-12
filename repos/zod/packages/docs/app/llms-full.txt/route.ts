import * as fs from "node:fs/promises";
import { join } from "node:path";
import { getLLMText } from "@/loaders/get-llm-text";
import { source } from "@/loaders/source";

export const revalidate = false;

export async function GET() {
  const pages = source.getPages();

  // Read meta.json to get the page order
  const metaPath = join(process.cwd(), "content", "meta.json");
  const meta = JSON.parse(await fs.readFile(metaPath, "utf-8"));

  // Create a map of page URLs to their order in meta.json
  const pageOrder = new Map<string, number>();
  meta.pages.forEach((page: string, index: number) => {
    pageOrder.set(page, index);
  });

  // Sort pages according to meta.json order
  const sortedPages = pages.sort((a, b) => {
    const aOrder = pageOrder.get(a.url) ?? Number.MAX_SAFE_INTEGER;
    const bOrder = pageOrder.get(b.url) ?? Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder;
  });

  // Generate content
  let txt = `# Zod

Zod is a TypeScript-first schema validation library with static type inference. This documentation provides comprehensive coverage of Zod 4's features, API, and usage patterns.

`;

  // Process each page
  for (const page of sortedPages) {
    txt += await getLLMText(page);
    txt += "\n\n";
  }

  return new Response(txt, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
