import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { getHomeCopy } from "@/lib/home-copy";
import { type Locale, localizePath } from "@/lib/locales";
import {
  getOnlineHomeToolText,
  getOnlineStaticCopy,
  getOnlineStaticText,
} from "@/lib/online-static-copy";
import { consoleUrl } from "@/lib/origins";
import { OnlineStaticShell } from "./online-static-shell";

const providers = [
  ["logos/claude.svg", "Claude", "reasoning + coding"],
  ["logos/openai.svg", "GPT", "language + multimodal"],
  ["logos/bytedance.svg", "Seedance 2.0", "video generation"],
  ["logos/zai.svg", "GLM 5.2", "reasoning + agents"],
  ["logos/moonshotai.svg", "Kimi", "long context + agents"],
  ["logos/googlegemini.svg", "Gemini", "multimodal intelligence"],
  ["logos/minimax.svg", "MiniMax", "image + music"],
  ["logos/deepseek.svg", "DeepSeek", "reasoning + coding"],
  ["tools/x.svg", "X / Twitter", "posts + profiles"],
  ["tools/linkedin.svg", "LinkedIn", "people + companies"],
  ["tools/tiktok.svg", "TikTok", "videos + trends"],
  ["tools/apify.png", "Apify", "actors + crawlers"],
  ["tools/browserbase.png", "Browserbase", "browser automation"],
  ["tools/exa.png", "Exa", "neural web search"],
  ["tools/apollo.svg", "Apollo", "sales intelligence"],
  ["tools/pdl.png", "People Data Labs", "people enrichment"],
];

const providerRows = [
  [
    ["logos/claude.svg", "Claude", "reasoning + coding"],
    ["logos/openai.svg", "GPT", "language + multimodal"],
    ["logos/bytedance.svg", "Seedance 2.0", "video generation"],
    ["logos/zai.svg", "GLM 5.2", "reasoning + agents"],
    ["logos/moonshotai.svg", "Kimi", "long context + agents"],
    ["logos/googlegemini.svg", "Gemini", "multimodal intelligence"],
    ["logos/minimax.svg", "MiniMax", "image + music"],
    ["logos/deepseek.svg", "DeepSeek", "reasoning + coding"],
  ],
  [
    ["tools/x.svg", "X / Twitter", "posts + profiles"],
    ["tools/linkedin.svg", "LinkedIn", "people + companies"],
    ["tools/tiktok.svg", "TikTok", "videos + trends"],
    ["tools/instagram.svg", "Instagram", "posts + creators"],
    ["tools/youtube.svg", "YouTube", "videos + transcripts"],
    ["tools/reddit.svg", "Reddit", "communities + intent"],
  ],
  [
    ["tools/apify.png", "Apify", "actors + crawlers"],
    ["tools/browserbase.png", "Browserbase", "browser automation"],
    ["tools/exa.png", "Exa", "neural web search"],
    ["tools/google.png", "Google Reviews", "local review data"],
    ["tools/amazon.svg", "Amazon", "products + reviews"],
  ],
  [
    ["tools/apollo.svg", "Apollo", "sales intelligence"],
    ["tools/pdl.png", "People Data Labs", "people enrichment"],
    ["tools/semrush.svg", "Semrush", "search intelligence"],
    ["tools/wokelo.png", "Wokelo", "private markets"],
    ["tools/saperly.png", "Saperly", "agent phone"],
    ["tools/openweather.svg", "OpenWeather", "real-time signals"],
  ],
];

const modelTiles = [
  ["gpt-5.5", "openai · 1M", "$3.33/M · 67% of list", false, true],
  ["claude-opus-4-8", "anthropic · 500K", "$3.33/M · 67% of list", false, true],
  ["claude-opus-5", "anthropic · 1M", "$4.50/M · 90% of list", false, true],
  ["gemini-3.2-pro", "google · 2M", "$1.50/M", false, true],
  ["deepseek-v4", "deepseek · 256K", "$0.17/M", false, true],
  ["qwen3-max", "alibaba", "$0.72/M", false, false],
  ["glm-5.2", "zhipu · 200K", "$0.56/M", false, true],
] as const;

const videoCards = [
  [
    "v1.1",
    "Seedance 2.5",
    "Image to Video",
    "bytedance · 1080p · t2v + i2v",
    "Early access",
    "/playground?model=seedance-2.5",
    true,
  ],
  [
    "v1.2",
    "Seedance 2.0",
    "Image to Video",
    "bytedance · i2v",
    "Usage-based",
    "/playground?model=seedance-2.0-i2v",
    false,
  ],
  [
    "v1.3",
    "Veo 3.1",
    "Text to Video",
    "google · t2v + audio",
    "Coming soon",
    "/playground?model=veo-3.1",
    false,
  ],
] as const;

const upcomingVideoModels = [
  ["sora-2", "openai · t2v"],
  ["kling-2.5-pro", "kuaishou · i2v"],
  ["wan-2.7", "alibaba · t2v"],
  ["hailuo-02", "minimax · i2v"],
  ["pixverse-v6", "pixverse · t2v"],
  ["seedance-2.0-lite", "bytedance · t2v"],
  ["ltx-2.3", "lightricks · i2v"],
] as const;

const modelWallRows = [
  modelTiles,
  [
    [
      "seedance-2.5",
      "bytedance · video · t2v + i2v",
      "Early access",
      true,
      false,
    ],
    ["glm-5.2", "z.ai", "$0.56/M", false, false],
    ["claude-sonnet-5", "anthropic · 1M", "$1.33/M", false, true],
    ["gpt-5.4-mini", "openai · 400K", "$0.50/M", false, true],
    ["gemini-3-flash", "google", "$0.047/M", false, false],
    ["deepseek-v4-flash", "deepseek", "$0.056/M", false, false],
    ["qwen3.7-max", "alibaba", "$1.00/M", false, false],
  ],
  [
    ["flatkey-auto", "routes itself", "no routing fee", true, false],
    ["minimax-m3", "minimax", "$0.18/M", false, false],
    ["grok-4.2", "xai", "$1.80/M", false, false],
    ["step-3.7-flash", "stepfun", "$0.16/M", false, false],
    ["hunyuan-2.0", "tencent", "$0.40/M", false, false],
    ["mimo-v2.5", "xiaomi", "$0.01/M", false, false],
  ],
] as const;

function createPixelRandom(initialSeed: number) {
  let seed = initialSeed;
  return function rnd() {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

function PixelGrid(props: {
  accent?: string;
  cell: number;
  colors?: string[];
  cols: number;
  n: number;
  rows: number;
  seed: number;
  style?: CSSProperties;
}) {
  const colors = props.colors ?? ["#DDD1F6", "#C4B5FD", "#A78BFA"];
  const accent = props.accent ?? "#15803D";
  const rnd = createPixelRandom(props.seed);

  const used = new Set<string>();
  const pixels = [];
  for (let index = 0; index < props.n; index += 1) {
    let x = 0;
    let y = 0;
    let key = "";
    let tries = 0;
    do {
      x = Math.floor(rnd() * props.cols);
      y = Math.floor(rnd() * props.rows);
      key = `${x}_${y}`;
      tries += 1;
    } while (used.has(key) && tries < 40);
    used.add(key);

    const background =
      rnd() < 0.07 ? accent : colors[Math.floor(rnd() * colors.length)];
    pixels.push(
      <i
        key={`${key}-${index}`}
        style={{
          animationDelay: `${(rnd() * 7).toFixed(2)}s`,
          animationDuration: `${(5 + rnd() * 7).toFixed(2)}s`,
          background,
          height: props.cell,
          left: x * props.cell,
          top: y * props.cell,
          width: props.cell,
        }}
      />,
    );
  }

  return (
    <div
      className="pxgrid"
      style={{
        height: props.rows * props.cell,
        width: props.cols * props.cell,
        ...props.style,
      }}
    >
      {pixels}
    </div>
  );
}

function renderLineBreakText(value: string) {
  return value.split(/<br\s*\/?>/i).map((part, index) => (
    <span key={`${part}-${index}`}>
      {index > 0 && <br />}
      {part}
    </span>
  ));
}

function renderHeroTitle(locale: Locale, fallback: ReactNode) {
  const value = getOnlineStaticText(locale, "hero.h1", "");
  if (!value) return fallback;
  const match = value.match(
    /^(.*?)<br><span class="price">(.*?)<span class="toolLine">(.*?)<\/span><span class="costLine">(.*?)<\/span><\/span>$/,
  );
  if (!match) return renderLineBreakText(value.replace(/<[^>]+>/g, ""));
  return (
    <>
      {match[1]}
      <br />
      <span className="price">
        {match[2]}
        <span className="toolLine">{match[3]}</span>
        <span className="costLine">{match[4]}</span>
      </span>
    </>
  );
}

function renderToolsTitle(locale: Locale, fallback: ReactNode) {
  const value = getOnlineHomeToolText(locale, "tools.intro.title", "");
  if (!value) return fallback;
  const match = value.match(
    /^<span class="tools-title-line">(.*?)<\/span><br>(.*)$/,
  );
  if (!match) return renderLineBreakText(value.replace(/<[^>]+>/g, ""));
  return (
    <>
      <span className="tools-title-line">{match[1]}</span>
      <br />
      {match[2]}
    </>
  );
}

function renderEmStart(value: string) {
  const match = value.match(/^<em>(.*?)<\/em>(.*)$/);
  if (!match) return value;
  return (
    <>
      <em>{match[1]}</em>
      {match[2]}
    </>
  );
}

function renderInlineEm(value: string) {
  const match = value.match(/^(.*?)<em>(.*?)<\/em>(.*)$/);
  if (!match) return renderLineBreakText(value);
  return (
    <>
      {renderLineBreakText(match[1])}
      <em>{match[2]}</em>
      {renderLineBreakText(match[3])}
    </>
  );
}

type OnlineHomePageProps = {
  /** A browser hint is not a verified console session; CTA auth state is verified client-side. */
  hasConsoleSessionHint?: boolean;
  locale: Locale;
};

export async function OnlineHomePage(props: OnlineHomePageProps) {
  const copy = getOnlineStaticCopy(props.locale);
  const home = getHomeCopy(props.locale);
  const t = (key: string, fallback: string) =>
    getOnlineStaticText(props.locale, key, fallback);
  const ht = (key: string, fallback: string) =>
    getOnlineHomeToolText(props.locale, key, fallback);
  const videoStatus = (status: string) => {
    if (status === "Early access") return status;
    if (status === "Usage-based") return t("md.usage", status);
    if (status === "Coming soon") return t("md.soon", status);
    return status;
  };
  const modelPrice = (price: string) =>
    price === "Early access" ? t("md.early", price) : price;
  const authActionHref = consoleUrl("/sign-up", `lng=${props.locale}`);
  const authActionLabel = copy.home.ctaKey;
  const finalCtaLabel = t("cta.b1", "Get started");

  return (
    <OnlineStaticShell locale={props.locale} pathname="/">
      <style>{`
        .online-static-page:has(> header.hero.heroUnified) .heroUnified h1.display{max-width:min(100%,720px);font-size:58px;line-height:1.04;letter-spacing:0;overflow-wrap:anywhere;text-wrap:balance}
        .online-static-page:has(> header.hero.heroUnified) .heroUnified h1 .price{display:block;max-width:100%;overflow-wrap:anywhere}
        .online-static-page:has(> header.hero.heroUnified) .heroUnified .heroCopy{min-width:0}
        .online-static-page:has(> header.hero.heroUnified) .heroUnified .saveRow small{white-space:normal;text-align:right;line-height:1.25}
        @media(max-width:1000px){.online-static-page:has(> header.hero.heroUnified) .heroUnified h1.display{font-size:52px;max-width:760px}}
        @media(max-width:620px){.online-static-page:has(> header.hero.heroUnified) .heroUnified h1.display{font-size:38px;line-height:1.06;letter-spacing:0}.online-static-page:has(> header.hero.heroUnified) .heroUnified h1 .price{margin-top:8px}.online-static-page:has(> header.hero.heroUnified) .heroUnified .heroCtas .btn{white-space:normal;text-align:center}}
        @media(max-width:380px){.online-static-page:has(> header.hero.heroUnified) .heroUnified h1.display{font-size:34px}}
        .hero{background:linear-gradient(180deg,#FFFFFF 0%,#F7F5FD 100%);border-bottom:1px solid var(--line)}.heroGrid{max-width:var(--fk-site-frame-max-width);margin:0 auto;padding:56px var(--fk-site-gutter) 52px;display:grid;grid-template-columns:minmax(0,1fr) 560px;gap:48px;align-items:start}.eyebrow{display:inline-flex;align-items:center;gap:8px;font-family:var(--mono);font-size:12px;letter-spacing:.6px;color:var(--violet-deep);background:var(--violet-tint);border-radius:999px;padding:7px 14px;font-weight:600;margin-bottom:22px}.hero h1 .price{color:var(--violet)}.hero h1 .toolLine,.hero h1 .costLine{display:block}.hero .sub{margin-top:18px;max-width:560px}.heroCtas{display:flex;gap:12px;margin-top:26px}.heroSavings{background:#fff;border:1px solid var(--line);border-radius:18px;padding:22px;box-shadow:0 24px 60px -18px rgba(46,16,101,.18)}.saveRow{display:flex;justify-content:space-between;gap:18px;border-bottom:1px solid var(--line2);padding:14px 0}.saveRow s{color:var(--ink3);font-weight:700}.saveRow small{font-family:var(--mono);color:var(--ink2)}.balanceCard{margin-top:18px;background:var(--violet-tint);border-radius:14px;padding:22px}.balanceCard span{font-family:var(--mono);font-size:11px;color:var(--violet-deep);font-weight:700;letter-spacing:.8px}.balanceCard strong{display:block;margin-top:8px;font-size:28px;letter-spacing:-1px}.balanceCard p{color:var(--ink2);margin-top:4px}.mini{margin-top:18px}.mbar{display:grid;grid-template-columns:66px 1fr 54px;align-items:center;gap:10px;font:600 11px/1 var(--mono);margin-top:10px}.mtrack{height:8px;border-radius:999px;background:#eee;overflow:hidden}.mfill{height:100%}.mcap{font-size:11px!important;margin-top:12px!important}.labs,.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}.lab{width:72px;height:54px;border-radius:12px;color:#fff;display:grid;place-items:center;font-weight:800}.lab span{display:block;font:500 8px/1 var(--mono)}.chips span{background:#f4f0ff;border:1px solid #ded6f4;border-radius:999px;padding:8px 10px;font-size:12px}.wcode{margin-top:16px;background:#0d0d10;color:#eee;border-radius:12px;padding:16px;font:500 12px/1.65 var(--mono);white-space:pre-wrap}.wcode span{color:#67e8f9}.wcode em{font-style:normal;color:#c4b5fd}.home-cta-link{display:inline-block;margin-top:24px;color:#fff;font-weight:800}.vcard video{display:block}.home-section-actions{display:flex;gap:12px;margin-top:24px}.home-section-actions a{text-decoration:none}
        .price-proof{position:relative;overflow:hidden;background:#fff;border-bottom:1px solid var(--line)}.price-proof:before{content:"";position:absolute;inset:0;background:linear-gradient(to right,rgba(124,58,237,.055) 1px,transparent 1px),linear-gradient(to bottom,rgba(124,58,237,.05) 1px,transparent 1px);background-size:72px 72px;mask-image:linear-gradient(180deg,rgba(0,0,0,.78),transparent 86%);pointer-events:none}.price-proof-in{position:relative;z-index:1;max-width:var(--fk-site-frame-max-width);margin:0 auto;padding:76px var(--fk-site-gutter);display:grid;grid-template-columns:minmax(0,.86fr) minmax(420px,1fr);gap:56px;align-items:center}.price-proof-copy{max-width:520px}.price-proof-copy .kick2{margin-bottom:16px}.price-proof-copy h2{font-family:var(--disp);font-size:clamp(36px,4vw,58px);line-height:.98;letter-spacing:-.055em;font-weight:700;text-wrap:balance}.price-proof-copy p{margin-top:18px;color:var(--ink2);font-size:16.5px;line-height:1.7}.price-proof-list{display:grid;gap:10px;margin-top:26px}.price-proof-list li{list-style:none;display:flex;align-items:flex-start;gap:10px;color:var(--ink2);font-size:14px;line-height:1.55}.price-proof-list li:before{content:"";margin-top:7px;width:8px;height:8px;flex:none;border-radius:999px;background:linear-gradient(135deg,var(--violet-hi),#c026d3);box-shadow:0 0 0 4px rgba(124,58,237,.09)}.price-board{position:relative;border:1px solid rgba(76,29,149,.14);border-radius:20px;background:rgba(255,255,255,.94);box-shadow:0 34px 90px -56px rgba(46,16,101,.48);overflow:hidden}.price-board-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:20px 22px;border-bottom:1px solid var(--line);background:linear-gradient(135deg,#fbfaff,#f4edff)}.price-board-head span{font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--violet-deep);font-weight:700}.price-board-head b{display:inline-flex;align-items:center;white-space:nowrap;border-radius:999px;background:#111;color:#dff36e;padding:8px 12px;font:800 12px/1 var(--mono);letter-spacing:.04em}.price-board-body{padding:24px 24px 22px}.price-bars{display:grid;gap:18px}.price-bar-row{display:grid;grid-template-columns:112px minmax(0,1fr) 72px;align-items:center;gap:14px}.price-bar-row span{font-size:13px;font-weight:750;color:var(--ink2)}.price-bar-row strong{font-family:var(--mono);font-size:13px;text-align:right;color:var(--ink)}.price-track{position:relative;height:20px;border-radius:999px;background:#eeeaf7;overflow:hidden}.price-fill{position:absolute;inset:0 auto 0 0;border-radius:999px}.price-fill.official{width:100%;background:#c9c4d3}.price-fill.flatkey{width:50%;background:linear-gradient(90deg,var(--violet-hi),#c026d3)}.price-save{margin-top:22px;border-radius:16px;background:#111;color:#fff;padding:20px}.price-save small{display:block;font-family:var(--mono);font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;color:#dff36e;font-weight:750}.price-save strong{display:block;margin-top:9px;font-size:22px;line-height:1.16;letter-spacing:-.03em}.price-board a{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:15px 24px;border-top:1px solid var(--line);color:var(--violet-deep);font-size:13px;font-weight:800;text-decoration:none}.price-board a:after{content:"→";font-family:var(--mono)}
        .why{background:var(--home-surface);border-bottom:1px solid var(--line);position:relative;overflow:hidden}.whyIn{max-width:var(--fk-site-frame-max-width);margin:0 auto;padding:80px var(--fk-site-gutter);display:grid;grid-template-columns:300px 1fr;gap:48px;position:relative;z-index:1}.whyHead{position:sticky;top:40px;align-self:start}.whyGrid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.why .wcard{background:var(--paper2);border:1px solid var(--line);border-radius:16px;padding:26px 28px}.why .wcard h3{font-family:var(--disp);font-size:20px;letter-spacing:-.5px;font-weight:700;margin-bottom:10px}.why .wcard p{font-size:13.5px;color:var(--ink2);line-height:1.6}.why .wcard.dark{background:var(--dark);border-color:transparent}.why .wcard.dark h3{color:#fff}.why .wcard.dark p{color:#B9B9C6}.why .mini{margin-top:20px}.why .mbar{display:grid;grid-template-columns:56px 1fr 52px;gap:10px;align-items:center;margin-bottom:8px;margin-top:0;font:inherit}.why .mbar span{font-family:var(--mono);font-size:11px;color:var(--ink3)}.why .mbar b{font-family:var(--mono);font-size:12px;text-align:right}.why .mtrack{height:20px;border-radius:5px;background:var(--line2);position:relative;overflow:visible}.why .mfill{position:absolute;inset:0 auto 0 0;border-radius:5px;height:auto}.why .mcap{font-size:11px!important;color:var(--ink3)!important;margin-top:10px!important}.why .labs{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:20px}.why .lab{width:auto;height:auto;border-radius:10px;color:#fff;font-family:var(--disp);font-weight:700;font-size:20px;padding:14px 14px 10px;display:flex;flex-direction:column;gap:6px;place-items:initial}.why .lab span{font-family:var(--mono);font-size:9.5px;font-weight:400;color:#ffffffcc;letter-spacing:.4px;line-height:1}.why .wcode{margin-top:18px;font-family:var(--mono);font-size:11.5px;line-height:1.75;color:#C9E8D4;background:#ffffff0d;border-radius:10px;padding:14px 16px;overflow-x:auto;white-space:pre-wrap}.why .wcode span{color:#A7F3C8}.why .wcode em{color:#8E8E9C;font-style:normal}.why .chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}.why .chips span{font-size:12px;font-weight:650;border:1px solid var(--line);background:#fff;border-radius:999px;padding:6px 12px;color:var(--ink2)}
        section.v{position:relative;min-height:680px;overflow:hidden;display:flex;flex-direction:column;justify-content:center;color:#F4F4F0}section.v .in{position:relative;z-index:2;max-width:var(--fk-site-frame-max-width);margin:0 auto;padding:150px var(--fk-site-gutter);width:100%}.bgv{position:absolute;inset:0;z-index:0}.shade{position:absolute;inset:0;z-index:1;background:linear-gradient(90deg,rgba(8,8,14,.9) 0%,rgba(8,8,14,.6) 48%,rgba(8,8,14,.2) 100%)}.kick{font-family:var(--mono);font-size:12.5px;letter-spacing:2.5px;color:#B7A3F0;margin-bottom:20px;font-weight:600}h2.big{font-family:var(--disp);font-size:72px;line-height:1;letter-spacing:-2.8px;font-weight:600;color:#fff;text-wrap:balance;max-width:900px}h2.big em{font-style:normal;color:var(--violet-hi)}p.d{font-size:17.5px;line-height:1.65;color:#C9C9CF;margin-top:20px;max-width:620px}.vtag{position:absolute;left:40px;bottom:26px;z-index:3;font-family:var(--mono);font-size:11.5px;color:#8E8E9C;display:flex;gap:10px;align-items:center}.vtag .p{width:24px;height:24px;border-radius:50%;background:#ffffff1f;display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px}.badges{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-top:30px;max-width:960px}.badge{border:1px solid #ffffff2e;border-radius:10px;padding:14px 16px;background:#ffffff0d;backdrop-filter:blur(4px)}.badge b{display:block;font-size:14px;font-weight:650;color:#fff;letter-spacing:-.2px}.badge span{display:block;font-size:11px;color:#9a9aa6;font-family:var(--mono);margin-top:4px;line-height:1.5}.ledger{position:absolute;inset:0;background:linear-gradient(180deg,#0A0A12,#0D0B18);overflow:hidden}.lcol{position:absolute;top:-40%;width:300px;font-family:var(--mono);font-size:11px;color:#7C5CF755;line-height:2.6;white-space:nowrap;animation:fall 16s linear infinite}@keyframes fall{to{transform:translateY(45%)}}.wall{position:absolute;inset:0;background:#08080E;display:flex;flex-direction:column;justify-content:center;gap:14px;overflow:hidden}.lane{display:flex;gap:14px;animation:slide 30s linear infinite;width:max-content}.lane.r{animation-direction:reverse}.tile{width:186px;height:100px;border-radius:10px;background:#121220;border:1px solid #ffffff12;padding:14px 16px;flex:none}.tile b{font-size:13.5px;color:#EDEDEF;display:block;font-weight:650;letter-spacing:-.2px}.tile span{font-family:var(--mono);font-size:10px;color:#77778A}.tile .pr{font-family:var(--mono);font-size:11px;color:#B7A3F0;margin-top:11px;display:block}@keyframes slide{to{transform:translateX(-50%)}}@media(max-width:900px){.home-section-actions{flex-direction:column}.heroCtas{flex-wrap:wrap}section.v .in{padding:96px 24px}.badges{grid-template-columns:1fr!important}h2.big{font-size:54px;letter-spacing:-1.8px}.vtag{left:24px}}@media(max-width:620px){h2.big{font-size:42px;letter-spacing:-1.2px}.vtag{font-size:10px}}
        :root{--tool-acid:#dff36e;--tool-violet:#7627df;--tool-ink:#111014;--tool-muted:#706a74;--tool-line:#ded7e7;--tool-soft:#faf9fb;--home-surface:#f8f6fc;--home-gradient:radial-gradient(ellipse 62% 52% at 50% 8%,rgba(124,58,237,.18),transparent 72%),linear-gradient(135deg,#fbfaff 0 56%,#f0e8ff 56% 100%)}
        .tools-intro,.tool-universe{background:var(--home-gradient)}
        .tools-intro{position:relative;overflow:hidden;border-bottom:1px solid var(--tool-line)}
        .tools-intro:before{content:"";position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(to right,rgba(124,58,237,.065) 1px,transparent 1px),linear-gradient(to bottom,rgba(124,58,237,.065) 1px,transparent 1px);background-size:72px 72px;mask-image:linear-gradient(to bottom,rgba(0,0,0,.78),transparent 88%)}
        .tools-intro:after{display:none}.tools-intro-inner{position:relative;z-index:2;max-width:var(--fk-site-frame-max-width);min-height:inherit;margin:0 auto;padding:150px var(--fk-site-gutter);display:grid;grid-template-columns:minmax(0,.94fr) minmax(520px,1.06fr);gap:76px;align-items:center}.tools-kicker{display:flex;align-items:center;gap:13px;color:#4d49ff;font:500 12px/1.4 var(--mono);letter-spacing:.04em}.tools-kicker:before{content:"";width:28px;height:2px;background:#706aff}.tools-title{margin:27px 0 0;max-width:700px;font-family:var(--disp);font-size:clamp(58px,6vw,94px);line-height:1.02;font-weight:700;letter-spacing:-.065em}.tools-title-line{white-space:nowrap}html:not(:lang(en)) .tools-title{font-size:clamp(48px,3.8vw,62px)}.tools-copy{max-width:690px;margin:30px 0 0;color:#615b64;font-size:18px;line-height:1.7}.agent-label{display:flex;align-items:center;gap:8px;margin-top:30px;font-size:12px;font-weight:700}.agent-marks{display:flex;margin-left:auto;gap:5px}.agent-mark{width:25px;height:25px;border-radius:7px;display:grid;place-items:center;color:#fff;font:700 10px/1 var(--mono)}.agent-mark.openai{background:#4e4652}.agent-mark.claude{background:#dc866c}.agent-mark.codex{background:#111}.agent-mark.more{width:auto;padding:0 8px;background:#f0edf2;color:#78717c}.agent-command{width:100%;display:flex;align-items:center;gap:14px;min-height:76px;margin-top:14px;padding:12px 18px 12px 24px;border:0;border-radius:14px;background:#0d0d10;color:#eee;text-align:left;font:500 13px/1.5 var(--mono);box-shadow:0 26px 60px -34px #000;cursor:pointer}.agent-command .prompt{color:#827b87}.agent-command code{flex:1;white-space:normal}.copy-state{min-width:72px;flex:none;display:flex;align-items:center;justify-content:flex-end;gap:8px;color:#aaa4ae;font-size:10px}.copy-icon-wrap{position:relative;width:20px;height:20px;display:grid;place-items:center}.copy-icon-wrap svg{position:absolute;width:16px;height:16px}.check-icon{color:#4ade80;opacity:0}.copy-label{min-width:38px;text-align:right}.agent-note{margin-top:13px;color:#99929d;font:400 10px/1.5 var(--mono)}.agent-links{display:flex;gap:34px;margin-top:30px;color:#4b454e;font-size:13px;font-weight:600}.terminal{position:relative;border:1px solid #dadfe8;border-radius:16px;background:rgba(255,255,255,.94);box-shadow:0 36px 90px -48px rgba(37,21,54,.45);overflow:hidden}.terminal-head{height:58px;display:flex;align-items:center;gap:9px;padding:0 18px;background:#f4f7fa;color:#708096;font:500 11px/1 var(--mono)}.terminal-dot{width:11px;height:11px;border-radius:50%}.terminal-dot.red{background:#ff675f}.terminal-dot.yellow{background:#ffbd2e}.terminal-dot.green{background:#29c940}.terminal-head span:last-child{margin-left:7px}.terminal-body{min-height:485px;padding:28px 29px 34px;color:#4e5c71;font:400 13px/1.72 var(--mono)}.term-brand{display:flex;align-items:center;gap:15px;margin:6px 0 25px}.term-bot{width:55px;height:39px;position:relative;background:#7627df;clip-path:polygon(16% 0,40% 0,40% 18%,60% 18%,60% 0,84% 0,84% 18%,100% 18%,100% 82%,84% 82%,84% 100%,68% 100%,68% 82%,32% 82%,32% 100%,16% 100%,16% 82%,0 82%,0 18%,16% 18%)}.term-brand b{display:block;color:#2c3543;font-size:13px}.term-brand span{display:block;color:#7e8ba0;font-size:11px}.term-command{color:#354356;margin-bottom:20px}.term-line{margin:7px 0;color:#718097}.term-line.ok{color:#1ba850}.term-line.bill{color:#6f22cf;font-weight:600}.term-divider{height:1px;margin:22px 0;background:#e3e7ec}.term-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.term-stat{border:1px solid #e1e5eb;border-radius:10px;padding:11px}.term-stat small{display:block;color:#8b96a6;font-size:8px;text-transform:uppercase;letter-spacing:.08em}.term-stat b{display:block;color:#354152;font-size:13px;margin-top:5px}
        .tool-universe{position:relative;min-height:100svh;overflow:hidden;border-bottom:1px solid var(--tool-line)}.tool-universe:before{content:"";position:absolute;inset:0;background-image:linear-gradient(to right,rgba(124,58,237,.05) 1px,transparent 1px),linear-gradient(to bottom,rgba(124,58,237,.05) 1px,transparent 1px);background-size:72px 72px;mask-image:linear-gradient(to bottom,rgba(0,0,0,.64),transparent 94%);pointer-events:none}.universe-inner{position:relative;z-index:1;max-width:var(--fk-site-frame-max-width);margin:0 auto;padding:90px var(--fk-site-gutter) 82px;text-align:center}.universe-title{font-family:var(--disp);font-size:clamp(46px,5vw,76px);line-height:1.03;font-weight:700;letter-spacing:-.055em}.universe-copy{max-width:790px;margin:20px auto 0;color:#6d6770;font-size:17px;line-height:1.65}.hub{position:relative;height:168px;margin-top:34px;display:block}.hub-core{position:absolute;z-index:3;top:8px;left:50%;transform:translateX(-50%);width:460px;padding:16px 18px 14px;border:1px solid #d8cee2;border-radius:19px;background:rgba(255,255,255,.96);box-shadow:0 28px 70px -42px rgba(65,24,98,.6),0 0 0 7px rgba(118,39,223,.035);text-align:left}.hub-core:before{content:"";position:absolute;width:1px;height:22px;left:50%;top:-22px;background:linear-gradient(#dcd6de,#a56ee6)}.hub-core:after{content:"";position:absolute;width:1px;height:34px;left:50%;bottom:-34px;background:linear-gradient(#a56ee6,#e4dfe6)}.hub-brand{display:flex;align-items:center;gap:12px}.hub-logo{width:48px;height:48px;flex:none;filter:drop-shadow(0 10px 14px rgba(109,40,217,.18))}.hub-brand-copy{min-width:0;margin-right:0;text-align:left}.hub-brand-copy strong{display:block;font-size:23px;line-height:1;font-weight:800;letter-spacing:-1px}.hub-brand-copy span{display:block;margin-top:5px;color:#796f7e;font:500 8.5px/1.3 var(--mono);letter-spacing:.08em;text-transform:uppercase}.hub-live{margin-left:auto;display:inline-flex;align-items:center;gap:6px;padding:7px 9px;border:1px solid #d9ecd9;border-radius:999px;background:#f3fbf3;color:#277748;font:600 8px/1 var(--mono);letter-spacing:.05em}.hub-live:before{content:"";width:6px;height:6px;border-radius:50%;background:#2db76b;box-shadow:0 0 0 4px rgba(45,183,107,.1)}.hub-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;margin-top:13px;border:1px solid #e7e0eb;border-radius:10px;overflow:hidden;background:#e7e0eb}.hub-metric{display:flex;align-items:baseline;gap:6px;justify-content:center;padding:10px 8px;background:#faf8fc}.hub-metric b{color:#5f1db5;font:700 13px/1 var(--mono)}.hub-metric small{color:#827a86;font:500 7.5px/1 var(--mono);text-transform:uppercase;letter-spacing:.05em}.capability-map{position:relative;z-index:2;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:2px}.capability-row,.provider-cards{display:contents}.provider-card{position:relative;min-width:0;height:84px;display:flex;align-items:center;gap:12px;padding:14px 15px;border:1px solid #e2dce4;border-radius:13px;background:rgba(255,255,255,.96);text-align:left;box-shadow:0 12px 30px -29px rgba(33,19,42,.5);transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease}.provider-card:hover{transform:translateY(-2px);border-color:#d5c8db;box-shadow:0 20px 40px -31px rgba(33,19,42,.6)}.provider-icon{width:38px;height:38px;flex:none;border-radius:9px;display:grid;place-items:center;background:#fff}.provider-icon img{display:block;width:32px;height:32px;object-fit:contain}.provider-icon.voc-mark{background:#111;color:#fff;border-radius:11px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.15)}.provider-icon.voc-mark span{margin:0;color:#fff;font:800 10px/1 var(--mono);letter-spacing:-.05em}.provider-card>div{min-width:0}.provider-card b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:1.2}.provider-card div>span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:5px;color:#8d8591;font:400 8.3px/1.3 var(--mono)}.provider-card.more-card{overflow:hidden;border-color:#d7c9e8;background:linear-gradient(135deg,rgba(255,255,255,.98),rgba(246,240,255,.98));color:#17131c;text-decoration:none;box-shadow:0 16px 36px -28px rgba(82,32,137,.48)}.provider-card.more-card:after{content:"↗";position:absolute;right:15px;top:50%;transform:translateY(-50%);color:#7340ac;font:600 15px/1 var(--mono)}.more-icon{position:relative;overflow:visible;background:linear-gradient(145deg,#22172e,#7933c5);box-shadow:0 8px 20px -10px rgba(81,25,143,.72)}.more-icon:before,.more-icon:after,.more-icon span{content:"";position:absolute;width:13px;height:13px;border:1px solid rgba(255,255,255,.72);border-radius:4px;background:rgba(255,255,255,.14);box-shadow:0 3px 8px rgba(27,11,41,.15)}.more-icon:before{left:7px;top:7px}.more-icon span{left:17px;top:11px}.more-icon:after{left:11px;top:19px}.more-card.tools-more .more-icon{background:linear-gradient(145deg,#3b2451,#9b58e3)}.more-card b em{font-style:normal;color:#6c2bad}.tool-values{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;margin-top:22px;border:1px solid #e2dce4;background:#e2dce4;border-radius:14px;overflow:hidden}.tool-value{background:#fff;padding:21px;text-align:left;border:0;border-radius:0}.tool-value small{color:#6f27c4;font:600 9px/1 var(--mono);letter-spacing:.08em}.tool-value b{display:block;margin-top:15px;font-size:14px}.tool-value p{margin:7px 0 0;color:#78717b;font-size:11px;line-height:1.55}.rel,.why,.media,.steps,.support,.ctaWrap{background-color:var(--home-surface)}
        @media(max-width:1050px){.price-proof-in,.tools-intro-inner{grid-template-columns:1fr;padding:78px var(--fk-site-gutter);gap:50px}.tools-intro-inner{padding:120px var(--fk-site-gutter)}.price-proof-copy{max-width:760px}.tools-title{max-width:850px}.terminal{max-width:780px}.hub{height:164px}.hub-core{top:4px}.tool-values{grid-template-columns:repeat(2,1fr)}}@media(max-width:700px){.price-proof-in,.tools-intro-inner{padding:64px var(--fk-site-gutter)}.tools-intro-inner{padding:88px var(--fk-site-gutter)}.price-board-head{align-items:flex-start;flex-direction:column}.price-board-body{padding:20px}.price-bar-row{grid-template-columns:1fr;gap:8px}.price-bar-row strong{text-align:left}.tools-title{font-size:clamp(39px,11.2vw,49px)}.tools-copy{font-size:15.5px}html:not(:lang(en)) .tools-title{font-size:clamp(34px,9vw,43px)}.agent-marks{display:none}.agent-command{font-size:10px;padding:14px}.copy-label{display:none}.copy-state{min-width:24px}.terminal-body{min-height:430px;padding:20px 17px;font-size:10px}.term-summary{grid-template-columns:1fr}.universe-inner{padding:68px var(--fk-site-gutter)}.universe-title{font-size:43px}.universe-copy{font-size:14px}.provider-card{height:82px;padding:13px 12px}.provider-icon{width:30px;height:30px}.provider-card b{font-size:11px}.capability-map{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.tool-values{grid-template-columns:1fr}.hub{height:166px}.hub-core{width:100%;padding:14px}.hub-logo{width:42px;height:42px}.hub-brand-copy strong{font-size:20px}}
      `}</style>
      <header className="hero heroUnified">
        <PixelGrid
          cell={22}
          cols={16}
          n={15}
          rows={3}
          seed={11}
          style={{ right: 30, top: 0 }}
        />
        <div className="heroGrid">
          <div className="heroCopy">
            <span className="eyebrow">{copy.home.eyebrow}</span>
            <h1 className="display">
              {renderHeroTitle(props.locale, copy.home.heroTitle)}
            </h1>
            <p className="sub">{copy.home.sub}</p>
            <div className="heroCtas">
              <Link className="btn big heroPrimary" href={authActionHref}>
                {authActionLabel}
              </Link>
              <Link
                className="btn big heroSecondary"
                href={localizePath("/models", props.locale)}
              >
                {copy.home.ctaModels}
              </Link>
            </div>
          </div>
          <div
            className="heroSavings"
            aria-label="Flatkey replaces separate AI subscriptions"
          >
            <div className="saveRow">
              <s>{copy.home.savings[0]}</s>
              <small>
                {ht("tools.hero.modelPrice", "20 to 200 USD per seat")}
              </small>
            </div>
            <div className="saveRow">
              <s>{copy.home.savings[1]}</s>
              <small>
                {ht("tools.hero.toolPrice", "49 to 500 USD per month")}
              </small>
            </div>
            <div className="saveRow">
              <s>{copy.home.savings[2]}</s>
              <small>
                {ht("tools.hero.automationPrice", "20 to 250 USD per month")}
              </small>
            </div>
            <div className="balanceCard">
              <span>{copy.home.balance}</span>
              <strong>{copy.home.pay}</strong>
              <p>{copy.home.invoice}</p>
            </div>
          </div>
        </div>
      </header>
      <section className="tools-intro">
        <div className="tools-intro-inner">
          <div>
            <div className="tools-kicker">{copy.home.toolsKicker}</div>
            <h2 className="tools-title">
              {renderToolsTitle(props.locale, copy.home.toolsTitle)}
            </h2>
            <p className="tools-copy">{copy.home.toolsCopy}</p>
            <div className="agent-label">
              <span>{ht("tools.intro.agent", "Give this to your agent")}</span>
              <div className="agent-marks">
                <span className="agent-mark openai">AI</span>
                <span className="agent-mark claude">C</span>
                <span className="agent-mark codex">⌘</span>
                <span className="agent-mark more">
                  {ht("tools.intro.more", "+ more")}
                </span>
              </div>
            </div>
            <button
              className="agent-command"
              id="copy-flatkey-setup"
              type="button"
              data-action="copy-flatkey-setup"
              aria-label="Copy Flatkey setup prompt"
              data-copy="Set up Flatkey from https://flatkey.ai/SKILL.md"
            >
              <span className="prompt" aria-hidden="true">
                &gt;
              </span>
              <code>{copy.home.toolsCommand}</code>
              <span className="copy-state" aria-hidden="true">
                <span className="copy-label">
                  {ht("tools.intro.copyButton", "Copy")}
                </span>
                <span className="copy-icon-wrap">
                  <svg
                    className="copy-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="14" height="14" x="8" y="8" rx="2" />
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                  </svg>
                  <svg
                    className="check-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
              </span>
            </button>
            <div className="agent-note">
              {ht(
                "tools.intro.note",
                "No new seat. No separate provider keys. Every model and tool call lands on the same ledger.",
              )}
            </div>
            <div className="agent-links">
              <a href={consoleUrl("/api-marketplace")}>
                {ht("tools.intro.explore", "Explore tools →")}
              </a>
              <a
                href="https://docs.flatkey.ai/"
                target="_blank"
                rel="noopener noreferrer"
              >
                {ht("tools.intro.docs", "Read the docs")}
              </a>
            </div>
          </div>
          <div className="terminal">
            <div className="terminal-head">
              <i className="terminal-dot red" />
              <i className="terminal-dot yellow" />
              <i className="terminal-dot green" />
              <span>{copy.home.terminal.title}</span>
            </div>
            <div className="terminal-body">
              <div className="term-brand">
                <div className="term-bot" />
                <div>
                  <b>flatkey tools</b>
                  <span>
                    {ht("tools.terminal.tagline", "one key · models + tools")}
                  </span>
                </div>
              </div>
              <div className="term-command">
                {ht(
                  "tools.terminal.command",
                  "❯ Find 14 competitors, research their launches, identify decision makers, waterfall-enrich contacts, and prepare a sourced GTM brief.",
                )}
              </div>
              <div className="term-line">{copy.home.terminal.competitors}</div>
              <div className="term-line">{copy.home.terminal.scanned}</div>
              <div className="term-line ok">{copy.home.terminal.contacts}</div>
              <div className="term-line ok">{copy.home.terminal.persona}</div>
              <div className="term-line bill">{copy.home.terminal.billed}</div>
              <div className="term-divider" />
              <div className="term-summary">
                <div className="term-stat">
                  <small>{copy.home.terminal.successfulLabel}</small>
                  <b>{copy.home.terminal.successfulValue}</b>
                </div>
                <div className="term-stat">
                  <small>{copy.home.terminal.runtimeLabel}</small>
                  <b>{copy.home.terminal.runtimeValue}</b>
                </div>
                <div className="term-stat">
                  <small>{copy.home.terminal.invoiceLabel}</small>
                  <b>{copy.home.terminal.invoiceValue}</b>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="tool-universe">
        <div className="universe-inner">
          <div className="tools-kicker" style={{ justifyContent: "center" }}>
            {copy.home.universeKicker}
          </div>
          <h2 className="universe-title" style={{ marginTop: 20 }}>
            {renderLineBreakText(
              ht(
                "tools.universe.title",
                "Every model. Every tool.<br>One key.",
              ),
            )}
          </h2>
          <p className="universe-copy">{copy.home.universeCopy}</p>
          <div className="hub" aria-hidden="true">
            <div className="hub-core">
              <div className="hub-brand">
                <img
                  className="hub-logo"
                  src="/assets/flatkey-mark.svg"
                  alt=""
                />
                <div className="hub-brand-copy">
                  <strong>flatkey</strong>
                  <span>
                    {ht("tools.universe.router", "Unified model + tool router")}
                  </span>
                </div>
                <span className="hub-live">
                  {ht("tools.universe.live", "ROUTING LIVE")}
                </span>
              </div>
              <div className="hub-metrics">
                <span className="hub-metric">
                  <b>100+</b>
                  <small>
                    {ht("tools.universe.models", "official models")}
                  </small>
                </span>
                <span className="hub-metric">
                  <b>1,000+</b>
                  <small>{ht("tools.universe.tools", "AI tools")}</small>
                </span>
                <span className="hub-metric">
                  <b>1</b>
                  <small>
                    {ht("tools.universe.balance", "shared balance")}
                  </small>
                </span>
              </div>
            </div>
          </div>
          <div className="capability-map">
            {providerRows.map((row, rowIndex) => (
              <div
                className={`capability-row ${["models", "social", "crawl", "gtm"][rowIndex]}`}
                data-section={["models", "social", "crawl", "gtm"][rowIndex]}
                key={rowIndex}
              >
                <div className="provider-cards">
                  {row.map(([src, name, desc]) => (
                    <article className="provider-card" key={name}>
                      <i className="provider-icon">
                        <img src={`/assets/${src}`} alt={name} />
                      </i>
                      <div>
                        <b>{name}</b>
                        <span>{desc}</span>
                      </div>
                    </article>
                  ))}
                  {rowIndex === 2 && (
                    <article className="provider-card">
                      <i className="provider-icon voc-mark">
                        <span>VOC</span>
                      </i>
                      <div>
                        <b>VOC AI</b>
                        <span>voice of customer</span>
                      </div>
                    </article>
                  )}
                  {rowIndex === 3 && (
                    <>
                      <Link
                        className="provider-card more-card models-more"
                        href={localizePath("/models", props.locale)}
                        aria-label="Explore more than 100 official AI models"
                      >
                        <i
                          className="provider-icon more-icon"
                          aria-hidden="true"
                        >
                          <span />
                        </i>
                        <div>
                          <b>
                            {renderEmStart(
                              ht(
                                "tools.universe.moreModels",
                                "<em>More</em> models",
                              ),
                            )}
                          </b>
                          <span>
                            {ht(
                              "tools.universe.moreModelsCount",
                              "100+ official models",
                            )}
                          </span>
                        </div>
                      </Link>
                      <a
                        className="provider-card more-card tools-more"
                        href={consoleUrl("/api-marketplace")}
                        aria-label="Explore more than 1,000 AI tools"
                      >
                        <i
                          className="provider-icon more-icon"
                          aria-hidden="true"
                        >
                          <span />
                        </i>
                        <div>
                          <b>
                            {renderEmStart(
                              ht(
                                "tools.universe.moreTools",
                                "<em>More</em> tools",
                              ),
                            )}
                          </b>
                          <span>
                            {ht(
                              "tools.universe.moreToolsCount",
                              "1,000+ available",
                            )}
                          </span>
                        </div>
                      </a>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="tool-values">
            <article className="tool-value">
              <small>{ht("tools.value.authEye", "ONE AUTH")}</small>
              <b>{ht("tools.value.authTitle", "One Flatkey key")}</b>
              <p>
                {ht(
                  "tools.value.authCopy",
                  "No provider credentials scattered across agents, repos, and environments.",
                )}
              </p>
            </article>
            <article className="tool-value">
              <small>{ht("tools.value.contractEye", "ONE CONTRACT")}</small>
              <b>
                {ht(
                  "tools.value.contractTitle",
                  "Normalized calls and results",
                )}
              </b>
              <p>
                {ht(
                  "tools.value.contractCopy",
                  "Consistent schemas, error envelopes, request IDs, and usage records.",
                )}
              </p>
            </article>
            <article className="tool-value">
              <small>{ht("tools.value.policyEye", "ONE POLICY")}</small>
              <b>{ht("tools.value.policyTitle", "Budgets and allowlists")}</b>
              <p>
                {ht(
                  "tools.value.policyCopy",
                  "Control which agents can call which tools and how much they may spend.",
                )}
              </p>
            </article>
            <article className="tool-value">
              <small>{ht("tools.value.billEye", "ONE BILL")}</small>
              <b>{ht("tools.value.billTitle", "Pay for successful work")}</b>
              <p>
                {ht(
                  "tools.value.billCopy",
                  "Models and tools share one balance; failed Flatkey-side calls cost nothing.",
                )}
              </p>
            </article>
          </div>
        </div>
      </section>
      <section className="rel" id="reliability">
        <PixelGrid
          cell={18}
          cols={8}
          n={9}
          rows={3}
          seed={139}
          style={{ right: 38, top: 20 }}
        />
        <div className="relIn">
          <div>
            <div className="kick2">
              {t("rel.kick", "RELIABILITY · SLA, IN WRITING")}
            </div>
            <h2 className="display">
              {renderLineBreakText(
                t("rel.h2", "Stability you can<br>hold us to."),
              )}
            </h2>
            <p className="sub" style={{ marginTop: 14, maxWidth: 440 }}>
              {t(
                "rel.p",
                "One request, five upstream channel classes. When a channel degrades, the router reroutes automatically — and the SLA is a public document, not a sales promise.",
              )}
            </p>
            <div className="relStats">
              <div>
                <b className="num">99.5%</b>
                <span>
                  {renderLineBreakText(
                    t("rel.s1", "signed SLA — public terms →")
                      .replace(/<a[^>]*>/g, "")
                      .replace(/<\/a>/g, ""),
                  )}
                </span>
              </div>
              <div>
                <b className="num">5</b>
                <span>
                  {t("rel.s2", "channel classes, automatic failover")}
                </span>
              </div>
              <div>
                <b className="num">$0</b>
                <span>
                  {t("rel.s3", "balance consumed by flatkey-side errors")}
                </span>
              </div>
            </div>
            <div className="home-section-actions">
              <Link
                className="btn black big"
                href={localizePath("/status", props.locale)}
              >
                {t("rel.cta1", "Live status →")}
              </Link>
              <Link
                className="btn white big"
                href={localizePath("/sla", props.locale)}
              >
                {t("rel.cta2", "SLA & service credits")}
              </Link>
            </div>
          </div>
          <div className="relChart">
            <div className="rcHead">
              <span>
                {t("rel.ct", "UPTIME · SINGLE CHANNEL VS FLATKEY MESH · LIVE")}
              </span>
              <span className="pill mint">
                <span className="dot" />
                LIVE
              </span>
            </div>
            <svg viewBox="0 0 560 220" preserveAspectRatio="none">
              <line x1="0" y1="30" x2="560" y2="30" stroke="#0B0B0F14" />
              <line x1="0" y1="90" x2="560" y2="90" stroke="#0B0B0F14" />
              <line x1="0" y1="150" x2="560" y2="150" stroke="#0B0B0F14" />
              <path
                d="M0,34 L60,32 L90,36 L120,120 L150,140 L170,60 L220,38 L260,34 L300,110 L330,170 L360,150 L390,44 L440,36 L480,100 L510,60 L560,38"
                fill="none"
                stroke="#D97706"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              <path
                d="M0,26 L80,24 L160,27 L240,24 L320,28 L400,24 L480,26 L560,24"
                fill="none"
                stroke="#15803D"
                strokeWidth="2.8"
                strokeLinejoin="round"
              />
              <text
                x="8"
                y="20"
                fontSize="11"
                fill="#15803D"
                fontWeight="700"
                fontFamily="monospace"
              >
                flatkey mesh 99.98%
              </text>
              <text
                x="300"
                y="196"
                fontSize="11"
                fill="#D97706"
                fontWeight="700"
                fontFamily="monospace"
              >
                least stable single channel
              </text>
            </svg>
            <p className="rcCap">
              {t(
                "rel.cap",
                "When one upstream errors, the router recovers on the next-best official channel — you see one flat line.",
              )}
            </p>
          </div>
        </div>
      </section>
      <section className="why" id="why">
        <PixelGrid
          cell={18}
          cols={7}
          n={9}
          rows={4}
          seed={113}
          style={{ bottom: 30, left: 34 }}
        />
        <div className="whyIn">
          <div className="whyHead">
            <h2 className="display" style={{ fontSize: 56 }}>
              {renderLineBreakText(t("why.h2", "Why choose<br>flatkey?"))}
            </h2>
          </div>
          <div className="whyGrid">
            <div className="wcard">
              <h3>{t("why.c1h", "As low as 40% of list")}</h3>
              <p>
                {t(
                  "why.c1p",
                  "National-lab models from 60% of list, stacking with the top-up bonus to 40%; flagships bill at list with the same bonus. One prepaid balance across every model.",
                )}
              </p>
              <div className="mini">
                <div className="mbar">
                  <span>official</span>
                  <div className="mtrack">
                    <div
                      className="mfill"
                      style={{ width: "100%", background: "#C9C9D2" }}
                    />
                  </div>
                  <b>$5.00</b>
                </div>
                <div className="mbar">
                  <span>flatkey</span>
                  <div className="mtrack">
                    <div
                      className="mfill"
                      style={{
                        width: "53%",
                        background:
                          "linear-gradient(90deg,var(--violet-hi),var(--violet-deep))",
                      }}
                    />
                  </div>
                  <b style={{ color: "var(--violet-deep)" }}>$2.67</b>
                </div>
                <p className="mcap">
                  claude-opus-4-8 · $/1M input tokens, after bonus
                </p>
              </div>
            </div>
            <div className="wcard">
              <h3>{t("why.c2h", "Official endpoints, verified hourly")}</h3>
              <p>
                {t(
                  "why.c2p",
                  "Every request hits the real lab API — no fp8 re-serves, no silent swaps. 100+ models probed against official fingerprints, on a public log.",
                )}
              </p>
              <div className="labs">
                {[
                  ["G", "OpenAI"],
                  ["C", "Anthropic"],
                  ["G", "Google"],
                  ["D", "DeepSeek"],
                  ["Q", "Alibaba"],
                  ["Z", "Z.ai"],
                ].map(([letter, lab]) => (
                  <div
                    className="lab"
                    key={lab}
                    style={{
                      background:
                        lab === "Anthropic"
                          ? "#B45309"
                          : lab === "Google"
                            ? "#2563EB"
                            : lab === "DeepSeek"
                              ? "#3B52D4"
                              : lab === "Alibaba"
                                ? "var(--violet-deep)"
                                : lab === "Z.ai"
                                  ? "#0B0B0F"
                                  : "#0E8A6C",
                    }}
                  >
                    {letter}
                    <span>{lab}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="wcard dark">
              <h3>{t("why.c3h", "CLI-native. Powered by SKILL.md.")}</h3>
              <p>
                {t(
                  "why.c3p",
                  "Point Codex, Claude Code, OpenClaw, or any agent CLI at Flatkey’s SKILL.md. It learns how to discover and call 100+ official models and 1,000+ pay-per-call tools with one key.",
                )}
              </p>
              <pre className="wcode">
                <span>$</span> codex{" "}
                <em>{`"Set up Flatkey from\n  https://flatkey.ai/SKILL.md"`}</em>
                {"\n\n"}
                <span>✓</span> 100+ official models connected{"\n"}
                <span>✓</span> 1,000+ tools discovered{"\n"}
                <span>✓</span> one key · one balance
              </pre>
            </div>
            <div className="wcard">
              <h3>{t("why.c4h", "Enterprise-grade governance")}</h3>
              <p>
                {t(
                  "why.c4p",
                  "Tree-structured sub-keys with budgets and model allowlists, a per-request ledger API, invoices in 48h — on audited infrastructure.",
                )}
              </p>
              <div className="chips">
                {[
                  "Sub-key caps",
                  "Model allowlists",
                  "Ledger API",
                  "Invoices 48h",
                  "SOC 2 Type II",
                  "ISO 27001",
                  "GDPR",
                  "Zero retention",
                ].map((chip) => (
                  <span key={chip}>{chip}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="v" id="compliance">
        <PixelGrid
          accent="#22C55E"
          cell={24}
          colors={["#7C3AED66", "#8B5CF64D", "#A78BFA59"]}
          cols={12}
          n={20}
          rows={6}
          seed={43}
          style={{ bottom: 70, right: 34, zIndex: 1 }}
        />
        <div className="bgv ledger">
          <div className="lcol" style={{ left: "56%" }}>
            req_8f3a2e91 · in 1,204 tok · out 388 tok · cached 61% · $0.0041
            <br />
            req_c11977ab · in 640 tok · out 1,022 tok · cached 38% · $0.0009
            <br />
            req_40deb0c2 · in 8,441 tok · out 96 tok · cached 95% · $0.0002
            <br />
            invoice #2026-0714 · VAT · issued 48h
            <br />
            req_77ab40de · 3DS ✓ · stripe checkout · BRL R$55,00
            <br />
            audit_export.csv · 128,441 rows · sha256 ✓
          </div>
          <div className="lcol" style={{ animationDelay: "-8s", left: "75%" }}>
            subkey cline-agent · cap $50/mo · model allowlist ✓<br />
            subkey prod · cap $500/mo · alert 80% ✓<br />
            SLA 99.9% · failover 3-region · breaker 99.95%
            <br />
            gdpr export · user 1835 · 2.1MB · done
            <br />
            req_b0c240de · in 96 tok · out 2,048 tok · $0.0031
          </div>
        </div>
        <div className="shade" />
        <div className="in">
          <div className="kick">
            {t("compl.kick", "COMPLIANCE · ENTERPRISE-GRADE AUDITABILITY")}
          </div>
          <h2 className="big">
            {renderInlineEm(
              t("compl.h2", "Every token,<br>on the record<em>.</em>"),
            )}
          </h2>
          <p className="d">
            {t(
              "compl.p",
              "Per-request ledger with input, output and cached tokens — exportable, API-accessible. Invoices in 48h (VAT fapiao supported), 3DS payments, sub-key caps and model allowlists for teams.",
            )}
          </p>
          <div className="badges">
            <div className="badge">
              <b className="num">99.5% SLA</b>
              <span>multi-provider failover · signed</span>
            </div>
            <div className="badge">
              <b>3DS · Stripe</b>
              <span>fraud-screened payments</span>
            </div>
            <div className="badge">
              <b>Invoices 48h</b>
              <span>enterprise invoicing API</span>
            </div>
            <div className="badge">
              <b>Ledger API</b>
              <span>every request, every token</span>
            </div>
            <div className="badge">
              <b>Sub-key governance</b>
              <span>caps · allowlists · alerts</span>
            </div>
          </div>
        </div>
      </section>
      <section className="v" id="models">
        <PixelGrid
          accent="#22C55E"
          cell={24}
          colors={["#7C3AED66", "#8B5CF64D", "#A78BFA59"]}
          cols={10}
          n={16}
          rows={5}
          seed={47}
          style={{ bottom: 56, right: 60, zIndex: 1 }}
        />
        <div className="bgv wall">
          {modelWallRows.map((row, rowIndex) => (
            <div className={`lane${rowIndex === 1 ? " r" : ""}`} key={rowIndex}>
              {[...row, ...row].map(
                ([name, meta, price, highlighted, verified], index) => (
                  <div
                    className="tile"
                    key={`${name}-${index}`}
                    style={
                      highlighted ? { borderColor: "#8B5CF666" } : undefined
                    }
                  >
                    <b style={highlighted ? { color: "#B7A3F0" } : undefined}>
                      {name}
                    </b>
                    <span>
                      {verified ? (
                        <>
                          <i
                            style={{
                              color: "var(--green)",
                              fontStyle: "normal",
                            }}
                          >
                            ✓ verified
                          </i>{" "}
                          · {meta}
                        </>
                      ) : (
                        meta
                      )}
                    </span>
                    <span className="pr">{modelPrice(price)}</span>
                  </div>
                ),
              )}
            </div>
          ))}
        </div>
        <div className="shade" />
        <div className="in">
          <div className="kick">
            {t("mdl.kick", "MODELS · 100+ OFFICIAL MODELS, ONE KEY")}
          </div>
          <h2 className="big">
            {renderInlineEm(
              t("mdl.h2", "Every frontier lab<em>.</em><br>One key."),
            )}
          </h2>
          <p className="d">
            {t(
              "mdl.p",
              "OpenAI, Anthropic, Google, DeepSeek, Alibaba, Zhipu, Moonshot, ByteDance… new models live within 24h of official release — always the real endpoints, never quantized re-serves.",
            )}
          </p>
        </div>
      </section>
      <section className="media" id="video">
        <PixelGrid
          cell={20}
          cols={10}
          n={11}
          rows={3}
          seed={103}
          style={{ right: 36, top: 14 }}
        />
        <div className="mediaIn">
          <div className="kick2">
            {t("vid.kick", "VIDEO MODELS · SAME KEY, SAME BALANCE")}
          </div>
          <h2 className="display">
            {t("vid.h2", "Video generation, official endpoints.")}
          </h2>
          <p className="sub" style={{ marginTop: 12, maxWidth: 620 }}>
            {t(
              "vid.sub",
              "Text-to-video and image-to-video from every major lab — metered per second on the same prepaid balance as your text models.",
            )}
          </p>
          <div className="vgal">
            {videoCards.map(
              ([asset, title, subtitle, meta, status, href, featured]) => (
                <Link
                  className={`vcard${featured ? " big" : ""}`}
                  href={localizePath(href, props.locale)}
                  key={asset}
                >
                  <video
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="auto"
                    poster={`/assets/video/${asset}.jpg`}
                    src={`/assets/video/${asset}.mp4`}
                  />
                  <div className="vshade" />
                  {featured && (
                    <span className="fbadge">
                      {t("vid.badge", "FEATURED · NEW")}
                    </span>
                  )}
                  <div className="vmeta">
                    <h3>
                      {title}
                      <br />
                      {subtitle}
                    </h3>
                    <p>
                      <span>{meta}</span>
                      <i>{videoStatus(status)}</i>
                    </p>
                  </div>
                </Link>
              ),
            )}
          </div>
          <div className="mgrid" style={{ marginTop: 16 }}>
            {upcomingVideoModels.map(([model, meta]) => (
              <div className="mcard" key={model}>
                <b>{model}</b>
                <span>{meta}</span>
                <i>{t("md.soon", "Coming soon")}</i>
              </div>
            ))}
            <div className="mcard more">
              <Link href={localizePath("/models", props.locale)}>
                {t("vid.more", "+ 20 more video models →")}
              </Link>
            </div>
          </div>
        </div>
      </section>
      <section className="support" id="support">
        <PixelGrid
          cell={18}
          cols={7}
          n={8}
          rows={3}
          seed={97}
          style={{ bottom: 20, left: 40 }}
        />
        <div className="supportIn">
          <div>
            <div className="kick2">
              {t("sup.kick", "SUPPORT · HUMANS ON CALL")}
            </div>
            <h2 className="display">{t("sup.h2", "Questions? Talk to us.")}</h2>
            <p className="sub" style={{ marginTop: 14, maxWidth: 420 }}>
              {t(
                "sup.sub",
                "Integration, model choice, or billing — online support and usage consultation for everything on flatkey.",
              )}
            </p>
          </div>
          <div className="chGrid">
            <a
              className="ch"
              href="https://discord.gg/VrbZFDXj5g"
              style={{
                gridColumn: "1/-1",
                background: "linear-gradient(120deg,#5865F2 0%,#4752C4 100%)",
                borderColor: "transparent",
              }}
            >
              <b style={{ color: "#fff" }}>
                {t("sup.dc", "Discord community")}
              </b>
              <span style={{ color: "#E4E6FF" }}>discord.gg/VrbZFDXj5g</span>
              <i style={{ color: "#C7CCFF" }}>
                {t(
                  "sup.dc.i",
                  "Builders answering builders — the team is in the channels daily",
                )}
              </i>
            </a>
            <a className="ch" href="mailto:support@flatkey.ai">
              <b>{t("sup.email", "Email")}</b>
              <span>support@flatkey.ai</span>
              <i>{t("sup.email.i", "Reply within 1 business day")}</i>
            </a>
            <Link className="ch" href={localizePath("/contact", props.locale)}>
              <b>{t("sup.chat", "Live chat")}</b>
              <span>{t("sup.chat.s", "Start chatting →")}</span>
              <i>{t("sup.chat.i", "Fastest answer, on the site")}</i>
            </Link>
            <a className="ch" href="https://x.com/flatkey101">
              <b>{t("sup.x", "X (Twitter)")}</b>
              <span>@flatkey101</span>
              <i>{t("sup.x.i", "Follow or DM")}</i>
            </a>
          </div>
        </div>
      </section>
      <section className="ctaWrap">
        <div className="ctaBanner">
          <PixelGrid
            accent="#67E8F9"
            cell={26}
            colors={["#7C3AED", "#A78BFA", "#6D28D9"]}
            cols={9}
            n={26}
            rows={7}
            seed={163}
            style={{ left: -30, opacity: 0.9, top: -20 }}
          />
          <PixelGrid
            accent="#67E8F9"
            cell={26}
            colors={["#A78BFA", "#C4B5FD", "#7C3AED"]}
            cols={9}
            n={26}
            rows={7}
            seed={167}
            style={{ bottom: -20, opacity: 0.9, right: -30 }}
          />
          <div className="ctaIn">
            <h2>
              {renderLineBreakText(
                t("cta.h", "More AI, less cost —<br>on every official model"),
              )}
            </h2>
            <p>
              {t(
                "cta.sub",
                "Whether you ship an agent today or route billions of tokens a month — one key, a signed SLA, and prices that drop as you grow.",
              )}
            </p>
            <div className="ctaBtns">
              <Link className="btn white big" href={authActionHref}>
                {finalCtaLabel}
              </Link>
              <Link
                className="btn black big"
                href={localizePath("/contact", props.locale)}
              >
                {t("cta.b2", "Contact Sales")}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </OnlineStaticShell>
  );
}
