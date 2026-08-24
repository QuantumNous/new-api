import { ArrowRight, Check, Circle, SquareArrowOutUpRight } from "lucide-react";
import Link from "next/link";
import {
  getClaudeToolsAdMarketplaceUrl,
  getClaudeToolsAdSignupUrl,
  type ClaudeToolsAdConfig,
} from "@/lib/claude-tools-ad-landing";

export function ClaudeToolsAdLandingPage({ config }: { config: ClaudeToolsAdConfig }) {
  const marketplaceUrl = getClaudeToolsAdMarketplaceUrl(config);
  const signupUrl = getClaudeToolsAdSignupUrl(config);

  return (
    <main className="min-h-screen bg-[#f4f1ea] text-[#12140f]">
      <header className="border-b border-[#12140f] px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-5">
          <Link href="/" className="font-mono text-sm font-black tracking-[-0.04em]">FLATKEY / TOOLS</Link>
          <div className="hidden items-center gap-6 font-mono text-[10px] tracking-[0.12em] uppercase sm:flex">
            <span>SPECIFICATION 01</span><span className="text-[#1f5c4a]">● LIVE CATALOG</span>
          </div>
          <a href={signupUrl} className="border border-[#12140f] px-4 py-2 font-mono text-[10px] font-bold uppercase transition-colors hover:bg-[#12140f] hover:text-[#f4f1ea]">Create key</a>
        </div>
      </header>

      <section className="px-5 py-14 sm:px-8 md:py-20">
        <div className="mx-auto grid max-w-[1440px] gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-7 xl:col-span-8">
            <div className="flex items-center gap-3 font-mono text-[10px] font-bold tracking-[0.14em] text-[#e0350b] uppercase">
              <span className="h-px w-8 bg-[#e0350b]" />{config.eyebrow}
            </div>
            <h1 className="mt-7 max-w-5xl text-[clamp(3rem,6.5vw,7.25rem)] leading-[0.91] font-black tracking-[-0.065em] text-balance">{config.h1}</h1>
            <p className="mt-8 max-w-3xl text-base leading-7 text-[#52544d] md:text-lg md:leading-8">{config.description}</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a href={signupUrl} className="group inline-flex h-13 items-center justify-center bg-[#e0350b] px-6 text-sm font-bold !text-white transition-colors hover:bg-[#b52b0a]">
                {config.primaryCta}<ArrowRight className="ml-3 size-4 transition-transform group-hover:translate-x-1" />
              </a>
              <a href={marketplaceUrl} className="inline-flex h-13 items-center justify-center border border-[#12140f] px-6 text-sm font-bold hover:bg-[#eae6dc]">
                {config.secondaryCta}<SquareArrowOutUpRight className="ml-3 size-4" />
              </a>
            </div>
          </div>

          <aside className="border-t-2 border-[#12140f] lg:col-span-5 xl:col-span-4">
            <div className="flex items-center justify-between border-b border-[#cfcabb] py-3 font-mono text-[10px] tracking-[0.12em] uppercase">
              <span>REQUEST SPEC</span><span>FK–01</span>
            </div>
            <dl className="font-mono text-xs">
              <div className="grid grid-cols-[94px_1fr] border-b border-[#cfcabb] py-4"><dt className="text-[#6b6c63]">AUTH</dt><dd>ONE API KEY</dd></div>
              <div className="grid grid-cols-[94px_1fr] border-b border-[#cfcabb] py-4"><dt className="text-[#6b6c63]">BILLING</dt><dd>PREPAID / METERED</dd></div>
              <div className="grid grid-cols-[94px_1fr] border-b border-[#cfcabb] py-4"><dt className="text-[#6b6c63]">PRICE</dt><dd>VISIBLE BEFORE RUN</dd></div>
              <div className="grid grid-cols-[94px_1fr] border-b border-[#cfcabb] py-4"><dt className="text-[#6b6c63]">STATUS</dt><dd className="text-[#1f5c4a]">CHECK LIVE CATALOG</dd></div>
            </dl>
          </aside>
        </div>
      </section>

      <section className="border-y border-[#12140f] bg-[#eae6dc] px-5 py-14 sm:px-8 md:py-20">
        <div className="mx-auto max-w-[1440px]">
          <div className="grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <p className="font-mono text-[10px] font-bold tracking-[0.14em] uppercase">INPUT / NATURAL LANGUAGE</p>
              <p className="mt-4 border-l-2 border-[#e0350b] pl-5 text-xl leading-8 font-semibold">{config.input}</p>
            </div>
            <div className="lg:col-span-8">
              <div className="hidden grid-cols-[90px_1.1fr_1.5fr_140px] border-b border-[#12140f] pb-3 font-mono text-[9px] tracking-[0.12em] text-[#6b6c63] uppercase md:grid">
                <span>Status</span><span>Tool slug</span><span>Capability</span><span className="text-right">Commercial</span>
              </div>
              <div className="border-t border-[#12140f] md:border-t-0">
                {config.pricedRows.map((row) => (
                  <div key={row.tool} className="grid gap-2 border-b border-[#12140f] py-4 font-mono text-[11px] md:grid-cols-[90px_1.1fr_1.5fr_140px] md:items-center">
                    <span className="flex items-center gap-2 text-[#1f5c4a]"><Circle className="size-2 fill-current" />{row.status}</span>
                    <strong>{row.tool}</strong><span className="text-[#52544d]">{row.capability}</span><span className="text-[#e0350b] md:text-right">{row.price}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 md:py-28">
        <div className="mx-auto grid max-w-[1440px] gap-12 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <p className="font-mono text-[10px] font-bold tracking-[0.14em] text-[#e0350b] uppercase">OPERATING PROOF</p>
            <h2 className="mt-5 text-4xl leading-[1.02] font-black tracking-[-0.045em] md:text-6xl">{config.proofTitle}</h2>
            <p className="mt-6 max-w-3xl text-base leading-8 text-[#52544d]">{config.proofBody}</p>
          </div>
          <div className="border-t-2 border-[#12140f] lg:col-span-5">
            {config.proofRows.map((row) => (
              <div key={row.label} className="grid grid-cols-[88px_1fr] gap-4 border-b border-[#cfcabb] py-5">
                <span className="font-mono text-[10px] font-bold text-[#e0350b]">{row.label}</span><span className="text-sm leading-6">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {config.caveats ? (
        <section className="border-y border-[#12140f] bg-[#12140f] px-5 py-16 text-[#f4f1ea] sm:px-8">
          <div className="mx-auto max-w-[1440px]">
            <p className="font-mono text-[10px] font-bold tracking-[0.14em] text-[#e76b4c] uppercase">WHAT FLATKEY IS NOT</p>
            <div className="mt-7 grid border-t border-white/25 md:grid-cols-3">
              {config.caveats.map((caveat, index) => (
                <div key={caveat} className="border-b border-white/25 py-6 md:border-r md:px-6 md:first:pl-0 md:last:border-r-0">
                  <span className="font-mono text-xs text-white/35">0{index + 1}</span><p className="mt-4 text-lg leading-7 font-semibold">{caveat}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="border-b border-[#12140f] px-5 py-20 sm:px-8 md:py-28">
        <div className="mx-auto max-w-[1440px]">
          <p className="font-mono text-[10px] font-bold tracking-[0.14em] uppercase">TEST PROCEDURE</p>
          <div className="mt-7 border-t-2 border-[#12140f]">
            {config.workflow.map((item) => (
              <article key={item.step} className="grid gap-4 border-b border-[#cfcabb] py-7 sm:grid-cols-[80px_0.75fr_1.25fr] sm:items-baseline">
                <span className="font-mono text-xs text-[#e0350b]">{item.step}</span><h3 className="text-xl font-bold">{item.title}</h3><p className="text-sm leading-7 text-[#52544d]">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#1f5c4a] px-5 py-20 text-[#f4f1ea] sm:px-8 md:py-28">
        <div className="mx-auto grid max-w-[1440px] gap-8 md:grid-cols-[1fr_auto] md:items-end">
          <div><p className="font-mono text-[10px] font-bold tracking-[0.14em] text-white/60 uppercase">PASS / FAIL ON REAL OUTPUT</p><h2 className="mt-5 max-w-4xl text-4xl leading-[1.02] font-black tracking-[-0.045em] md:text-6xl">{config.finalTitle}</h2><p className="mt-5 max-w-2xl text-sm leading-7 text-white/70">{config.finalBody}</p></div>
          <a href={signupUrl} className="group inline-flex h-14 items-center justify-center bg-[#f4f1ea] px-7 text-sm font-bold !text-[#12140f] hover:bg-white">{config.primaryCta}<ArrowRight className="ml-3 size-4 transition-transform group-hover:translate-x-1" /></a>
        </div>
      </section>

      <footer className="bg-[#12140f] px-5 py-6 text-[#f4f1ea] sm:px-8">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 font-mono text-[9px] tracking-[0.12em] text-white/45 uppercase sm:flex-row sm:items-center sm:justify-between">
          <span>FLATKEY / ONE KEY · ONE BALANCE</span><span className="flex items-center gap-2"><Check className="size-3 text-[#66b89f]" /> VERIFY CURRENT COVERAGE IN THE LIVE CATALOG</span>
        </div>
      </footer>
    </main>
  );
}
