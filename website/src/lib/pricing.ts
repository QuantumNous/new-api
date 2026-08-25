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

export type ModelDirectoryMetadata = {
  author: string;
  providers: string[];
  modalities: Array<"text" | "image" | "file" | "audio" | "video">;
  context_tokens: number | null;
  series: string;
  categories: string[];
  released_at: string;
  distillable: boolean;
  popularity_rank?: number;
  top_ten_rank?: number;
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
  group_model_ratio?: Record<string, number>;
  billing_mode?: string;
  billing_expr?: string;
  pricing_version?: string;
  featured_order?: number;
  display_pricing?: ModelDisplayPricing;
  availability_status?: string;
  availability_reason?: string;
  availability_detected_at?: number;
  availability_checked_at?: number;
  directory_metadata?: ModelDirectoryMetadata;
};

export type DisplayPricingUnit = "per_second" | "request" | "token" | "tiered_expr";
export type DisplayPricingDimension =
  | "second"
  | "request"
  | "input"
  | "output"
  | "cache"
  | "create_cache"
  | "image"
  | "audio_input"
  | "audio_output";
export type DisplayPricingVariant = "configured" | "plg";

export type DisplayPricePair = {
  configured?: number;
  plg?: number;
  from?: boolean;
};

export type ModelDisplayPricing = {
  billing_kind: DisplayPricingUnit;
  prices: Partial<Record<DisplayPricingDimension, DisplayPricePair>>;
};

export type ResolvedModelDisplayPrice = {
  text: string;
  value: number;
  variant: DisplayPricingVariant;
  dimension: DisplayPricingDimension;
  configuredValue?: number;
  configured?: number;
  plg?: number;
  unit: string;
  from: boolean;
  source: "display" | "legacy";
};

type PricingApiResponse = {
  success: boolean;
  message?: string;
  data?: PricingModel[];
  vendors?: PricingVendor[];
  group_ratio?: Record<string, number>;
  group_model_ratio?: GroupModelRatio;
  usable_group?: Record<string, string>;
  supported_endpoint?: Record<string, string>;
  auto_groups?: string[];
  display_pricing?: Record<string, unknown>;
};

export type GroupModelRatio = Record<string, Record<string, number>>;

export type PricingData = {
  models: PricingModel[];
  vendors: PricingVendor[];
  groupRatio: Record<string, number>;
  groupModelRatio: GroupModelRatio;
  usableGroup: Record<string, string>;
  supportedEndpoint: Record<string, unknown>;
  autoGroups: string[];
};

export type PricingSearch = {
  q?: string;
  vendor?: string;
  endpoint?: string;
  purpose?: string;
  pricing?: string;
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
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (!response.ok) return emptyPricingData();
    const payload = (await response.json()) as PricingApiResponse;
    if (!payload.success) return emptyPricingData();
    const displayPricing = parseDisplayPricingMap(payload.display_pricing);
    return {
      models: (payload.data ?? []).map((model) => attachPricingPayloadData(model, displayPricing)),
      vendors: payload.vendors ?? [],
      groupRatio: payload.group_ratio ?? {},
      groupModelRatio: payload.group_model_ratio ?? {},
      usableGroup: payload.usable_group ?? {},
      supportedEndpoint: payload.supported_endpoint ?? {},
      autoGroups: payload.auto_groups ?? [],
    };
  } catch {
    return emptyPricingData();
  }
}

export function buildEffectiveGroupRatio(
  model: Pick<PricingModel, "model_name" | "group_ratio">,
  fallbackGroupRatio: Record<string, number>,
  groupModelRatio: GroupModelRatio = {}
): Record<string, number> {
  const effective = { ...fallbackGroupRatio, ...(model.group_ratio ?? {}) };
  const matchedModelName = formatMatchingModelName(model.model_name);
  for (const [group, modelRatios] of Object.entries(groupModelRatio)) {
    const ratio = modelRatios?.[matchedModelName];
    if (typeof ratio === "number" && Number.isFinite(ratio)) {
      effective[group] = ratio;
    }
  }
  return effective;
}

export function getGroupModelRatioForModel(modelName: string, groupModelRatio: GroupModelRatio = {}): Record<string, number> {
  const result: Record<string, number> = {};
  const matchedModelName = formatMatchingModelName(modelName);
  for (const [group, modelRatios] of Object.entries(groupModelRatio)) {
    const ratio = modelRatios?.[matchedModelName];
    if (typeof ratio === "number" && Number.isFinite(ratio)) {
      result[group] = ratio;
    }
  }
  return result;
}

export function formatMatchingModelName(modelName: string): string {
  let name = modelName;
  if (name.startsWith("gemini-2.5-flash-lite")) {
    name = handleThinkingBudgetModel(name, "gemini-2.5-flash-lite", "gemini-2.5-flash-lite-thinking-*");
  } else if (name.startsWith("gemini-2.5-flash")) {
    name = handleThinkingBudgetModel(name, "gemini-2.5-flash", "gemini-2.5-flash-thinking-*");
  } else if (name.startsWith("gemini-2.5-pro")) {
    name = handleThinkingBudgetModel(name, "gemini-2.5-pro", "gemini-2.5-pro-thinking-*");
  }

  if (name.startsWith("gpt-4-gizmo")) {
    return "gpt-4-gizmo-*";
  }
  if (name.startsWith("gpt-4o-gizmo")) {
    return "gpt-4o-gizmo-*";
  }
  return name;
}

function handleThinkingBudgetModel(modelName: string, prefix: string, wildcard: string): string {
  return modelName.startsWith(prefix) && modelName.includes("-thinking-") ? wildcard : modelName;
}

export function filterPricingModels(models: PricingModel[], search: PricingSearch): PricingModel[] {
  const query = search.q?.trim().toLowerCase();
  const vendor = search.vendor?.trim().toLowerCase();
  const endpoint = search.endpoint?.trim().toLowerCase();
  const pricing = (search.pricing ?? search.quota)?.trim().toLowerCase();

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
    if (pricing === "token" && model.quota_type !== QUOTA_TYPE_TOKEN) return false;
    if (pricing === "request" && model.quota_type !== QUOTA_TYPE_REQUEST) return false;

    return true;
  });
}

export function sortPricingModelsBySeries(models: PricingModel[]): PricingModel[] {
  return [...models].sort((a, b) => {
    const aFeaturedOrder = Number.isFinite(a.featured_order)
      ? (a.featured_order as number)
      : Number.POSITIVE_INFINITY;
    const bFeaturedOrder = Number.isFinite(b.featured_order)
      ? (b.featured_order as number)
      : Number.POSITIVE_INFINITY;
    if (aFeaturedOrder !== bFeaturedOrder) return aFeaturedOrder - bFeaturedOrder;

    const vendorCompare = getVendorSortKey(a).localeCompare(getVendorSortKey(b), "en", { numeric: true });
    if (vendorCompare !== 0) return vendorCompare;

    const familyCompare = getModelFamilyKey(a.model_name).localeCompare(getModelFamilyKey(b.model_name), "en", { numeric: true });
    if (familyCompare !== 0) return familyCompare;

    return getModelVersionSortKey(a.model_name).localeCompare(getModelVersionSortKey(b.model_name), "en", { numeric: true });
  });
}

const VENDOR_BY_MODEL_NAME: Array<[RegExp, string]> = [
  [/^(gpt|o[1-9]|dall-e|sora|codex|text-embedding|whisper|tts)/i, "OpenAI"],
  [/^claude/i, "Anthropic"],
  [/^(gemini|imagen|veo|gemma)/i, "Google"],
  [/^(seedance|seedream|doubao|bytedance)/i, "ByteDance"],
  [/^deepseek/i, "DeepSeek"],
  [/^(qwen|qwq)/i, "Qwen"],
  [/^(glm|chatglm)/i, "Z.ai"],
  [/^(kimi|moonshot)/i, "Moonshot"],
  [/^grok/i, "xAI"],
  [/^minimax/i, "MiniMax"],
  [/^(llama|meta)/i, "Meta"],
  [/^mistral/i, "Mistral"],
  [/^sonilo/i, "Sonilo"],
];

/**
 * Vendor for a model, preferring the catalog's own value.
 *
 * The pricing payload leaves vendor_id unresolved for some models (veo-3.1 has
 * no vendor entry today), and the previous fallback was the literal "AI" --
 * which rendered as "More AI models from AI" and "AI · $1" on the cards. Model
 * names carry the vendor reliably, so infer from the name before giving up.
 */
export function getVendorName(model: PricingModel, vendors: PricingVendor[]): string {
  const known = model.vendor_name ?? vendors.find((vendor) => vendor.id === model.vendor_id)?.name;
  if (known) return known;
  const inferred = VENDOR_BY_MODEL_NAME.find(([pattern]) => pattern.test(model.model_name))?.[1];
  // Last resort names the catalog rather than asserting a vendor we do not know.
  return inferred ?? "Flatkey catalog";
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
//
// Pass `groupModelRatio` (the payload's top-level map) whenever it is available:
// per-model overrides beat the flat group ratio during billing, so omitting them
// quotes a model higher than it is actually charged. Callers that already folded
// the overrides in (via buildEffectiveGroupRatio) can leave it out.
export function getBestGroupRatio(
  model: PricingModel,
  fallbackGroupRatio: Record<string, number>,
  groupModelRatio: GroupModelRatio = {}
): number {
  const effective = buildEffectiveGroupRatio(model, fallbackGroupRatio, groupModelRatio);
  const groups = Array.isArray(model.enable_groups) ? model.enable_groups.filter(isVisibleGroup) : [];
  const names = groups.includes("all") ? Object.keys(effective).filter(isVisibleGroup) : groups;
  const ratios = names
    .map((group) => effective[group])
    .filter((ratio): ratio is number => typeof ratio === "number" && Number.isFinite(ratio) && ratio > 0);
  return ratios.length > 0 ? Math.min(...ratios) : 1;
}

// Effective price shown to visitors. The top-up bonus tiers are retired, so the
// group ratio (applied by the caller via getBestGroupRatio) is the only discount
// layer left and the listed price passes through unchanged.
export function discountedPriceUsd(value: number): number {
  return value;
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
  const ratioGroups = Object.keys(model.group_ratio ?? fallbackGroupRatio).filter(isVisibleGroup);
  if (groups.includes("all")) return usableGroups;
  const modelSpecificGroups = Object.keys(model.group_model_ratio ?? {}).filter(isVisibleGroup);
  const candidateGroups = Array.from(new Set(groups.length > 0 ? [...groups, ...modelSpecificGroups] : ratioGroups));
  if (candidateGroups.length > 0 && usableGroups.length > 0) {
    const usableSet = new Set(usableGroups);
    return candidateGroups.filter((group) => usableSet.has(group));
  }
  if (candidateGroups.length > 0) return candidateGroups;
  return ratioGroups;
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

export function resolveModelDisplayPrice(
  model: PricingModel,
  dimension?: DisplayPricingDimension,
  variant: DisplayPricingVariant = "plg",
  fallbackGroupRatio: Record<string, number> = {}
): ResolvedModelDisplayPrice | null {
  const resolvedDimension = dimension ?? defaultDisplayDimension(model);
  const displayPrice = resolveParsedDisplayPrice(model, resolvedDimension, variant);
  if (displayPrice) return displayPrice;
  const legacyPrice = resolveLegacyDisplayPrice(model, resolvedDimension, variant, fallbackGroupRatio);
  if (legacyPrice || dimension != null) return legacyPrice;

  // A malformed display contract must not change the legacy billing dimension
  // selected for a model. Retry the legacy dimension when the display kind's
  // pair is absent or invalid (for example, a request model with a bad
  // per-second entry).
  const fallbackDimension = legacyDisplayDimension(model);
  if (fallbackDimension === resolvedDimension) return null;
  return resolveLegacyDisplayPrice(model, fallbackDimension, variant, fallbackGroupRatio);
}

export function formatResolvedModelDisplayPrice(price: ResolvedModelDisplayPrice): string {
  return `${price.from ? "from " : ""}${price.text} ${price.unit}`;
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

function attachPricingPayloadData(model: PricingModel, displayPricing: Record<string, ModelDisplayPricing>): PricingModel {
  const parsed = displayPricing[model.model_name];
  const directoryMetadata = parseModelDirectoryMetadata(model.directory_metadata);
  return {
    ...model,
    ...(parsed ? { display_pricing: parsed } : {}),
    ...(directoryMetadata ? { directory_metadata: directoryMetadata } : { directory_metadata: undefined }),
  };
}

function parseModelDirectoryMetadata(value: unknown): ModelDirectoryMetadata | null {
  if (!isRecord(value)) return null;
  const author = parseRequiredString(value.author);
  const providers = parseRequiredStringArray(value.providers);
  const modalities = parseRequiredStringArray(value.modalities);
  const series = parseRequiredString(value.series);
  const categories = parseRequiredStringArray(value.categories);
  const releasedAt = parseRequiredString(value.released_at);
  const contextTokens = value.context_tokens;
  if (
    !author ||
    !providers ||
    !modalities ||
    !modalities.every(isDirectoryModality) ||
    !series ||
    !categories ||
    !releasedAt ||
    !/^\d{4}-\d{2}-\d{2}$/.test(releasedAt) ||
    typeof value.distillable !== "boolean" ||
    !(contextTokens === null || (typeof contextTokens === "number" && Number.isInteger(contextTokens) && contextTokens > 0))
  ) {
    return null;
  }
  const popularityRank = parseOptionalPositiveInteger(value.popularity_rank);
  const topTenRank = parseOptionalPositiveInteger(value.top_ten_rank);
  if (value.popularity_rank != null && popularityRank == null) return null;
  if (value.top_ten_rank != null && (topTenRank == null || topTenRank > 10)) return null;
  return {
    author,
    providers,
    modalities: modalities as ModelDirectoryMetadata["modalities"],
    context_tokens: contextTokens,
    series,
    categories,
    released_at: releasedAt,
    distillable: value.distillable,
    ...(popularityRank == null ? {} : { popularity_rank: popularityRank }),
    ...(topTenRank == null ? {} : { top_ten_rank: topTenRank }),
  };
}

function parseRequiredString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function parseRequiredStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const parsed = value.map(parseRequiredString);
  return parsed.every((item): item is string => item != null) && new Set(parsed).size === parsed.length ? parsed : null;
}

function parseOptionalPositiveInteger(value: unknown): number | null {
  return value == null ? null : typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function isDirectoryModality(value: string): value is ModelDirectoryMetadata["modalities"][number] {
  return value === "text" || value === "image" || value === "file" || value === "audio" || value === "video";
}

function parseDisplayPricingMap(value: unknown): Record<string, ModelDisplayPricing> {
  if (!isRecord(value)) return {};
  const parsed: Record<string, ModelDisplayPricing> = {};
  for (const [modelName, entry] of Object.entries(value)) {
    const pricing = parseModelDisplayPricing(entry);
    if (pricing) parsed[modelName] = pricing;
  }
  return parsed;
}

function parseModelDisplayPricing(value: unknown): ModelDisplayPricing | null {
  if (!isRecord(value)) return null;
  const billingKind = value.billing_kind;
  if (!isDisplayPricingUnit(billingKind)) return null;
  if (!isRecord(value.prices)) return { billing_kind: billingKind, prices: {} };

  const prices: ModelDisplayPricing["prices"] = {};
  for (const [dimension, pair] of Object.entries(value.prices)) {
    if (!isDisplayPricingDimension(dimension) || !isRecord(pair)) continue;
    const configured = parseDisplayPriceValue(pair.configured);
    const plg = parseDisplayPriceValue(pair.plg);
    if (configured == null && plg == null) continue;
    prices[dimension] = {
      ...(configured == null ? {} : { configured }),
      ...(plg == null ? {} : { plg }),
      from: pair.from === true,
    };
  }

  return { billing_kind: billingKind, prices };
}

function parseDisplayPriceValue(value: unknown): number | null {
  const parsed = typeof value === "string" && value.trim() !== "" ? Number(value) : typeof value === "number" ? value : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function resolveParsedDisplayPrice(
  model: PricingModel,
  dimension: DisplayPricingDimension,
  variant: DisplayPricingVariant
): ResolvedModelDisplayPrice | null {
  const pair = model.display_pricing?.prices[dimension];
  if (!pair) return null;
  const value = variant === "plg" ? pair.plg : pair.configured;
  if (!isValidDisplayNumber(value)) return null;
  return {
    text: formatUsd(value),
    value,
    variant,
    dimension,
    configuredValue: pair.configured,
    configured: pair.configured,
    plg: pair.plg,
    unit: unitForDisplayDimension(dimension),
    from: pair.from === true,
    source: "display",
  };
}

function resolveLegacyDisplayPrice(
  model: PricingModel,
  dimension: DisplayPricingDimension,
  variant: DisplayPricingVariant,
  fallbackGroupRatio: Record<string, number>
): ResolvedModelDisplayPrice | null {
  const configured = calculateLegacyDisplayPrice(model, dimension, "configured", fallbackGroupRatio);
  const plg = calculateLegacyDisplayPrice(model, dimension, "plg", fallbackGroupRatio);
  const value = variant === "plg" ? plg : configured;
  if (!isValidDisplayNumber(value)) return null;
  return {
    text: formatUsd(value),
    value,
    variant,
    dimension,
    configuredValue: configured,
    configured,
    plg,
    unit: unitForDisplayDimension(dimension),
    from: false,
    source: "legacy",
  };
}

function calculateLegacyDisplayPrice(
  model: PricingModel,
  dimension: DisplayPricingDimension,
  variant: DisplayPricingVariant,
  fallbackGroupRatio: Record<string, number>
): number {
  const ratio = variant === "plg" ? getGroupRatio(model, WEBSITE_PUBLIC_PRICING_GROUP, fallbackGroupRatio) : 1;
  if (dimension === "request") {
    if (isTokenBasedModel(model)) return Number.NaN;
    return Number(model.model_price ?? 0) * ratio;
  }
  if (dimension === "second") return Number.NaN;
  if (!isTokenBasedModel(model)) return Number.NaN;
  const base = Number(model.model_ratio ?? 0) * 2 * ratio;
  return calculateTokenPrice(model, base, dimension);
}

function defaultDisplayDimension(model: PricingModel): DisplayPricingDimension {
  if (model.display_pricing?.billing_kind === "per_second") return "second";
  if (model.display_pricing?.billing_kind === "request") return "request";
  if (!isTokenBasedModel(model)) return "request";
  return "input";
}

function legacyDisplayDimension(model: PricingModel): DisplayPricingDimension {
  return isTokenBasedModel(model) ? "input" : "request";
}

function unitForDisplayDimension(dimension: DisplayPricingDimension): string {
  switch (dimension) {
    case "second":
      return "/ second";
    case "request":
      return "/ request";
    // Image and audio ratios multiply token counts in the billing pipeline
    // (see service/text_quota.go), so every remaining dimension is priced per
    // 1M tokens. Keep the switch exhaustive so a new dimension must pick a
    // unit explicitly.
    case "input":
    case "output":
    case "cache":
    case "create_cache":
    case "image":
    case "audio_input":
    case "audio_output":
      return "/ 1M tokens";
  }
}

function isDisplayPricingUnit(value: unknown): value is DisplayPricingUnit {
  return value === "per_second" || value === "request" || value === "token" || value === "tiered_expr";
}

function isDisplayPricingDimension(value: string): value is DisplayPricingDimension {
  return (
    value === "second" ||
    value === "request" ||
    value === "input" ||
    value === "output" ||
    value === "cache" ||
    value === "create_cache" ||
    value === "image" ||
    value === "audio_input" ||
    value === "audio_output"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidDisplayNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
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
  return { models: [], vendors: [], groupRatio: {}, groupModelRatio: {}, usableGroup: {}, supportedEndpoint: {}, autoGroups: [] };
}
