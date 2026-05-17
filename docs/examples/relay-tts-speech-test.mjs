/**
 * 本地测试：POST /v1/audio/speech → new-api → 火山豆包 OpenSpeech TTS V3
 *
 * 用法（勿把真实令牌写入仓库）：
 *   set NEW_API_BASE=http://127.0.0.1:3000
 *   set NEW_API_TOKEN=sk-xxxx
 *   node docs/examples/relay-tts-speech-test.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE = (process.env.NEW_API_BASE || "http://127.0.0.1:3000").replace(/\/$/, "");
const TOKEN = process.env.NEW_API_TOKEN || "";

/** 须与后台渠道「已开通模型」一致 */
const MODEL = process.env.NEW_API_TTS_MODEL || "doubao-tts-v3";

async function main() {
  if (!TOKEN) {
    console.error("请设置环境变量 NEW_API_TOKEN（new-api 用户/API 令牌，Bearer 使用）");
    process.exit(1);
  }

  const url = `${BASE}/v1/audio/speech`;
  const body = {
    model: MODEL,
    input: "你好，这是经 new-api 中转的豆包语音合成测试。",
    voice: "zh_female_vv_uranus_bigtts",
    response_format: "mp3",
    metadata: {
      resource_id: process.env.DOUBAO_V3_RESOURCE_ID || "seed-tts-2.0",
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const ct = res.headers.get("content-type") || "";
  const buf = Buffer.from(await res.arrayBuffer());

  if (!res.ok) {
    console.error("HTTP", res.status, ct);
    console.error(buf.toString("utf8").slice(0, 2000));
    process.exit(1);
  }

  const outPath = path.join(__dirname, "relay-tts-output.mp3");
  fs.writeFileSync(outPath, buf);
  console.log("OK →", outPath, "bytes=", buf.length, "content-type=", ct);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
