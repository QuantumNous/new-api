"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Code2,
  Copy,
  FileText,
  Gauge,
  HeartPulse,
  Image as ImageIcon,
  Info,
  KeyRound,
  Layers,
  Maximize2,
  Mic2,
  Route,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Sigma,
  Tags,
  Timer,
  Type,
  Video,
  X,
  Zap,
} from "lucide-react";
import {
  formatGroupRequestPrice,
  formatGroupTokenPrice,
  formatModelPrice,
  formatRatio,
  getAvailableGroups,
  isTokenBasedModel,
  parseTags,
  type PricingModel,
} from "@/lib/pricing";
import { localizePath, type Locale } from "@/lib/locales";
import { getModelLandingConfigForModel } from "@/lib/model-landing";
import { APP_CONSOLE_ORIGIN } from "@/lib/origins";
import { cn } from "@/lib/utils";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type PricingModelBrowserProps = {
  locale: Locale;
  models: PricingModel[];
  groupRatio: Record<string, number>;
  usableGroup: Record<string, { desc: string; ratio: number }>;
  endpointMap: Record<string, unknown>;
  autoGroups: string[];
};

type TabValue = "overview" | "performance" | "api";
type ApiLang = "curl" | "python" | "typescript" | "javascript";
type Modality = "text" | "image" | "audio" | "video" | "file";
type Capability =
  | "function_calling"
  | "streaming"
  | "vision"
  | "json_mode"
  | "structured_output"
  | "reasoning"
  | "tools"
  | "system_prompt"
  | "web_search"
  | "code_interpreter"
  | "caching"
  | "embeddings";

type PerformanceSeriesPoint = {
  ts: number;
  avg_ttft_ms: number;
  avg_latency_ms: number;
  success_rate: number;
  avg_tps: number;
};

type PerformanceGroup = {
  group: string;
  avg_ttft_ms: number;
  avg_latency_ms: number;
  success_rate: number;
  avg_tps: number;
  series: PerformanceSeriesPoint[];
};

type PerformanceSummary = {
  model_name: string;
  avg_latency_ms: number;
  success_rate: number;
  avg_tps: number;
  request_count?: number;
};

type PerformanceMetricsData = {
  model_name: string;
  groups: PerformanceGroup[];
};

type SupportedParameter = {
  name: string;
  type: "number" | "integer" | "boolean" | "string" | "object" | "array";
  defaultValue?: string | number | boolean;
  range?: string;
  enumValues?: string[];
  description: string;
};

const TAB_META: Record<TabValue, { icon: React.ComponentType<{ className?: string }>; label: string }> = {
  overview: { icon: Info, label: "Overview" },
  performance: { icon: HeartPulse, label: "Performance" },
  api: { icon: Code2, label: "API" },
};

const API_LANG_LABELS: Record<ApiLang, string> = {
  curl: "cURL",
  python: "Python",
  typescript: "TypeScript",
  javascript: "JavaScript",
};

const COMMON_CHAT_PARAMETERS: SupportedParameter[] = [
  { name: "temperature", type: "number", defaultValue: 1, range: "0 ~ 2", description: "Sampling temperature; lower is more deterministic" },
  { name: "top_p", type: "number", defaultValue: 1, range: "0 ~ 1", description: "Nucleus sampling probability mass" },
  { name: "max_tokens", type: "integer", range: ">= 1", description: "Maximum number of tokens in the response" },
  { name: "frequency_penalty", type: "number", defaultValue: 0, range: "-2 ~ 2", description: "Penalises repetition of frequent tokens" },
  { name: "presence_penalty", type: "number", defaultValue: 0, range: "-2 ~ 2", description: "Encourages introducing new topics" },
  { name: "stop", type: "array", description: "Up to 4 strings that stop generation" },
  { name: "seed", type: "integer", description: "Deterministic sampling seed (best-effort)" },
  { name: "n", type: "integer", defaultValue: 1, range: ">= 1", description: "Number of completions to generate" },
  { name: "stream", type: "boolean", defaultValue: false, description: "Stream tokens via Server-Sent Events" },
  { name: "response_format", type: "object", description: "Force JSON object or schema-conforming output" },
  { name: "tools", type: "array", description: "Tool / function declarations the model may call" },
  { name: "tool_choice", type: "string", enumValues: ["auto", "none", "required"], description: "Tool-choice policy or specific tool name" },
  { name: "logprobs", type: "boolean", defaultValue: false, description: "Return per-token log probabilities" },
  { name: "top_logprobs", type: "integer", range: "0 ~ 20", description: "Number of top log probabilities returned per token" },
  { name: "logit_bias", type: "object", description: "Per-token logit bias map" },
  { name: "user", type: "string", description: "End-user identifier for abuse monitoring" },
];

const TOKEN_PRICE_TYPES = [
  ["input", "Input"],
  ["output", "Output"],
  ["cache", "Cache"],
  ["create_cache", "Cache Write"],
  ["image", "Image"],
  ["audio_input", "Audio In"],
  ["audio_output", "Audio Out"],
] as const;

const CAPABILITY_LABELS: Record<Capability, string> = {
  function_calling: "Function calling",
  streaming: "Streaming",
  vision: "Vision",
  json_mode: "JSON mode",
  structured_output: "Structured output",
  reasoning: "Reasoning",
  tools: "Tools",
  system_prompt: "System prompt",
  web_search: "Web search",
  code_interpreter: "Code interpreter",
  caching: "Prompt caching",
  embeddings: "Embeddings",
};

const MODALITY_ICONS: Record<Modality, React.ComponentType<{ className?: string }>> = {
  text: Type,
  image: ImageIcon,
  audio: Mic2,
  video: Video,
  file: FileText,
};

const MODALITY_LABELS: Record<Modality, string> = {
  text: "Text",
  image: "Image",
  audio: "Audio",
  video: "Video",
  file: "File",
};

export function PricingModelBrowser(props: PricingModelBrowserProps) {
  const [selectedModelName, setSelectedModelName] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabValue>("overview");
  const [performanceSummary, setPerformanceSummary] = useState<Record<string, PerformanceSummary>>({});
  const selectedModel = useMemo(
    () => props.models.find((model) => model.model_name === selectedModelName) ?? null,
    [props.models, selectedModelName]
  );
  const selectedSummary = selectedModel ? performanceSummary[selectedModel.model_name] : undefined;

  useEffect(() => {
    let cancelled = false;
    fetchPerformanceSummary()
      .then((summary) => {
        if (!cancelled) setPerformanceSummary(summary);
      })
      .catch(() => {
        if (!cancelled) setPerformanceSummary({});
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedModel) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedModelName(null);
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedModel]);

  const handleSelect = (modelName: string) => {
    setActiveTab("overview");
    setSelectedModelName(modelName);
  };

  return (
    <>
      <div className="grid gap-3 xl:grid-cols-3">
        {props.models.map((model) => (
          <ModelPriceCard
            key={`${model.vendor_id ?? "vendor"}-${model.model_name}`}
            model={model}
            locale={props.locale}
            performance={performanceSummary[model.model_name]}
            onSelect={() => handleSelect(model.model_name)}
          />
        ))}
      </div>

      <ModelDetailsDrawer
        model={selectedModel}
        groupRatio={props.groupRatio}
        usableGroup={props.usableGroup}
        endpointMap={props.endpointMap}
        autoGroups={props.autoGroups}
        performance={selectedSummary}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onClose={() => setSelectedModelName(null)}
      />
    </>
  );
}

function ModelPriceCard(props: { model: PricingModel; locale: Locale; performance?: PerformanceSummary; onSelect: () => void }) {
  const model = props.model;
  const tokenBased = isTokenBasedModel(model);
  const endpoints = model.supported_endpoint_types ?? [];
  const tags = parseTags(model.tags);
  const initial = model.model_name.charAt(0).toUpperCase();
  const iconKey = model.icon || model.vendor_icon;
  const landingConfig = getModelLandingConfigForModel(model.model_name);
  const landingHref = landingConfig ? localizePath(`/models/${landingConfig.slug}`, props.locale) : null;

  const handleCopy = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    void navigator.clipboard?.writeText(model.model_name || "");
  };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={props.onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          props.onSelect();
        }
      }}
      className="group relative flex min-h-[188px] flex-col overflow-hidden rounded-3xl border border-violet-300/30 bg-white/58 p-4 text-left shadow-[0_22px_70px_rgba(91,33,182,0.09)] backdrop-blur-xl transition-all before:pointer-events-none before:absolute before:inset-x-6 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-violet-300/60 before:to-transparent hover:-translate-y-0.5 hover:border-violet-400/45 hover:bg-white/75 hover:shadow-[0_26px_80px_rgba(91,33,182,0.14)] focus-visible:ring-3 focus-visible:ring-violet-500/20 focus-visible:outline-none dark:border-white/10 dark:bg-white/[0.055] dark:shadow-[0_22px_70px_-50px_rgba(124,58,237,0.95)] dark:before:via-violet-200/25 dark:hover:border-violet-300/30 dark:hover:bg-white/[0.08] sm:p-5"
      aria-label={`View pricing details for ${model.model_name}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-violet-300/25 bg-violet-500/10 shadow-[0_0_26px_rgba(168,85,247,0.12)] dark:border-violet-300/20 dark:bg-violet-300/10">
            <ModelLogo iconKey={iconKey} fallback={initial} size={28} />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-[15px] leading-tight font-black text-slate-950 dark:text-white">{model.model_name}</h3>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs">
              {tokenBased ? (
                <>
                  <span className="whitespace-nowrap text-slate-500 dark:text-slate-400">
                    Input <span className="font-mono font-semibold text-slate-950 dark:text-slate-100">{formatModelPrice(model, "input")}</span>/1M
                  </span>
                  <span className="whitespace-nowrap text-slate-500 dark:text-slate-400">
                    Output <span className="font-mono font-semibold text-slate-950 dark:text-slate-100">{formatModelPrice(model, "output")}</span>/1M
                  </span>
                  {model.cache_ratio != null ? (
                    <span className="whitespace-nowrap text-slate-400 dark:text-slate-500">Cached {formatModelPrice(model, "cache")}</span>
                  ) : null}
                </>
              ) : (
                <span className="whitespace-nowrap text-slate-500 dark:text-slate-400">
                  <span className="font-mono font-semibold text-slate-950 dark:text-slate-100">{formatModelPrice(model)}</span> / request
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {props.performance ? <HealthBadge summary={props.performance} /> : null}
          <span className="inline-flex items-center gap-1 rounded-full border border-violet-300/30 bg-white/55 px-2.5 py-1.5 text-xs font-bold text-slate-600 transition-colors group-hover:bg-violet-500/10 group-hover:text-slate-950 dark:border-violet-300/20 dark:bg-white/[0.055] dark:text-slate-300 dark:group-hover:bg-violet-300/10 dark:group-hover:text-white">
            Details
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </span>
          {landingHref ? (
            <a
              href={landingHref}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              className="inline-flex h-7 items-center rounded-full border border-emerald-300/40 bg-emerald-500/10 px-2.5 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-500/15 dark:border-emerald-300/25 dark:text-emerald-200 dark:hover:bg-emerald-300/15"
            >
              Landing
            </a>
          ) : null}
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex size-7 items-center justify-center rounded-full border border-violet-300/30 bg-white/55 text-slate-500 transition-colors hover:bg-violet-500/10 hover:text-slate-950 dark:border-violet-300/20 dark:bg-white/[0.055] dark:text-slate-400 dark:hover:bg-violet-300/10 dark:hover:text-white"
            aria-label={`Copy ${model.model_name}`}
            title="Copy"
          >
            <Copy className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
      <p className="mt-4 line-clamp-2 min-h-[2.5rem] flex-1 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
        {model.description || "No description available."}
      </p>
      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {(model.enable_groups ?? [])[0] ? (
            <span className="text-xs font-semibold text-violet-700/80 dark:text-violet-200">{(model.enable_groups ?? [])[0]} Groups</span>
          ) : null}
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{tokenBased ? "Token-based" : "Per Request"}</span>
          {model.billing_mode === "tiered_expr" ? (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-200">Dynamic Pricing</span>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-1">
          {endpoints.slice(0, 2).map((endpoint) => (
            <span key={endpoint} className="text-xs text-slate-500/80 dark:text-slate-400">
              {endpoint}
            </span>
          ))}
          {tags.slice(0, 2).map((tag) => (
            <span key={tag} className="text-xs text-slate-500/80 dark:text-slate-400">
              {tag}
            </span>
          ))}
          <span className="text-xs text-slate-400 dark:text-slate-500">1M</span>
        </div>
      </div>
    </article>
  );
}

function ModelDetailsDrawer(props: {
  model: PricingModel | null;
  groupRatio: Record<string, number>;
  usableGroup: Record<string, { desc: string; ratio: number }>;
  endpointMap: Record<string, unknown>;
  autoGroups: string[];
  performance?: PerformanceSummary;
  activeTab: TabValue;
  onTabChange: (tab: TabValue) => void;
  onClose: () => void;
}) {
  const model = props.model;
  const open = Boolean(model);

  return (
    <div className={cn("fixed inset-0 z-50", open ? "pointer-events-auto" : "pointer-events-none")} aria-hidden={!open}>
      <div
        className={cn("absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity", open ? "opacity-100" : "opacity-0")}
        onClick={props.onClose}
      />
      <aside
        className={cn(
          "pricing-model-drawer fixed inset-y-0 right-0 flex h-full w-full max-w-[100vw] flex-col border-l border-border bg-background shadow-2xl transition-transform duration-200 sm:max-w-2xl lg:max-w-3xl xl:max-w-4xl 2xl:max-w-5xl",
          open ? "translate-x-0" : "translate-x-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-label={model ? `${model.model_name} model details` : "Model details"}
      >
        <button
          type="button"
          onClick={props.onClose}
          className="absolute top-4 right-4 z-10 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
        <div className="flex-1 overflow-y-auto px-4 pt-11 pb-5 sm:px-6 sm:pt-12 sm:pb-6">
          {model ? (
            <ModelDetailsContent
              model={model}
              groupRatio={props.groupRatio}
              usableGroup={props.usableGroup}
              endpointMap={props.endpointMap}
              autoGroups={props.autoGroups}
              performance={props.performance}
              activeTab={props.activeTab}
              onTabChange={props.onTabChange}
            />
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function ModelDetailsContent(props: {
  model: PricingModel;
  groupRatio: Record<string, number>;
  usableGroup: Record<string, { desc: string; ratio: number }>;
  endpointMap: Record<string, unknown>;
  autoGroups: string[];
  performance?: PerformanceSummary;
  activeTab: TabValue;
  onTabChange: (tab: TabValue) => void;
}) {
  const metadata = useMemo(() => inferModelMetadata(props.model), [props.model]);

  return (
    <div className="@container/details space-y-4">
      <ModelHeader model={props.model} />
      <div className="space-y-4">
        <div className="grid w-full grid-cols-3 gap-1 rounded-lg bg-muted/60 p-1">
          {(Object.keys(TAB_META) as TabValue[]).map((tab) => {
            const Icon = TAB_META[tab].icon;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => props.onTabChange(tab)}
                className={cn(
                  "inline-flex h-8 min-w-0 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors sm:text-sm",
                  props.activeTab === tab ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                <span className="truncate">{TAB_META[tab].label}</span>
              </button>
            );
          })}
        </div>

        {props.activeTab === "overview" ? (
          <div className="space-y-6 outline-none">
            <OverviewSummaryGrid model={props.model} performance={props.performance} />
            <section className="bg-card/60 space-y-5 rounded-xl border p-4 shadow-sm">
              <SectionTitle>Pricing</SectionTitle>
              <PriceSection model={props.model} groupRatio={props.groupRatio} />
              <GroupPricingSection
                model={props.model}
                groupRatio={props.groupRatio}
                usableGroup={props.usableGroup}
                autoGroups={props.autoGroups}
              />
            </section>
            <QuickStats metadata={metadata} />
            <ModelSignalsSection metadata={metadata} />
            <ProviderInfo model={props.model} />
          </div>
        ) : null}

        {props.activeTab === "performance" ? <PerformancePanel model={props.model} summary={props.performance} /> : null}
        {props.activeTab === "api" ? <ApiPanel model={props.model} endpointMap={props.endpointMap} /> : null}
      </div>
    </div>
  );
}

function ModelHeader(props: { model: PricingModel }) {
  const model = props.model;
  const description = model.description || model.vendor_description || null;
  const tags = parseTags(model.tags);
  const initial = model.model_name.charAt(0).toUpperCase() || "?";
  const iconKey = model.icon || model.vendor_icon;
  const isSpecialExpression = model.billing_mode === "tiered_expr" && Boolean(model.billing_expr);

  return (
    <header className="pb-4">
      <div className="flex items-center gap-2.5 pr-10">
        <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border bg-muted text-xs font-bold text-foreground/80">
          <ModelLogo iconKey={iconKey} fallback={initial} size={20} />
        </span>
        <h1 className="break-all font-mono text-xl font-bold tracking-tight sm:text-2xl">{model.model_name}</h1>
        <button
          type="button"
          onClick={() => void navigator.clipboard?.writeText(model.model_name || "")}
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Copy model name"
        >
          <Copy className="size-3" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
        {model.vendor_name ? <span className="text-muted-foreground">{model.vendor_name}</span> : null}
        <span className="text-muted-foreground/30">·</span>
        <span className="text-muted-foreground/70">{isTokenBasedModel(model) ? "Token-based" : "Per Request"}</span>
        {isSpecialExpression ? (
          <>
            <span className="text-muted-foreground/30">·</span>
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">Dynamic Pricing</span>
          </>
        ) : null}
      </div>
      {description ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
      {tags.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span key={tag} className="rounded bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </header>
  );
}

function OverviewSummaryGrid(props: { model: PricingModel; performance?: PerformanceSummary }) {
  const successFallback = props.model.availability_status ? props.model.availability_status.replace(/_/g, " ") : "--";
  return (
    <div className="grid overflow-hidden rounded-lg border bg-muted/20 sm:grid-cols-3 sm:divide-x">
      <OverviewMetric icon={Timer} label="TPS" value={props.performance ? formatThroughput(props.performance.avg_tps) : "--"} />
      <OverviewMetric icon={Timer} label="Average latency" value={props.performance ? formatLatency(props.performance.avg_latency_ms) : "--"} />
      <OverviewMetric icon={HeartPulse} label="Success rate" value={props.performance ? formatUptimePct(props.performance.success_rate) : successFallback} />
    </div>
  );
}

function OverviewMetric(props: { icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode }) {
  const Icon = props.icon;
  return (
    <div className="flex min-w-0 items-center gap-2 px-3 py-2">
      <Icon className="size-3.5 shrink-0 text-muted-foreground/70" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[10px] font-medium tracking-wider text-muted-foreground uppercase">{props.label}</div>
        <div className="truncate font-mono text-sm font-semibold tabular-nums text-foreground">{props.value}</div>
      </div>
    </div>
  );
}

function PriceSection(props: { model: PricingModel; groupRatio: Record<string, number> }) {
  const model = props.model;
  const tokenBased = isTokenBasedModel(model);
  const tokenUnitLabel = "1M";

  if (!tokenBased) {
    return (
      <section>
        <SectionTitle>Base Price</SectionTitle>
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Per request</span>
          <span className="font-mono text-sm font-semibold tabular-nums text-foreground">{formatModelPrice(model)}</span>
        </div>
      </section>
    );
  }

  const secondaryItems = TOKEN_PRICE_TYPES.slice(2).filter(([type]) => formatGroupTokenPrice(model, "_base", { _base: 1 }, type) !== "-");

  return (
    <section>
      <SectionTitle>Base Price</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        {TOKEN_PRICE_TYPES.slice(0, 2).map(([type, label]) => (
          <div key={type} className="bg-muted/20 rounded-lg border p-3">
            <div className="text-muted-foreground text-xs">{label}</div>
            <div className="text-foreground mt-1 font-mono text-base font-semibold tabular-nums">
              {formatGroupTokenPrice(model, "_base", { _base: 1 }, type)}
              <span className="text-muted-foreground/40 ml-1 text-xs font-normal">/ {tokenUnitLabel}</span>
            </div>
          </div>
        ))}
      </div>
      {secondaryItems.length > 0 ? (
        <div className="bg-muted/20 mt-3 rounded-lg border px-3 py-2.5">
          <div className="space-y-1.5">
            {secondaryItems.map(([type, label]) => (
              <div key={type} className="flex items-baseline justify-between gap-4">
                <span className="text-muted-foreground/70 text-sm">{label}</span>
                <span className="text-muted-foreground font-mono text-sm tabular-nums">
                  {formatGroupTokenPrice(model, "_base", { _base: 1 }, type)}
                  <span className="text-muted-foreground/40 ml-1 text-xs font-normal">/ {tokenUnitLabel}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {model.billing_expr ? (
        <div className="mt-3 rounded-lg border border-amber-200/70 bg-amber-50/70 p-3">
          <div className="text-sm font-medium text-amber-800">Special billing expression</div>
          <code className="mt-2 block max-h-28 overflow-auto rounded-md border bg-background/80 px-2 py-1.5 font-mono text-xs break-all text-muted-foreground">
            {model.billing_expr}
          </code>
        </div>
      ) : null}
    </section>
  );
}

function GroupPricingSection(props: {
  model: PricingModel;
  groupRatio: Record<string, number>;
  usableGroup: Record<string, { desc: string; ratio: number }>;
  autoGroups: string[];
}) {
  const availableGroups = getAvailableGroups(props.model, props.groupRatio, props.usableGroup);
  const tokenBased = isTokenBasedModel(props.model);
  const extraPriceTypes = TOKEN_PRICE_TYPES.slice(2).filter(([type]) => formatGroupTokenPrice(props.model, availableGroups[0] ?? "Default", props.groupRatio, type) !== "-");

  return (
    <section>
      <SectionTitle>Pricing by Group</SectionTitle>
      <AutoGroupChain model={props.model} autoGroups={props.autoGroups} />
      {availableGroups.length === 0 ? (
        <p className="text-sm text-muted-foreground">This model is not available in any group, or no group pricing information is configured.</p>
      ) : (
        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <div data-slot="table-container" className="relative w-full overflow-x-auto overflow-y-hidden">
          <table
            data-slot="table"
            className="w-full caption-bottom tabular-nums [&_td]:text-sm [&_td_*]:text-sm [&_th]:text-sm [&_th_*]:text-sm text-sm"
          >
            <thead data-slot="table-header" className="[&_tr]:border-b">
              <tr data-slot="table-row" className="has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors hover:bg-transparent">
                <TableHead>Group</TableHead>
                <TableHead>Ratio</TableHead>
                {tokenBased ? (
                  <>
                    <TableHead align="right">Input</TableHead>
                    <TableHead align="right">Output</TableHead>
                    {extraPriceTypes.map(([, label]) => (
                      <TableHead key={label} align="right">
                        {label}
                      </TableHead>
                    ))}
                  </>
                ) : (
                  <TableHead align="right">Price</TableHead>
                )}
              </tr>
            </thead>
            <tbody data-slot="table-body" className="[&_tr:last-child]:border-0">
              {availableGroups.map((group) => {
                const ratio = props.groupRatio[group] || props.usableGroup[group]?.ratio || 1;
                return (
                  <tr
                    key={group}
                    data-slot="table-row"
                    className="hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors"
                  >
                    <td data-slot="table-cell" className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 py-2.5">
                      <GroupBadge group={group} />
                    </td>
                    <td data-slot="table-cell" className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 text-muted-foreground py-2.5 font-mono">
                      {ratio}x
                    </td>
                    {tokenBased ? (
                      <>
                        <td data-slot="table-cell" className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 py-2.5 text-right font-mono">
                          {formatGroupTokenPrice(props.model, group, props.groupRatio, "input")}
                        </td>
                        <td data-slot="table-cell" className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 py-2.5 text-right font-mono">
                          {formatGroupTokenPrice(props.model, group, props.groupRatio, "output")}
                        </td>
                        {extraPriceTypes.map(([type]) => (
                          <td
                            key={type}
                            data-slot="table-cell"
                            className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 py-2.5 text-right font-mono"
                          >
                            {formatGroupTokenPrice(props.model, group, props.groupRatio, type)}
                          </td>
                        ))}
                      </>
                    ) : (
                      <td data-slot="table-cell" className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 py-2.5 text-right font-mono">
                        {formatGroupRequestPrice(props.model, group, props.groupRatio)}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          {tokenBased ? <p className="text-muted-foreground/40 mt-1.5 px-4 text-[10px] sm:px-0">Prices shown per 1M tokens</p> : null}
        </div>
      )}
    </section>
  );
}

function AutoGroupChain(props: { model: PricingModel; autoGroups: string[] }) {
  const groups = Array.isArray(props.model.enable_groups) ? props.model.enable_groups : [];
  const autoChain = props.autoGroups.filter((group) => groups.includes(group));
  if (autoChain.length === 0) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
      <span className="font-medium">Auto Group Chain</span>
      <span className="text-muted-foreground/40">→</span>
      {autoChain.map((group, index) => (
        <span key={group} className="flex items-center gap-1">
          <GroupBadge group={group} />
          {index < autoChain.length - 1 ? <span className="text-muted-foreground/40">→</span> : null}
        </span>
      ))}
    </div>
  );
}

function QuickStats(props: { metadata: ModelMetadata }) {
  const stats: Array<{
    key: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: React.ReactNode;
    hint?: string;
  }> = [
    { key: "context", icon: Layers, label: "Context", value: formatTokenCount(props.metadata.context_length), hint: "Maximum input window" },
    { key: "max-output", icon: Maximize2, label: "Max output", value: formatTokenCount(props.metadata.max_output_tokens), hint: "Maximum tokens per response" },
    {
      key: "modalities",
      icon: FileText,
      label: "Modalities",
      value: <ModalityFlow input={props.metadata.input_modalities} output={props.metadata.output_modalities} />,
    },
    { key: "knowledge", icon: Sparkles, label: "Knowledge cutoff", value: props.metadata.knowledge_cutoff },
    { key: "release", icon: CalendarClock, label: "Released", value: props.metadata.release_date },
  ];

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-muted/20 md:grid-cols-3 xl:grid-cols-5">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.key} className="flex min-w-0 flex-col gap-0.5 bg-background px-3 py-2.5">
            <span className="inline-flex min-w-0 items-center gap-1 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              <Icon className="size-3 shrink-0" />
              <span className="truncate">{stat.label}</span>
            </span>
            <span className="truncate text-sm font-semibold tabular-nums text-foreground">{stat.value}</span>
            {"hint" in stat && stat.hint ? <span className="truncate text-[10px] text-muted-foreground/60">{stat.hint}</span> : null}
          </div>
        );
      })}
    </div>
  );
}

function ModelSignalsSection(props: { metadata: ModelMetadata }) {
  return (
    <section>
      <SectionTitle>Capabilities / Supported modalities</SectionTitle>
      <div className="grid gap-3 rounded-xl border p-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(260px,1fr)]">
        <div className="flex flex-wrap gap-1.5">
          {props.metadata.capabilities.length > 0 ? (
            props.metadata.capabilities.map((capability) => (
              <span key={capability} className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                {CAPABILITY_LABELS[capability] ?? capability}
              </span>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">No capabilities reported for this model.</span>
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <ModalityBox label="Input" modalities={props.metadata.input_modalities} />
          <ModalityBox label="Output" modalities={props.metadata.output_modalities} />
        </div>
      </div>
    </section>
  );
}

function ProviderInfo(props: { model: PricingModel }) {
  const apiInfo = inferApiInfo(props.model);
  return (
    <section className="rounded-xl border p-4">
      <SectionTitle>Provider</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        <InfoLine icon={ShieldCheck} label="Provider" value={props.model.vendor_name ?? apiInfo.vendorLabel} />
        <InfoLine icon={Gauge} label="Tokenizer" value={apiInfo.tokenizer} />
        <InfoLine icon={KeyRound} label="License" value={apiInfo.license} />
        <InfoLine icon={Zap} label="Training opt-out" value={apiInfo.trainingOptOut ? "Available" : "Provider-specific"} />
      </div>
    </section>
  );
}

function PerformancePanel(props: { model: PricingModel; summary?: PerformanceSummary }) {
  const [metrics, setMetrics] = useState<PerformanceMetricsData | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPerformanceMetrics(props.model.model_name)
      .then((data) => {
        if (!cancelled) setMetrics(data);
      })
      .catch(() => {
        if (!cancelled) setMetrics(null);
      });
    return () => {
      cancelled = true;
    };
  }, [props.model.model_name]);

  const currentMetrics = metrics?.model_name === props.model.model_name ? metrics : null;
  const groups = useMemo(() => currentMetrics?.groups ?? [], [currentMetrics]);
  const aggregate = aggregatePerformance(groups) ?? props.summary;
  const latencySeries = useMemo(() => toLatencySeries(groups), [groups]);
  const uptimeSeries = useMemo(() => toUptimeSeries(groups), [groups]);
  const incidents = uptimeSeries.filter((point) => point.success_rate < 100).length;

  if (!aggregate) {
    return <div className="text-muted-foreground rounded-lg border p-6 text-center text-sm">Loading performance data...</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <PerformanceStatCard icon={Timer} label="TPS" value={formatThroughput(aggregate.avg_tps)} hint="Sustained tokens per second" />
        <PerformanceStatCard icon={Timer} label="Average latency" value={formatLatency(aggregate.avg_latency_ms)} />
        <PerformanceStatCard
          icon={HeartPulse}
          label="Success rate"
          value={formatUptimePct(aggregate.success_rate)}
          hint={incidents > 0 ? `${incidents} incident buckets in the last 24 hours` : "No incidents in the last 24 hours"}
          intent={aggregate.success_rate >= 99.9 ? "success" : aggregate.success_rate >= 99 ? "default" : "warning"}
        />
      </div>

      {groups.length > 0 ? (
        <section>
          <PanelHeader icon={HeartPulse} title="Per-group performance" description="Average latency, TTFT, TPS, and success rate" />
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full caption-bottom text-sm tabular-nums">
              <thead className="[&_tr]:border-b">
                <tr className="border-b transition-colors hover:bg-transparent">
                  <TableHead>Group</TableHead>
                  <TableHead align="right">TPS</TableHead>
                  <TableHead align="right">Average TTFT</TableHead>
                  <TableHead align="right">Average latency</TableHead>
                  <TableHead align="right">Success rate</TableHead>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {groups.map((group) => (
                  <tr key={group.group} className="border-b transition-colors hover:bg-muted/20">
                    <td className="p-2 py-2.5 align-middle whitespace-nowrap"><GroupBadge group={group.group} /></td>
                    <td className="p-2 py-2.5 text-right font-mono whitespace-nowrap">{formatThroughput(group.avg_tps)}</td>
                    <td className="p-2 py-2.5 text-right font-mono whitespace-nowrap">{formatLatency(group.avg_ttft_ms)}</td>
                    <td className="p-2 py-2.5 text-right font-mono whitespace-nowrap text-muted-foreground">{formatLatency(group.avg_latency_ms)}</td>
                    <td className="p-2 py-2.5 text-right font-mono whitespace-nowrap">{formatUptimePct(group.success_rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section>
        <PanelHeader icon={Timer} title="Latency trend (last 24h)" description="Average TTFT" />
        <TrendLineChart series={latencySeries} valueKey="avg_ttft_ms" unit="ms" emptyLabel="No latency data available" />
      </section>

      <section>
        <PanelHeader
          icon={HeartPulse}
          title="Availability (last 24h)"
          description="Request success rate sampled over the last 24 hours"
          accent={incidents > 0 ? <span className="inline-flex items-center gap-1 text-amber-600"><AlertTriangle className="size-3.5" />{incidents} incidents</span> : null}
        />
        <TrendLineChart series={uptimeSeries} valueKey="success_rate" unit="%" min={95} max={100} emptyLabel="No availability data available" />
      </section>
    </div>
  );
}

function ApiPanel(props: { model: PricingModel; endpointMap: Record<string, unknown> }) {
  const endpoints = props.model.supported_endpoint_types ?? [];
  const endpointOptions = endpoints.length > 0 ? endpoints : ["openai"];
  const [endpointType, setEndpointType] = useState(endpointOptions[0]);
  const [lang, setLang] = useState<ApiLang>("curl");
  const activeEndpoint = endpointOptions.includes(endpointType) ? endpointType : endpointOptions[0];
  const endpointPath = formatEndpointPath(activeEndpoint, props.endpointMap[activeEndpoint], props.model.model_name);
  const code = buildCodeSample(lang, props.model, activeEndpoint, endpointPath);
  const params = buildSupportedParameters(props.model);
  const limits = buildRateLimits(props.model);

  return (
    <div className="space-y-6">
      <section>
        <PanelTitle icon={ScrollText}>Code samples</PanelTitle>
        <div className="flex flex-wrap items-center gap-2">
          {endpointOptions.length > 1 ? (
            <SegmentedTabs
              value={activeEndpoint}
              values={endpointOptions}
              labels={Object.fromEntries(endpointOptions.map((endpoint) => [endpoint, endpoint]))}
              onChange={setEndpointType}
            />
          ) : null}
          <SegmentedTabs
            className="ml-auto"
            value={lang}
            values={Object.keys(API_LANG_LABELS) as ApiLang[]}
            labels={API_LANG_LABELS}
            onChange={(value) => setLang(value as ApiLang)}
          />
        </div>
        <CodeBlock code={code} />
        <p className="text-muted-foreground mt-2 text-xs">
          Replace <code className="bg-muted rounded px-1 py-0.5 font-mono text-[11px]">&lt;YOUR_API_KEY&gt;</code> with the API key from your token settings.
        </p>
      </section>

      <section>
        <PanelTitle icon={KeyRound}>Authentication</PanelTitle>
        <div className="border-border/60 bg-muted/20 flex items-start gap-2 rounded-lg border p-3">
          <ChevronRight className="text-muted-foreground mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <div className="space-y-1.5 text-xs leading-relaxed">
            <p>
              All requests must include <code className="bg-muted rounded px-1 py-0.5 font-mono text-[11px]">Authorization: Bearer &lt;TOKEN&gt;</code> header.
              Anthropic-formatted endpoints accept the <code className="bg-muted rounded px-1 py-0.5 font-mono text-[11px]">x-api-key</code> header instead.
            </p>
            <p className="text-muted-foreground">Generate tokens from the Tokens page; you can scope them to specific models, groups, IPs, and rate-limits.</p>
          </div>
        </div>
      </section>

      <section>
        <PanelTitle icon={Sigma}>Supported parameters</PanelTitle>
        <div className="border-border/60 overflow-hidden rounded-lg border">
          <div className="relative w-full overflow-x-auto overflow-y-hidden">
            <table className="w-full caption-bottom text-sm tabular-nums [&_td]:text-sm [&_td_*]:text-sm [&_th]:text-sm [&_th_*]:text-sm">
              <thead className="[&_tr]:border-b">
                <tr className="border-b bg-muted/30 transition-colors hover:bg-muted/30">
                  <th className="h-9 w-44 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground">Parameter</th>
                  <th className="h-9 w-24 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground">Type</th>
                  <th className="h-9 w-32 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground">Default / range</th>
                  <th className="h-9 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground">Description</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {params.map((param) => (
                  <tr key={param.name} className="border-b transition-colors hover:bg-muted/20">
                    <td className="p-2 py-2 align-top whitespace-nowrap"><code className="font-mono text-sm font-medium">{param.name}</code></td>
                    <td className="p-2 py-2 align-top whitespace-nowrap"><span className="inline-flex h-7 items-center rounded-full bg-secondary px-2.5 font-mono text-sm text-secondary-foreground">{param.type}</span></td>
                    <td className="p-2 py-2 align-top whitespace-nowrap"><ParameterRange param={param} /></td>
                    <td className="p-2 py-2 align-top whitespace-nowrap text-muted-foreground">{param.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section>
        <PanelTitle icon={Gauge}>Rate limits</PanelTitle>
        <div className="border-border/60 overflow-hidden rounded-lg border">
          <div className="relative w-full overflow-x-auto overflow-y-hidden">
            <table className="w-full caption-bottom text-sm tabular-nums">
              <thead className="[&_tr]:border-b">
                <tr className="border-b bg-muted/30 transition-colors hover:bg-muted/30">
                  <th className="h-9 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground">Group</th>
                  <th className="h-9 px-2 text-right align-middle font-medium whitespace-nowrap text-foreground">RPM</th>
                  <th className="h-9 px-2 text-right align-middle font-medium whitespace-nowrap text-foreground">TPM</th>
                  <th className="h-9 px-2 text-right align-middle font-medium whitespace-nowrap text-foreground">RPD</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {limits.map((limit) => (
                  <tr key={limit.group} className="border-b transition-colors hover:bg-muted/20">
                    <td className="p-2 py-2 font-mono whitespace-nowrap">{limit.group}</td>
                    <td className="p-2 py-2 text-right font-mono whitespace-nowrap">{formatCompactNumber(limit.rpm)}</td>
                    <td className="p-2 py-2 text-right font-mono whitespace-nowrap">{formatCompactNumber(limit.tpm)}</td>
                    <td className="p-2 py-2 text-right font-mono whitespace-nowrap">{formatCompactNumber(limit.rpd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-muted-foreground mt-2 text-[11px] leading-relaxed">
          RPM = requests per minute, TPM = tokens per minute, RPD = requests per day. Limits apply per token group.
        </p>
      </section>
    </div>
  );
}

function HealthBadge(props: { summary: PerformanceSummary }) {
  const successRate = props.summary.success_rate;
  const Icon = successRate >= 99.9 ? CheckCircle2 : successRate >= 99 ? Activity : AlertTriangle;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-1.5 text-xs font-bold",
        successRate >= 99.9
          ? "border-emerald-300/40 bg-emerald-500/10 text-emerald-700"
          : successRate >= 99
            ? "border-sky-300/40 bg-sky-500/10 text-sky-700"
            : "border-amber-300/50 bg-amber-500/10 text-amber-700"
      )}
      title={`Success rate ${formatUptimePct(successRate)}`}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {formatUptimePct(successRate)}
    </span>
  );
}

function PerformanceStatCard(props: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  hint?: string;
  intent?: "default" | "warning" | "success";
}) {
  const Icon = props.icon;
  return (
    <div className="bg-background flex flex-col gap-1 rounded-lg border p-3">
      <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[10px] font-medium tracking-wider uppercase">
        <Icon className="size-3" />
        {props.label}
      </span>
      <span
        className={cn(
          "text-foreground font-mono text-lg font-semibold tabular-nums",
          props.intent === "warning" && "text-amber-600",
          props.intent === "success" && "text-emerald-600"
        )}
      >
        {props.value}
      </span>
      {props.hint ? <span className="text-muted-foreground/70 text-[11px]">{props.hint}</span> : null}
    </div>
  );
}

function PanelHeader(props: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  accent?: React.ReactNode;
}) {
  const Icon = props.icon;
  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="text-muted-foreground/70 size-3.5 shrink-0" />
        <div className="min-w-0">
          <div className="text-foreground text-sm font-semibold">{props.title}</div>
          {props.description ? <p className="text-muted-foreground/80 text-xs">{props.description}</p> : null}
        </div>
      </div>
      {props.accent ? <div className="shrink-0 text-xs font-medium">{props.accent}</div> : null}
    </div>
  );
}

function PanelTitle(props: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  const Icon = props.icon;
  return (
    <h3 className="text-foreground mb-3 flex items-center gap-1.5 text-sm font-semibold">
      <Icon className="text-muted-foreground/70 size-3.5" aria-hidden="true" />
      {props.children}
    </h3>
  );
}

function SegmentedTabs<T extends string>(props: {
  value: T;
  values: T[];
  labels: Record<string, string>;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex h-8 w-fit items-center justify-center rounded-lg bg-muted/40 p-0.5 text-muted-foreground", props.className)}>
      {props.values.map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => props.onChange(value)}
          className={cn(
            "inline-flex h-7 items-center justify-center rounded-md px-2.5 text-xs font-medium transition-all",
            props.value === value ? "bg-background text-foreground shadow-sm" : "hover:text-foreground"
          )}
        >
          {props.labels[value] ?? value}
        </button>
      ))}
    </div>
  );
}

function CodeBlock(props: { code: string }) {
  return (
    <div className="mt-3 group bg-background text-foreground relative w-full overflow-hidden rounded-md border">
      <pre className="m-0 overflow-auto p-4 text-sm leading-6">
        <code className="font-mono">{props.code}</code>
      </pre>
      <div className="absolute top-2 right-2">
        <button
          type="button"
          onClick={() => void navigator.clipboard?.writeText(props.code)}
          className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Copy code sample"
        >
          <Copy className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function ParameterRange(props: { param: SupportedParameter }) {
  if (props.param.defaultValue !== undefined) {
    return (
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-muted-foreground text-sm">=</span>
        <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-sm">{String(props.param.defaultValue)}</code>
        {props.param.range ? <span className="text-muted-foreground text-sm">{props.param.range}</span> : null}
      </div>
    );
  }
  if (props.param.range) return <span className="text-muted-foreground font-mono text-sm">{props.param.range}</span>;
  if (props.param.enumValues?.length) {
    return (
      <div className="flex flex-wrap gap-0.5">
        {props.param.enumValues.map((value) => (
          <code key={value} className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-sm">
            {value}
          </code>
        ))}
      </div>
    );
  }
  return <span className="text-muted-foreground/60 text-sm">—</span>;
}

function TrendLineChart(props: {
  series: Array<Record<string, number>>;
  valueKey: string;
  unit: string;
  min?: number;
  max?: number;
  emptyLabel: string;
}) {
  const values = props.series.map((point) => point[props.valueKey]).filter((value) => Number.isFinite(value) && value > 0);
  if (values.length === 0) {
    return <div className="text-muted-foreground flex h-48 items-center justify-center rounded-lg border text-xs">{props.emptyLabel}</div>;
  }
  const min = props.min ?? Math.min(...values);
  const max = props.max ?? Math.max(...values);
  const domainPadding = props.unit === "%" ? 0 : Math.max(1, (max - min) * 0.12);
  const domainMin = props.min ?? Math.max(0, min - domainPadding);
  const domainMax = props.max ?? max + domainPadding;
  const data = props.series
    .map((point, index) => {
      const value = point[props.valueKey];
      if (!Number.isFinite(value) || value <= 0) return null;
      return {
        index,
        label: formatHourFromTimestamp(point.ts),
        value,
      };
    })
    .filter((point): point is { index: number; label: string; value: number } => Boolean(point));
  const last = values[values.length - 1];

  return (
    <div className="rounded-lg border bg-muted/10 p-3">
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 14, bottom: 8, left: 8 }}>
            <CartesianGrid stroke="var(--muted-foreground)" strokeOpacity={0.15} strokeDasharray="4 4" vertical={false} />
            <XAxis
              dataKey="label"
              minTickGap={28}
              tickLine={false}
              axisLine={{ stroke: "var(--muted-foreground)", strokeOpacity: 0.24 }}
              tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
            />
            <YAxis
              width={54}
              domain={[domainMin, domainMax]}
              tickFormatter={(value) => formatChartValue(Number(value), props.unit)}
              tickLine={false}
              axisLine={{ stroke: "var(--muted-foreground)", strokeOpacity: 0.24 }}
              tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
            />
            <Tooltip
              cursor={{ stroke: "var(--muted-foreground)", strokeOpacity: 0.28, strokeDasharray: "4 4" }}
              formatter={(value) => [formatChartValue(Number(value), props.unit), props.unit === "%" ? "Success rate" : "Average TTFT"]}
              labelFormatter={(label) => `${label}`}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--background)",
                color: "var(--foreground)",
                boxShadow: "0 16px 40px rgb(0 0 0 / 0.12)",
                fontSize: 12,
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="oklch(0.58 0.22 292)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--background)" }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="ml-[54px] mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>24h ago</span>
        <span className="font-mono">{formatChartValue(last, props.unit)}</span>
        <span>now</span>
      </div>
    </div>
  );
}

function formatHourFromTimestamp(timestamp?: number): string {
  if (!timestamp) return "";
  const date = new Date(timestamp * 1000);
  return `${String(date.getHours()).padStart(2, "0")}:00`;
}

function formatChartValue(value: number, unit: string): string {
  if (unit === "%") return `${value.toFixed(2)}%`;
  if (unit === "ms") return formatLatency(value);
  return `${value.toFixed(1)}${unit}`;
}

function ModalityBox(props: { label: string; modalities: Modality[] }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
      <span className="text-xs font-medium text-muted-foreground">{props.label}</span>
      <ModalityIcons modalities={props.modalities} />
    </div>
  );
}

function ModalityFlow(props: { input: Modality[]; output: Modality[] }) {
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      <ModalityIcons modalities={props.input} className="size-3.5" />
      <span className="text-muted-foreground/40">→</span>
      <ModalityIcons modalities={props.output} className="size-3.5" />
    </span>
  );
}

function ModalityIcons(props: { modalities: Modality[]; className?: string }) {
  if (props.modalities.length === 0) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  return (
    <span className="inline-flex items-center gap-1">
      {props.modalities.map((modality) => {
        const Icon = MODALITY_ICONS[modality];
        return (
          <span key={modality} aria-label={MODALITY_LABELS[modality]} title={MODALITY_LABELS[modality]} className="text-foreground/80 inline-flex">
            <Icon className={cn("size-3.5", props.className)} />
          </span>
        );
      })}
    </span>
  );
}

export function ModelLogo(props: { iconKey?: string; fallback: string; size: number }) {
  const [failed, setFailed] = useState(false);
  const src = !failed ? getLobeStaticSvgUrl(props.iconKey) : null;

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={props.size}
        height={props.size}
        className="block rounded-sm object-contain"
        style={{ width: props.size, height: props.size }}
        onError={() => setFailed(true)}
      />
    );
  }

  return <span className="text-sm font-black text-violet-700">{props.fallback || "?"}</span>;
}

function InfoLine(props: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; mono?: boolean }) {
  const Icon = props.icon;
  return (
    <div className="flex min-w-0 items-start gap-2">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/70" />
      <div className="min-w-0">
        <div className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">{props.label}</div>
        <div className={cn("break-words text-sm text-foreground", props.mono && "font-mono")}>{props.value}</div>
      </div>
    </div>
  );
}

function GroupBadge(props: { group: string }) {
  return (
    <span className="inline-flex w-fit max-w-full shrink-0 items-center rounded-4xl font-medium tracking-normal whitespace-nowrap transition-colors h-5 gap-1 px-1.5 text-xs leading-none text-chart-3">
      <span className="inline-block size-1.5 shrink-0 rounded-full bg-chart-3" aria-hidden="true" />
      <span className="truncate">{props.group}</span>
    </span>
  );
}

function TableHead(props: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 text-muted-foreground py-2 text-[10px] font-medium tracking-wider uppercase",
        props.align === "right" && "text-right"
      )}
    >
      {props.children}
    </th>
  );
}

function SectionTitle(props: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">{props.children}</h2>;
}

type ModelMetadata = {
  context_length: number;
  max_output_tokens: number;
  knowledge_cutoff: string;
  release_date: string;
  input_modalities: Modality[];
  output_modalities: Modality[];
  capabilities: Capability[];
};

function inferModelMetadata(model: PricingModel): ModelMetadata {
  const name = model.model_name.toLowerCase();
  const endpoints = model.supported_endpoint_types ?? [];
  const input = new Set<Modality>(["text"]);
  const output = new Set<Modality>(["text"]);
  const capabilities = new Set<Capability>(["streaming", "system_prompt"]);

  if (model.image_ratio != null || /vision|image|omni|vl/.test(name)) {
    input.add("image");
    capabilities.add("vision");
  }
  if (model.audio_ratio != null || /audio|whisper|tts|voice/.test(name)) input.add("audio");
  if (/video|sora|veo|kling|seed/.test(name) || endpoints.includes("openai-video")) {
    input.add("video");
    output.add("video");
  }
  if (endpoints.includes("image-generation")) output.add("image");
  if (endpoints.includes("embeddings") || endpoints.includes("jina-rerank")) capabilities.add("embeddings");
  if (/reasoning|thinking|deepseek-r|^o[1-4]/.test(name)) capabilities.add("reasoning");
  if (/code|coder/.test(name)) capabilities.add("code_interpreter");
  if (model.cache_ratio != null) capabilities.add("caching");
  if (!endpoints.includes("image-generation") && !endpoints.includes("embeddings")) {
    capabilities.add("function_calling");
    capabilities.add("tools");
    capabilities.add("json_mode");
    capabilities.add("structured_output");
  }

  return {
    context_length: /1m|claude.*4|gemini/.test(name) ? 1_000_000 : /128k|gpt-4|gpt-5|o1|o3|o4/.test(name) ? 128_000 : 32_768,
    max_output_tokens: endpoints.includes("embeddings") || endpoints.includes("image-generation") ? 0 : 16_384,
    knowledge_cutoff: "2025-04",
    release_date: "2025-08",
    input_modalities: Array.from(input),
    output_modalities: Array.from(output),
    capabilities: Array.from(capabilities),
  };
}

function inferApiInfo(model: PricingModel) {
  const name = model.model_name.toLowerCase();
  const vendorLabel =
    model.vendor_name ??
    (/claude/.test(name) ? "Anthropic" : /gemini|veo|imagen/.test(name) ? "Google" : /deepseek/.test(name) ? "DeepSeek" : /^gpt|^o[1-4]|sora/.test(name) ? "OpenAI" : "Provider");
  return {
    vendorLabel,
    tokenizer: /claude/.test(name) ? "Anthropic Claude tokenizer" : /gemini/.test(name) ? "SentencePiece (Gemini)" : "BPE (vendor-specific)",
    license: /llama|mistral|qwen|deepseek/.test(name) ? "Open-weight / provider-specific" : "Proprietary (commercial)",
    trainingOptOut: /^gpt|^o[1-4]|claude/.test(name),
  };
}

function formatTokenCount(tokens: number): string {
  if (!Number.isFinite(tokens) || tokens <= 0) return "-";
  if (tokens >= 1_000_000) return `${tokens / 1_000_000}M`;
  if (tokens >= 1_000) return `${tokens / 1_000}K`;
  return String(tokens);
}

function formatEndpointPath(endpoint: string, configuredPath: unknown, modelName: string): string {
  const fallback = endpoint === "openai-response" ? "/v1/responses" : endpoint === "anthropic" ? "/v1/messages" : "/v1/chat/completions";
  return resolveEndpointPath(configuredPath, fallback).replace(/\{model\}/g, modelName);
}

function resolveEndpointPath(configuredPath: unknown, fallback: string): string {
  if (typeof configuredPath === "string" && configuredPath.trim()) return configuredPath;
  if (configuredPath && typeof configuredPath === "object") {
    const record = configuredPath as Record<string, unknown>;
    for (const key of ["path", "url", "endpoint"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value;
    }
  }
  return fallback;
}

async function fetchPerformanceSummary(): Promise<Record<string, PerformanceSummary>> {
  const response = await fetch("/api/perf-metrics/summary?hours=24", { headers: { accept: "application/json" } });
  if (!response.ok) return {};
  const payload = (await response.json()) as { success?: boolean; data?: { models?: PerformanceSummary[] } };
  if (!payload.success) return {};
  return Object.fromEntries((payload.data?.models ?? []).map((model) => [model.model_name, model]));
}

async function fetchPerformanceMetrics(modelName: string): Promise<PerformanceMetricsData | null> {
  const params = new URLSearchParams({ model: modelName, hours: "24" });
  const response = await fetch(`/api/perf-metrics?${params.toString()}`, { headers: { accept: "application/json" } });
  if (!response.ok) return null;
  const payload = (await response.json()) as { success?: boolean; data?: PerformanceMetricsData };
  return payload.success && payload.data ? payload.data : null;
}

function aggregatePerformance(groups: PerformanceGroup[]): PerformanceSummary | null {
  if (groups.length === 0) return null;
  const avgTps = averagePositive(groups.map((group) => group.avg_tps));
  const avgLatency = averagePositive(groups.map((group) => group.avg_latency_ms));
  const successRates = groups.map((group) => group.success_rate).filter(Number.isFinite);
  const successRate = successRates.length ? successRates.reduce((sum, value) => sum + value, 0) / successRates.length : 0;
  return { model_name: "", avg_tps: avgTps, avg_latency_ms: avgLatency, success_rate: successRate };
}

function averagePositive(values: number[]): number {
  const positives = values.filter((value) => Number.isFinite(value) && value > 0);
  if (positives.length === 0) return 0;
  return positives.reduce((sum, value) => sum + value, 0) / positives.length;
}

function toLatencySeries(groups: PerformanceGroup[]): Array<Record<string, number>> {
  const byTs = new Map<number, number[]>();
  for (const group of groups) {
    for (const point of group.series ?? []) {
      if (point.avg_ttft_ms <= 0) continue;
      const values = byTs.get(point.ts) ?? [];
      values.push(point.avg_ttft_ms);
      byTs.set(point.ts, values);
    }
  }
  return [...byTs.entries()]
    .sort(([a], [b]) => a - b)
    .map(([ts, values]) => ({ ts, avg_ttft_ms: values.reduce((sum, value) => sum + value, 0) / values.length }));
}

function toUptimeSeries(groups: PerformanceGroup[]): Array<Record<string, number>> {
  const byTs = new Map<number, number[]>();
  for (const group of groups) {
    for (const point of group.series ?? []) {
      if (!Number.isFinite(point.success_rate)) continue;
      const values = byTs.get(point.ts) ?? [];
      values.push(point.success_rate);
      byTs.set(point.ts, values);
    }
  }
  return [...byTs.entries()]
    .sort(([a], [b]) => a - b)
    .map(([ts, values]) => ({ ts, success_rate: values.reduce((sum, value) => sum + value, 0) / values.length }));
}

function formatThroughput(tps: number): string {
  if (!Number.isFinite(tps) || tps <= 0) return "—";
  if (tps >= 1_000) return `${(tps / 1_000).toFixed(1)}K t/s`;
  return `${tps.toFixed(tps < 10 ? 2 : 1)} t/s`;
}

function formatLatency(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  if (ms >= 1_000) return `${(ms / 1_000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

function formatUptimePct(pct: number): string {
  if (!Number.isFinite(pct)) return "—";
  return `${pct.toFixed(2)}%`;
}

function buildCodeSample(lang: ApiLang, model: PricingModel, endpointType: string, endpointPath: string): string {
  const baseUrl = APP_CONSOLE_ORIGIN;
  const url = `${baseUrl}${endpointPath}`;
  const userMessage = "Explain quantum entanglement in one paragraph.";
  const body = endpointType === "openai-response"
    ? { model: model.model_name, input: userMessage }
    : { model: model.model_name, messages: [{ role: "user", content: userMessage }], temperature: 0.7 };

  if (endpointType === "anthropic") {
    const anthropicBody = { model: model.model_name, max_tokens: 1024, messages: [{ role: "user", content: userMessage }] };
    if (lang === "python") return `import anthropic\n\nclient = anthropic.Anthropic(\n    base_url="${baseUrl}",\n    api_key="<YOUR_API_KEY>",\n)\n\nmessage = client.messages.create(\n    model="${model.model_name}",\n    max_tokens=1024,\n    messages=[{"role": "user", "content": "${userMessage}"}],\n)\n\nprint(message.content[0].text)`;
    if (lang === "typescript" || lang === "javascript") return `const response = await fetch('${url}', {\n  method: 'POST',\n  headers: {\n    'x-api-key': process.env.NEW_API_KEY,\n    'anthropic-version': '2023-06-01',\n    'Content-Type': 'application/json',\n  },\n  body: JSON.stringify(${JSON.stringify(anthropicBody, null, 2)}),\n})\n\nconst data = await response.json()\nconsole.log(data.content[0].text)`;
    return buildCurl(url, anthropicBody, "x-api-key: $NEW_API_KEY", "anthropic-version: 2023-06-01");
  }

  if (lang === "python") return `from openai import OpenAI\n\nclient = OpenAI(\n    base_url="${baseUrl}/v1",\n    api_key="<YOUR_API_KEY>",\n)\n\ncompletion = client.chat.completions.create(\n    model="${model.model_name}",\n    messages=[{"role": "user", "content": "${userMessage}"}],\n)\n\nprint(completion.choices[0].message.content)`;
  if (lang === "typescript") return `import OpenAI from 'openai'\n\nconst client = new OpenAI({\n  baseURL: '${baseUrl}/v1',\n  apiKey: process.env.NEW_API_KEY,\n})\n\nconst completion = await client.chat.completions.create({\n  model: '${model.model_name}',\n  messages: [{ role: 'user', content: '${userMessage}' }],\n})\n\nconsole.log(completion.choices[0].message.content)`;
  if (lang === "javascript") return `const response = await fetch('${url}', {\n  method: 'POST',\n  headers: {\n    Authorization: \`Bearer \${process.env.NEW_API_KEY}\`,\n    'Content-Type': 'application/json',\n  },\n  body: JSON.stringify(${JSON.stringify(body, null, 2)}),\n})\n\nconst data = await response.json()\nconsole.log(data)`;
  return buildCurl(url, body, "Authorization: Bearer $NEW_API_KEY");
}

function buildCurl(url: string, body: unknown, ...headers: string[]): string {
  return [
    `curl ${url} \\`,
    ...headers.map((header) => `  -H "${header}" \\`),
    `  -H "Content-Type: application/json" \\`,
    `  -d '${JSON.stringify(body, null, 2).replace(/\n/g, "\n     ")}'`,
  ].join("\n");
}

function buildSupportedParameters(model: PricingModel): SupportedParameter[] {
  const endpoints = model.supported_endpoint_types ?? [];
  if (endpoints.includes("embeddings") || endpoints.includes("jina-rerank")) {
    return [
      { name: "input", type: "string", description: "Input text or array to embed or rerank" },
      { name: "encoding_format", type: "string", enumValues: ["float", "base64"], description: "Embedding vector encoding format" },
      { name: "user", type: "string", description: "End-user identifier for abuse monitoring" },
    ];
  }
  if (endpoints.includes("image-generation")) {
    return [
      { name: "prompt", type: "string", description: "Text prompt used to generate an image" },
      { name: "size", type: "string", enumValues: ["1024x1024", "1024x1792", "1792x1024"], description: "Requested image size" },
      { name: "n", type: "integer", defaultValue: 1, range: "1 ~ 10", description: "Number of images to generate" },
      { name: "response_format", type: "string", enumValues: ["url", "b64_json"], description: "Image response payload format" },
    ];
  }
  return COMMON_CHAT_PARAMETERS;
}

function buildRateLimits(model: PricingModel): Array<{ group: string; rpm: number; tpm: number; rpd: number }> {
  const groups = (model.enable_groups ?? []).filter((group) => group && group !== "auto").slice(0, 8);
  const targets = groups.length > 0 ? groups : ["Standard"];
  return targets.map((group, index) => {
    const seed = hashString(`${model.model_name}:${group}`);
    const rpm = 200 + (seed % 900) + index * 25;
    const tpm = rpm * (isTokenBasedModel(model) ? 400 : 40);
    const rpd = rpm * 20;
    return { group, rpm, tpm, rpd };
  });
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

function formatCompactNumber(value: number): string {
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(value);
}

function getLobeStaticSvgUrl(iconKey?: string): string | null {
  if (!iconKey) return null;
  const directKey = normalizeIconKey(iconKey);
  if (directKey) return `https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@latest/icons/${directKey}.svg`;
  return null;
}

function normalizeIconKey(iconKey: string): string | null {
  const known: Record<string, string> = {
    openai: "openai",
    "open-ai": "openai",
    anthropic: "anthropic",
    claude: "claude-color",
    google: "google-color",
    gemini: "gemini-color",
    deepseek: "deepseek-color",
    "deep-seek": "deepseek-color",
    qwen: "qwen-color",
    alibaba: "alibabacloud-color",
    "alibaba-cloud": "alibabacloud-color",
    mistral: "mistral-color",
    xai: "xai",
    grok: "grok",
    meta: "meta-color",
    llama: "meta-color",
    moonshot: "moonshot",
    kimi: "kimi-color",
  };
  const normalized = iconKey
    .split(".")
    .filter((segment) => segment && !segment.includes("="))
    .join("-")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!normalized) return null;
  return known[normalized] ?? normalized;
}
