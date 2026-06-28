"use client";

import { useMemo, useState } from "react";
import { Code2 } from "lucide-react";
import type { GlmLandingPageCopy } from "@/lib/glm-landing";

type ApiVisualTab = "openai" | "claude" | "glm";

type Props = {
  copy: GlmLandingPageCopy;
};

const CODE_BLOCK_LINE_COUNT = 14;

function padCodeBlock(code: string): string {
  const lines = code.split("\n");
  if (lines.length >= CODE_BLOCK_LINE_COUNT) return code;
  return [...lines, ...Array(CODE_BLOCK_LINE_COUNT - lines.length).fill("")].join("\n");
}

export function GlmApiVisual({ copy }: Props) {
  const tabs = useMemo(
    () =>
      [
        {
          id: "claude" as const,
          label: copy.visual.tabs[1],
          endpoint: "https://router.flatkey.ai/v1/messages",
          status: copy.visual.status.claude,
          code: padCodeBlock(`# ~/.claude/settings.json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://router.flatkey.ai",
    "ANTHROPIC_AUTH_TOKEN": "YOUR_FLATKEY_KEY",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "glm-5.2",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "glm-5.2",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "glm-5.2",
    "CLAUDE_CODE_AUTO_COMPACT_WINDOW": "1000000",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
    "API_TIMEOUT_MS": "3000000"
  }
}`),
        },
        {
          id: "openai" as const,
          label: copy.visual.tabs[0],
          endpoint: "https://router.flatkey.ai/v1/chat/completions",
          status: copy.visual.status.openai,
          code: padCodeBlock(`from openai import OpenAI

client = OpenAI(
    base_url="https://router.flatkey.ai/v1",
    api_key="YOUR_FLATKEY_KEY",
)

client.chat.completions.create(
    model="${copy.code.model}",
    messages=[...]
)`),
        },
        {
          id: "glm" as const,
          label: copy.visual.tabs[2],
          endpoint: "https://router.flatkey.ai/v1/chat/completions",
          status: copy.visual.status.curl,
          code: padCodeBlock(`curl https://router.flatkey.ai/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_FLATKEY_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "glm-5.2",
    "messages": [{"role":"user","content":"..."}]
  }'`),
        },
      ],
    [copy]
  );
  const [activeTab, setActiveTab] = useState<ApiVisualTab>("claude");
  const active = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  return (
    <div className="relative mx-auto w-full max-w-3xl">
      <div className="absolute -inset-6 rounded-[2rem] bg-violet-500/18 blur-3xl dark:bg-violet-500/20" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-2xl border border-violet-200/80 bg-white/88 shadow-[0_36px_110px_rgba(79,70,229,0.18)] backdrop-blur-sm dark:border-violet-400/20 dark:bg-white/[0.06] dark:shadow-[0_40px_120px_rgba(0,0,0,0.45)]">
        <div className="flex items-center gap-1 border-b border-violet-200/80 bg-white/70 px-3 dark:border-violet-300/10 dark:bg-white/[0.04]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={[
                "relative -mb-px min-h-12 border-b-2 px-3 text-left text-xs font-bold tracking-wide transition-colors",
                active.id === tab.id
                  ? "border-violet-600 text-violet-700 dark:border-violet-400 dark:text-violet-200"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-300",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2 pr-2">
            <span className="inline-block size-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.55)] dark:bg-emerald-300 dark:shadow-[0_0_10px_rgba(52,211,153,0.75)]" />
            <span className="font-mono text-[10px] tracking-wider text-slate-600 uppercase dark:text-slate-500">200 ok</span>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-2.5 border-b border-violet-200/80 bg-violet-50/70 px-5 py-3 dark:border-violet-300/10 dark:bg-violet-500/[0.035]">
          <span className="rounded-md bg-violet-100 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">POST</span>
          <code className="truncate font-mono text-[12.5px] text-slate-700 dark:text-slate-300">{active.endpoint}</code>
        </div>

        <div className="grid min-h-[390px] grid-rows-[1fr_auto] font-mono text-[12.5px] leading-[1.65]">
          <div className="p-5">
            <div className="mb-4 flex items-center gap-2 text-slate-600 dark:text-slate-500">
              <Code2 className="size-4 text-emerald-600 dark:text-emerald-300" />
              <span className="font-sans text-[10px] font-bold tracking-[0.18em] uppercase">{active.status}</span>
            </div>

            <pre className="min-h-[20rem] overflow-x-auto rounded-lg border border-slate-950/15 bg-[#060912] p-4 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] dark:border-white/10 dark:bg-[#060912]/80 dark:text-slate-300">
              <code>{active.code}</code>
            </pre>
          </div>

          <div className="border-t border-violet-200/80 bg-violet-50/70 px-5 py-4 dark:border-violet-300/10 dark:bg-violet-500/[0.035]">
            <div className="flex flex-col gap-3 text-slate-600 sm:flex-row sm:items-center sm:justify-between dark:text-slate-400">
              <span>{copy.visual.compatibility}</span>
              <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-300">{copy.visual.priceSignal}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
