"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type MouseEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  FileText,
  ImageIcon,
  KeyRound,
  Layers3,
  Minus,
  Music2,
  Play,
  Plus,
  Settings2,
  ShieldCheck,
  Sparkles,
  Timer,
  Trash2,
  Upload,
  Video,
  WandSparkles,
  Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { DailyHealthBars } from "@/components/home-health-bars";
import { HomeModelLogo } from "@/components/home-model-logo";
import {
  fetchHealthSummary,
  fetchModelTrend,
  formatCallCount,
  formatLatencyMs,
  formatSuccessRate,
  formatThroughput,
  TOKEN_DISPLAY_SCALE,
  trendAvgTtftMs,
  type HomePerfSummary,
  type HomeTrendPoint,
} from "@/lib/home-live";
import { SiteShell } from "@/components/site-shell";
import { localizePath, type Locale } from "@/lib/locales";
import {
  modelLandingCopy,
  getModelLandingConfigs,
  normalizeModelId,
  type ModelConfig,
  type ModelGeneratorField,
  type ModelLandingKey,
} from "@/lib/model-landing";
import { consoleUrl } from "@/lib/origins";
import {
  formatGroupRequestPrice,
  formatGroupTokenPrice,
  formatModelPrice,
  discountedPriceUsd,
  formatUsdPrice,
  getAvailableGroups,
  getBestGroupRatio,
  getModelFamilyKey,
  getOfficialPriceUsd,
  isTokenBasedModel,
  resolveModelDisplayPrice,
  type PricingModel,
} from "@/lib/pricing";
import type { RankedModel, RankingsData } from "@/lib/rankings-live";
import { buildModelSchema, stringifyJsonLd } from "@/lib/schema";

type Props = {
  config: ModelConfig;
  locale: Locale;
  liveModels?: PricingModel[];
  allModels?: PricingModel[];
  groupRatio?: Record<string, number>;
  rankings?: RankingsData | null;
};

type GtagWindow = Window & {
  gtag?: (...args: unknown[]) => void;
};

type DraftValue = Record<string, unknown>;

type MediaExample = {
  poster: string;
  video?: string;
};

type ReferenceImageDraft = {
  id: string;
  name: string;
  size: number;
  type: string;
  previewUrl: string;
};

type RelatedModelCard = {
  href: string;
  name: string;
  vendor: string;
  kind: string;
  price: string;
  sameProvider: boolean;
};

type CatalogRelatedModel = {
  href: string;
  name: string;
  description: string;
  sameProvider: boolean;
};

type FlatkeyPriceTableRow = {
  label: string;
  flatkey: string;
  official: string;
  flatkeyPercent: number;
  officialPercent: number;
};

const MEDIA_EXAMPLES: Record<"image" | "video" | "audio", readonly MediaExample[]> = {
  image: [
    { poster: "/assets/prompts/awesome-images/gpt-image-2-showcase-complex.png" },
    { poster: "/assets/prompts/awesome-images/ecommerce-skincare.png" },
    { poster: "/assets/prompts/awesome-images/ugc-coffee-ad.png" },
  ],
  video: [
    { poster: "/assets/video/v1.1.jpg", video: "/assets/video/v1.1.mp4" },
    { poster: "/assets/video/v1.2.jpg", video: "/assets/video/v1.2.mp4" },
    { poster: "/assets/video/v1.3.jpg", video: "/assets/video/v1.3.mp4" },
  ],
  audio: [
    { poster: "/assets/prompts/awesome-images/ai-agent-poster.png" },
    { poster: "/assets/prompts/awesome-images/liquid-bento.png" },
    { poster: "/assets/prompts/awesome-images/campaign-hero.png" },
  ],
} as const;

export function ModelLandingPage({ config, locale, liveModels = [], allModels = [], groupRatio = {}, rankings = null }: Props) {
  const [prompt, setPrompt] = useState(config.examplePrompt);
  const [fieldValues, setFieldValues] = useState<Record<string, string | number | boolean>>(() =>
    buildInitialGeneratorValues(config)
  );
  const [referenceImages, setReferenceImages] = useState<ReferenceImageDraft[]>([]);
  const generator = config.generator;
  const mediaKind = generator?.kind ?? "text";
  const t = (key: string, vars?: Record<string, string>) => modelLandingCopy(locale, key as ModelLandingKey, vars);
  const primaryLiveModel =
    liveModels.find((model) => normalizeModelId(model.model_name) === normalizeModelId(config.modelId)) ??
    liveModels[0] ??
    null;

  useEffect(() => {
    (window as GtagWindow).gtag?.("event", "flatkey_model_page_view", {
      model: config.slug,
      lng: locale,
    });
  }, [config.slug, locale]);

  const buildDraft = (): DraftValue => ({
    source: "model_landing",
    model: config.modelId,
    slug: config.slug,
    mediaKind,
    endpoint: generator?.endpoint ?? "/v1/chat/completions",
    storageKey: generator?.storageKey ?? "flatkey:model-generator-draft",
    prompt,
    fields: fieldValues,
    referenceImages: referenceImages.map(({ name, size, type }) => ({ name, size, type })),
    request: buildGeneratorRequest(config, prompt, fieldValues, referenceImages),
    locale,
    savedAt: new Date().toISOString(),
  });

  const onRunClick = (event: MouseEvent<HTMLAnchorElement>) => {
    (window as GtagWindow).gtag?.("event", "flatkey_sign_in_to_run_click", {
      model: config.slug,
      media_kind: mediaKind,
    });
    const draft = buildDraft();
    window.localStorage.setItem(generator?.storageKey ?? "flatkey:model-generator-draft", JSON.stringify(draft));
    event.currentTarget.href = withCurrentSearch(buildRunHref(config, locale, prompt, draft));
  };

  return (
    <FlatkeyModelDetailPage
      config={config}
      locale={locale}
      prompt={prompt}
      fieldValues={fieldValues}
      referenceImages={referenceImages}
      onPromptChange={setPrompt}
      onFieldChange={(name, value) => setFieldValues((current) => ({ ...current, [name]: value }))}
      onReferenceImagesChange={setReferenceImages}
      onRunClick={onRunClick}
      primaryLiveModel={primaryLiveModel}
      liveModels={liveModels}
      allModels={allModels}
      groupRatio={groupRatio}
      rankings={rankings}
      t={t}
    />
  );
}

function FlatkeyModelDetailPage(props: {
  config: ModelConfig;
  locale: Locale;
  prompt: string;
  fieldValues: Record<string, string | number | boolean>;
  referenceImages: ReferenceImageDraft[];
  onPromptChange: (prompt: string) => void;
  onFieldChange: (name: string, value: string | number | boolean) => void;
  onReferenceImagesChange: (images: ReferenceImageDraft[]) => void;
  onRunClick: (event: MouseEvent<HTMLAnchorElement>) => void;
  primaryLiveModel: PricingModel | null;
  liveModels: PricingModel[];
  allModels: PricingModel[];
  groupRatio: Record<string, number>;
  rankings: RankingsData | null;
  t: (key: string, vars?: Record<string, string>) => string;
}) {
  const runHref = buildRunHref(props.config, props.locale, props.prompt, {
    model: props.config.modelId,
    prompt: props.prompt,
    fields: props.fieldValues,
  });
  const model = props.primaryLiveModel;
  const providerName = model?.vendor_name ?? props.config.officialName;
  const relatedModels = buildCatalogRelatedModels(props.config, props.locale, props.allModels, props.groupRatio, props.t);
  const providerRows = buildCatalogProviderRows(props.config, props.liveModels, providerName);
  const priceRows = buildFlatkeyPriceRows(props.config, model, props.groupRatio, props.t);
  const modalityLabels = buildModalityLabels(props.config, model, props.t);
  const generator = props.config.generator;
  const examples = generator ? MEDIA_EXAMPLES[generator.kind] : [];
  const releasedAt = formatModelDate(model?.availability_detected_at ?? model?.availability_checked_at);
  const contextValue = inferContextValue(model);
  const modelDescription = buildModelDescription(props.config, model, props.t);
  const faqItems = buildModelFaq(props.config, props.t);
  const schema = buildModelSchema({
    locale: props.locale,
    modelName: props.config.displayName,
    vendorName: providerName,
    description: modelDescription,
    inputPriceUsd: model
      ? discountedPriceUsd(getOfficialPriceUsd(model) * getBestGroupRatio(model, props.groupRatio))
      : parsePrice(priceRows.rows[0]?.flatkey ?? `${props.config.flatkeyPrice} ${props.t(props.config.priceUnit)}`) ?? Number.NaN,
    pagePath: localizePath(`/models/${props.config.slug}`, props.locale),
    faq: faqItems.map((item) => ({ q: item.question, a: item.answer })),
  });
  const rankingRow = findRankingRow(props.rankings?.models ?? [], props.config.modelId);

  const [health, setHealth] = useState<{
    model: string;
    trend: HomeTrendPoint[];
    summary?: HomePerfSummary;
  }>({ model: "", trend: [] });

  useEffect(() => {
    let cancelled = false;
    const modelName = props.config.modelId;
    Promise.all([fetchModelTrend(modelName), fetchHealthSummary(undefined, modelName)]).then(([trend, summaries]) => {
      if (cancelled) return;
      const normalized = normalizeModelId(modelName);
      const summary =
        summaries[modelName] ??
        Object.values(summaries).find((row) => normalizeModelId(row.model_name) === normalized);
      setHealth({ model: modelName, trend, summary });
    });
    return () => {
      cancelled = true;
    };
  }, [props.config.modelId]);

  const healthReady = health.model === props.config.modelId;
  const trend = healthReady ? health.trend : [];
  const summary = healthReady ? health.summary : undefined;
  const trendSuccess = averageFinite(trend.map((point) => point.success_rate));
  const successRate = summary?.success_rate ?? trendSuccess;
  const ttft = summary?.avg_ttft_ms ?? trendAvgTtftMs(trend);
  const heroPrice = priceRows.rows[0]?.flatkey ?? (model ? "—" : `${props.config.flatkeyPrice} ${props.t(props.config.priceUnit)}`);
  const endpointLabel = props.config.generator?.endpoint ?? model?.supported_endpoint_types?.[0] ?? "/v1/chat/completions";
  const dashboardHref = consoleUrl("/dashboard");

  return (
    <SiteShell locale={props.locale} pathname={`/models/${props.config.slug}`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: stringifyJsonLd(schema) }} />
      <main className="home-landing relative overflow-x-hidden bg-[linear-gradient(180deg,#f4f0ff_0%,#fbfaff_28%,#ffffff_58%,#f4f1ff_100%)] text-[#0B0B0F] dark:bg-[linear-gradient(180deg,#050712_0%,#080b18_36%,#070712_72%,#03040b_100%)] dark:text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-0 bg-[linear-gradient(to_right,rgba(124,58,237,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(124,58,237,0.08)_1px,transparent_1px)] bg-[size:4.5rem_4.5rem] opacity-70 dark:bg-[linear-gradient(to_right,rgba(148,163,184,0.055)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.045)_1px,transparent_1px)] dark:opacity-45"
        />

        <section className="relative z-10 px-6 pt-20 pb-12 md:pt-28 md:pb-16">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
              <ModelLandingBreadcrumb
                locale={props.locale}
                modelName={props.config.modelId}
                t={props.t}
                className="text-[13px]"
              />
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={localizePath("/models", props.locale)}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-violet-500/20 bg-white/65 px-4 text-sm font-medium hover:border-violet-500/35 hover:bg-violet-500/10"
                >
                  <ArrowLeft className="size-4" />
                  {props.t("Back to Models")}
                </a>
                <a
                  href={dashboardHref}
                  className="flatkey-hero-cta inline-flex h-10 items-center gap-2 px-4 text-sm font-medium shadow-[0_16px_34px_-18px_rgba(124,58,237,0.85)]"
                  style={{ borderRadius: "0.5rem" }}
                >
                  <KeyRound className="size-4" />
                  {props.t("Get API Key")}
                </a>
              </div>
            </div>

            <div className="grid items-start gap-8 lg:grid-cols-12">
              <div className="min-w-0 lg:col-span-7">
                <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1.5 text-[11px] font-medium text-violet-700 shadow-[0_12px_34px_-22px_rgba(124,58,237,0.75)]">
                  <span className="relative flex size-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-violet-500" />
                  </span>
                  <span>{model ? props.t("Live catalog model") : props.t("Catalog data unavailable")}</span>
                </div>

                <div className="mb-4 flex items-start gap-3">
                  <HomeModelLogo
                    iconKey={model?.icon ?? model?.vendor_icon}
                    modelName={props.config.modelId}
                    vendor={providerName}
                    fallback={props.config.modelId.slice(0, 1)}
                    surfaceSize={48}
                    imageSize={30}
                  />
                  <div className="min-w-0">
                    <h1 className="text-[clamp(2.15rem,4.2vw,3.25rem)] leading-[1.08] font-bold tracking-tight">
                      {providerName}: {props.config.displayName}
                    </h1>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[#5f6368] dark:text-white/62">
                      <Link href={localizePath(`/models/${props.config.slug}`, props.locale)} className="font-mono text-[#3f3f46] underline underline-offset-4 dark:text-white/78">
                        {props.config.modelId}
                      </Link>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard?.writeText(props.config.modelId).catch(() => undefined)}
                        className="grid size-7 place-items-center rounded-lg border border-violet-500/16 bg-white/70 text-[#6b7280] hover:text-[#111827]"
                        aria-label={props.t("Copy model id")}
                      >
                        <Copy className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                <p className="text-muted-foreground/80 max-w-2xl text-base leading-relaxed md:text-[15px]">
                  {modelDescription}
                </p>

                <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <FlatkeyHeroMetric label={props.t("Modalities")} value={modalityLabels.join(" · ")} />
                  <FlatkeyHeroMetric label={props.t("API")} value={endpointLabel} />
                  <FlatkeyHeroMetric label={props.t("Context")} value={contextValue} />
                  <FlatkeyHeroMetric label={props.t("Released")} value={releasedAt} />
                </div>
              </div>

              <aside className="min-w-0 rounded-2xl border border-violet-500/16 bg-white/72 p-5 shadow-[0_24px_70px_-52px_rgba(91,33,182,0.78)] backdrop-blur-sm lg:col-span-5 dark:bg-white/[0.04]">
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-muted-foreground mb-2 text-xs font-medium tracking-widest uppercase">{props.t("Model price comparison")}</p>
                    <h2 className="text-2xl font-bold tracking-tight">{heroPrice}</h2>
                  </div>
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                    {props.t("After bonus")}
                  </span>
                </div>
                <div className="grid gap-3">
                  {priceRows.rows.length > 0 ? priceRows.rows.map((row) => (
                    <FlatkeyPriceRow key={row.label} row={row} officialLabel={props.t("Reference price")} flatkeyLabel={props.t("Flatkey price")} />
                  )) : (
                    <div className="rounded-xl border border-violet-500/12 bg-white/62 p-4 text-sm text-muted-foreground">
                      {props.t("Pricing data unavailable")}
                    </div>
                  )}
                </div>
                <p className="mt-4 text-xs leading-5 text-muted-foreground">
                  {priceRows.note}
                </p>
              </aside>
            </div>
          </div>
        </section>

        {generator ? (
          <section id="workbench" className="relative z-10 scroll-mt-24 border-y border-violet-500/10 bg-white/60 px-6 py-16 backdrop-blur-sm dark:bg-white/[0.02]">
            <div className="mx-auto max-w-7xl">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <FlatkeySectionHeading
                  eyebrow={props.t("Generator setup")}
                  title={props.t("Playground (edit before sign-up)")}
                  description={props.t("Edit the prompt and settings here. We save the draft locally, then open Flatkey so you can run it after signup.")}
                />
                <a
                  href={runHref}
                  onClick={props.onRunClick}
                  className="flatkey-hero-cta inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold shadow-[0_16px_34px_-18px_rgba(124,58,237,0.85)] sm:w-auto"
                >
                  <Play className="size-4 fill-current" />
                  {props.t("Open in Playground")}
                </a>
              </div>
              <div className="mt-8 grid overflow-hidden rounded-2xl border border-violet-500/16 bg-white/78 shadow-[0_24px_70px_-52px_rgba(91,33,182,0.78)] backdrop-blur-sm lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)] dark:bg-white/[0.04]">
                <div className="min-w-0 border-b border-violet-500/12 p-4 sm:p-5 lg:border-r lg:border-b-0 xl:p-6">
                  <PanelHeader title={props.t("Input")} right={props.t("Form")} />
                  <MediaPromptEditor
                    generator={generator}
                    modelId={props.config.modelId}
                    prompt={props.prompt}
                    fieldValues={props.fieldValues}
                    referenceImages={props.referenceImages}
                    onPromptChange={props.onPromptChange}
                    onFieldChange={props.onFieldChange}
                    onReferenceImagesChange={props.onReferenceImagesChange}
                    t={props.t}
                  />
                  <a
                    href={runHref}
                    onClick={props.onRunClick}
                    className="flatkey-hero-cta mt-5 flex min-h-12 flex-wrap items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow-[0_18px_42px_-24px_rgba(124,58,237,.85)] sm:text-base"
                  >
                    <WandSparkles className="size-4" />
                    {props.t("Start generating")}
                    <span className="text-white/70">·</span>
                    <span className="text-sm text-white/85">{props.t("Join and run")}</span>
                  </a>
                </div>

                <div className="min-w-0 p-4 sm:p-5 xl:p-6">
                  <PanelHeader title={props.t("Output")} right={props.t("Preview")} />
                  <OutputPreview
                    modelName={props.config.displayName}
                    prompt={props.prompt}
                    kind={generator.kind}
                    images={examples}
                    t={props.t}
                  />
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <a
                      href={runHref}
                      onClick={props.onRunClick}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-violet-500/16 bg-white/70 px-4 text-sm font-semibold hover:border-violet-500/32 hover:bg-violet-500/8"
                    >
                      <Play className="size-4" />
                      {props.t("Open in Playground")}
                    </a>
                    <a
                      href={runHref}
                      onClick={props.onRunClick}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-violet-500/16 bg-white/70 px-4 text-sm font-semibold hover:border-violet-500/32 hover:bg-violet-500/8"
                    >
                      <KeyRound className="size-4" />
                      {props.t("Get API Key")}
                    </a>
                  </div>
                </div>
              </div>
              <RequestPreview
                config={props.config}
                prompt={props.prompt}
                fieldValues={props.fieldValues}
                referenceImages={props.referenceImages}
                t={props.t}
              />
            </div>
          </section>
        ) : null}

        <section id="health" className="relative z-10 border-y border-violet-500/10 bg-white/60 px-6 py-16 backdrop-blur-sm dark:bg-white/[0.02]">
          <div className="mx-auto max-w-7xl">
            <FlatkeySectionHeading
              eyebrow={props.t("Live model health")}
              title={props.t("30-day health, measured on real traffic")}
              description={props.t("Performance uses Flatkey request telemetry from the last 30 days when enough traffic is available.")}
            />
            <div className="mt-8 grid gap-4 md:grid-cols-4">
              <FlatkeyMetricCard label={props.t("Avg. provider uptime")} value={formatSuccessRate(successRate)} />
              <FlatkeyMetricCard label={props.t("Latency")} value={formatLatencyMs(ttft)} />
              <FlatkeyMetricCard label={props.t("Requests")} value={formatCallCount(summary?.request_count)} />
              <FlatkeyMetricCard label={props.t("Throughput")} value={formatThroughput(summary?.avg_tps)} />
            </div>
            <div className="mt-5 rounded-2xl border border-violet-500/16 bg-white/72 p-5 shadow-[0_24px_70px_-52px_rgba(91,33,182,0.78)] backdrop-blur-sm dark:bg-white/[0.04]">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-semibold">{props.t("Successful inference trend")}</div>
                {rankingRow ? (
                  <div className="rounded-full bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-700">
                    #{rankingRow.rank} · {formatCallCount(displayRankingTokens(rankingRow.total_tokens))}
                  </div>
                ) : null}
              </div>
              <div className="h-24">
                {trend.length > 0 ? (
                  <DailyHealthBars points={trend} label={props.t("Uptime")} heightPx={96} />
                ) : (
                  <div className="flex h-full items-center justify-center rounded-xl bg-violet-500/5 text-sm text-muted-foreground">
                    {props.t("Not enough data yet")}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section id="providers" className="relative z-10 px-6 py-16">
          <div className="mx-auto max-w-7xl">
            <FlatkeySectionHeading
              eyebrow={props.t("Model catalog")}
              title={props.t("Available catalog entries")}
              description={props.t("Flatkey routes your request to available upstream channels for this model and keeps billing under one account.")}
            />
            <div className="mt-8 overflow-x-auto rounded-2xl border border-violet-500/16 bg-white/72 shadow-[0_24px_70px_-52px_rgba(91,33,182,0.78)] backdrop-blur-sm dark:bg-white/[0.04]">
              <table className="w-full min-w-[680px] border-collapse text-sm">
                <thead>
                  <tr className="text-muted-foreground/80 border-b border-violet-500/12 text-left text-[11px] font-bold tracking-[0.1em] uppercase">
                    <th className="px-5 py-3.5">{props.t("Provider")}</th>
                    <th className="px-5 py-3.5">{props.t("Model ID")}</th>
                    <th className="px-5 py-3.5">{props.t("API")}</th>
                    <th className="px-5 py-3.5">{props.t("Status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {providerRows.map((row) => (
                    <tr key={`${row.provider}-${row.modelId}`} className="border-b border-violet-500/8 last:border-b-0">
                      <td className="px-5 py-4 font-medium">{row.provider}</td>
                      <td className="px-5 py-4 font-mono text-[13px]">{row.modelId}</td>
                      <td className="px-5 py-4 text-muted-foreground">{row.endpoint}</td>
                      <td className="px-5 py-4">
                        <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-700">
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="related" className="relative z-10 border-y border-violet-500/10 bg-white px-6 py-16 dark:bg-white/[0.02]">
          <div className="mx-auto max-w-7xl">
            <FlatkeySectionHeading
              eyebrow={props.t("Related models")}
              title={relatedModels.title}
              description={props.t("Related models from the pricing catalog.")}
            />
            <div className="mt-8 flex gap-3 overflow-x-auto pb-2">
              {relatedModels.models.map((related) => (
                <Link
                  key={related.href}
                  href={related.href}
                  className="group grid min-h-[150px] min-w-[260px] rounded-2xl border border-violet-500/16 bg-white p-4 shadow-none transition-colors hover:border-violet-500/28 dark:bg-white/[0.04]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <HomeModelLogo
                      modelName={related.name}
                      vendor={related.description}
                      fallback={related.name.charAt(0)}
                      surfaceSize={34}
                      imageSize={22}
                    />
                    <ArrowRight className="size-4 text-violet-600 transition-transform group-hover:translate-x-0.5" />
                  </div>
                  <div className="mt-4 min-w-0">
                    <h3 className="truncate font-mono text-sm font-semibold">{related.name}</h3>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{related.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="relative z-10 px-6 py-16">
          <div className="mx-auto max-w-7xl">
            <FlatkeySectionHeading
              eyebrow="FAQ"
              title={props.t("Frequently asked questions")}
              description={props.t("Use the pricing section above for current Flatkey prices from our pricing API.")}
            />
            <div className="mt-6 divide-y divide-violet-500/12 rounded-2xl border border-violet-500/16 bg-white/72 px-5 shadow-[0_24px_70px_-52px_rgba(91,33,182,0.78)] backdrop-blur-sm dark:bg-white/[0.04]">
              {faqItems.map((item) => (
                <details key={item.question} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold">
                    {item.question}
                    <ChevronRight className="size-4 text-violet-600 transition group-open:rotate-90" />
                  </summary>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
    </SiteShell>
  );
}

function MediaModelLanding(props: {
  config: ModelConfig;
  locale: Locale;
  prompt: string;
  fieldValues: Record<string, string | number | boolean>;
  referenceImages: ReferenceImageDraft[];
  onPromptChange: (prompt: string) => void;
  onFieldChange: (name: string, value: string | number | boolean) => void;
  onReferenceImagesChange: (images: ReferenceImageDraft[]) => void;
  onRunClick: (event: MouseEvent<HTMLAnchorElement>) => void;
  primaryLiveModel: PricingModel | null;
  t: (key: string, vars?: Record<string, string>) => string;
}) {
  const generator = props.config.generator!;
  const examples = MEDIA_EXAMPLES[generator.kind];
  const runHref = buildRunHref(props.config, props.locale, props.prompt, {
    model: props.config.modelId,
    prompt: props.prompt,
    fields: props.fieldValues,
  });
  const Icon = generator.kind === "video" ? Video : generator.kind === "audio" ? Music2 : ImageIcon;
  const pricingRows = buildMediaPricingRows(props.config);
  const relatedModels = buildRelatedModelCards(props.config, props.locale, props.t);
  const relatedModelsTitle = buildRelatedModelsTitle(props.config, relatedModels, props.t);

  return (
    <SiteShell locale={props.locale} pathname={`/models/${props.config.slug}`}>
      <div className="model-square-page bg-[linear-gradient(180deg,#f4f0ff_0%,#fbfaff_32%,#ffffff_62%,#f4f1ff_100%)] text-[#0B0B0F] dark:bg-[linear-gradient(180deg,#050712_0%,#080b18_36%,#070712_72%,#03040b_100%)] dark:text-white">
        <div className="px-6 pt-10 pb-8 sm:px-8 lg:px-10 lg:pt-14">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <ModelLandingBreadcrumb
              locale={props.locale}
              modelName={props.config.displayName}
              t={props.t}
            />
            <ModelLandingActions
              locale={props.locale}
              runHref={runHref}
              onRunClick={props.onRunClick}
              t={props.t}
            />
          </div>

          <section className="grid gap-6 pb-5">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <span className="grid size-8 place-items-center rounded-full bg-[#f4f0ff] text-[#7c3aed]">
                  <Icon className="size-4" />
                </span>
                <h1 className="text-[clamp(2.25rem,5vw,3.7rem)] leading-none font-extrabold tracking-tight">
                  {props.config.displayName}
                </h1>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(props.config.modelId).catch(() => undefined)}
                  className="rounded-full border border-[#0B0B0F14] bg-white p-1.5 text-[#706a74] hover:border-[#7c3aed]/35 hover:text-[#4c1d95]"
                  aria-label={props.t("Copy model id")}
                >
                  <Copy className="size-3.5" />
                </button>
              </div>
              <div className="mb-4 inline-flex rounded-full border border-[#ded6f4] bg-[#f4f0ff] px-3.5 py-1.5 text-[13px] font-extrabold text-[#4c1d95]">
                {props.t("Flatkey Router")}
              </div>
              <p className="max-w-3xl text-[17px] leading-8 text-[#43434c]">
                {props.t("Configure a {{model}} request on the public page. Flatkey saves the draft locally, then opens the console so you can run it with your account and API key.", {
                  model: props.config.displayName,
                })}
              </p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <Pill label={props.t("Model Type")} value={generator.kind === "video" ? props.t("Text to Video") : generator.kind === "audio" ? props.t("Audio") : props.t("Image to Image")} />
                <Pill label={props.t("API")} value={generator.endpoint} />
                <Pill label={props.t("Pricing")} value={`${props.config.flatkeyPrice} ${props.t(props.config.priceUnit)}`} />
              </div>
            </div>
          </section>

        </div>

        <section id="playground" className="border-y border-[#0B0B0F14] bg-[#f8f6fc] py-8">
          <div className="px-6 sm:px-8 lg:px-10">
            <div className="grid overflow-hidden rounded-2xl border border-[#0B0B0F14] bg-white shadow-[0_24px_70px_-46px_rgba(46,16,101,.26)] lg:grid-cols-[minmax(0,0.9fr)_minmax(390px,1.1fr)] xl:grid-cols-[minmax(0,0.86fr)_minmax(430px,1.14fr)]">
              <div className="min-w-0 border-b border-[#0B0B0F14] p-4 sm:p-5 lg:border-r lg:border-b-0 xl:p-6">
                <PanelHeader title={props.t("Input")} right={props.t("Form")} />
                <MediaPromptEditor
                  generator={generator}
                  modelId={props.config.modelId}
                  prompt={props.prompt}
                  fieldValues={props.fieldValues}
                  referenceImages={props.referenceImages}
                  onPromptChange={props.onPromptChange}
                  onFieldChange={props.onFieldChange}
                  onReferenceImagesChange={props.onReferenceImagesChange}
                  t={props.t}
                />
                <a
                  href={runHref}
                  onClick={props.onRunClick}
                  className="mt-5 flex h-12 items-center justify-center gap-2 rounded-full bg-[#070707] text-base font-extrabold !text-white shadow-[0_18px_42px_-24px_rgba(11,11,15,.46)] hover:bg-[#1a1a1d]"
                  style={{ color: "#fff" }}
                >
                  <WandSparkles className="size-4" />
                  {props.t("Start generating")}
                  <span className="text-white/75">·</span>
                  <span className="text-sm font-semibold text-white/85">{props.t("Join and run")}</span>
                </a>
              </div>

              <div className="min-w-0 p-4 sm:p-5 xl:p-6">
                <PanelHeader title={props.t("Output")} right={props.t("Preview")} />
                <OutputPreview
                  modelName={props.config.displayName}
                  prompt={props.prompt}
                  kind={generator.kind}
                  images={examples}
                  t={props.t}
                />
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <a
                    href={localizePath("/docs", props.locale)}
                    className="rounded-full border border-[#0B0B0F14] px-4 py-2.5 text-center text-sm font-bold hover:border-[#7c3aed]/35 hover:text-[#4c1d95]"
                  >
                    {props.t("View API Docs")}
                  </a>
                  <a
                    href={runHref}
                    onClick={props.onRunClick}
                    className="rounded-full border border-[#0B0B0F14] px-4 py-2.5 text-center text-sm font-bold hover:border-[#7c3aed]/35 hover:text-[#4c1d95]"
                  >
                    {props.t("Get API Key")}
                  </a>
                </div>
              </div>
            </div>
            <RequestPreview
              config={props.config}
              prompt={props.prompt}
              fieldValues={props.fieldValues}
              referenceImages={props.referenceImages}
              t={props.t}
            />
          </div>
        </section>

        <section id="examples" className="px-6 py-12 sm:px-8 lg:px-10">
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard value="2M+" label={props.t(generator.kind === "video" ? "Videos generated" : "Images generated")} />
            <StatCard value="8s" label={props.t("Avg. response time")} />
            <StatCard value="99.9%" label={props.t("Uptime")} />
            <StatCard value="API" label={props.t("Ready for production")} />
          </div>

          <div className="mt-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-xs font-extrabold tracking-[0.16em] text-[#7c3aed] uppercase">
                {props.t("Generated Examples")}
              </div>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight">
                {props.t("Explore what {{model}} can create", { model: props.config.displayName })}
              </h2>
            </div>
            <a href={runHref} onClick={props.onRunClick} className="inline-flex items-center gap-2 text-base font-bold">
              {props.t("Create with this model")}
              <ArrowRight className="size-4" />
            </a>
          </div>
          <div className="mt-5">
            <GeneratedExamplesCarousel
              examples={examples}
              kind={generator.kind}
              modelName={props.config.displayName}
              t={props.t}
            />
          </div>
          <RelatedModelsCarousel
            models={relatedModels}
            title={relatedModelsTitle}
            t={props.t}
          />
        </section>

        <section className="border-y border-[#0B0B0F0D] bg-[#f8f6fc] py-12">
          <div className="px-6 sm:px-8 lg:px-10">
            <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-xs font-extrabold tracking-[0.16em] text-[#7c3aed] uppercase">
                  {props.t("Transparent Pricing")}
                </div>
                <h2 className="mt-2 text-3xl font-extrabold tracking-tight">
                  {props.t("Flatkey {{model}} usage pricing", { model: props.config.displayName })}
                </h2>
                <p className="mt-2 max-w-2xl text-base leading-7 text-[#706a74]">
                  {props.t("Use the same Flatkey balance and API key across image, video, audio, and text models.")}
                </p>
              </div>
              <a
                href={runHref}
                onClick={props.onRunClick}
                className="inline-flex h-11 items-center rounded-full bg-[#070707] px-5 text-sm font-extrabold !text-white hover:bg-[#1a1a1d]"
                style={{ color: "#fff" }}
              >
                {props.t("Open wallet")}
              </a>
            </div>
            <div className="overflow-hidden rounded-2xl border border-[#0B0B0F14] bg-white">
              <div className="hidden grid-cols-[1fr_1fr_0.75fr_1fr] gap-5 border-b border-[#0B0B0F14] px-6 py-4 text-xs font-extrabold tracking-[0.14em] text-[#706a74] uppercase md:grid">
                <span>{props.t("Model Type")}</span>
                <span>{props.t("Flatkey price")}</span>
                <span className="text-center">{props.t("Pricing vs official")}</span>
                <span>{props.t("Reference price")}</span>
              </div>
              {pricingRows.map((row) => (
                <div key={row.spec} className="grid gap-4 border-b border-[#0B0B0F0D] px-5 py-5 text-base last:border-b-0 md:grid-cols-[1fr_1fr_0.75fr_1fr] md:items-center md:px-6">
                  <div className="flex items-center gap-2 font-extrabold">
                    <span className="size-2 rounded-full bg-[#7c3aed]" />
                    {row.spec}
                  </div>
                  <PriceBox label={props.t("Flatkey price")} value={row.flatkey} />
                  <div className="text-sm font-extrabold text-emerald-600 md:text-center">
                    <span className="block text-lg leading-none">{formatSavings(row.flatkey, row.official)}</span>
                    <span className="mt-1 block text-[10px] tracking-[0.14em] text-emerald-600/70 uppercase">vs {props.config.officialName}</span>
                  </div>
                  <PriceBox label={props.t("Reference price")} value={row.official} muted />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 py-12 sm:px-8 lg:px-10">
          <div className="text-xs font-extrabold tracking-[0.16em] text-[#7c3aed] uppercase">
            {props.t("Why Flatkey")}
          </div>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight">
            {props.t("Why use Flatkey for {{model}}?", { model: props.config.displayName })}
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <ReasonCard icon={<Zap className="size-5" />} title={props.t("Lower generation pricing")} body={props.t("Route media workloads through Flatkey and keep prompt tests cheaper before scaling.")} />
            <ReasonCard icon={<Sparkles className="size-5" />} title={props.t("Draft handoff")} body={props.t("The public page stores prompt settings locally before sending the user into Flatkey.")} />
            <ReasonCard icon={<Code2 className="size-5" />} title={props.t("Unified API access")} body={props.t("Use one account and API key across image, video, audio, and language models.")} />
          </div>
        </section>

        <section className="grid gap-5 px-6 pb-12 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:px-10">
          <div className="rounded-2xl border border-[#0B0B0F14] bg-white p-7 shadow-sm xl:p-8">
            <div className="mb-5 grid size-10 place-items-center rounded-full bg-[#f4f0ff] text-[#7c3aed]">
              <Code2 className="size-5" />
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight">{props.t("Start generating in three steps")}</h2>
            <ol className="mt-5 grid gap-4">
              {[
                [props.t("Try a prompt"), props.t("Use the playground to validate quality and style fit.")],
                [props.t("Create an API key"), props.t("Sign up, open Dashboard, and create a token for this model.")],
                [props.t("Ship your workflow"), props.t("Call the same endpoint, then top up credits as usage grows.")],
              ].map(([title, body], index) => (
                <li key={title} className="grid grid-cols-[auto_1fr] gap-3">
                  <span className="grid size-7 place-items-center rounded-full bg-[#070707] text-sm font-extrabold text-white">{index + 1}</span>
                  <span>
                    <b className="block text-sm">{title}</b>
                    <span className="text-sm leading-6 text-[#706a74]">{body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-2xl bg-[#0d0d10] p-7 text-white shadow-[0_24px_80px_-60px_rgba(0,0,0,.9)] xl:p-8">
            <div className="mb-5 grid size-10 place-items-center rounded-full bg-white/10">
              <ImageIcon className="size-5" />
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight">{props.t("Built for generation teams")}</h2>
            <div className="mt-5 grid gap-3">
              {[
                [props.t("Ads and social creative"), props.t("Produce campaign concepts, thumbnails, posters, and localized variants.")],
                [props.t("Product visuals"), props.t("Generate product-style shots, merchandising scenes, and reference-guided variations.")],
                [props.t("Developer pipelines"), props.t("Add async generation for agents, CMS tools, and batch creative systems.")],
              ].map(([title, body]) => (
                <div key={title} className="rounded-xl bg-white/8 p-4">
                  <b className="text-sm">{title}</b>
                  <p className="mt-1 text-sm leading-6 text-white/68">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-5 px-6 pb-12 sm:px-8 lg:grid-cols-[1.3fr_0.8fr] lg:px-10">
          <div>
            <div className="text-xs font-extrabold tracking-[0.16em] text-[#7c3aed] uppercase">FAQ</div>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight">
              {props.t("{{model}} pricing FAQ", { model: props.config.displayName })}
            </h2>
            <div className="mt-5 grid gap-3">
              {props.config.faq.map((item) => (
                <details key={item.question} className="rounded-xl border border-[#0B0B0F14] bg-white px-4 py-3 text-sm">
                  <summary className="cursor-pointer font-extrabold">{props.t(item.question)}</summary>
                  <p className="mt-2 leading-6 text-[#706a74]">{props.t(item.answer)}</p>
                </details>
              ))}
            </div>
          </div>
          <div className="self-start rounded-2xl bg-[#0d0d10] p-6 text-white shadow-[0_24px_80px_-54px_rgba(0,0,0,.9)]">
            <div className="mb-4 text-sm font-bold text-white/55">{props.config.displayName} API</div>
            <h3 className="text-2xl font-extrabold tracking-tight">
              {props.t("Generate your first {{model}} on Flatkey", { model: props.config.displayName })}
            </h3>
            <p className="mt-3 text-sm leading-6 text-white/62">
              {props.t("Save the draft, continue to signup if needed, or open the console directly when already logged in.")}
            </p>
            <a
              href={runHref}
              onClick={props.onRunClick}
              className="mt-5 flex h-11 items-center justify-center rounded-xl bg-white text-sm font-extrabold !text-[#4c1d95] hover:bg-[#f4f0ff]"
              style={{ color: "#4c1d95" }}
            >
              {props.t("Start generating")}
            </a>
          </div>
        </section>
      </div>
    </SiteShell>
  );
}

function TextModelGuide(props: {
  config: ModelConfig;
  locale: Locale;
  prompt: string;
  onRunClick: (event: MouseEvent<HTMLAnchorElement>) => void;
  primaryLiveModel: PricingModel | null;
  t: (key: string, vars?: Record<string, string>) => string;
}) {
  const runHref = buildRunHref(props.config, props.locale, props.prompt, {
    model: props.config.modelId,
    prompt: props.prompt,
  });
  const updated = new Date().toISOString().slice(0, 10);
  const price =
    props.primaryLiveModel && isTokenBasedModel(props.primaryLiveModel)
      ? `${formatModelPrice(props.primaryLiveModel, "input")} in / ${formatModelPrice(props.primaryLiveModel, "output")} out`
      : `${props.config.flatkeyPrice} ${props.t(props.config.priceUnit)}`;
  const features = buildTextGuideFeatures(props.config, props.t);
  const relatedModels = buildRelatedModelCards(props.config, props.locale, props.t);
  const relatedModelsTitle = buildRelatedModelsTitle(props.config, relatedModels, props.t);

  return (
    <SiteShell locale={props.locale} pathname={`/models/${props.config.slug}`}>
      <div className="model-square-page bg-[linear-gradient(180deg,#f4f0ff_0%,#fbfaff_32%,#ffffff_62%,#f4f1ff_100%)] text-[#161821] dark:bg-[linear-gradient(180deg,#050712_0%,#080b18_36%,#070712_72%,#03040b_100%)] dark:text-white">
        <div className="px-6 pt-10 pb-16 sm:px-8 lg:px-10 lg:pt-14">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <ModelLandingBreadcrumb
              locale={props.locale}
              modelName={props.config.modelId}
              t={props.t}
            />
            <div className="flex flex-wrap gap-2">
              <ModelLandingActions
                locale={props.locale}
                runHref={runHref}
                onRunClick={props.onRunClick}
                t={props.t}
              />
              <a href="#overview" className="inline-flex h-9 items-center gap-2 rounded-full border border-black/10 bg-white px-4 text-xs font-bold shadow-sm">
                <BookOpen className="size-3.5" />
                Markdown
              </a>
            </div>
          </div>

          <section className="grid gap-6 pb-5 lg:grid-cols-[1.3fr_0.9fr]">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <span className="grid size-8 place-items-center rounded-full bg-[#f4f0ff] text-[#7c3aed]">
                  <Code2 className="size-4" />
                </span>
                <h1 className="text-[clamp(2.25rem,5vw,3.7rem)] leading-none font-extrabold tracking-tight">
                  {props.config.modelId}
                </h1>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(props.config.modelId).catch(() => undefined)}
                  className="rounded-full border border-[#0B0B0F14] bg-white p-1.5 text-[#706a74] hover:border-[#7c3aed]/35 hover:text-[#4c1d95]"
                  aria-label={props.t("Copy model id")}
                >
                  <Copy className="size-3.5" />
                </button>
              </div>
              <div className="mb-4 inline-flex rounded-full border border-[#ded6f4] bg-[#f4f0ff] px-3.5 py-1.5 text-[13px] font-extrabold text-[#4c1d95]">
                {props.t("Model Guide")}
              </div>
              <p className="max-w-3xl text-[17px] leading-8 text-[#43434c]">
                {props.t("{{model}} is a production text model for chat, coding, long-context reasoning, and tool-enabled workflows through Flatkey-compatible API access.", {
                  model: props.config.modelId,
                })}
              </p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <Pill label={props.t("Model Type")} value={props.t("Text")} />
                <Pill label={props.t("API")} value="/v1/chat/completions" />
                <Pill label={props.t("Pricing")} value={price} />
                <Pill label={props.t("Updated")} value={updated} />
              </div>
            </div>
            <div className="self-start rounded-2xl bg-[#0d0d10] p-6 text-white shadow-[0_24px_80px_-54px_rgba(0,0,0,.9)]">
              <div className="mb-4 text-sm font-bold text-white/55">{props.config.displayName} API</div>
              <h3 className="text-2xl font-extrabold tracking-tight">
                {props.t("Generate your first {{model}} on Flatkey", { model: props.config.displayName })}
              </h3>
              <p className="mt-3 text-sm leading-6 text-white/62">
                {props.t("Save the draft, continue to signup if needed, or open the console directly when already logged in.")}
              </p>
              <a
                href={runHref}
                onClick={props.onRunClick}
                className="mt-5 flex h-11 items-center justify-center rounded-xl bg-white text-sm font-extrabold !text-[#4c1d95] hover:bg-[#f4f0ff]"
                style={{ color: "#4c1d95" }}
              >
                <Play className="size-4 fill-current" />
                {props.t("Start generating")}
              </a>
              <div className="mt-5 grid gap-2 text-sm leading-6 text-white/72">
                <div>{props.t("Use one account and API key across text, image, video, and audio models.")}</div>
                <div>{props.t("Keep prompts, quotas, and model routing in one place.")}</div>
              </div>
            </div>
          </section>

          <section id="overview" className="border-y border-[#0B0B0F14] bg-[#f8f6fc] py-8">
            <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border border-[#0B0B0F14] bg-white p-6 shadow-[0_24px_70px_-46px_rgba(46,16,101,.16)]">
                <div className="text-xs font-extrabold tracking-[0.16em] text-[#7c3aed] uppercase">
                  {props.t("Model Overview")}
                </div>
                <h2 className="mt-2 text-3xl font-extrabold tracking-tight">
                  {props.t("Best for chat, code generation, agent workflows, and production assistants.")}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#65636b]">
                  {props.t("Use Flatkey when you want OpenAI-compatible routing, unified billing, and reusable API keys.")}
                </p>
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  {features.map((feature) => (
                    <FeatureCard key={feature.title} icon={feature.icon} title={feature.title} body={feature.body} />
                  ))}
                </div>
              </div>
              <div className="grid gap-5 self-start">
                <div className="rounded-2xl border border-[#0B0B0F14] bg-white p-6 shadow-[0_24px_70px_-46px_rgba(46,16,101,.16)]">
                  <div className="text-xs font-extrabold tracking-[0.16em] text-[#7c3aed] uppercase">
                    {props.t("How to Use {{model}} API", { model: props.config.modelId })}
                  </div>
                  <ol className="mt-4 grid gap-3 text-sm leading-6 text-[#65636b]">
                    <li>{props.t("Create an API key and set Authorization: Bearer <YOUR_API_KEY>.")}</li>
                    <li>{props.t("POST to /v1/chat/completions with at least model and messages.")}</li>
                    <li>{props.t("Tune max_tokens, temperature, and top_p based on task complexity.")}</li>
                    <li>{props.t("Enable streaming for chat UIs, terminal assistants, and agent workflows.")}</li>
                    <li>{props.t("Use logs and retries to refine prompts before broader rollout.")}</li>
                  </ol>
                </div>
                <div className="rounded-2xl bg-[#0d0d10] p-6 text-white shadow-[0_24px_80px_-54px_rgba(0,0,0,.9)]">
                  <div className="mb-4 text-sm font-bold text-white/55">{props.t("Common Errors")}</div>
                  <div className="grid gap-3">
                    {[
                      ["400 invalid_request_error", props.t("Missing required fields, malformed messages, or unsupported parameter values.")],
                      ["401 authentication_error", props.t("Missing Authorization header, malformed bearer token, or invalid API key.")],
                      ["429 rate_limit_error", props.t("Request rate, concurrency, or quota is above current account limits.")],
                    ].map(([title, body]) => (
                      <div key={title} className="rounded-xl bg-white/8 p-4">
                        <b className="text-sm">{title}</b>
                        <p className="mt-1 text-sm leading-6 text-white/68">{body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <RelatedModelsCarousel
            models={relatedModels}
            title={relatedModelsTitle}
            t={props.t}
          />

          <section className="grid gap-5 px-6 py-12 sm:px-8 lg:grid-cols-[1.3fr_0.8fr] lg:px-10">
            <div>
              <div className="text-xs font-extrabold tracking-[0.16em] text-[#7c3aed] uppercase">FAQ</div>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight">
                {props.t("{{model}} pricing FAQ", { model: props.config.displayName })}
              </h2>
              <div className="mt-5 grid gap-3">
                {buildModelFaq(props.config, props.t).map((item) => (
                  <details key={item.question} className="rounded-xl border border-[#0B0B0F14] bg-white px-4 py-3 text-sm">
                    <summary className="cursor-pointer font-extrabold">{item.question}</summary>
                    <p className="mt-2 leading-6 text-[#706a74]">{item.answer}</p>
                  </details>
                ))}
              </div>
            </div>
            <div className="self-start rounded-2xl bg-[#0d0d10] p-6 text-white shadow-[0_24px_80px_-54px_rgba(0,0,0,.9)]">
              <div className="mb-4 text-sm font-bold text-white/55">{props.config.displayName} API</div>
              <h3 className="text-2xl font-extrabold tracking-tight">
                {props.t("Ready to unify your AI model access?")}
              </h3>
              <p className="mt-3 text-sm leading-6 text-white/62">
                {props.t("Use one Flatkey account to test prompts, compare models, and move the saved request into the console.")}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  href={runHref}
                  onClick={props.onRunClick}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-extrabold !text-[#4c1d95] hover:bg-[#f4f0ff]"
                  style={{ color: "#4c1d95" }}
                >
                  {props.t("Start generating")}
                  <ArrowRight className="size-4" />
                </a>
                <Link
                  href={localizePath("/pricing", props.locale)}
                  className="inline-flex h-11 items-center rounded-xl border border-white/15 px-5 text-sm font-bold text-white hover:bg-white/8"
                >
                  {props.t("View Pricing")}
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </SiteShell>
  );
}

function ModelLandingActions(props: {
  locale: Locale;
  runHref: string;
  onRunClick: (event: MouseEvent<HTMLAnchorElement>) => void;
  t: (key: string, vars?: Record<string, string>) => string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={localizePath("/models", props.locale)}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-black/10 bg-white px-4 text-xs font-bold text-[#3d3845] shadow-sm hover:border-[#7c3aed]/35 hover:text-[#4c1d95]"
      >
        <ArrowLeft className="size-3.5" />
        {props.t("Back to Models")}
      </Link>
      <a
        href={props.runHref}
        onClick={props.onRunClick}
        className="inline-flex h-9 items-center gap-2 rounded-full bg-[#070707] px-4 text-xs font-extrabold !text-white shadow-[0_16px_34px_-22px_rgba(11,11,15,.55)] hover:bg-[#1a1a1d]"
        style={{ color: "#fff" }}
      >
        <Play className="size-3.5 fill-current" />
        {props.t("Open in Playground")}
      </a>
    </div>
  );
}

function ModelLandingBreadcrumb(props: {
  locale: Locale;
  modelName: string;
  t: (key: string, vars?: Record<string, string>) => string;
  className?: string;
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex min-w-0 flex-wrap items-center gap-1 text-xs text-[#6B6475] dark:text-slate-300/72 ${props.className ?? ""}`}
    >
      <Link href={localizePath("/", props.locale)} className="hover:text-[#0B0B0F] dark:hover:text-white">
        flatkey.ai
      </Link>
      <ChevronRight className="size-3" />
      <Link href={localizePath("/models", props.locale)} className="hover:text-[#0B0B0F] dark:hover:text-white">
        {props.t("All models")}
      </Link>
      <ChevronRight className="size-3" />
      <span className="min-w-0 truncate font-mono text-[#0B0B0F]/80 dark:text-white/80">{props.modelName}</span>
    </nav>
  );
}

function MediaPromptEditor(props: {
  generator: NonNullable<ModelConfig["generator"]>;
  modelId: string;
  prompt: string;
  fieldValues: Record<string, string | number | boolean>;
  referenceImages: ReferenceImageDraft[];
  onPromptChange: (prompt: string) => void;
  onFieldChange: (name: string, value: string | number | boolean) => void;
  onReferenceImagesChange: (images: ReferenceImageDraft[]) => void;
  t: (key: string, vars?: Record<string, string>) => string;
}) {
  const fields = useMemo(() => props.generator.fields, [props.generator.fields]);
  const quickPrompts = props.generator.kind === "video"
    ? ["Product Reveal", "UGC Ad", "Cinematic Scene", "Social Clip"]
    : ["Product Photo", "Anime Portrait", "Realistic Human", "YouTube Thumbnail", "Fantasy Landscape"];
  const supportsReferenceImages = props.generator.kind === "image";

  const onReferenceInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    if (files.length === 0) return;
    const remainingSlots = Math.max(0, 4 - props.referenceImages.length);
    const nextImages = files.slice(0, remainingSlots).map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}`,
      name: file.name,
      size: file.size,
      type: file.type || "image",
      previewUrl: URL.createObjectURL(file),
    }));
    props.onReferenceImagesChange([...props.referenceImages, ...nextImages]);
    event.currentTarget.value = "";
  };

  const removeReferenceImage = (image: ReferenceImageDraft) => {
    URL.revokeObjectURL(image.previewUrl);
    props.onReferenceImagesChange(props.referenceImages.filter((item) => item.id !== image.id));
  };

  return (
    <>
      <label className="block text-sm font-semibold text-[#2c2d33] dark:text-white/88">
        {props.t("Prompt")}
        <textarea
          value={props.prompt}
          onChange={(event) => props.onPromptChange(event.target.value)}
          className="mt-2 min-h-[140px] w-full resize-y rounded-[1.1rem] border border-[#ded8ea] bg-[#fcfbff] p-4 font-mono text-sm leading-6 font-medium text-[#20222a] shadow-[0_10px_28px_-26px_rgba(76,29,149,.72)] outline-none transition focus:border-[#7c3aed] focus:bg-white focus:ring-4 focus:ring-[#7c3aed]/10"
        />
      </label>
      <div className="mt-2 text-right text-xs font-medium text-muted-foreground">
        {props.prompt.length} / 10000
      </div>
      <div className="mt-5">
        <div className="mb-3 text-sm font-semibold text-[#2c2d33] dark:text-white/88">{props.t("Quick Prompts")}</div>
        <div className="flex flex-wrap gap-2.5">
          {quickPrompts.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => props.onPromptChange(buildQuickPrompt(item, props.generator.kind))}
              className="rounded-xl border border-[#e4deed] bg-[#fcfbff] px-3.5 py-2 text-[13px] font-bold text-[#4f4d56] shadow-[0_10px_20px_-18px_rgba(76,29,149,.45)] transition hover:border-[#7c3aed]/45 hover:bg-white hover:text-[#4c1d95]"
            >
              {props.t(item)}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-6">
        <div className="rounded-[1.35rem] border border-[#e2dbea] bg-[linear-gradient(180deg,#ffffff_0%,#fbf9ff_100%)] p-4 shadow-[0_18px_38px_-32px_rgba(76,29,149,.55)] sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="text-sm font-extrabold text-[#2c2d33]">{props.t("Advanced Options")}</div>
          </div>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-6">
            {fields.map((field) => (
              <div key={field.name} className={generatorFieldColumnClass(props.generator.kind, field)}>
                <GeneratorFieldControl
                  kind={props.generator.kind}
                  field={field}
                  value={props.fieldValues[field.name] ?? field.defaultValue}
                  onChange={(value) => props.onFieldChange(field.name, value)}
                  t={props.t}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
      {supportsReferenceImages ? (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-[#2c2d33] dark:text-white/88">{props.t("Reference Images")}</div>
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-violet-500/16 bg-white/70 px-4 text-sm font-semibold text-[#4f4d56] hover:border-violet-500/35 hover:bg-violet-500/8 hover:text-violet-700">
              <Upload className="size-3.5" />
              {props.t("Upload reference")}
              <input type="file" accept="image/*" multiple className="sr-only" onChange={onReferenceInputChange} />
            </label>
          </div>
          {props.referenceImages.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {props.referenceImages.map((image) => (
                <div key={image.id} className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 rounded-xl border border-violet-500/12 bg-white/70 p-3">
                  <div className="relative aspect-square overflow-hidden rounded-lg bg-white">
                    <Image src={image.previewUrl} alt="" fill sizes="52px" className="object-cover" unoptimized />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-extrabold text-[#2c2d33]">{image.name}</div>
                    <div className="mt-0.5 text-[10px] font-medium text-[#8b8891]">{formatUploadedSize(image.size)}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeReferenceImage(image)}
                    className="grid size-8 place-items-center rounded-lg text-[#706a74] hover:bg-violet-500/8 hover:text-violet-700"
                    aria-label="Remove reference image"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function GeneratorFieldControl(props: {
  kind: NonNullable<ModelConfig["generator"]>["kind"];
  field: ModelGeneratorField;
  value: string | number | boolean;
  onChange: (value: string | number | boolean) => void;
  t: (key: string, vars?: Record<string, string>) => string;
}) {
  const optionCount = props.field.options?.length ?? 0;
  const canUseSegmented =
    props.field.type === "select" && optionCount > 0 && (optionCount <= 4 || (props.kind === "video" && props.field.name === "ratio"));

  if (props.field.type === "boolean") {
    return (
      <label className="flex min-h-[4.55rem] min-w-0 cursor-pointer items-center justify-between gap-4 rounded-[1.05rem] border border-[#ded8ea] bg-white px-4 py-3 text-sm font-extrabold text-[#5d5b64] shadow-[0_10px_22px_-20px_rgba(76,29,149,.5)] transition hover:border-[#7c3aed]/35 hover:bg-[#fdfcff]">
        <span className="min-w-0 leading-5">{props.t(props.field.label)}</span>
        <span className="relative inline-flex h-7 w-12 shrink-0 items-center">
          <input
            type="checkbox"
            checked={Boolean(props.value)}
            onChange={(event) => props.onChange(event.target.checked)}
            className="peer sr-only"
          />
          <span className="absolute inset-0 rounded-full bg-violet-500/14 transition-colors peer-checked:bg-violet-600" />
          <span className="absolute left-1 size-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
        </span>
      </label>
    );
  }

  if (props.field.type === "number" && props.field.name === "n") {
    const numericValue = Number(props.value);
    const min = props.field.min ?? 1;
    const max = props.field.max ?? 10;
    const update = (next: number) => props.onChange(Math.min(max, Math.max(min, next)));

    return (
      <label className="grid min-w-0 gap-2 text-[11px] font-extrabold tracking-normal text-[#77717f] uppercase">
        <span>{props.t(props.field.label)}</span>
        <span className="grid h-11 grid-cols-[2.75rem_1fr_2.75rem] overflow-hidden rounded-[0.95rem] border border-[#ded8ea] bg-white text-base font-bold tracking-normal text-[#20222a] shadow-[0_10px_22px_-20px_rgba(76,29,149,.5)] transition focus-within:border-[#7c3aed] focus-within:ring-4 focus-within:ring-[#7c3aed]/10">
          <button
            type="button"
            onClick={() => update(numericValue - 1)}
            className="grid place-items-center border-r border-[#ede7f4] text-[#5d5b64] transition hover:bg-[#f4f0ff] hover:text-[#4c1d95]"
          >
            <Minus className="size-3.5" />
          </button>
          <input
            type="number"
            min={min}
            max={max}
            value={String(props.value)}
            onChange={(event) => props.onChange(coerceGeneratorValue(props.field, event.target.value))}
            className="min-w-0 bg-transparent px-2 text-center outline-none"
          />
          <button
            type="button"
            onClick={() => update(numericValue + 1)}
            className="grid place-items-center border-l border-[#ede7f4] text-[#5d5b64] transition hover:bg-[#f4f0ff] hover:text-[#4c1d95]"
          >
            <Plus className="size-3.5" />
          </button>
        </span>
      </label>
    );
  }

  if (canUseSegmented) {
    return (
      <div className="grid min-w-0 gap-2 text-[11px] font-extrabold tracking-normal text-[#77717f] uppercase">
        <span>{props.t(props.field.label)}</span>
        <div className={`${segmentedGridClass(props.field)} min-h-11 gap-1.5 rounded-[0.95rem] border border-[#ded8ea] bg-[#f3f0f9] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,.8)]`}>
          {(props.field.options ?? []).map((item) => {
            const active = String(props.value) === item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => props.onChange(coerceGeneratorValue(props.field, item))}
                className={`min-h-9 min-w-0 rounded-[0.72rem] px-3 py-2 text-[13px] leading-5 font-extrabold tracking-normal transition ${
                  active
                    ? "bg-white text-[#4c1d95] shadow-[0_8px_18px_-12px_rgba(76,29,149,.85)] ring-1 ring-[#7c3aed]/20"
                    : "text-[#5d5b64] hover:bg-white/75 hover:text-[#3f236b]"
                }`}
              >
                <span className="block">{item}</span>
              </button>
            );
          })}
        </div>
        {props.field.help ? <span className="text-[10px] font-medium tracking-normal text-[#8b8891] normal-case">{props.t(props.field.help)}</span> : null}
      </div>
    );
  }

  return (
    <label className="grid min-w-0 gap-2 text-[11px] font-extrabold tracking-normal text-[#77717f] uppercase">
      <span>{props.t(props.field.label)}</span>
      {props.field.type === "select" ? (
        <span className="relative block">
          <select
            value={String(props.value)}
            onChange={(event) => props.onChange(coerceGeneratorValue(props.field, event.target.value))}
            className="h-11 w-full min-w-0 appearance-none rounded-[0.95rem] border border-[#ded8ea] bg-white px-3.5 pr-9 text-sm font-bold tracking-normal text-[#20222a] shadow-[0_10px_22px_-20px_rgba(76,29,149,.5)] outline-none transition focus:border-[#7c3aed] focus:ring-4 focus:ring-[#7c3aed]/10"
          >
            {(props.field.options ?? []).map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-[#8b8891]" />
        </span>
      ) : (
        <input
          type={props.field.type === "number" ? "number" : "text"}
          min={props.field.min}
          max={props.field.max}
          value={String(props.value)}
          onChange={(event) => props.onChange(coerceGeneratorValue(props.field, event.target.value))}
          className="h-11 w-full min-w-0 rounded-[0.95rem] border border-[#ded8ea] bg-white px-3.5 text-sm font-bold tracking-normal text-[#20222a] shadow-[0_10px_22px_-20px_rgba(76,29,149,.5)] outline-none transition focus:border-[#7c3aed] focus:ring-4 focus:ring-[#7c3aed]/10"
        />
      )}
      {props.field.help ? <span className="text-[10px] font-medium tracking-normal text-[#8b8891] normal-case">{props.t(props.field.help)}</span> : null}
    </label>
  );
}

function generatorFieldColumnClass(kind: NonNullable<ModelConfig["generator"]>["kind"], field: ModelGeneratorField) {
  if (kind === "image") {
    if (field.name === "n") return "sm:col-span-2";
    if (field.name === "size") return "sm:col-span-6";
    return "sm:col-span-3";
  }
  if (kind === "video") {
    if (field.name === "ratio") return "sm:col-span-6";
    if (field.name === "resolution" || field.name === "duration" || field.name === "frames" || field.name === "seed") {
      return "sm:col-span-3";
    }
    return "sm:col-span-2";
  }
  return "sm:col-span-3";
}

function segmentedGridClass(field: ModelGeneratorField) {
  if (field.name === "ratio") {
    const optionCount = field.options?.length ?? 0;
    if (optionCount >= 7) return "grid grid-cols-2 min-[900px]:grid-cols-4 min-[1280px]:grid-cols-7";
    if (optionCount === 5) return "grid grid-cols-2 min-[900px]:grid-cols-3 min-[1280px]:grid-cols-5";
  }
  if (field.name === "size") return "grid grid-cols-2 min-[1280px]:grid-cols-4";
  if ((field.options?.length ?? 0) === 4) return "grid grid-cols-2";
  if ((field.options?.length ?? 0) === 3) return "grid grid-cols-3";
  return "grid grid-cols-2";
}

function formatUploadedSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "0 KB";
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function formatSavings(flatkey: string, official: string) {
  const flatkeyPrice = parsePrice(flatkey);
  const officialPrice = parsePrice(official);
  if (!flatkeyPrice || !officialPrice || flatkeyPrice >= officialPrice) return "0%";
  return `${Math.round(((officialPrice - flatkeyPrice) / officialPrice) * 100)}%`;
}

function parsePrice(value: string) {
  const match = value.match(/[\d.]+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function OutputPreview(props: {
  modelName: string;
  prompt: string;
  kind: "image" | "video" | "audio";
  images: readonly MediaExample[];
  t: (key: string, vars?: Record<string, string>) => string;
}) {
  const primary = props.images[0] ?? { poster: "/assets/prompts/awesome-images/sports-shoe.png" };

  return (
    <div className={props.kind === "video" ? "overflow-hidden rounded-[1.35rem] border border-black/10 bg-[#10131a] p-2 text-white shadow-[0_18px_42px_-32px_rgba(15,15,18,.8)]" : "overflow-hidden rounded-[1.35rem] border border-black/10 bg-white p-2 text-[#0B0B0F] shadow-[0_18px_42px_-34px_rgba(76,29,149,.65)]"}>
      <div className={`relative overflow-hidden rounded-[1.05rem] ${props.kind === "video" ? "aspect-video bg-[#171b24]" : "aspect-[16/10] bg-[#11131a]"}`}>
        {props.kind === "video" && primary?.video ? (
          <video
            className="h-full w-full object-cover"
            autoPlay
            controls
            loop
            muted
            playsInline
            poster={primary.poster}
            preload="metadata"
            src={primary.video}
          />
        ) : (
          <>
            <Image
              src={primary.poster}
              alt=""
              fill
              sizes="(min-width: 1280px) 620px, (min-width: 1024px) 56vw, 100vw"
              className="object-cover"
              priority={props.kind === "image"}
            />
          </>
        )}
      </div>
      <div className={`grid gap-1 px-2 pt-3 pb-1 text-xs leading-5 ${props.kind === "video" ? "" : "text-[#3f3d46] dark:text-white/74"}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${props.kind === "video" ? "bg-white/10 text-white/78" : "bg-violet-500/10 text-violet-700 dark:text-violet-300"}`}>
            {props.t("Example output")}
          </span>
          <b className="min-w-0 truncate">{props.modelName}</b>
        </div>
        <span className={props.kind === "video" ? "text-white/72" : "text-[#706a74]"}>{props.prompt}</span>
      </div>
    </div>
  );
}

function GeneratedExamplesCarousel(props: {
  examples: readonly MediaExample[];
  kind: "image" | "video" | "audio";
  modelName: string;
  t: (key: string, vars?: Record<string, string>) => string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeExample = props.examples[activeIndex] ?? props.examples[0];
  const total = props.examples.length;
  const hasMultiple = total > 1;
  const goToPrevious = () => setActiveIndex((current) => (current + total - 1) % total);
  const goToNext = () => setActiveIndex((current) => (current + 1) % total);

  if (!activeExample) return null;

  return (
    <figure className="min-w-0 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
      <div className="relative overflow-hidden bg-[#10131a]">
        <div className={`relative w-full ${props.kind === "video" ? "aspect-video" : "aspect-[16/10]"}`}>
          {activeExample.video ? (
            <video
              className="h-full w-full object-cover"
              autoPlay
              controls
              loop
              muted
              playsInline
              poster={activeExample.poster}
              preload="metadata"
              src={activeExample.video}
            />
          ) : (
            <Image
              src={activeExample.poster}
              alt=""
              fill
              sizes="(min-width: 1280px) 820px, (min-width: 1024px) 62vw, 100vw"
              className="object-cover"
            />
          )}
        </div>
        {activeExample.video ? (
          <div className="pointer-events-none absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-extrabold text-white backdrop-blur">
            <Play className="size-3 fill-current" />
            {props.t("Preview")}
          </div>
        ) : null}
        <div className="pointer-events-none absolute right-3 bottom-3 rounded-full bg-black/65 px-3 py-1.5 text-[11px] font-extrabold text-white backdrop-blur">
          {props.t("Example {{index}} of {{total}}", {
            index: String(activeIndex + 1),
            total: String(total),
          })}
        </div>
        {hasMultiple ? (
          <div className="absolute inset-y-0 right-3 left-3 flex items-center justify-between">
            <button
              type="button"
              onClick={goToPrevious}
              className="grid size-10 place-items-center rounded-full bg-black/58 text-white shadow-sm backdrop-blur transition hover:bg-black/75"
              aria-label={props.t("Previous example")}
            >
              <ArrowLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={goToNext}
              className="grid size-10 place-items-center rounded-full bg-black/58 text-white shadow-sm backdrop-blur transition hover:bg-black/75"
              aria-label={props.t("Next example")}
            >
              <ArrowRight className="size-4" />
            </button>
          </div>
        ) : null}
      </div>
      <figcaption className="px-4 py-3 text-xs font-bold text-[#4b4a52]">
        {props.t("Generated with {{model}}", { model: props.modelName })} #{activeIndex + 1}
      </figcaption>
      {hasMultiple ? (
        <div className="grid grid-cols-3 gap-2 border-t border-black/10 bg-[#fbfaff] p-3">
          {props.examples.map((example, index) => (
            <button
              key={example.video ?? example.poster}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`relative aspect-video overflow-hidden rounded-xl border bg-[#10131a] transition ${
                activeIndex === index ? "border-[#7c3aed] ring-2 ring-[#7c3aed]/18" : "border-black/10 hover:border-[#7c3aed]/45"
              }`}
              aria-label={props.t("Example {{index}} of {{total}}", {
                index: String(index + 1),
                total: String(total),
              })}
            >
              <Image
                src={example.poster}
                alt=""
                fill
                sizes="(min-width: 1024px) 90px, 30vw"
                className="object-cover"
              />
              {example.video ? (
                <span className="absolute top-1.5 left-1.5 grid size-5 place-items-center rounded-full bg-black/62 text-white">
                  <Play className="size-2.5 fill-current" />
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </figure>
  );
}

function RelatedModelsCarousel(props: {
  models: RelatedModelCard[];
  title: string;
  t: (key: string, vars?: Record<string, string>) => string;
}) {
  if (props.models.length === 0) return null;

  return (
    <div className="mt-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-extrabold tracking-[0.16em] text-[#7c3aed] uppercase">
            {props.t("Related models")}
          </div>
          <h3 className="mt-2 text-2xl font-extrabold tracking-tight">{props.title}</h3>
        </div>
        <span className="text-xs font-bold text-[#706a74]">
          {props.t("Swipe or scroll to compare")}
        </span>
      </div>
      <div className="-mx-6 flex snap-x gap-3 overflow-x-auto px-6 pb-2 sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">
        {props.models.map((model) => (
          <Link
            key={model.name}
            href={model.href}
            className="group grid min-h-36 min-w-[16rem] snap-start rounded-2xl border border-black/10 bg-white p-4 shadow-sm transition hover:border-[#7c3aed]/40 hover:shadow-[0_18px_44px_-34px_rgba(76,29,149,.55)] sm:min-w-[18rem]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="grid size-9 place-items-center rounded-full bg-[#f4f0ff] text-sm font-extrabold text-[#6d28d9]">
                {model.name.slice(0, 1).toUpperCase()}
              </div>
              <ArrowRight className="size-4 text-[#8b8891] transition group-hover:translate-x-0.5 group-hover:text-[#4c1d95]" />
            </div>
            <div className="mt-4 min-w-0">
              <h4 className="truncate text-base font-extrabold text-[#17151d]">{model.name}</h4>
              <p className="mt-1 text-xs font-bold text-[#706a74]">{model.vendor}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-[#f4f0ff] px-2.5 py-1 text-[10px] font-extrabold text-[#6d28d9]">
                {model.kind}
              </span>
              <span className="rounded-full bg-[#f8fafc] px-2.5 py-1 text-[10px] font-extrabold text-[#64748b]">
                {model.price}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function buildRelatedModelCards(
  config: ModelConfig,
  locale: Locale,
  t: (key: string, vars?: Record<string, string>) => string
): RelatedModelCard[] {
  const current = normalizeModelId(config.modelId);
  const seen = new Set<string>([current]);
  const kind = relatedModelKindLabel(config, t);
  const direct = config.modelIds
    .filter((modelId) => {
      const normalized = normalizeModelId(modelId);
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .map((modelId) => ({
      href: localizePath(`/models/${encodeURIComponent(modelId)}`, locale),
      name: modelId,
      vendor: config.officialName,
      kind,
      price: `${config.flatkeyPrice} ${t(config.priceUnit)}`,
      sameProvider: true,
    }));

  if (direct.length >= 2) return direct.slice(0, 8);

  const familyKind = config.generator?.kind;
  const configs = getModelLandingConfigs().filter((candidate) => candidate.slug !== config.slug);
  const fallbackCandidates = familyKind
    ? [
        ...configs.filter((candidate) => candidate.generator?.kind === familyKind),
        ...configs.filter((candidate) => candidate.generator && candidate.generator.kind !== familyKind),
        ...configs.filter((candidate) => !candidate.generator),
      ]
    : [
        ...configs.filter((candidate) => !candidate.generator),
        ...configs.filter((candidate) => candidate.generator),
      ];
  const fallback = fallbackCandidates
    .filter((candidate) => {
      const normalized = normalizeModelId(candidate.modelId);
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .map((candidate) => ({
      href: localizePath(`/models/${candidate.slug}`, locale),
      name: candidate.displayName,
      vendor: candidate.officialName,
      kind: relatedModelKindLabel(candidate, t),
      price: `${candidate.flatkeyPrice} ${t(candidate.priceUnit)}`,
      sameProvider: false,
    }));

  return [...direct, ...fallback].slice(0, 8);
}

function buildRelatedModelsTitle(
  config: ModelConfig,
  models: RelatedModelCard[],
  t: (key: string, vars?: Record<string, string>) => string
) {
  if (models.length > 0 && models.every((model) => model.sameProvider)) {
    return t("More models from {{provider}}", { provider: config.officialName });
  }
  return t("Keep exploring Flatkey");
}

function relatedModelKindLabel(
  config: ModelConfig,
  t: (key: string, vars?: Record<string, string>) => string
) {
  if (config.generator?.kind === "video") return t("Text to Video");
  if (config.generator?.kind === "audio") return t("Audio");
  if (config.generator?.kind === "image") return t("Image to Image");
  return t("Text");
}

function FlatkeySectionHeading(props: { eyebrow: string; title: string; description?: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase">{props.eyebrow}</p>
      <h2 className="text-2xl leading-tight font-bold tracking-tight md:text-3xl">{props.title}</h2>
      {props.description ? (
        <p className="text-muted-foreground mt-3 text-sm leading-7 md:text-base">{props.description}</p>
      ) : null}
    </div>
  );
}

function FlatkeyHeroMetric(props: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-violet-500/16 bg-white/62 p-4 shadow-[0_18px_48px_-42px_rgba(91,33,182,0.72)] backdrop-blur-sm dark:bg-white/[0.04]">
      <div className="text-muted-foreground text-[11px] font-bold tracking-[0.1em] uppercase">{props.label}</div>
      <div className="mt-2 truncate font-mono text-sm font-semibold">{props.value}</div>
    </div>
  );
}

function FlatkeyMetricCard(props: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-violet-500/16 bg-white/72 p-5 shadow-[0_24px_70px_-56px_rgba(91,33,182,0.72)] backdrop-blur-sm dark:bg-white/[0.04]">
      <div className="text-muted-foreground text-xs font-medium tracking-widest uppercase">{props.label}</div>
      <div className="mt-3 font-mono text-2xl font-bold text-emerald-600 dark:text-emerald-400">{props.value}</div>
    </div>
  );
}

function FlatkeyPriceRow(props: { row: FlatkeyPriceTableRow; officialLabel: string; flatkeyLabel: string }) {
  return (
    <div className="rounded-xl border border-violet-500/12 bg-white/62 p-4 dark:bg-white/[0.03]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-sm font-semibold">{props.row.label}</span>
        <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
          {props.row.flatkey}
        </span>
      </div>
      <div className="grid gap-2">
        <PriceTrack label={props.flatkeyLabel} value={props.row.flatkey} percent={props.row.flatkeyPercent} kind="flatkey" />
        <PriceTrack label={props.officialLabel} value={props.row.official} percent={props.row.officialPercent} kind="official" />
      </div>
    </div>
  );
}

function PriceTrack(props: { label: string; value: string; percent: number; kind: "flatkey" | "official" }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">{props.label}</span>
        <span className={props.kind === "flatkey" ? "font-mono font-semibold text-emerald-700" : "font-mono text-muted-foreground line-through"}>
          {props.value}
        </span>
      </div>
      <span className="block h-2 overflow-hidden rounded-full bg-violet-500/10">
        <span
          className={props.kind === "flatkey" ? "block h-full rounded-full bg-emerald-500" : "block h-full rounded-full bg-violet-400/55"}
          style={{ width: `${props.percent}%` }}
        />
      </span>
    </div>
  );
}

function buildCatalogProviderRows(config: ModelConfig, liveModels: PricingModel[], providerName: string) {
  const current = normalizeModelId(config.modelId);
  const exactRows = liveModels.filter((model) => normalizeModelId(model.model_name) === current);
  const rows = exactRows.length > 0 ? exactRows : liveModels.slice(0, 1);
  if (rows.length === 0) {
    return [{
      provider: providerName,
      modelId: config.modelId,
      endpoint: config.generator?.endpoint ?? "/v1/chat/completions",
      status: "Live",
    }];
  }
  return rows.slice(0, 8).map((model) => ({
    provider: model.vendor_name ?? providerName,
    modelId: model.model_name,
    endpoint: model.supported_endpoint_types?.join(" · ") || config.generator?.endpoint || "/v1/chat/completions",
    status: model.availability_status || "Live",
  }));
}

function buildFlatkeyPriceRows(
  config: ModelConfig,
  model: PricingModel | null,
  groupRatio: Record<string, number>,
  t: (key: string, vars?: Record<string, string>) => string
): { rows: FlatkeyPriceTableRow[]; note: string } {
  const note = t("Prices below are calculated from Flatkey pricing data for this model and the visible groups currently returned by our pricing API.");
  if (!model) {
    return {
      note,
      rows: [
        {
          label: t("Flatkey price"),
          flatkey: `${config.flatkeyPrice} ${t(config.priceUnit)}`,
          official: `${config.officialPrice} ${t(config.priceUnit)}`,
          flatkeyPercent: 67,
          officialPercent: 100,
        },
      ],
    };
  }

  if (!isTokenBasedModel(model)) {
    const perSecond = resolveModelDisplayPrice(model, 'second', 'plg', groupRatio);
    if (perSecond) {
      const official = perSecond.configured ?? perSecond.value;
      const flatkey = perSecond.value;
      return {
        note,
        rows: [{ label: t("Price / second"), flatkey: `${formatUsdPrice(flatkey)} ${t("/ second")}`, official: `${formatUsdPrice(official)} ${t("/ second")}`, flatkeyPercent: pricePercent(flatkey, official), officialPercent: 100 }],
      };
    }
    const official = getOfficialPriceUsd(model);
    const listed = official * getBestGroupRatio(model, groupRatio);
    const flatkey = discountedPriceUsd(listed);
    return {
      note,
      rows: [
        {
          label: t("Request price"),
          flatkey: `${formatUsdPrice(flatkey)} ${t("/ request")}`,
          official: `${formatUsdPrice(official)} ${t("/ request")}`,
          flatkeyPercent: pricePercent(flatkey, official),
          officialPercent: 100,
        },
      ],
    };
  }

  return (["input", "output"] as const).map((type) => {
    const official = getOfficialPriceUsd(model, type);
    const listed = official * getBestGroupRatio(model, groupRatio);
    const flatkey = discountedPriceUsd(listed);
    return {
      label: type === "input" ? t("Input /M") : t("Output /M"),
      flatkey: formatUsdPrice(flatkey),
      official: formatUsdPrice(official),
      flatkeyPercent: pricePercent(flatkey, official),
      officialPercent: 100,
    };
  }).reduce<{ rows: FlatkeyPriceTableRow[]; note: string }>(
    (result, row) => ({ ...result, rows: [...result.rows, row] }),
    { rows: [], note }
  );
}

function buildCatalogRelatedModels(
  config: ModelConfig,
  locale: Locale,
  allModels: PricingModel[],
  groupRatio: Record<string, number>,
  t: (key: string, vars?: Record<string, string>) => string
) {
  const current = normalizeModelId(config.modelId);
  const provider = allModels.find((model) => normalizeModelId(model.model_name) === current)?.vendor_name ?? config.officialName;
  const family = getModelFamilyKey(config.modelId);
  const currentEndpoints = new Set((allModels.find((model) => normalizeModelId(model.model_name) === current)?.supported_endpoint_types ?? []).map(normalizeModelId));
  const currentModality = configModalityKey(config);
  const scoredRelated = allModels
    .filter((model) => normalizeModelId(model.model_name) !== current)
    .map((model) => {
      const endpointMatch = (model.supported_endpoint_types ?? []).some((endpoint) => currentEndpoints.has(normalizeModelId(endpoint)));
      const modalityMatch = modelModalityKey(model) === currentModality;
      const score =
        model.vendor_name === provider ? 0 :
        getModelFamilyKey(model.model_name) === family ? 1 :
        endpointMatch ? 2 :
        modalityMatch ? 3 :
        4;
      return { model, score };
    });
  const preferredRelated = scoredRelated.filter((item) => item.score < 4);
  const liveRelated = preferredRelated
    .sort((a, b) => a.score - b.score || a.model.model_name.localeCompare(b.model.model_name, "en", { numeric: true }))
    .slice(0, 8)
    .map(({ model }): CatalogRelatedModel => ({
      href: localizePath(`/models/${encodeURIComponent(model.model_name)}`, locale),
      name: model.model_name,
      description: model.description || `${model.vendor_name ?? provider} · ${formatRelatedPrice(model, groupRatio)}`,
      sameProvider: model.vendor_name === provider,
    }));

  if (liveRelated.length > 0) {
    return {
      title: liveRelated.every((model) => model.sameProvider)
        ? t("More models from {{provider}}", { provider })
        : t("Keep exploring Flatkey"),
      models: liveRelated,
    };
  }

  const fallback: CatalogRelatedModel[] = buildRelatedModelCards(config, locale, t).map((model) => ({
    href: model.href,
    name: model.name,
    description: `${model.vendor} · ${model.kind} · ${model.price}`,
    sameProvider: model.sameProvider,
  }));
  return {
    title: buildRelatedModelsTitle(config, fallback.map((model) => ({ ...model, vendor: "", kind: "", price: "", sameProvider: false })), t),
    models: fallback,
  };
}

function buildModalityLabels(
  config: ModelConfig,
  model: PricingModel | null,
  t: (key: string, vars?: Record<string, string>) => string
) {
  const endpoints = model?.supported_endpoint_types ?? [];
  const labels = new Set<string>();
  if (config.generator?.kind === "video" || endpoints.some((endpoint) => endpoint.includes("video"))) labels.add(t("Text to Video"));
  if (config.generator?.kind === "audio" || endpoints.some((endpoint) => /audio|music|sound|tts/.test(endpoint))) labels.add(t("Audio"));
  if (config.generator?.kind === "image" || endpoints.some((endpoint) => endpoint.includes("image"))) labels.add(t("Image to Image"));
  if (labels.size === 0) labels.add(t("Text"));
  return [...labels];
}

function configModalityKey(config: ModelConfig) {
  return config.generator?.kind ?? "text";
}

function modelModalityKey(model: PricingModel) {
  const endpoints = (model.supported_endpoint_types ?? []).join(" ").toLowerCase();
  const name = normalizeModelId(model.model_name);
  if (/audio|music|sound|tts|voice/.test(endpoints) || /(^|-)(audio|music|sound|sonilo|suno)(-|$)/.test(name)) return "audio";
  if (/video/.test(endpoints) || /(^|-)(video|seedance|kling|sora|veo|wan)(-|$)/.test(name)) return "video";
  if (/image/.test(endpoints) || /(^|-)(image|imagen|flux|dall-e)(-|$)/.test(name)) return "image";
  return "text";
}

function buildModelDescription(
  config: ModelConfig,
  model: PricingModel | null,
  t: (key: string, vars?: Record<string, string>) => string
) {
  if (model?.description) return model.description;
  if (config.generator) {
    return t("{{model}} is available through Flatkey with live pricing, provider routing, generation examples, API handoff, and related model links.", {
      model: config.displayName,
    });
  }
  return t("{{model}} is a production text model for chat, coding, long-context reasoning, and tool-enabled workflows through Flatkey-compatible API access.", {
    model: config.modelId,
  });
}

function buildModelFaq(config: ModelConfig, t: (key: string, vars?: Record<string, string>) => string) {
  return [
    {
      question: t("What is {{model}}?", { model: config.displayName }),
      answer: buildModelDescription(config, null, t),
    },
    {
      question: t("How much does {{model}} cost?", { model: config.displayName }),
      answer: t("Use the pricing section above for current Flatkey prices from our pricing API."),
    },
    {
      question: t("Which providers serve {{model}}?", { model: config.displayName }),
      answer: t("The providers section shows the upstream provider names available in our model catalog."),
    },
    ...config.faq.map((item) => ({ question: t(item.question), answer: t(item.answer) })),
  ];
}

function findRankingRow(rows: RankedModel[], modelId: string): RankedModel | null {
  const normalized = normalizeModelId(modelId);
  return rows.find((row) => normalizeModelId(row.model_name) === normalized) ?? null;
}

function extractRankingUsageSeries(rankings: RankingsData | null, modelId: string): number[] {
  const usage = rankings?.usage;
  if (!usage) return [];
  const index = usage.series.findIndex((name) => normalizeModelId(name) === normalizeModelId(modelId));
  if (index < 0) return [];
  return usage.days.map((day) => day.values[index] ?? 0).filter((value) => value > 0);
}

function displayRankingTokens(rawTokens: number): number {
  return rawTokens * TOKEN_DISPLAY_SCALE;
}

function bestVisibleGroup(model: PricingModel, groupRatio: Record<string, number>) {
  return getAvailableGroups(model, groupRatio)[0] ?? "default";
}

function formatRelatedPrice(model: PricingModel, groupRatio: Record<string, number>) {
  const group = bestVisibleGroup(model, groupRatio);
  return isTokenBasedModel(model)
    ? `${formatGroupTokenPrice(model, group, groupRatio, "input")} in`
    : formatGroupRequestPrice(model, group, groupRatio);
}

function pricePercent(value: number, official: number) {
  if (!Number.isFinite(value) || !Number.isFinite(official) || official <= 0 || value <= 0) return 0;
  return Math.round(Math.max(6, Math.min(100, (value / official) * 100)));
}

function formatModelDate(timestamp?: number) {
  if (!timestamp || !Number.isFinite(timestamp)) return "—";
  const millis = timestamp > 10_000_000_000 ? timestamp : timestamp * 1000;
  return new Date(millis).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function inferContextValue(model: PricingModel | null) {
  const text = `${model?.tags ?? ""} ${model?.description ?? ""}`;
  const match = text.match(/\b(\d+(?:\.\d+)?)\s*(m|k)\s*(?:token|context|ctx|tokens)?\b/i);
  if (!match) return "—";
  return `${match[1]}${match[2].toUpperCase()}`;
}

function averageFinite(values: number[]) {
  const finite = values.filter((value) => Number.isFinite(value) && value > 0);
  return finite.length > 0 ? finite.reduce((sum, value) => sum + value, 0) / finite.length : undefined;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function RequestPreview(props: {
  config: ModelConfig;
  prompt: string;
  fieldValues: Record<string, string | number | boolean>;
  referenceImages?: ReferenceImageDraft[];
  t: (key: string, vars?: Record<string, string>) => string;
}) {
  const request = buildGeneratorRequest(props.config, props.prompt, props.fieldValues, props.referenceImages);
  return (
    <div className="mt-5 rounded-2xl border border-violet-500/16 bg-white/72 p-4 shadow-[0_24px_70px_-56px_rgba(91,33,182,0.72)] backdrop-blur-sm sm:p-5 dark:bg-white/[0.04]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm font-semibold text-[#2c2d33] dark:text-white/88">
        <span>{props.t("Request preview")}</span>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-violet-500/16 bg-white/70 px-3 text-xs font-semibold text-[#4f4d56] hover:border-violet-500/32 hover:bg-violet-500/8 hover:text-violet-700 dark:bg-white/[0.04] dark:text-white/74"
        >
          <Copy className="size-3" />
          {props.t("Copy request")}
        </button>
      </div>
      <pre className="max-h-64 overflow-auto rounded-xl border border-white/10 bg-[#11131a] p-4 font-mono text-xs leading-6 text-white/78 shadow-inner sm:p-5">
        {JSON.stringify(request, null, 2)}
      </pre>
    </div>
  );
}

function PanelHeader(props: { title: string; right: string }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <h2 className="min-w-0 text-base font-semibold tracking-tight text-[#20222a] dark:text-white/90">{props.title}</h2>
      <span className="shrink-0 rounded-full border border-violet-500/12 bg-violet-500/8 px-3 py-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300">
        {props.right}
      </span>
    </div>
  );
}

function Pill(props: { label: string; value: string }) {
  return (
    <span className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
      <span className="block text-xs font-extrabold tracking-[0.12em] text-[#8b8891] uppercase">{props.label}</span>
      <b className="mt-1.5 block text-sm">{props.value}</b>
    </span>
  );
}

function StatCard(props: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
      <b className="text-3xl font-extrabold">{props.value}</b>
      <div className="mt-2 text-sm font-medium text-[#77747d]">{props.label}</div>
    </div>
  );
}

function PriceBox(props: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${props.muted ? "border-dashed border-[#cbd5e1] bg-[#f8fafc]" : "border-[#d8c9ff] bg-[#fbfaff]"}`}>
      <div className={`text-xs font-extrabold tracking-[0.12em] uppercase ${props.muted ? "text-[#64748b]" : "text-[#7c3aed]"}`}>
        {props.label}
      </div>
      <div className={`mt-2 text-xl font-extrabold ${props.muted ? "text-[#475569]" : "text-[#0B0B0F]"}`}>{props.value}</div>
    </div>
  );
}

function ReasonCard(props: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
      <div className="mb-5 grid size-10 place-items-center rounded-full bg-[#f4f0ff] text-[#7c3aed]">{props.icon}</div>
      <h3 className="text-base font-extrabold">{props.title}</h3>
      <p className="mt-2 text-base leading-7 text-[#6b6872]">{props.body}</p>
    </div>
  );
}

function GuideFact(props: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-[#fbfaf7] p-4">
      <div className="text-[10px] font-extrabold tracking-[0.12em] text-[#8b8891] uppercase">{props.label}</div>
      <div className="mt-2 break-words text-sm font-extrabold">{props.value}</div>
    </div>
  );
}

function FeatureCard(props: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
      <div className="mb-5 grid size-9 place-items-center rounded-full bg-[#141824] text-white">{props.icon}</div>
      <h3 className="text-base font-extrabold">{props.title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#6b6872]">{props.body}</p>
    </div>
  );
}

function buildTextGuideFeatures(config: ModelConfig, t: (key: string, vars?: Record<string, string>) => string) {
  return [
    {
      icon: <Code2 className="size-4" />,
      title: t("OpenAI-compatible migration path"),
      body: t("Chat Completions-style payloads reduce switching friction from existing model stacks."),
    },
    {
      icon: <Layers3 className="size-4" />,
      title: t("Structured and tool-based output"),
      body: t("Use structured JSON, tools, and code-generation flows for agentic workflows."),
    },
    {
      icon: <Timer className="size-4" />,
      title: t("Streaming interaction"),
      body: t("Streaming supports chat UIs, terminal assistants, and progressive rendering."),
    },
    {
      icon: <ShieldCheck className="size-4" />,
      title: t("Production routing"),
      body: t("Keep usage, keys, quotas, and model routing in one Flatkey account."),
    },
    {
      icon: <FileText className="size-4" />,
      title: t("Long-context work"),
      body: t("Useful for document summarization, codebase analysis, and knowledge workflows."),
    },
    {
      icon: <Settings2 className="size-4" />,
      title: t("Coding and technical generation"),
      body: t("Useful for code explanation, tests, refactors, SDK wrappers, and technical drafts."),
    },
  ];
}

function buildMediaPricingRows(config: ModelConfig) {
  if (config.slug === "gpt-image-2") {
    return [
      { spec: "1K", flatkey: "$0.0075", official: "$0.22" },
      { spec: "2K", flatkey: "$0.010", official: "$0.50" },
      { spec: "4K", flatkey: "$0.0125", official: "$1.30" },
    ];
  }
  if (config.generator?.kind === "video") {
    return [
      { spec: "720p", flatkey: config.flatkeyPrice, note: "Shared balance", official: config.officialPrice },
      { spec: "1080p", flatkey: "$0.067", note: "Shared balance", official: "$0.10" },
      { spec: "I2V", flatkey: "$0.053", note: "Shared balance", official: "$0.08" },
    ];
  }
  if (config.generator?.kind === "audio") {
    return [
      { spec: "Standard", flatkey: config.flatkeyPrice, note: "Shared balance", official: config.officialPrice },
      { spec: "High quality", flatkey: config.estFlatkey, note: "Shared balance", official: config.estOfficial },
      { spec: "Batch", flatkey: config.flatkeyPrice, note: "Shared balance", official: config.officialPrice },
    ];
  }
  return [
    { spec: "1024x1024", flatkey: config.flatkeyPrice, note: "Shared balance", official: config.officialPrice },
    { spec: "1536x1024", flatkey: config.flatkeyPrice, note: "Shared balance", official: config.officialPrice },
    { spec: "1024x1536", flatkey: config.flatkeyPrice, note: "Shared balance", official: config.officialPrice },
  ];
}

function buildInitialGeneratorValues(config: ModelConfig) {
  return Object.fromEntries((config.generator?.fields ?? []).map((field) => [field.name, field.defaultValue]));
}

function buildGeneratorRequest(
  config: ModelConfig,
  prompt: string,
  values: Record<string, string | number | boolean>,
  referenceImages: ReferenceImageDraft[] = []
) {
  if (config.generator?.kind === "video") {
    const content = [{ type: "text", text: prompt }];
    return compactRequest({ model: config.modelId, content, ...values });
  }
  if (config.generator?.kind === "audio") {
    return compactRequest({ model: config.modelId, input: prompt, ...values });
  }
  if (config.generator?.kind === "image") {
    return compactRequest({
      model: config.modelId,
      prompt,
      ...values,
      reference_images:
        referenceImages.length > 0
          ? referenceImages.map(({ name, size, type }) => ({ name, size, type }))
          : undefined,
    });
  }
  return { model: config.modelId, prompt };
}

function compactRequest(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== "" && entry !== 0 && entry !== undefined)
  );
}

function buildRunHref(
  config: ModelConfig,
  locale: Locale,
  prompt: string,
  draft: DraftValue
) {
  const playgroundParams = new URLSearchParams({
    model: config.modelId,
    prompt,
    lng: locale,
    draft: JSON.stringify(draft),
  });
  if (config.generator?.kind === "image" || config.generator?.kind === "video") {
    playgroundParams.set("generate", config.generator.kind);
  }
  return consoleUrl("/playground", playgroundParams.toString());
}

function withCurrentSearch(baseHref: string) {
  const currentSearch = window.location.search;
  if (!currentSearch) return baseHref;
  const url = new URL(baseHref);
  const current = new URLSearchParams(currentSearch);
  current.forEach((value, key) => {
    if (!url.searchParams.has(key)) url.searchParams.set(key, value);
  });
  return url.toString();
}

function coerceGeneratorValue(field: ModelGeneratorField, raw: string) {
  if (field.type !== "number" && typeof field.defaultValue !== "number") return raw;
  const value = Number(raw);
  if (!Number.isFinite(value)) return field.defaultValue;
  return Math.min(field.max ?? value, Math.max(field.min ?? value, value));
}

function buildQuickPrompt(label: string, kind: "image" | "video" | "audio") {
  if (kind === "video") {
    return `${label}: a concise commercial video shot with clear subject motion, realistic lighting, stable camera, and production-ready framing.`;
  }
  if (kind === "audio") {
    return `${label}: a clean studio-quality audio generation brief with precise tone, pacing, ambience, and delivery notes.`;
  }
  return `${label}: a high-quality product visual with clean composition, precise lighting, strong subject focus, and realistic detail.`;
}
