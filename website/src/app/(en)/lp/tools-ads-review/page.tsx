import { ArrowUpRight } from "lucide-react";

export const metadata = {
  title: "Flatkey Tools Ads — landing page review",
  description: "Local comparison board for Flatkey tools advertising landing pages.",
  robots: { index: false, follow: false },
};

const ROWS = [
  { name: "Web Scraping API", intent: "High-intent category search", codex: "/tools/web-scraping-api", claude: "/lp/tools-ads/claude/web-scraping-api" },
  { name: "Google Search / SERP API", intent: "Search-data workflow", codex: "/tools/google-search-api", claude: "/lp/tools-ads/claude/google-search-api" },
  { name: "Apify Alternative", intent: "Competitor conquest", codex: "/apify-alternative", claude: "/lp/tools-ads/claude/apify-alternative" },
] as const;

function Preview({ label, direction, url }: { label: string; direction: string; url: string }) {
  return (
    <article className="overflow-hidden border border-[#292923] bg-white shadow-[5px_5px_0_#292923]">
      <div className="flex items-center justify-between gap-4 border-b border-[#292923] bg-[#f7f4ec] px-4 py-3">
        <div><p className="font-mono text-[10px] font-black tracking-[0.14em] uppercase">{label}</p><p className="mt-1 text-xs text-black/55">{direction}</p></div>
        <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-[#292923] px-3 py-2 font-mono text-[9px] font-bold uppercase hover:bg-[#292923] hover:text-white">Open full preview <ArrowUpRight className="size-3" /></a>
      </div>
      <div className="relative h-[560px] bg-[#dedbd2]">
        <iframe title={`${label} preview`} src={url} className="h-full w-full bg-white" />
      </div>
    </article>
  );
}

export default function Page() {
  return (
    <main className="min-h-screen bg-[#d8ff67] px-4 py-10 text-[#151612] sm:px-6 md:py-16">
      <div className="mx-auto max-w-[1540px]">
        <header className="grid gap-6 border-y-2 border-[#151612] py-7 md:grid-cols-[1fr_auto] md:items-end">
          <div><p className="font-mono text-xs font-black tracking-[0.16em] uppercase">Flatkey / Tools Ads / Local Review</p><h1 className="mt-4 text-4xl leading-none font-black tracking-[-0.05em] md:text-7xl">Three intents.<br />Two creative systems.</h1></div>
          <div className="max-w-sm font-mono text-[11px] leading-5 uppercase"><p>Codex: agent-workflow editorial</p><p>Claude Opus 5: instrument specification sheet</p><p className="mt-2 font-bold">Compare message match, clarity, and CTA—not decoration alone.</p></div>
        </header>

        <div className="mt-12 space-y-16">
          {ROWS.map((row, index) => (
            <section key={row.name}>
              <div className="mb-5 flex flex-col gap-2 border-b border-[#151612] pb-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex items-baseline gap-4"><span className="font-mono text-xs">0{index + 1}</span><h2 className="text-2xl font-black tracking-[-0.03em] md:text-4xl">{row.name}</h2></div><p className="font-mono text-[10px] uppercase">{row.intent}</p>
              </div>
              <div className="grid gap-7 xl:grid-cols-2">
                <Preview label="Codex / A" direction="Workflow proof + execution receipt" url={row.codex} />
                <Preview label="Claude Opus 5 / B" direction="Technical spec sheet + priced rows" url={row.claude} />
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
