import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { HomeCopy } from "@/lib/home-copy";

type Props = {
  copy: HomeCopy["compare"];
  moreHref: string;
};

// Hero visual: a staggered wall of LLM vendor logos — conveys the breadth of
// 300+ models better than a price table. Logos are local SVGs under /logos
// (from the brand design kit); layout mirrors the design's 5-column masonry.
type Tile = { src: string; label: string; size?: number };

const COLUMNS: Array<{ offset: number; tiles: Tile[] }> = [
  {
    offset: 22,
    tiles: [
      { src: "openai", label: "OpenAI" },
      { src: "meta", label: "Meta Llama" },
      { src: "mistralai", label: "Mistral" },
    ],
  },
  {
    offset: 66,
    tiles: [
      { src: "claude", label: "Claude" },
      { src: "deepseek", label: "DeepSeek" },
    ],
  },
  {
    offset: 0,
    tiles: [
      { src: "googlegemini", label: "Gemini" },
      { src: "huggingface", label: "Hugging Face" },
      { src: "qwen", label: "Qwen" },
    ],
  },
  {
    offset: 66,
    tiles: [
      { src: "moonshotai", label: "Kimi / Moonshot", size: 28 },
      { src: "perplexity", label: "Perplexity" },
    ],
  },
  {
    offset: 22,
    tiles: [
      { src: "minimax", label: "MiniMax" },
      { src: "ollama", label: "Ollama" },
      { src: "nvidia", label: "NVIDIA" },
    ],
  },
];

function LogoTile({ tile }: { tile: Tile }) {
  const size = tile.size ?? 30;
  return (
    <div
      title={tile.label}
      className="flex aspect-square items-center justify-center rounded-2xl border border-[#E9E7F2] bg-white shadow-[0_10px_24px_-18px_rgba(30,27,75,0.35)] transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_30px_-16px_rgba(124,58,237,0.45)] dark:border-white/10"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/logos/${tile.src}.svg`} width={size} height={size} alt={tile.label} className="block object-contain" />
    </div>
  );
}

export function HomeModelCloud(props: Props) {
  return (
    <div className="relative flex w-full max-w-md flex-col gap-[18px] py-2">
      {/* soft radial glow behind the wall */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-x-8 -inset-y-10 -z-10 bg-[radial-gradient(closest-side,rgba(168,85,247,0.12),transparent_70%)]"
      />

      {/* pills */}
      <div className="relative flex items-center justify-between px-0.5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F3EFFC] px-3.5 py-1.5 text-[13px] font-bold text-[#6D28D9] dark:bg-violet-500/15 dark:text-violet-300">
          <img src="/flatkey-mark.svg" width={14} height={14} alt="" className="block" />
          300+
        </span>
        <span className="rounded-full bg-[#E7F5EF] px-3.5 py-1.5 text-[13px] font-bold text-[#0A7B54] dark:bg-emerald-500/15 dark:text-emerald-300">
          {props.copy.badge}
        </span>
      </div>

      {/* staggered logo grid */}
      <div className="relative grid grid-cols-5 items-start gap-3">
        {COLUMNS.map((col, ci) => (
          <div key={ci} className="flex flex-col gap-3" style={{ paddingTop: col.offset }}>
            {col.tiles.map((tile) => (
              <LogoTile key={tile.src} tile={tile} />
            ))}
          </div>
        ))}
      </div>

      {/* footer link */}
      <Link
        href={props.moreHref}
        className="relative mt-1 flex items-center justify-between text-[12px] font-semibold text-violet-700 transition-colors hover:text-violet-500 dark:text-violet-300 dark:hover:text-violet-200"
      >
        <span>{props.copy.more}</span>
        <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}
