import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeDollarSign, BarChart3, Check, KeyRound, Link2, Server, ShieldCheck } from "lucide-react";
import { HomeHealthTrends } from "@/components/home-health-trends";
import { HomeModelsTable } from "@/components/home-models-table";
import { HomeSupport } from "@/components/home-support";
import { HomePriceCompare } from "@/components/home-price-compare";
import { SiteShell } from "@/components/site-shell";
import { getCopy } from "@/lib/copy";
import { getHomeCopy, type HomeCopy } from "@/lib/home-copy";
import { buildHomeModelRows, pickFlagshipModels } from "@/lib/home-models";
import type { Locale } from "@/lib/locales";
import { localizePath } from "@/lib/locales";
import { APP_CONSOLE_ORIGIN, ROUTER_ORIGIN, consoleUrl } from "@/lib/origins";
import { getPricingData } from "@/lib/pricing";

// "Start free trial" lands the user straight on the console API Keys tab:
// already-authenticated users skip the form, new users land on /keys after signing up.
const SIGN_UP_URL = consoleUrl("/sign-up", "?redirect=/keys");
const API_BASE_URL = `${ROUTER_ORIGIN}/v1`;

type Props = {
  locale: Locale;
};

// Same certification artwork as the footer's "Trusted & verified by" strip.
const PRIVACY_BADGES = [
  { src: "/trust/vanta-trust.png", alt: "GDPR powered by Vanta", width: 1260, height: 1260 },
  { src: "/trust/soc2.png", alt: "CAI SOC 2 certification", width: 94, height: 94 },
  { src: "/trust/iso-27001.png", alt: "CAI ISO 27001:2022 certification", width: 94, height: 94 },
];

export async function HomePage(props: Props) {
  const copy = getCopy(props.locale);
  const home = getHomeCopy(props.locale);
  const pricing = await getPricingData();
  const flagships = pickFlagshipModels(pricing);
  const tableRows = buildHomeModelRows(pricing);
  const healthModels = flagships.slice(0, 3).map((row) => ({ name: row.name, iconKey: row.iconKey }));

  const apiBaseUrlDescription = (text: string) => text.replace("{{apiBaseUrl}}", API_BASE_URL);
  const ctaDescription = copy.home.cta.description.replace("{{host}}", APP_CONSOLE_ORIGIN.replace(/^https?:\/\//, ""));
  const valueBlocks = [
    { icon: <Server className="size-6" strokeWidth={1.6} />, block: home.values.reliability, href: "/models", badges: [] as typeof PRIVACY_BADGES },
    { icon: <BadgeDollarSign className="size-6" strokeWidth={1.6} />, block: home.values.cost, href: "/blog/category/cost-billing-and-ops", badges: [] as typeof PRIVACY_BADGES },
    { icon: <ShieldCheck className="size-6" strokeWidth={1.6} />, block: home.values.privacy, href: "/blog/category/enterprise-controls-and-trust", badges: PRIVACY_BADGES },
  ];

  return (
    <SiteShell locale={props.locale} pathname="/">
      <main className="home-landing relative overflow-x-hidden bg-[linear-gradient(180deg,#f4f0ff_0%,#fbfaff_28%,#ffffff_58%,#f4f1ff_100%)] dark:bg-[linear-gradient(180deg,#050712_0%,#080b18_36%,#070712_72%,#03040b_100%)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-0 bg-[linear-gradient(to_right,rgba(124,58,237,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(124,58,237,0.08)_1px,transparent_1px)] bg-[size:4.5rem_4.5rem] opacity-70 dark:bg-[linear-gradient(to_right,rgba(148,163,184,0.055)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.045)_1px,transparent_1px)] dark:opacity-45"
        />

        {/* Screen 1: hero — official models, up to 33% off, stable and secure. */}
        <section className="relative z-10 overflow-hidden px-6 pt-24 pb-14 md:pt-32 md:pb-20 lg:pt-36">
          <div
            aria-hidden
            className="home-hero-glow pointer-events-none absolute inset-0 -z-10 opacity-40 dark:opacity-55"
            style={{
              background: "var(--home-hero-glow)",
            }}
          />
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(124,58,237,0.16)_1px,transparent_1px),linear-gradient(to_bottom,rgba(124,58,237,0.14)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_64%_52%_at_50%_28%,black_20%,transparent_100%)] bg-[size:4rem_4rem] opacity-35 dark:bg-[linear-gradient(to_right,rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.05)_1px,transparent_1px)] dark:opacity-40"
          />

          <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
            <div className="flex flex-col items-start text-left lg:col-span-7">
              <div className="landing-animate-fade-up mb-5 inline-flex items-center gap-1.5 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1.5 text-[11px] font-medium text-violet-700 opacity-0 shadow-[0_12px_34px_-22px_rgba(124,58,237,0.75)]">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-violet-500" />
                </span>
                <span>{home.hero.badge}</span>
              </div>

              <h1 className="landing-animate-fade-up text-[clamp(2.25rem,4.5vw,3.25rem)] leading-[1.15] font-bold tracking-tight" style={{ animationDelay: "60ms" }}>
                {home.hero.titleLine1}
                <br />
                <span className="bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500 bg-clip-text text-transparent dark:from-violet-200 dark:via-fuchsia-300 dark:to-indigo-300">
                  {home.hero.titleLine2}
                </span>
              </h1>
              <p className="landing-animate-fade-up text-muted-foreground/80 mt-5 max-w-xl text-base leading-relaxed opacity-0 md:text-[15px]" style={{ animationDelay: "120ms" }}>
                {home.hero.description}
              </p>

              <div className="landing-animate-fade-up mt-8 flex flex-wrap items-center gap-3 opacity-0" style={{ animationDelay: "180ms" }}>
                <a
                  className="flatkey-hero-cta group inline-flex h-11 items-center px-5 text-sm font-medium shadow-[0_16px_34px_-18px_rgba(124,58,237,0.85)] transition-colors hover:opacity-90"
                  href={SIGN_UP_URL}
                  style={{ borderRadius: "0.5rem" }}
                >
                  {home.hero.ctaTrial}
                  <ArrowRight className="ml-1.5 size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </a>
                <Link
                  className="inline-flex h-11 items-center rounded-lg border border-violet-500/20 bg-white/65 px-5 text-sm font-medium hover:border-violet-500/35 hover:bg-violet-500/10"
                  href={localizePath("/models", props.locale)}
                >
                  {home.hero.ctaModels}
                </Link>
              </div>
            </div>

            <div className="landing-animate-fade-up flex w-full justify-center opacity-0 lg:col-span-5 lg:justify-end" style={{ animationDelay: "260ms" }}>
              <HomePriceCompare copy={home.compare} rows={flagships} />
            </div>
          </div>
        </section>

        <Stats items={home.stats} />

        {/* Screen 2: 30-day model health from real traffic. */}
        {healthModels.length > 0 ? <HomeHealthTrends locale={props.locale} copy={home.health} usageCopy={home.usage} models={healthModels} /> : null}

        {/* Screen 3: core value blocks — reliability, cost, privacy. */}
        <section className="relative z-10 overflow-hidden px-6 py-20 md:py-24">
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(124,58,237,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(124,58,237,0.1)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_60%_52%_at_50%_42%,black_18%,transparent_90%)] bg-[size:4rem_4rem] opacity-40 dark:bg-[linear-gradient(to_right,rgba(148,163,184,0.055)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.045)_1px,transparent_1px)] dark:opacity-40" />
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 max-w-2xl">
              <p className="text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase">{home.values.eyebrow}</p>
              <h2 className="text-2xl leading-tight font-bold tracking-tight md:text-3xl">{home.values.title}</h2>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {valueBlocks.map(({ icon, block, href, badges }) => (
                <ValueBlock
                  key={block.title}
                  locale={props.locale}
                  icon={icon}
                  block={block}
                  href={href}
                  badges={badges}
                  learnMore={home.values.learnMore}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Screen 4: all models — prices, latency, health, volume. */}
        <HomeModelsTable locale={props.locale} copy={home.table} rows={tableRows} />

        {/* Screen 5: how to start. */}
        <section className="relative z-10 border-t border-violet-500/10 px-6 py-20 md:py-28">
          <div className="mx-auto max-w-6xl">
            <div className="mb-16 text-center md:mb-20">
              <p className="text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase">{copy.home.howItWorks.eyebrow}</p>
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{copy.home.howItWorks.title}</h2>
            </div>
            <div className="grid gap-8 md:grid-cols-3 md:gap-12">
              {[
                [copy.home.howItWorks.steps[0].num, copy.home.howItWorks.steps[0].title, copy.home.howItWorks.steps[0].desc, <KeyRound key="key" className="size-6" strokeWidth={1.5} />],
                [copy.home.howItWorks.steps[1].num, copy.home.howItWorks.steps[1].title, apiBaseUrlDescription(copy.home.howItWorks.steps[1].desc), <Link2 key="link" className="size-6" strokeWidth={1.5} />],
                [copy.home.howItWorks.steps[2].num, copy.home.howItWorks.steps[2].title, copy.home.howItWorks.steps[2].desc, <BarChart3 key="chart" className="size-6" strokeWidth={1.5} />],
              ].map(([num, title, desc, icon]) => (
                <article key={String(num)} className="relative flex flex-col items-center text-center">
                  <div className="relative mb-6">
                    <div className="flex size-16 items-center justify-center rounded-2xl border border-violet-500/15 bg-white/70 text-violet-600 shadow-[0_18px_48px_-34px_rgba(91,33,182,0.7)]">{icon}</div>
                    <div className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white shadow-[0_0_18px_rgba(124,58,237,0.55)]">{num}</div>
                  </div>
                  <h3 className="mb-2 text-base font-semibold">{title}</h3>
                  <p className="text-muted-foreground max-w-[240px] text-sm leading-relaxed">{desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Screen 6: support — email, live chat, SMS, or X. */}
        <HomeSupport copy={home.support} />

        {/* Screen 7: closing CTA. */}
        <section className="relative z-10 overflow-hidden px-6 py-24 md:py-32">
          <div className="absolute inset-0 -z-10 opacity-20" style={{ background: "radial-gradient(ellipse 55% 45% at 30% 50%, rgba(124,58,237,0.28) 0%, transparent 70%), radial-gradient(ellipse 42% 38% at 70% 40%, rgba(217,70,239,0.2) 0%, transparent 70%)" }} />
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl leading-tight font-bold tracking-tight md:text-4xl">
              {copy.home.cta.titleLine1}
              <br />
              <span className="bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500 bg-clip-text text-transparent dark:from-violet-200 dark:via-fuchsia-300 dark:to-indigo-300">{copy.home.cta.titleLine2}</span>
            </h2>
            <p className="text-muted-foreground/80 mx-auto mt-5 max-w-md text-sm leading-relaxed md:text-base">{ctaDescription}</p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <a
                className="flatkey-hero-cta group inline-flex h-10 items-center px-4 text-sm font-medium shadow-[0_16px_34px_-18px_rgba(124,58,237,0.85)] transition-colors hover:opacity-90"
                href={SIGN_UP_URL}
                style={{ borderRadius: "0.5rem" }}
              >
                {home.hero.ctaTrial}
                <ArrowRight className="ml-1 size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </a>
              <Link className="inline-flex h-10 items-center rounded-lg border border-violet-500/20 bg-white/65 px-4 text-sm font-medium hover:border-violet-500/35 hover:bg-violet-500/10" href={localizePath("/models", props.locale)}>
                {home.hero.ctaModels}
              </Link>
            </div>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}

function ValueBlock(props: {
  locale: Locale;
  icon: React.ReactNode;
  block: HomeCopy["values"]["reliability"];
  href: string;
  badges: typeof PRIVACY_BADGES;
  learnMore: string;
}) {
  return (
    <Link
      href={localizePath(props.href, props.locale)}
      className="group flex flex-col rounded-2xl border border-violet-500/16 bg-white/62 p-7 shadow-[0_24px_70px_-52px_rgba(91,33,182,0.78)] backdrop-blur-sm transition-colors duration-300 hover:border-violet-500/28 hover:bg-white/78 md:p-8 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
    >
      <div className="mb-6 flex size-14 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/8 text-violet-700 shadow-[0_18px_44px_-30px_rgba(124,58,237,0.8)] transition-transform duration-300 group-hover:scale-[1.03] dark:text-violet-300">
        {props.icon}
      </div>
      <h3 className="text-xl font-semibold tracking-tight">{props.block.title}</h3>
      <p className="text-muted-foreground mt-3 text-sm leading-6">{props.block.desc}</p>
      <ul className="mt-5 space-y-2.5">
        {props.block.points.map((point) => (
          <li key={point} className="flex items-start gap-2 text-sm leading-6">
            <Check className="mt-1 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={2.4} />
            <span className="text-foreground/85">{point}</span>
          </li>
        ))}
      </ul>
      {props.badges.length > 0 ? (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {props.badges.map((badge) => (
            <Image key={badge.src} src={badge.src} alt={badge.alt} width={badge.width} height={badge.height} className="h-12 w-auto object-contain" />
          ))}
        </div>
      ) : null}
      <span className="mt-auto inline-flex items-center gap-1.5 pt-6 text-sm font-semibold text-violet-700 dark:text-violet-300">
        {props.learnMore}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function Stats(props: { items: { value: string; label: string }[] }) {
  return (
    <div className="relative z-10 border-y border-violet-500/10 bg-white/45 backdrop-blur-sm dark:bg-white/[0.02]">
      <div className="mx-auto max-w-6xl px-6 py-10 md:py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-12">
          {props.items.map((item) => (
            <div key={item.label} className="flex flex-col items-center text-center">
              <span className="bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent md:text-3xl dark:from-violet-300 dark:to-fuchsia-300">{item.value}</span>
              <span className="text-muted-foreground mt-1.5 text-xs">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
