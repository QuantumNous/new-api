// ffmpeg wrapper. Streams concatenated PNG frames to ffmpeg's stdin via the
// image2pipe demuxer and encodes per format. The supersampled frames are
// downscaled to the target size with lanczos for crisp output.

import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import type { Writable } from "node:stream";
import type { VideoFormat } from "../types.ts";

export interface EncodeOptions {
  format: VideoFormat;
  width: number;
  height: number;
  fps: number;
  crf: number;
  outPath: string;
}

export function buildFfmpegArgs(o: EncodeOptions): string[] {
  const scale = `scale=${o.width}:${o.height}:flags=lanczos`;
  // image2pipe + -c:v png reads the concatenated PNG stream; input -r stamps the
  // frame timing so output duration = frames / fps.
  const base = ["-y", "-f", "image2pipe", "-c:v", "png", "-r", String(o.fps), "-i", "pipe:0"];
  if (o.format === "webm") {
    return [
      ...base,
      "-vf", scale,
      "-c:v", "libvpx-vp9",
      "-b:v", "0",
      "-crf", String(o.crf),
      "-pix_fmt", "yuv420p",
      "-r", String(o.fps),
      o.outPath,
    ];
  }
  if (o.format === "gif") {
    return [
      ...base,
      "-vf", `${scale},split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5`,
      "-r", String(o.fps),
      o.outPath,
    ];
  }
  // mp4 (default)
  return [
    ...base,
    "-vf", scale,
    "-c:v", "libx264",
    "-preset", "slow",
    "-crf", String(o.crf),
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    "-r", String(o.fps),
    o.outPath,
  ];
}

export class FfmpegEncoder {
  private child: ChildProcess;
  private stderr = "";
  private exited: Promise<void>;

  constructor(opts: EncodeOptions) {
    this.child = spawn("ffmpeg", buildFfmpegArgs(opts), { stdio: ["pipe", "ignore", "pipe"] });
    this.child.stderr?.on("data", (d: Buffer) => {
      this.stderr += d.toString();
      if (this.stderr.length > 8000) this.stderr = this.stderr.slice(-8000);
    });
    // Swallow EPIPE if ffmpeg dies mid-stream — the close handler reports the
    // real exit code with the captured stderr tail.
    this.child.stdin?.on("error", () => {});
    this.exited = new Promise<void>((resolve, reject) => {
      this.child.on("error", reject);
      this.child.on("close", (code) => {
        if (code === 0) resolve();
        else {
          const tail = this.stderr.trim().split("\n").slice(-3).join(" ");
          reject(new Error(`ffmpeg exited with code ${code}: ${tail}`));
        }
      });
    });
  }

  async writeFrame(buf: Buffer): Promise<void> {
    const stdin = this.child.stdin as Writable;
    if (!stdin.write(buf)) {
      await new Promise<void>((resolve) => stdin.once("drain", resolve));
    }
  }

  async finish(): Promise<void> {
    (this.child.stdin as Writable).end();
    await this.exited;
  }

  destroy(): void {
    try {
      this.child.kill("SIGKILL");
    } catch {
      /* best-effort */
    }
  }
}
