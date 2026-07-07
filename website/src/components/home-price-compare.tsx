import { BadgePercent } from "lucide-react";
import type { HomeCopy } from "@/lib/home-copy";

export type PriceCompareRow = {
  name: string;
  vendor: string;
  official: string;
  discounted: string;
};

type Props = {
  copy: HomeCopy["compare"];
  rows: PriceCompareRow[];
};

// Hero visual: official list price struck through vs the Flatkey effective
// price (best top-up bonus). Server-rendered from live pricing data.
export function HomePriceCompare(props: Props) {
  if (props.rows.length === 0) return null;
  return (
    <div className="w-full max-w-md rounded-2xl border border-violet-500/16 bg-white/78 p-6 shadow-[0_32px_90px_-52px_rgba(91,33,182,0.8)] backdrop-blur-sm dark:bg-white/[0.04]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold tracking-tight">{props.copy.title}</h2>
          <p className="text-muted-foreground mt-1 text-xs leading-5">{props.copy.subtitle}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
          <BadgePercent className="size-3.5" />
          -33%
        </span>
      </div>

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 text-sm">
        <span aria-hidden />
        <span className="text-muted-foreground/70 pb-2 text-right text-[10px] font-bold tracking-[0.12em] uppercase">{props.copy.official}</span>
        <span className="pb-2 text-right text-[10px] font-bold tracking-[0.12em] text-violet-700 uppercase dark:text-violet-300">{props.copy.flatkey}</span>
        {props.rows.map((row) => (
          <div key={row.name} className="col-span-3 grid grid-cols-subgrid items-center border-t border-violet-500/10 py-3">
            <div className="min-w-0">
              <div className="truncate font-semibold tracking-tight">{row.name}</div>
              <div className="text-muted-foreground/70 text-[11px]">{row.vendor}</div>
            </div>
            <div className="text-muted-foreground text-right font-mono text-[13px] line-through">{row.official}</div>
            <div className="text-right font-mono text-[15px] font-bold text-emerald-600 dark:text-emerald-400">{row.discounted}</div>
          </div>
        ))}
      </div>

      <p className="text-muted-foreground/80 mt-4 border-t border-violet-500/10 pt-3 text-[11px] leading-5">
        {props.copy.inputLabel} · {props.copy.save}
      </p>
    </div>
  );
}
