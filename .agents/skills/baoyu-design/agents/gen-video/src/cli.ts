// CLI entry: argv → GenVideoInput, drive the export, print one JSON result line.
// Shebang is added by esbuild's banner.
//
//   gen-video --url <servedAnimationUrl> --config <jsonPath|-> [--out <dir>]

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { runGenVideo } from "./orchestrator/run.ts";
import { PlaywrightDriver } from "./orchestrator/driver.ts";
import type { GenVideoInput } from "./types.ts";

const SETUP_HINT =
  "cd <skill>/agents/gen-video && npm install && npx playwright install chromium\n  (ffmpeg must also be on PATH: `brew install ffmpeg` on macOS, `apt install ffmpeg` on Linux)";

interface Args {
  url: string;
  config: string;
  out?: string;
}

function usage(msg: string): never {
  process.stderr.write(
    `${msg}\n\nUsage: gen-video --url <servedAnimationUrl> --config <jsonPath|-> [--out <dir>]\n`,
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
    else if (a === "-h" || a === "--help") usage("gen-video");
    else usage(`Unknown argument: ${a}`);
  }
  if (!out.url) usage("Missing --url");
  if (!out.config) usage("Missing --config");
  if (!/^https?:\/\//i.test(out.url)) {
    usage("--url must be an http(s) URL (multi-file animations need a served origin, not file://)");
  }
  return out as Args;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

/** Append the capture-mode query param so a capture-aware Stage strips its chrome. */
function withCaptureParam(url: string, param: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set(param, "1");
    return u.toString();
  } catch {
    return url;
  }
}

function ffmpegAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn("ffmpeg", ["-version"], { stdio: "ignore" });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
}

async function preflight(): Promise<void> {
  const major = parseInt(process.versions.node.split(".")[0] ?? "0", 10);
  if (major < 18) {
    process.stderr.write(`gen-video: node >= 18 required (found ${process.versions.node}).\n`);
    process.exit(1);
  }
  let pw: typeof import("playwright");
  try {
    pw = await import("playwright");
  } catch {
    process.stderr.write(`gen-video: playwright is not installed.\nOne-time setup:\n  ${SETUP_HINT}\n`);
    process.exit(1);
  }
  let exe = "";
  try {
    exe = pw.chromium.executablePath();
  } catch {
    /* fall through to the not-found message */
  }
  if (!exe || !existsSync(exe)) {
    process.stderr.write(`gen-video: Chromium browser is not installed.\nOne-time setup:\n  ${SETUP_HINT}\n`);
    process.exit(1);
  }
  if (!(await ffmpegAvailable())) {
    process.stderr.write(
      `gen-video: ffmpeg is not installed or not on PATH.\nOne-time setup:\n  brew install ffmpeg   # macOS\n  apt install ffmpeg    # Debian/Ubuntu\n`,
    );
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  await preflight();

  const raw = args.config === "-" ? await readStdin() : readFileSync(resolve(args.config), "utf8");
  let input: GenVideoInput;
  try {
    input = JSON.parse(raw) as GenVideoInput;
  } catch (err) {
    usage(`--config is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!input || typeof input.width !== "number" || typeof input.height !== "number") {
    usage("config must include numeric width and height");
  }

  const captureParam = input.captureParam ?? "capture";
  const url = withCaptureParam(args.url, captureParam);
  const driver = await PlaywrightDriver.launch(url, {
    width: input.width,
    height: input.height,
    deviceScaleFactor: input.deviceScaleFactor ?? 2,
  });
  try {
    const { result, file } = await runGenVideo(input, driver, args.out ?? process.cwd());
    process.stdout.write(
      JSON.stringify({
        ok: true,
        file,
        frames: result.frames,
        fps: result.fps,
        duration: result.duration,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        flags: result.validation.map((v) => ({ code: v.kind, message: v.message })),
        warnings: result.warnings,
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
