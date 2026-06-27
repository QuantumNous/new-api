// Write the .pptx Buffer to disk. Replaces the claude.ai host download (Ye) /
// connectrpc upload (Je/He/Xe).

import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { safeBasename } from "../core/filename.ts";

export async function writeOutput(
  buffer: Buffer,
  outDir: string,
  filename: string | undefined,
): Promise<string> {
  const base = safeBasename(filename, "deck").replace(/\.pptx$/i, "") || "deck";
  const name = `${base}.pptx`;
  const dir = resolve(outDir);
  await mkdir(dir, { recursive: true });
  const path = join(dir, name);
  await writeFile(path, buffer);
  return path;
}
