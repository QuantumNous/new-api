import { ArrowRight, Ban, Boxes, CheckCircle2, DollarSign, Gauge, Mail, Wallet } from "lucide-react";
import { SiteShell } from "@/components/site-shell";
import {
  getPricingData,
  getVendorName,
  getAvailableGroups,
  type PricingModel,
  type PricingVendor,
  type PricingSearch,
} from "@/lib/pricing";
import { PricingExplorer } from "@/components/pricing-explorer";
import { FlatkeyTallyEmbed } from "@/components/flatkey-tally-embed";
import type { Locale } from "@/lib/locales";
import { consoleUrl } from "@/lib/origins";

type PricingPageProps = {
  locale: Locale;
  search?: PricingSearch;
};

const SIGN_UP_URL = consoleUrl("/sign-up");

export function parsePricingSearch(searchParams?: Record<string, string | string[] | undefined>): PricingSearch {
  return {
    q: parseParam(searchParams?.q),
    vendor: parseParam(searchParams?.vendor),
    endpoint: parseParam(searchParams?.endpoint),
    quota: parseParam(searchParams?.quota),
  };
}

export async function PricingPage(props: PricingPageProps) {
  const pricing = await getPricingData();
  const allModels = enrichVendorNames(pricing.models, pricing.vendors, pricing.groupRatio, pricing.usableGroup);

  return (
    <SiteShell locale={props.locale} pathname="/pricing">
      <main className="model-square-page relative min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#f4f0ff_0%,#fbfaff_32%,#ffffff_62%,#f4f1ff_100%)] dark:bg-[linear-gradient(180deg,#050712_0%,#080b18_36%,#070712_72%,#03040b_100%)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(124,58,237,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(124,58,237,0.08)_1px,transparent_1px)] bg-[size:4.5rem_4.5rem] opacity-70 dark:bg-[linear-gradient(to_right,rgba(148,163,184,0.055)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.045)_1px,transparent_1px)] dark:opacity-45"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[640px] opacity-75"
          style={{
            background: [
              "radial-gradient(ellipse 56% 46% at 22% 8%, rgba(168,85,247,0.30) 0%, transparent 68%)",
              "radial-gradient(ellipse 46% 36% at 78% 6%, rgba(99,102,241,0.28) 0%, transparent 70%)",
              "radial-gradient(ellipse 48% 34% at 50% 46%, rgba(217,70,239,0.18) 0%, transparent 72%)",
            ].join(", "),
            maskImage: "linear-gradient(to bottom, black 40%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, black 40%, transparent 100%)",
          }}
        />
        <div className="relative mx-auto w-full max-w-[1800px] px-3 pt-16 pb-8 sm:px-6 sm:pt-20 sm:pb-10 xl:px-8">
          <header className="mx-auto mb-6 max-w-3xl pt-5 text-center sm:mb-10 sm:pt-10">
            <p className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-violet-400/35 bg-violet-500/10 px-4 py-1.5 text-xs font-semibold tracking-[0.18em] text-violet-700 uppercase shadow-[0_0_28px_rgba(168,85,247,0.14)]">
              <span className="size-1.5 rounded-full bg-violet-500 shadow-[0_0_12px_rgba(168,85,247,0.9)]" />
              Models Directory
            </p>
            <h1 className="bg-[linear-gradient(90deg,#171321_0%,#7c3aed_46%,#2563eb_100%)] bg-clip-text text-[clamp(2.6rem,7vw,5rem)] leading-[0.98] font-black tracking-tight text-transparent">
              Model Pricing
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Discover curated AI models, compare pricing and capabilities, and choose the right model for every scenario.
            </p>
          </header>

          <PricingPackages locale={props.locale} />

          <PricingExplorer
            locale={props.locale}
            models={allModels}
            vendors={pricing.vendors}
            groupRatio={pricing.groupRatio}
            usableGroup={pricing.usableGroup}
            endpointMap={pricing.supportedEndpoint}
            autoGroups={pricing.autoGroups}
            initialSearch={props.search}
          />

          <PricingSeoContent locale={props.locale} modelCount={allModels.length} vendorCount={pricing.vendors.length} />
        </div>
      </main>
    </SiteShell>
  );
}

function PricingPackages(props: { locale: Locale }) {
  const highlights = [
    [DollarSign, "$10", "minimum website package"],
    [Boxes, "100+", "models available through one balance"],
    [Wallet, "1", "balance across GPT, Claude, Gemini, DeepSeek, and more"],
    [Gauge, "3", "metered token types: input, output, cache-hit"],
    [Ban, "0", "fixed bundle lock-in"],
  ] as const;

  return (
    <section className="mb-8 rounded-3xl border border-violet-500/16 bg-white/62 p-5 shadow-[0_24px_70px_-52px_rgba(91,33,182,0.78)] backdrop-blur-sm sm:p-6">
      <div className="mb-5">
        <p className="text-muted-foreground mb-2 text-xs font-medium tracking-widest uppercase">Plans and top-up packages</p>
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Transparent pricing for every AI model</h2>
        <p className="text-muted-foreground mt-3 text-sm leading-7 md:whitespace-nowrap">
          Start from $10 to try leading models like GPT-5.1, Claude Opus 4.7, Gemini 3.5 Flash, DeepSeek V4, and more with one prepaid balance.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {["GPT-5.1", "Claude Opus 4.7", "Gemini 3.5 Flash", "DeepSeek V4", "More"].map((modelName) => (
            <span key={modelName} className="rounded-full border border-violet-500/15 bg-violet-500/6 px-3 py-1 text-xs font-medium text-violet-800">
              {modelName}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <article className="rounded-2xl border border-violet-500/14 bg-white/66 p-5">
          <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">Website package</p>
          <h3 className="mt-2 text-base font-semibold tracking-tight">Prepaid balance for top AI models</h3>
          <div className="mt-5 flex items-end gap-2">
            <span className="text-4xl font-bold tracking-tight">$10</span>
            <span className="text-muted-foreground pb-1 text-sm">starting package, pay as you go with the balance you add</span>
          </div>
          <div className="mt-5 space-y-3 text-sm">
            {[
              "Successful payment adds prepaid balance.",
              "Usage is charged by model input, output, and cache-hit token prices.",
              "Permanently 20-40% cheaper",
              "One API key for everything",
              "Zero vendor lock-in",
              "Usage analytics & cost control",
              "Enterprise-grade privacy",
              "One unified invoice for all providers",
            ].map((point) => (
              <p key={point} className="flex gap-2 leading-6">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-violet-600" />
                <span>{point}</span>
              </p>
            ))}
          </div>
          <a
            className="flatkey-primary-cta mt-6 inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium shadow-[0_16px_34px_-18px_rgba(15,23,42,0.55)] transition-opacity hover:opacity-90"
            href={SIGN_UP_URL}
          >
            Get free API key
            <ArrowRight className="ml-2 size-4" />
          </a>
        </article>

        <article className="rounded-2xl border border-violet-500/14 bg-white/66 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">Enterprise teams</p>
              <h3 className="mt-2 text-base font-semibold tracking-tight">Contact sales for higher monthly usage and greater discounts.</h3>
            </div>
            <a
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-violet-500/16 bg-violet-500/8 px-3 text-sm font-semibold text-violet-700 transition-colors hover:border-violet-500/25 hover:bg-violet-500/12 hover:text-violet-600"
              href="mailto:support@flatkey.ai"
            >
              <Mail className="size-4" />
              support@flatkey.ai
            </a>
          </div>
          <FlatkeyTallyEmbed locale={props.locale} className="mt-5 rounded-xl border border-violet-500/12 bg-white/62 p-3 shadow-[0_18px_46px_-36px_rgba(91,33,182,0.5)]" />
        </article>
      </div>

      <div className="mt-5 border-t border-violet-500/12 pt-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {highlights.map(([Icon, metric, label]) => (
            <div key={label} className="flex gap-3 rounded-xl border border-violet-500/12 bg-white/58 px-4 py-4">
              <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/8 text-violet-700">
                <Icon className="size-4" />
              </span>
              <div>
                <p className="text-xl font-bold text-violet-700">{metric}</p>
                <p className="text-muted-foreground mt-1 text-xs leading-5">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingSeoContent(props: { locale: Locale; modelCount: number; vendorCount: number }) {
  return (
    <section className="mt-10 rounded-3xl border border-violet-500/12 bg-white/70 p-6 shadow-[0_20px_70px_-58px_rgba(91,33,182,0.6)] backdrop-blur-sm">
      <p className="text-muted-foreground mb-2 text-xs font-medium tracking-widest uppercase">AI-readable pricing summary</p>
      <h2 className="text-xl font-bold tracking-tight">flatkey.ai model pricing, billing, and provider coverage</h2>
      <div className="mt-4 grid gap-4 text-sm leading-7 text-muted-foreground md:grid-cols-3">
        <p>
          flatkey.ai publishes server-rendered model pricing for {props.modelCount.toLocaleString()} AI models across {props.vendorCount.toLocaleString()} providers. Search engines and AI assistants can read model names, vendors, endpoint types, and input/output pricing directly from the page HTML.
        </p>
        <p>
          Pricing is organized by token-based and request-based models. Token models expose input, output, cache-hit, and group-adjusted prices, while request models show per-request billing for production API usage.
        </p>
        <p>
          Vendor filter URLs such as <code className="rounded bg-muted px-1.5 py-0.5">/pricing?vendor=OpenAI</code> and <code className="rounded bg-muted px-1.5 py-0.5">/pricing?vendor=Anthropic</code> provide crawlable entry points for provider-specific AI model pricing.
        </p>
      </div>
    </section>
  );
}

function enrichVendorNames(
  models: PricingModel[],
  vendors: PricingVendor[],
  groupRatio: Record<string, number>,
  usableGroup: Record<string, { desc: string; ratio: number }>
) {
  return models.map((model) => ({
    ...model,
    vendor_name: getVendorName(model, vendors),
    vendor_icon: model.vendor_icon ?? vendors.find((vendor) => vendor.id === model.vendor_id)?.icon,
    vendor_description: model.vendor_description ?? vendors.find((vendor) => vendor.id === model.vendor_id)?.description,
    group_ratio: model.group_ratio ?? groupRatio,
    enable_groups: getAvailableGroups(model, groupRatio, usableGroup),
  }));
}

function parseParam(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() || undefined;
}
