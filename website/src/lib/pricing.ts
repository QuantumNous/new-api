import { APP_CONSOLE_ORIGIN } from "@/lib/origins";

export const API_BASE_URL = APP_CONSOLE_ORIGIN;
export const WEBSITE_PUBLIC_PRICING_GROUP = "plg";
// Health metrics scope: every active group, merged server-side (whole-platform traffic).
export const PERF_METRICS_ALL_GROUPS = "all";

export type PricingVendor = {
  id: number;
  name: string;
  icon?: string;
  description?: string;
};

export type PricingModel = {
  id?: number;
  model_name: string;
  description?: string;
  icon?: string;
  vendor_id?: number;
  vendor_name?: string;
  vendor_icon?: string;
  vendor_description?: string;
  quota_type: number;
  model_ratio: number;
  completion_ratio: number;
  model_price?: number;
  cache_ratio?: number | null;
  create_cache_ratio?: number | null;
  image_ratio?: number | null;
  audio_ratio?: number | null;
  audio_completion_ratio?: number | null;
  enable_groups?: string[];
  tags?: string;
  supported_endpoint_types?: string[];
  group_ratio?: Record<string, number>;
  billing_mode?: string;
  billing_expr?: string;
  pricing_version?: string;
  availability_status?: string;
  availability_reason?: string;
  availability_detected_at?: number;
  availability_checked_at?: number;
};

type PricingApiResponse = {
  success: boolean;
  message?: string;
  data?: PricingModel[];
  vendors?: PricingVendor[];
  group_ratio?: Record<string, number>;
  usable_group?: Record<string, string>;
  supported_endpoint?: Record<string, string>;
  auto_groups?: string[];
};

export type PricingData = {
  models: PricingModel[];
  vendors: PricingVendor[];
  groupRatio: Record<string, number>;
  usableGroup: Record<string, string>;
  supportedEndpoint: Record<string, unknown>;
  autoGroups: string[];
};

export type PricingSearch = {
  q?: string;
  vendor?: string;
  endpoint?: string;
  quota?: string;
};

const QUOTA_TYPE_TOKEN = 0;
const QUOTA_TYPE_REQUEST = 1;
const VENDOR_SORT_PRIORITY: Record<string, number> = {
  openai: 0,
  anthropic: 1,
  google: 2,
  gemini: 2,
};

export function publicPricingUrl(apiBaseUrl = API_BASE_URL, group?: string): string {
  const url = new URL("/api/website/pricing", apiBaseUrl);
  if (group) url.searchParams.set("group", group);
  return url.toString();
}

export async function getPricingData(group?: string): Promise<PricingData> {
  try {
    const response = await fetch(publicPricingUrl(API_BASE_URL, group), {
      next: { revalidate: 300 },
      headers: { accept: "application/json" },
    });
    if (!response.ok) return emptyPricingData();
    const payload = (await response.json()) as PricingApiResponse;
    if (!payload.success) return emptyPricingData();
    return {
      models: payload.data ?? [],
      vendors: payload.vendors ?? [],
      groupRatio: payload.group_ratio ?? {},
      usableGroup: payload.usable_group ?? {},
      supportedEndpoint: payload.supported_endpoint ?? {},
      autoGroups: payload.auto_groups ?? [],
    };
  } catch {
    return emptyPricingData();
  }
}

export function filterPricingModels(models: PricingModel[], search: PricingSearch): PricingModel[] {
  const query = search.q?.trim().toLowerCase();
  const vendor = search.vendor?.trim().toLowerCase();
  const endpoint = search.endpoint?.trim().toLowerCase();
  const quota = search.quota?.trim().toLowerCase();

  return models.filter((model) => {
    if (query) {
      const haystack = [
        model.model_name,
        model.description,
        model.vendor_name,
        model.tags,
        ...(model.supported_endpoint_types ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    if (vendor && vendor !== "all" && model.vendor_name?.toLowerCase() !== vendor) return false;
    if (endpoint && endpoint !== "all" && !(model.supported_endpoint_types ?? []).some((item) => item.toLowerCase() === endpoint)) {
      return false;
    }
    if (quota === "token" && model.quota_type !== QUOTA_TYPE_TOKEN) return false;
    if (quota === "request" && model.quota_type !== QUOTA_TYPE_REQUEST) return false;

    return true;
  });
}

export function sortPricingModelsBySeries(models: PricingModel[]): PricingModel[] {
  return [...models].sort((a, b) => {
    const vendorCompare = getVendorSortKey(a).localeCompare(getVendorSortKey(b), "en", { numeric: true });
    if (vendorCompare !== 0) return vendorCompare;

    const familyCompare = getModelFamilyKey(a.model_name).localeCompare(getModelFamilyKey(b.model_name), "en", { numeric: true });
    if (familyCompare !== 0) return familyCompare;

    return getModelVersionSortKey(a.model_name).localeCompare(getModelVersionSortKey(b.model_name), "en", { numeric: true });
  });
}

export function getVendorName(model: PricingModel, vendors: PricingVendor[]): string {
  return model.vendor_name ?? vendors.find((vendor) => vendor.id === model.vendor_id)?.name ?? "AI";
}

export function getTopVendors(models: PricingModel[], limit = 10): string[] {
  const counts = new Map<string, number>();
  for (const model of models) {
    if (!model.vendor_name) continue;
    counts.set(model.vendor_name, (counts.get(model.vendor_name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([vendor]) => vendor);
}

export function getTopEndpoints(models: PricingModel[], limit = 8): string[] {
  const counts = new Map<string, number>();
  for (const model of models) {
    for (const endpoint of model.supported_endpoint_types ?? []) {
      counts.set(endpoint, (counts.get(endpoint) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([endpoint]) => endpoint);
}

export function isTokenBasedModel(model: PricingModel): boolean {
  return model.quota_type === QUOTA_TYPE_TOKEN;
}

export function formatModelPrice(model: PricingModel, type: "input" | "output" | "cache" = "input"): string {
  if (!isTokenBasedModel(model)) {
    return formatUsd(model.model_price ?? 0);
  }

  const base = Number(model.model_ratio ?? 0) * 2 * getMinGroupRatio(model);
  const price =
    type === "output"
      ? base * Number(model.completion_ratio ?? 1)
      : type === "cache" && model.cache_ratio != null
        ? base * Number(model.cache_ratio)
        : base;

  return formatUsd(price);
}

// Official vendor list price per 1M tokens (ratio convention: model_ratio × $2,
// calibrated to the vendor's published price), before any group discount.
export function getOfficialPriceUsd(model: PricingModel, type: "input" | "output" = "input"): number {
  if (!isTokenBasedModel(model)) return Number(model.model_price ?? 0);
  const base = Number(model.model_ratio ?? 0) * 2;
  return type === "output" ? base * Number(model.completion_ratio ?? 1) : base;
}

// Cheapest visible group ratio for the model — the "60-90% of official" layer.
// Group ratios live in the pricing payload's top-level group_ratio map, keyed
// by the model's enable_groups.
export function getBestGroupRatio(model: PricingModel, fallbackGroupRatio: Record<string, number>): number {
  const groups = Array.isArray(model.enable_groups) ? model.enable_groups.filter(isVisibleGroup) : [];
  const names = groups.includes("all") ? Object.keys(fallbackGroupRatio).filter(isVisibleGroup) : groups;
  const ratios = names
    .map((group) => model.group_ratio?.[group] ?? fallbackGroupRatio[group])
    .filter((ratio): ratio is number => typeof ratio === "number" && Number.isFinite(ratio) && ratio > 0);
  return ratios.length > 0 ? Math.min(...ratios) : 1;
}

// Effective price after the best top-up bonus tier ($200 + $100 → 2/3 of list).
export function discountedPriceUsd(value: number): number {
  return (value * 2) / 3;
}

export function formatUsdPrice(value: number): string {
  return formatUsd(value);
}

export function getAvailableGroups(
  model: PricingModel,
  fallbackGroupRatio: Record<string, number> = {},
  usableGroup: Record<string, string> = {}
): string[] {
  const usableGroups = Object.keys(usableGroup).filter(isVisibleGroup);
  const groups = Array.isArray(model.enable_groups) ? model.enable_groups.filter(isVisibleGroup) : [];
  if (groups.includes("all")) return usableGroups;
  if (groups.length > 0 && usableGroups.length > 0) {
    const usableSet = new Set(usableGroups);
    return groups.filter((group) => usableSet.has(group));
  }
  if (groups.length > 0) return groups;
  return Object.keys(model.group_ratio ?? fallbackGroupRatio);
}

export function formatGroupTokenPrice(
  model: PricingModel,
  group: string,
  groupRatio: Record<string, number>,
  type: "input" | "output" | "cache" | "create_cache" | "image" | "audio_input" | "audio_output"
): string {
  if (!isTokenBasedModel(model)) return "-";
  const ratio = getGroupRatio(model, group, groupRatio);
  const base = Number(model.model_ratio ?? 0) * 2 * ratio;
  const price = calculateTokenPrice(model, base, type);
  return Number.isFinite(price) ? formatUsd(price) : "-";
}

export function formatGroupRequestPrice(model: PricingModel, group: string, groupRatio: Record<string, number>): string {
  if (isTokenBasedModel(model)) return "-";
  const ratio = getGroupRatio(model, group, groupRatio);
  return formatUsd(Number(model.model_price ?? 0) * ratio);
}

export function formatRatio(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return "-";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 8,
  }).format(Number(value));
}

export function parseTags(tags?: string): string[] {
  if (!tags) return [];
  return tags
    .split(/[,\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function getMinGroupRatio(model: PricingModel): number {
  const groups = Array.isArray(model.enable_groups) ? model.enable_groups : [];
  if (groups.length === 0) return 1;
  const ratios = groups
    .map((group) => model.group_ratio?.[group])
    .filter((ratio): ratio is number => typeof ratio === "number" && Number.isFinite(ratio));
  return ratios.length > 0 ? Math.min(...ratios) : 1;
}

function getGroupRatio(model: PricingModel, group: string, fallbackGroupRatio: Record<string, number>): number {
  const modelRatio = model.group_ratio?.[group];
  if (typeof modelRatio === "number" && Number.isFinite(modelRatio)) return modelRatio;
  const fallbackRatio = fallbackGroupRatio[group];
  if (typeof fallbackRatio === "number" && Number.isFinite(fallbackRatio)) return fallbackRatio;
  return 1;
}

function isVisibleGroup(group: string): boolean {
  return group !== "" && group !== "auto";
}

function getVendorSortKey(model: PricingModel): string {
  const vendor = (model.vendor_name || model.vendor_icon || "zz-provider").toLowerCase();
  const priority = VENDOR_SORT_PRIORITY[vendor] ?? 50;
  return `${priority}:${vendor}`;
}

export function getModelFamilyKey(modelName: string): string {
  const name = modelName.toLowerCase();
  const normalized = name
    .replace(/\b(20\d{2}[-_]?\d{2}[-_]?\d{2}|\d{8})\b/g, "")
    .replace(/[-_](latest|preview|beta|stable|turbo|instruct|chat|online|fk|br|cc|compact)$/g, "")
    .replace(/[-_]+/g, "-");

  const familyPatterns: Array<[RegExp, string]> = [
    [/^gpt-5(?:[.-]\d+)?(?:-|$)/, "gpt-5"],
    [/^gpt-4(?:[.-]\d+)?(?:-|$)/, "gpt-4"],
    [/^gpt-3(?:[.-]\d+)?(?:-|$)/, "gpt-3"],
    [/^o[1-4](?:-|$)/, "openai-o"],
    [/^claude-(opus|sonnet|haiku|fable)-(\d+)/, "claude-$1-$2"],
    [/^gemini-(\d+(?:\.\d+)?)/, "gemini-$1"],
    [/^qwen(?:\d+|[-_]\d+)?/, "qwen"],
    [/^deepseek[-_]?r/, "deepseek-r"],
    [/^deepseek/, "deepseek"],
    [/^doubao/, "doubao"],
    [/^hunyuan/, "hunyuan"],
    [/^glm[-_]?/, "glm"],
    [/^mistral/, "mistral"],
    [/^llama[-_]?\d+/, "llama"],
    [/^grok[-_]?/, "grok"],
    [/^kimi[-_]?/, "kimi"],
    [/^abab[-_]?/, "abab"],
    [/^seedance[-_]?/, "seedance"],
    [/^kling[-_]?/, "kling"],
    [/^veo[-_]?/, "veo"],
    [/^imagen[-_]?/, "imagen"],
    [/^sora[-_]?/, "sora"],
    [/^dall[-_]?e/, "dalle"],
    [/^text-embedding/, "text-embedding"],
  ];

  for (const [pattern, key] of familyPatterns) {
    const match = normalized.match(pattern);
    if (match) return key.replace(/\$(\d+)/g, (_, index: string) => match[Number(index)] ?? "");
  }

  return normalized.split("-").slice(0, 2).join("-") || normalized;
}

function getModelVersionSortKey(modelName: string): string {
  const name = modelName.toLowerCase();
  const tier =
    /latest|preview/.test(name) ? "0" :
    /mini|small|haiku|flash|nano/.test(name) ? "2" :
    /pro|sonnet|medium/.test(name) ? "1" :
    /opus|ultra|large|max/.test(name) ? "0" :
    "1";
  return `${tier}:${name}`;
}

function calculateTokenPrice(
  model: PricingModel,
  base: number,
  type: "input" | "output" | "cache" | "create_cache" | "image" | "audio_input" | "audio_output"
): number {
  switch (type) {
    case "input":
      return base;
    case "output":
      return base * Number(model.completion_ratio ?? 1);
    case "cache":
      return model.cache_ratio == null ? Number.NaN : base * Number(model.cache_ratio);
    case "create_cache":
      return model.create_cache_ratio == null ? Number.NaN : base * Number(model.create_cache_ratio);
    case "image":
      return model.image_ratio == null ? Number.NaN : base * Number(model.image_ratio);
    case "audio_input":
      return model.audio_ratio == null ? Number.NaN : base * Number(model.audio_ratio);
    case "audio_output":
      return model.audio_ratio == null || model.audio_completion_ratio == null
        ? Number.NaN
        : base * Number(model.audio_ratio) * Number(model.audio_completion_ratio);
  }
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return "-";
  const digits = Math.abs(value) >= 1 ? 4 : 6;
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
  }).format(value);
  return formatted.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
}

function emptyPricingData(): PricingData {
  return { models: [], vendors: [], groupRatio: {}, usableGroup: {}, supportedEndpoint: {}, autoGroups: [] };
}
