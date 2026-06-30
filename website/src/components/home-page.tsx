import Link from "next/link";
import { ArrowRight, BadgeDollarSign, BarChart3, Boxes, Gauge, KeyRound, Link2, ReceiptText, Route, Server, UsersRound } from "lucide-react";
import { ClaudeCodeInstallTabs } from "@/components/claude-code-install-tabs";
import { HeroTerminalDemo } from "@/components/hero-terminal-demo";
import { SiteShell } from "@/components/site-shell";
import { getCopy } from "@/lib/copy";
import type { Locale } from "@/lib/locales";
import { localizePath } from "@/lib/locales";
import { APP_CONSOLE_ORIGIN, consoleUrl } from "@/lib/origins";
import { cn } from "@/lib/utils";

// "Get API Key" lands the user straight on the console API Keys tab (OpenRouter-style):
// already-authenticated users skip the form, new users land on /keys after signing up.
const SIGN_UP_URL = consoleUrl("/sign-up", "?redirect=/keys");
const API_BASE_URL = `${APP_CONSOLE_ORIGIN}/v1`;

type Props = {
  locale: Locale;
};

const homeAgentCopy: Record<
  Locale,
  {
    cheapTitle: string;
    cheapBody: string;
    takeoverTitle: string;
    takeoverBody: string;
    quickTitle: string;
    quickBody: string;
    codexTitle: string;
    codexBody: string;
    claudeTitle: string;
    claudeBody: string;
    learnMore: string;
  }
> = {
  en: {
    cheapTitle: "At least 40% cheaper than official",
    cheapBody: "Route Codex and Claude Code usage through Flatkey, keep the workflow, cut metered spend.",
    takeoverTitle: "Take over existing coding-agent traffic now",
    takeoverBody: "One installer configures Codex CLI or Claude Code to use router.flatkey.ai in about 30 seconds.",
    quickTitle: "Quick install",
    quickBody: "One command sets up the local agent, asks which tool to take over, and points usage to Flatkey.",
    codexTitle: "Flatkey with Codex",
    codexBody: "OpenAI-compatible Codex CLI routing, one key, visible spend, lower usage cost.",
    claudeTitle: "Flatkey with Claude Code",
    claudeBody: "Claude Code routed through Flatkey with prepaid balance, logs, and cost control.",
    learnMore: "Learn more",
  },
  zh: {
    cheapTitle: "至少比官方便宜 40%",
    cheapBody: "把 Codex 和 Claude Code 用量路由到 Flatkey，工作流不变，计量成本直接下降。",
    takeoverTitle: "立刻接管现有 coding-agent 流量",
    takeoverBody: "一个安装器配置 Codex CLI 或 Claude Code，约 30 秒接到 router.flatkey.ai。",
    quickTitle: "快速安装",
    quickBody: "一条命令安装本地 agent，询问要接管哪个工具，并把用量指向 Flatkey。",
    codexTitle: "Flatkey with Codex",
    codexBody: "OpenAI 兼容 Codex CLI 路由，一个 key，可见支出，更低用量成本。",
    claudeTitle: "Flatkey with Claude Code",
    claudeBody: "Claude Code 通过 Flatkey 路由，带预付余额、日志和成本控制。",
    learnMore: "了解更多",
  },
  es: {
    cheapTitle: "Al menos 40% más barato que oficial",
    cheapBody: "Enruta Codex y Claude Code por Flatkey, conserva el flujo y reduce el gasto medido.",
    takeoverTitle: "Toma el control del tráfico coding-agent ahora",
    takeoverBody: "Un instalador configura Codex CLI o Claude Code con router.flatkey.ai en unos 30 segundos.",
    quickTitle: "Instalación rápida",
    quickBody: "Un comando instala el agente local, pregunta qué herramienta tomar y envía el uso a Flatkey.",
    codexTitle: "Flatkey with Codex",
    codexBody: "Routing Codex CLI compatible con OpenAI, una key, gasto visible y menor coste.",
    claudeTitle: "Flatkey with Claude Code",
    claudeBody: "Claude Code vía Flatkey con saldo prepago, logs y control de costes.",
    learnMore: "Más información",
  },
  fr: {
    cheapTitle: "Au moins 40 % moins cher que l'officiel",
    cheapBody: "Routez Codex et Claude Code via Flatkey, gardez le flux et réduisez la dépense mesurée.",
    takeoverTitle: "Reprenez le trafic coding-agent maintenant",
    takeoverBody: "Un installateur configure Codex CLI ou Claude Code vers router.flatkey.ai en environ 30 secondes.",
    quickTitle: "Installation rapide",
    quickBody: "Une commande installe l'agent local, demande quel outil reprendre et envoie l'usage vers Flatkey.",
    codexTitle: "Flatkey with Codex",
    codexBody: "Routage Codex CLI compatible OpenAI, une clé, dépense visible et coût plus bas.",
    claudeTitle: "Flatkey with Claude Code",
    claudeBody: "Claude Code via Flatkey avec solde prépayé, logs et contrôle des coûts.",
    learnMore: "En savoir plus",
  },
  pt: {
    cheapTitle: "Pelo menos 40% mais barato que oficial",
    cheapBody: "Roteie Codex e Claude Code pela Flatkey, mantenha o fluxo e reduza o gasto medido.",
    takeoverTitle: "Assuma o tráfego coding-agent agora",
    takeoverBody: "Um instalador configura Codex CLI ou Claude Code para router.flatkey.ai em cerca de 30 segundos.",
    quickTitle: "Instalação rápida",
    quickBody: "Um comando instala o agente local, pergunta qual ferramenta assumir e envia o uso para a Flatkey.",
    codexTitle: "Flatkey with Codex",
    codexBody: "Roteamento Codex CLI compatível com OpenAI, uma key, gasto visível e menor custo.",
    claudeTitle: "Flatkey with Claude Code",
    claudeBody: "Claude Code via Flatkey com saldo pré-pago, logs e controle de custos.",
    learnMore: "Saiba mais",
  },
  ru: {
    cheapTitle: "Минимум на 40% дешевле официального пути",
    cheapBody: "Маршрутизируйте Codex и Claude Code через Flatkey, сохраняя workflow и снижая metered spend.",
    takeoverTitle: "Перехватите coding-agent traffic сейчас",
    takeoverBody: "Один installer настраивает Codex CLI или Claude Code на router.flatkey.ai примерно за 30 секунд.",
    quickTitle: "Быстрая установка",
    quickBody: "Одна команда ставит local agent, спрашивает какой tool подключить и отправляет usage в Flatkey.",
    codexTitle: "Flatkey with Codex",
    codexBody: "OpenAI-compatible routing для Codex CLI, один key, видимый spend и ниже cost.",
    claudeTitle: "Flatkey with Claude Code",
    claudeBody: "Claude Code через Flatkey с prepaid balance, logs и cost control.",
    learnMore: "Подробнее",
  },
  ja: {
    cheapTitle: "公式より少なくとも 40% 安価",
    cheapBody: "Codex と Claude Code の利用を Flatkey 経由にし、ワークフローを保ったまま従量コストを下げます。",
    takeoverTitle: "既存 coding-agent トラフィックを今すぐ接管",
    takeoverBody: "1 つのインストーラーで Codex CLI または Claude Code を約 30 秒で router.flatkey.ai に接続します。",
    quickTitle: "クイックインストール",
    quickBody: "1 コマンドでローカル agent を設定し、接管するツールを選んで利用を Flatkey に向けます。",
    codexTitle: "Flatkey with Codex",
    codexBody: "OpenAI 互換の Codex CLI routing、1 key、可視支出、低い利用コスト。",
    claudeTitle: "Flatkey with Claude Code",
    claudeBody: "Claude Code を Flatkey 経由にし、プリペイド残高、ログ、コスト制御を提供。",
    learnMore: "詳しく見る",
  },
  vi: {
    cheapTitle: "Rẻ hơn chính thức ít nhất 40%",
    cheapBody: "Định tuyến Codex và Claude Code qua Flatkey, giữ workflow và giảm chi phí theo usage.",
    takeoverTitle: "Tiếp quản traffic coding-agent ngay",
    takeoverBody: "Một installer cấu hình Codex CLI hoặc Claude Code sang router.flatkey.ai trong khoảng 30 giây.",
    quickTitle: "Cài nhanh",
    quickBody: "Một lệnh cài agent local, hỏi tool cần tiếp quản và đưa usage về Flatkey.",
    codexTitle: "Flatkey with Codex",
    codexBody: "Routing Codex CLI tương thích OpenAI, một key, chi phí rõ ràng và rẻ hơn.",
    claudeTitle: "Flatkey with Claude Code",
    claudeBody: "Claude Code qua Flatkey với prepaid balance, logs và kiểm soát chi phí.",
    learnMore: "Tìm hiểu thêm",
  },
  de: {
    cheapTitle: "Mindestens 40% günstiger als offiziell",
    cheapBody: "Route Codex- und Claude-Code-Nutzung über Flatkey, behalte den Workflow und senke nutzungsbasierte Kosten.",
    takeoverTitle: "Bestehenden Coding-Agent-Traffic jetzt übernehmen",
    takeoverBody: "Ein Installer richtet Codex CLI oder Claude Code in etwa 30 Sekunden für router.flatkey.ai ein.",
    quickTitle: "Schnellinstallation",
    quickBody: "Ein Befehl richtet den lokalen Agent ein, fragt nach dem Tool und leitet Nutzung zu Flatkey.",
    codexTitle: "Flatkey with Codex",
    codexBody: "OpenAI-kompatibles Codex-CLI-Routing, ein Key, sichtbare Ausgaben und niedrigere Nutzungskosten.",
    claudeTitle: "Flatkey with Claude Code",
    claudeBody: "Claude Code über Flatkey mit Prepaid-Guthaben, Logs und Kostenkontrolle.",
    learnMore: "Mehr erfahren",
  },
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
      className="flex size-5 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-violet-600 to-fuchsia-500 font-mono text-[9px] font-black text-white"
      aria-hidden="true"
    >
      CC
    </span>
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

export const HOMEPAGE_SUPPORTED_APPS = [
  { label: "Cherry Studio", icon: "cherry-studio", iconUrl: undefined, muted: false },
  { label: "CC Switch", icon: "cc-switch", iconUrl: undefined, muted: false },
  { label: "More Apps", icon: "more-apps", iconUrl: undefined, muted: true },
] as const;

function SupportedAppIcon(props: { icon: (typeof HOMEPAGE_SUPPORTED_APPS)[number]["icon"] }) {
  if (props.icon === "cherry-studio") return <CherryStudioIcon />;
  if (props.icon === "cc-switch") return <CCSwitchIcon />;
  return <MoreAppsIcon />;
}

export function HomePage(props: Props) {
  const copy = getCopy(props.locale);
  const agentCopy = homeAgentCopy[props.locale] ?? homeAgentCopy.en;
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

              <div className="landing-animate-fade-up mt-6 grid w-full max-w-xl gap-3 opacity-0 sm:grid-cols-2" style={{ animationDelay: "150ms" }}>
                <Link
                  href={localizePath("/pricing", props.locale)}
                  className="group rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 shadow-[0_18px_52px_-38px_rgba(5,150,105,0.72)] transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/14"
                >
                  <div className="flex items-center gap-2 text-sm font-extrabold text-emerald-700 dark:text-emerald-300">
                    <BadgeDollarSign className="size-4" />
                    {agentCopy.cheapTitle}
                  </div>
                  <p className="text-muted-foreground mt-2 text-xs leading-5">{agentCopy.cheapBody}</p>
                </Link>
                <a
                  href="#quick-install"
                  className="group rounded-xl border border-violet-500/18 bg-white/70 p-4 shadow-[0_18px_52px_-40px_rgba(91,33,182,0.72)] transition-colors hover:border-violet-500/32 hover:bg-violet-500/8 dark:bg-white/[0.04]"
                >
                  <div className="flex items-center gap-2 text-sm font-extrabold text-violet-700 dark:text-violet-200">
                    <Route className="size-4" />
                    {agentCopy.takeoverTitle}
                  </div>
                  <p className="text-muted-foreground mt-2 text-xs leading-5">{agentCopy.takeoverBody}</p>
                </a>
              </div>

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
                  {HOMEPAGE_SUPPORTED_APPS.map((item) => (
                    <div
                      key={item.label}
                      className={cn(
                        "group flex cursor-default items-center gap-2.5 rounded-full border border-violet-500/15 bg-white/65 px-4 py-2 text-[13px] font-medium shadow-[0_12px_38px_-28px_rgba(124,58,237,0.7)] backdrop-blur-xs transition-all duration-300 hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-foreground",
                        item.muted ? "text-foreground/55" : "text-foreground/80"
                      )}
                    >
                      <SupportedAppIcon icon={item.icon} />
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

        <section id="quick-install" className="relative z-10 px-6 pb-16 md:pb-20">
          <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:items-start">
            <div>
              <p className="text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase">{agentCopy.cheapTitle}</p>
              <h2 className="text-2xl leading-tight font-bold tracking-tight md:text-3xl">{agentCopy.quickTitle}</h2>
              <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-7 md:text-base">{agentCopy.quickBody}</p>
              <div className="mt-6">
                <ClaudeCodeInstallTabs locale={props.locale} />
              </div>
            </div>
            <div className="grid gap-4">
              {[
                [agentCopy.codexTitle, agentCopy.codexBody, "/use-case/codex"],
                [agentCopy.claudeTitle, agentCopy.claudeBody, "/use-case/claude-code"],
              ].map(([title, body, href]) => (
                <Link
                  key={href}
                  href={localizePath(href, props.locale)}
                  className="group rounded-2xl border border-violet-500/16 bg-white/72 p-5 shadow-[0_24px_70px_-50px_rgba(91,33,182,0.78)] transition-colors hover:border-violet-500/30 hover:bg-white/86 dark:bg-white/[0.04]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-bold tracking-tight">{title}</h3>
                      <p className="text-muted-foreground mt-2 text-sm leading-6">{body}</p>
                    </div>
                    <ArrowRight className="mt-0.5 size-4 shrink-0 text-violet-600 transition-transform group-hover:translate-x-0.5 dark:text-violet-300" />
                  </div>
                  <span className="mt-4 inline-flex text-sm font-semibold text-violet-700 dark:text-violet-200">{agentCopy.learnMore}</span>
                </Link>
              ))}
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
                {copy.home.secondary}
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
