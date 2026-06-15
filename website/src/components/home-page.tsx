import Link from "next/link";
import { ArrowRight, BadgeDollarSign, BarChart3, Boxes, Gauge, KeyRound, Link2, ReceiptText, Route, Server, UsersRound } from "lucide-react";
import { HeroTerminalDemo } from "@/components/hero-terminal-demo";
import { SiteShell } from "@/components/site-shell";
import { getCopy } from "@/lib/copy";
import type { Locale } from "@/lib/locales";
import { localizePath } from "@/lib/locales";
import { APP_CONSOLE_ORIGIN, consoleUrl } from "@/lib/origins";
import { cn } from "@/lib/utils";

const SIGN_UP_URL = consoleUrl("/sign-up");
const API_BASE_URL = `${APP_CONSOLE_ORIGIN}/v1`;

type Props = {
  locale: Locale;
};

function CherryStudioIcon() {
  return (
    <svg
      className="size-5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M6.513 18.419c-1.6 0-3.107-.64-4.247-1.802A6.146 6.146 0 01.5 12.287c0-1.63.626-3.168 1.766-4.33 1.14-1.162 2.647-1.802 4.247-1.802s3.132.655 4.25 1.795c.835.849.835 2.23 0 3.078a2.11 2.11 0 01-3.02 0 1.737 1.737 0 00-1.234-.521c-.945 0-1.744.813-1.744 1.776 0 .964.799 1.777 1.744 1.777.46 0 .907-.19 1.234-.522a2.11 2.11 0 013.02 0c.835.85.835 2.23 0 3.079a5.997 5.997 0 01-4.25 1.794v.008z"
        fill="#EA5E5D"
      />
      <path
        d="M12.026 24c-1.6 0-3.107-.64-4.247-1.802a6.146 6.146 0 01-1.766-4.33c0-1.63.644-3.193 1.762-4.337a2.11 2.11 0 013.021 0c.834.849.834 2.23 0 3.078-.324.331-.51.788-.51 1.255 0 .964.798 1.777 1.744 1.777.945 0 1.744-.813 1.744-1.777 0-.341-.083-.83-.475-1.233a6.255 6.255 0 01-1.77-4.348c0-1.615.627-3.168 1.767-4.33s2.646-1.802 4.247-1.802c1.6 0 3.107.64 4.247 1.802a6.146 6.146 0 011.766 4.33c0 1.63-.644 3.194-1.762 4.337a2.11 2.11 0 01-3.021 0 2.206 2.206 0 010-3.078c.323-.331.51-.788.51-1.255 0-.964-.798-1.777-1.744-1.777s-1.744.813-1.744 1.777c0 .47.19.935.521 1.27 1.115 1.136 1.727 2.667 1.727 4.311a6.122 6.122 0 01-1.766 4.33C15.137 23.36 13.63 24 12.03 24h-.004z"
        fill="#EA5E5D"
      />
      <path
        d="M12.026 6.867L8.53 3.587a1.336 1.336 0 111.827-1.949l1.4 1.313L13.744.495a1.336 1.336 0 012.075 1.68l-3.798 4.692h.004z"
        fill="#23AF69"
      />
    </svg>
  );
}

function CCSwitchIcon() {
  return (
    <span
      className="size-5 shrink-0 rounded-md bg-contain bg-center bg-no-repeat"
      style={{ backgroundImage: "url(https://ccswitch.io/favicon.png)" }}
      aria-hidden="true"
    />
  );
}

function MoreAppsIcon() {
  return (
    <svg
      className="text-muted-foreground/60 group-hover:text-foreground size-5 shrink-0 transition-colors"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="6" cy="12" r="2" fill="currentColor" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <circle cx="18" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}

const supportedApps = [
  { label: "Cherry Studio", icon: <CherryStudioIcon />, muted: false },
  { label: "CC Switch", icon: <CCSwitchIcon />, muted: false },
  { label: "More Apps", icon: <MoreAppsIcon />, muted: true },
] as const;

export function HomePage(props: Props) {
  const copy = getCopy(props.locale);
  const features = [
    {
      title: copy.home.features.items[0].title,
      desc: copy.home.features.items[0].desc,
      icon: <Server className="size-7" strokeWidth={1.7} />,
      iconClass: "bg-violet-600 text-white shadow-[0_14px_32px_-16px_rgba(124,58,237,0.85)]",
    },
    {
      title: copy.home.features.items[1].title,
      desc: copy.home.features.items[1].desc,
      icon: <UsersRound className="size-7" strokeWidth={1.7} />,
      iconClass: "bg-indigo-500 text-white shadow-[0_14px_32px_-16px_rgba(99,102,241,0.78)]",
    },
    {
      title: copy.home.features.items[2].title,
      desc: copy.home.features.items[2].desc,
      icon: <BadgeDollarSign className="size-7" strokeWidth={1.7} />,
      iconClass: "bg-violet-500 text-white shadow-[0_14px_30px_-16px_rgba(139,92,246,0.75)]",
    },
  ];
  const recommendedModels = [
    ["GPT Image 2", "$4 / 1M", "from-violet-200 via-fuchsia-300 to-slate-950"],
    ["Seedance 2.0", "$0.063 / sec", "from-indigo-200 via-violet-500 to-slate-950"],
    ["Claude Opus 4.7", "$4 / 1M", "from-fuchsia-200 via-indigo-500 to-slate-950"],
    ["Claude Sonnet 4.6", "$2.4 / 1M", "from-slate-100 via-violet-300 to-slate-950"],
  ];
  const productHighlights = [
    [copy.home.productHighlights.items[0].title, copy.home.productHighlights.items[0].desc, <Boxes key="boxes" className="size-6" strokeWidth={1.6} />],
    [copy.home.productHighlights.items[1].title, copy.home.productHighlights.items[1].desc, <ReceiptText key="receipt" className="size-6" strokeWidth={1.6} />],
    [copy.home.productHighlights.items[2].title, copy.home.productHighlights.items[2].desc, <Route key="route" className="size-6" strokeWidth={1.6} />],
    [copy.home.productHighlights.items[3].title, copy.home.productHighlights.items[3].desc, <Gauge key="gauge" className="size-6" strokeWidth={1.6} />],
  ] as const;
  const apiBaseUrlDescription = (text: string) => text.replace("{{apiBaseUrl}}", API_BASE_URL);
  const ctaDescription = copy.home.cta.description.replace("{{host}}", APP_CONSOLE_ORIGIN.replace(/^https?:\/\//, ""));

  return (
    <SiteShell locale={props.locale} pathname="/">
      <main className="home-landing relative overflow-x-hidden bg-[linear-gradient(180deg,#f4f0ff_0%,#fbfaff_28%,#ffffff_58%,#f4f1ff_100%)] dark:bg-[linear-gradient(180deg,#050712_0%,#080b18_36%,#070712_72%,#03040b_100%)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-0 bg-[linear-gradient(to_right,rgba(124,58,237,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(124,58,237,0.08)_1px,transparent_1px)] bg-[size:4.5rem_4.5rem] opacity-70 dark:bg-[linear-gradient(to_right,rgba(148,163,184,0.055)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.045)_1px,transparent_1px)] dark:opacity-45"
        />

        <section className="relative z-10 overflow-hidden px-6 pt-24 pb-16 md:pt-32 md:pb-24 lg:pt-36 lg:pb-28">
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

          <div className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-12 lg:grid-cols-12 lg:gap-8">
            <div className="flex flex-col items-start text-left lg:col-span-6">
              <div className="landing-animate-fade-up mb-5 inline-flex items-center gap-1.5 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1.5 text-[11px] font-medium text-violet-700 opacity-0 shadow-[0_12px_34px_-22px_rgba(124,58,237,0.75)]">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-violet-500" />
                </span>
                <span>{copy.home.hero.badge}</span>
              </div>

              <h1 className="landing-animate-fade-up text-[clamp(2.25rem,4.5vw,3.25rem)] leading-[1.15] font-bold tracking-tight" style={{ animationDelay: "60ms" }}>
                {copy.home.hero.titleLine1}
                <br />
                <span className="bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500 bg-clip-text text-transparent dark:from-violet-200 dark:via-fuchsia-300 dark:to-indigo-300">
                  {copy.home.hero.titleLine2}
                </span>
              </h1>
              <p className="landing-animate-fade-up text-muted-foreground/80 mt-5 max-w-xl text-base leading-relaxed opacity-0 md:text-[15px]" style={{ animationDelay: "120ms" }}>
                {copy.home.description}
              </p>

              <div className="landing-animate-fade-up mt-8 flex flex-wrap items-center gap-3 opacity-0" style={{ animationDelay: "180ms" }}>
                <a
                  className="flatkey-hero-cta group inline-flex h-11 items-center px-5 text-sm font-medium shadow-[0_16px_34px_-18px_rgba(124,58,237,0.85)] transition-colors hover:opacity-90"
                  href={SIGN_UP_URL}
                  style={{ borderRadius: "0.5rem" }}
                >
                  {copy.home.primary}
                  <ArrowRight className="ml-1.5 size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </a>
                <Link className="inline-flex h-11 items-center rounded-lg border border-violet-500/20 bg-white/65 px-5 text-sm font-medium hover:border-violet-500/35 hover:bg-violet-500/10" href={localizePath("/pricing", props.locale)}>
                  {copy.home.secondary}
                </Link>
              </div>

              <div className="landing-animate-fade-up mt-10 w-full max-w-xl opacity-0" style={{ animationDelay: "240ms" }}>
                <div className="mb-4 flex flex-col gap-1">
                  <span className="text-muted-foreground/50 text-[10px] font-bold tracking-[0.15em] uppercase">{copy.home.hero.toolsLabel}</span>
                  <p className="text-muted-foreground/60 text-xs leading-relaxed">{copy.home.hero.toolsDescription}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {supportedApps.map((item) => (
                    <div
                      key={item.label}
                      className={cn(
                        "group flex cursor-default items-center gap-2.5 rounded-full border border-violet-500/15 bg-white/65 px-4 py-2 text-[13px] font-medium shadow-[0_12px_38px_-28px_rgba(124,58,237,0.7)] backdrop-blur-xs transition-all duration-300 hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-foreground",
                        item.muted ? "text-foreground/55" : "text-foreground/80"
                      )}
                    >
                      {item.icon}
                      <span>{item.muted ? copy.home.hero.moreApps : item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="landing-animate-fade-up flex w-full justify-center opacity-0 lg:col-span-6" style={{ animationDelay: "320ms" }}>
              <HeroTerminalDemo className="mt-8 lg:mt-0" copy={copy.home.terminal} />
            </div>
          </div>
        </section>

        <Stats items={copy.home.stats.items} />

        <section className="relative z-10 overflow-hidden px-6 py-24 md:py-32">
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(124,58,237,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(124,58,237,0.1)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_60%_52%_at_50%_42%,black_18%,transparent_90%)] bg-[size:4rem_4rem] opacity-40 dark:bg-[linear-gradient(to_right,rgba(148,163,184,0.055)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.045)_1px,transparent_1px)] dark:opacity-40" />
          <div className="mx-auto max-w-7xl">
            <div className="mb-14 max-w-lg">
              <p className="text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase">{copy.home.features.eyebrow}</p>
              <h2 className="text-2xl leading-tight font-bold tracking-tight md:text-3xl">{copy.home.features.titleLine1}<br />{copy.home.features.titleLine2}</h2>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {features.map((feature) => (
                <article key={feature.title} className="group min-h-[220px] rounded-xl border border-violet-500/15 bg-white/80 p-7 shadow-[0_24px_70px_-48px_rgba(91,33,182,0.72)] backdrop-blur-sm transition-colors duration-300 hover:border-violet-500/30 hover:bg-white md:p-8">
                  <div className={cn("mb-8 flex size-16 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-[1.03]", feature.iconClass)}>
                    {feature.icon}
                  </div>
                  <h3 className="mb-4 text-xl font-semibold tracking-tight">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm leading-7 md:text-[15px]">{feature.desc}</p>
                </article>
              ))}
            </div>

            <div className="mt-20 md:mt-24">
              <h3 className="text-2xl font-bold tracking-tight md:text-3xl">{copy.home.models.title}</h3>
              <p className="text-muted-foreground mt-3 text-sm md:text-base">{copy.home.models.description}</p>
            </div>
            <div className="mt-8 grid gap-5 lg:grid-cols-4">
              {recommendedModels.map(([name, price, gradient]) => (
                <article key={name} className="group relative min-h-[270px] overflow-hidden rounded-xl border border-violet-200/50 bg-slate-950 shadow-[0_24px_72px_-34px_rgba(88,28,135,0.82)] transition-transform duration-300 hover:-translate-y-1">
                  <div className={cn("absolute inset-0 bg-gradient-to-br opacity-95", gradient)} />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.45),transparent_28%),linear-gradient(to_top,rgba(2,6,23,0.92)_0%,rgba(2,6,23,0.54)_38%,rgba(2,6,23,0.08)_76%)]" />
                  <div className="absolute top-12 left-1/2 size-28 -translate-x-1/2 rounded-full bg-violet-300/45 blur-2xl transition-transform duration-500 group-hover:scale-125" />
                  <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                    <h4 className="text-[21px] leading-tight font-bold tracking-tight xl:text-2xl">{name}</h4>
                    <div className="mt-3 font-mono text-lg font-semibold text-white/90">{price}</div>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <span className="rounded-full border border-white/20 bg-slate-950/45 px-3 py-1 text-xs font-semibold text-white/90 shadow-sm backdrop-blur-sm">{copy.home.models.tag}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <div className="home-model-marquee group relative mt-6 overflow-hidden rounded-xl border border-violet-500/15 bg-white/80 py-3 shadow-[0_18px_54px_-40px_rgba(91,33,182,0.75)] backdrop-blur-sm">
              <div className="home-model-marquee-track flex w-max gap-3">
                {[0, 1].map((copy) => (
                  <div key={copy} className="flex shrink-0 gap-3 px-1">
                    {["DeepSeek V4 Pro", "MiniMax-M2.7", "GPT-5.4 nano", "GPT-5.4 mini", "GPT-5.4 pro"].map((model) => (
                      <div key={`${copy}-${model}`} className="flex shrink-0 items-center gap-2 rounded-full border border-violet-500/25 bg-violet-500/5 px-4 py-2">
                        <span className="flex size-5 items-center justify-center rounded-full bg-violet-500/10 text-[10px] font-bold text-violet-700">AI</span>
                        <span className="text-sm font-semibold">{model}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="relative z-10 px-6 py-16 md:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 max-w-3xl md:mb-12">
              <p className="text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase">{copy.home.about.eyebrow}</p>
              <h2 className="text-2xl leading-tight font-bold tracking-tight md:text-3xl">{copy.home.about.title}</h2>
              <p className="text-muted-foreground mt-4 max-w-2xl text-sm leading-7 md:text-base">
                {copy.home.about.description}
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {[
                [copy.home.about.items[0].title, copy.home.about.items[0].desc, <Boxes key="boxes" className="size-6" strokeWidth={1.6} />],
                [copy.home.about.items[1].title, copy.home.about.items[1].desc, <Route key="route" className="size-6" strokeWidth={1.6} />],
                [copy.home.about.items[2].title, copy.home.about.items[2].desc, <UsersRound key="users" className="size-6" strokeWidth={1.6} />],
              ].map(([title, desc, icon]) => (
                <article key={String(title)} className="group min-h-[230px] rounded-2xl border border-violet-500/16 bg-white/62 p-7 shadow-[0_24px_70px_-52px_rgba(91,33,182,0.78)] backdrop-blur-sm transition-colors duration-300 hover:border-violet-500/28 hover:bg-white/78 md:p-8">
                  <div className="mb-7 flex size-14 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/8 text-violet-700 shadow-[0_18px_44px_-30px_rgba(124,58,237,0.8)] transition-transform duration-300 group-hover:scale-[1.03]">
                    {icon}
                  </div>
                  <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
                  <p className="text-muted-foreground mt-4 text-sm leading-7 md:text-[15px]">{desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="relative z-10 px-6 py-24 md:py-32">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 max-w-3xl md:mb-12">
              <p className="text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase">{copy.home.productHighlights.eyebrow}</p>
              <h2 className="text-2xl leading-tight font-bold tracking-tight md:text-3xl">{copy.home.productHighlights.title}</h2>
              <p className="text-muted-foreground mt-4 max-w-2xl text-sm leading-7 md:text-base">{copy.home.productHighlights.description}</p>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              {productHighlights.map(([title, desc, icon]) => (
                <article key={title} className="group min-h-[210px] rounded-2xl border border-violet-500/16 bg-white/62 p-7 shadow-[0_24px_70px_-52px_rgba(91,33,182,0.78)] backdrop-blur-sm transition-colors duration-300 hover:border-violet-500/28 hover:bg-white/78 md:p-8">
                  <div className="mb-7 flex size-14 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/8 text-violet-700 shadow-[0_18px_44px_-30px_rgba(124,58,237,0.8)] transition-transform duration-300 group-hover:scale-[1.03]">
                    {icon}
                  </div>
                  <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
                  <p className="text-muted-foreground mt-4 max-w-xl text-sm leading-7 md:text-[15px]">{desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="relative z-10 border-t border-violet-500/10 px-6 py-24 md:py-32">
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
                {copy.home.primary}
                <ArrowRight className="ml-1 size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </a>
              <Link className="inline-flex h-10 items-center rounded-lg border border-violet-500/20 bg-white/65 px-4 text-sm font-medium hover:border-violet-500/35 hover:bg-violet-500/10" href={localizePath("/pricing", props.locale)}>
                {copy.home.primary}
              </Link>
            </div>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}

function Stats(props: { items: { value: string; label: string }[] }) {
  return (
    <div className="relative z-10 border-y border-violet-500/10 bg-white/45 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-6 py-10 md:py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-12">
          {props.items.map((item) => (
            <div key={item.label} className="flex flex-col items-center text-center">
              <span className="bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent md:text-3xl">{item.value}</span>
              <span className="text-muted-foreground mt-1.5 text-xs">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
