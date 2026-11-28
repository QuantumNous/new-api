import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { source } from "@/loaders/source";
import type { InferPageType } from "fumadocs-core/source";
import { remarkInclude } from "fumadocs-mdx/config";
import matter from "gray-matter";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import remarkStringify from "remark-stringify";

const processor = remark().use(remarkMdx).use(remarkInclude).use(remarkGfm).use(remarkStringify);

export async function getLLMText(page: InferPageType<typeof source>): Promise<string> {
  // Resolve file path relative to project root to handle ISR correctly
  // During ISR on Vercel, absolutePath might not be correct, so we resolve it ourselves
  // process.cwd() is already packages/docs during build/ISR
  const relativePath = page.file.path;
  const resolvedPath = path.join(process.cwd(), "content", relativePath);

  // Try resolved path first, fallback to absolutePath if it doesn't exist
  let filePath: string;
  let fileContent: Buffer;
  try {
    filePath = resolvedPath;
    fileContent = await fs.readFile(filePath);
  } catch {
    // If the resolved path doesn't work, try the absolutePath as fallback
    filePath = page.data._file.absolutePath;
    fileContent = await fs.readFile(filePath);
  }

  const { content } = matter(fileContent.toString());

  const processed = await processor.process({
    path: filePath,
    value: content,
  });

  return `# ${page.data.title}

${processed}`;
}
