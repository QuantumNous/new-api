// CLI entry: argv → GenPptxInput, drive the export, write the .pptx, print one
// JSON result line. Shebang is added by esbuild's banner.
//
//   gen-pptx --url <servedDeckUrl> --config <jsonPath|-> [--out <dir>]

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runGenPptx } from "./orchestrator/run.ts";
import { PlaywrightDriver } from "./orchestrator/driver.ts";
import { writeOutput } from "./orchestrator/output.ts";
import type { GenPptxInput } from "./types.ts";

const SETUP_HINT =
  "cd <skill>/agents/gen-pptx && npm install && npx playwright install chromium";

interface Args {
  url: string;
  config: string;
  out?: string;
}

function usage(msg: string): never {
  process.stderr.write(
    `${msg}\n\nUsage: gen-pptx --url <servedDeckUrl> --config <jsonPath|-> [--out <dir>]\n`,
  );
  process.exit(64);
}

function parseArgs(argv: string[]): Args {
  const out: Partial<Args> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--url") out.url = argv[++i];
    else if (a === "--config") out.config = argv[++i];
    else if (a === "--out") out.out = argv[++i];
    else if (a === "-h" || a === "--help") usage("gen-pptx");
    else usage(`Unknown argument: ${a}`);
  }
  if (!out.url) usage("Missing --url");
  if (!out.config) usage("Missing --config");
  if (!/^https?:\/\//i.test(out.url)) {
    usage("--url must be an http(s) URL (deck-stage / multi-file decks need a served origin, not file://)");
  }
  return out as Args;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function preflight(): Promise<void> {
  const major = parseInt(process.versions.node.split(".")[0] ?? "0", 10);
  if (major < 18) {
    process.stderr.write(`gen-pptx: node >= 18 required (found ${process.versions.node}).\n`);
    process.exit(1);
  }
  let pw: typeof import("playwright");
  try {
    pw = await import("playwright");
  } catch {
    process.stderr.write(`gen-pptx: playwright is not installed.\nOne-time setup:\n  ${SETUP_HINT}\n`);
    process.exit(1);
  }
  let exe = "";
  try {
    exe = pw.chromium.executablePath();
  } catch {
    /* fall through to the not-found message */
  }
  if (!exe || !existsSync(exe)) {
    process.stderr.write(`gen-pptx: Chromium browser is not installed.\nOne-time setup:\n  ${SETUP_HINT}\n`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  await preflight();

  const raw = args.config === "-" ? await readStdin() : readFileSync(resolve(args.config), "utf8");
  let input: GenPptxInput;
  try {
    input = JSON.parse(raw) as GenPptxInput;
  } catch (err) {
    usage(`--config is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!input || typeof input.width !== "number" || typeof input.height !== "number") {
    usage("config must include numeric width and height");
  }

  const mode = input.mode ?? "editable";
  const driver = await PlaywrightDriver.launch(args.url, {
    width: input.width,
    height: input.height,
    deviceScaleFactor: mode === "screenshots" ? 2 : 1,
  });
  try {
    const { result, buffer } = await runGenPptx(input, driver);
    const savedPath = await writeOutput(buffer, args.out ?? process.cwd(), input.filename);
    process.stdout.write(
      JSON.stringify({
        ok: true,
        file: savedPath,
        slides: result.slides,
        bytes: result.bytes,
        flags: result.validation.map((v) => ({ code: v.kind, message: v.message })),
        warnings: result.warnings,
        speakerNotes: result.speakerNotes,
      }) + "\n",
    );
    process.exit(0);
  } catch (err) {
    process.stdout.write(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }) + "\n",
    );
    process.exit(1);
  } finally {
    await driver.close();
  }
}

main().catch((err) => {
  process.stdout.write(
    JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }) + "\n",
  );
  process.exit(1);
});
