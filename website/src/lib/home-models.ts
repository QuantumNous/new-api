import {
  discountedPriceUsd,
  formatUsdPrice,
  getBestGroupRatio,
  getOfficialPriceUsd,
  getVendorName,
  buildEffectiveGroupRatio,
  isTokenBasedModel,
  parseTags,
  resolveModelDisplayPrice,
  sortPricingModelsBySeries,
  type GroupModelRatio,
  type PricingData,
  type PricingModel,
} from "./pricing";
import { getModelMeta, inferSeries } from "./model-directory-meta";

export type HomePricedModel = {
  name: string;
  vendor: string;
  official: string;
  discounted: string;
  officialUsd: number;
  discountedUsd: number;
  priceUnit?: string;
  pricePrefix?: string;
  billingUnit?: "token" | "request" | "second";
  inputFilterUsd?: number;
  outputFilterUsd?: number;
  input?: string;
  inputOfficial?: string;
  output?: string;
  outputOfficial?: string;
  billing?: string;
  capabilities?: string[];
  endpointTypes?: string[];
  // Directory-only metadata, sourced from model-directory-meta rather than the
  // pricing payload. Optional so home/pricing callers are unaffected.
  series?: string;
  contextTokens?: number | null;
  top10?: number;
  // Lobehub static-svg icon key rendered by ModelLogo; derived from the model
  // name because the pricing payload's icon fields are empty in production.
  iconKey: string;
};

const ICON_KEY_PATTERNS: Array<[RegExp, string]> = [
  [/^(gpt|o\d|dall-e|sora|codex)/i, "openai"],
  [/^claude/i, "claude-color"],
  [/^(gemini|imagen|veo)/i, "gemini-color"],
  [/^deepseek/i, "deepseek-color"],
  [/^qwen/i, "qwen-color"],
  [/^glm|^chatglm/i, "chatglm-color"],
  [/^kimi|^moonshot/i, "kimi-color"],
  [/^grok/i, "grok"],
  [/^llama/i, "meta-color"],
  [/^mistral/i, "mistral-color"],
  [/^doubao/i, "doubao-color"],
  [/^seedance/i, "bytedance-color"],
  [/^minimax/i, "minimax-color"],
];

export function modelIconKey(modelName: string, vendor: string): string {
  for (const [pattern, key] of ICON_KEY_PATTERNS) {
    if (pattern.test(modelName)) return key;
  }
  return vendor.toLowerCase();
}

// One flagship per vendor for the hero price-comparison card — spans Western +
// Chinese vendors so it reads "many models", not just OpenAI/Anthropic. Vendor-
// driven (not name-regex) so it stays robust as model names churn.
const FLAGSHIP_VENDORS: Array<{ label: string; match: RegExp }> = [
  { label: "OpenAI", match: /openai/i },
  { label: "Anthropic", match: /anthropic|claude/i },
  { label: "Google", match: /google|gemini/i },
  { label: "DeepSeek", match: /deepseek/i },
  { label: "Qwen", match: /qwen|alibaba|阿里|通义/i },
  { label: "Zhipu", match: /zhipu|智谱|glm/i },
  { label: "xAI", match: /xai|grok/i },
];
// Variants that never read as "the flagship" of a family.
const NON_FLAGSHIP =
  /[-_.](mini|nano|lite|flash|haiku|preview|codex|image|audio|realtime|embedding|turbo|thinking|exp|deepsearch|tts|ocr)/i;

export function pickFlagshipModels(data: PricingData, limit = 7): HomePricedModel[] {
  const priced = pricedTokenModels(data);
  const rows: HomePricedModel[] = [];
  const seenVendors = new Set<string>();
  for (const vendor of FLAGSHIP_VENDORS) {
    const forVendor = priced.filter((model) => {
      const name = model.vendor_name ?? getVendorName(model, data.vendors);
      return vendor.match.test(name) || vendor.match.test(model.model_name);
    });
    if (forVendor.length === 0) continue;
    // Prefer a "real" flagship (drop mini/lite/preview/etc), highest official
    // price first — but ignore placeholder-priced outliers (some models carry a
    // sentinel ~$75 list price). Fall back to any priced model from the vendor.
    const SANE_MAX = 12; // official $/1M input; filters sentinel pricing
    const clean = forVendor.filter((model) => !NON_FLAGSHIP.test(model.model_name));
    const byPriceDesc = (a: PricingModel, b: PricingModel) => getOfficialPriceUsd(b) - getOfficialPriceUsd(a);
    const flagship =
      clean.filter((model) => getOfficialPriceUsd(model) <= SANE_MAX).sort(byPriceDesc)[0] ??
      clean.sort(byPriceDesc)[0] ??
      forVendor.filter((model) => getOfficialPriceUsd(model) <= SANE_MAX).sort(byPriceDesc)[0] ??
      forVendor.sort(byPriceDesc)[0];
    if (!flagship || seenVendors.has(vendor.label)) continue;
    seenVendors.add(vendor.label);
    rows.push(toHomeRow(flagship, data));
    if (rows.length >= limit) break;
  }
  return rows;
}

export function buildHomeModelRows(data: PricingData): HomePricedModel[] {
  return sortPricingModelsBySeries(pricedTokenModels(data)).map((model) => toHomeRow(model, data));
}

export function finalHomePricedRowsByName(rows: HomePricedModel[]): HomePricedModel[] {
  return [...new Map(rows.map((row) => [row.name, row])).values()];
}

// Rows for an externally filtered/sorted model list (the /models directory).
// Includes per-request and display-priced models; rows carry unit metadata so
// the table can mix token, request, and second billing without a global suffix.
export function buildRowsForModels(
  models: PricingModel[],
  vendors: PricingData["vendors"],
  groupRatio: Record<string, number>,
  groupModelRatio: GroupModelRatio = {}
): HomePricedModel[] {
  return models
    .filter((model) => getOfficialPriceUsd(model) > 0 || resolveModelDisplayPrice(model, undefined, "plg", groupRatio) != null)
    .map((model) => {
      const official = getOfficialPriceUsd(model);
      // Per-model overrides in group_model_ratio beat the flat group ratio
      // during billing, so the quoted price has to apply them too — otherwise a
      // model priced below its group is advertised higher than it is charged.
      const effectiveGroupRatio = buildEffectiveGroupRatio(model, groupRatio, groupModelRatio);
      const listed = official * getBestGroupRatio(model, effectiveGroupRatio);
      const vendor = model.vendor_name ?? getVendorName(model, vendors);
      const displayPrice = resolveModelDisplayPrice(model, undefined, "plg", effectiveGroupRatio);
      const officialDisplayPrice = displayPrice
        ? resolveModelDisplayPrice(model, displayPrice.dimension, "configured", effectiveGroupRatio)
        : null;
      const inputPrice = resolveModelDisplayPrice(model, "input", "plg", effectiveGroupRatio);
      const officialInputPrice = inputPrice ? resolveModelDisplayPrice(model, "input", "configured", effectiveGroupRatio) : null;
      const outputPrice = resolveModelDisplayPrice(model, "output", "plg", effectiveGroupRatio);
      const officialOutputPrice = outputPrice ? resolveModelDisplayPrice(model, "output", "configured", effectiveGroupRatio) : null;
      const usesParsedDisplayPrice = displayPrice?.source === "display";
      const discountedUsd = usesParsedDisplayPrice ? displayPrice.value : discountedPriceUsd(listed);
      const billingUnit = modelBillingUnit(model, displayPrice?.unit);
      const inputFilterUsd = billingUnit === "token" ? inputPrice?.value : discountedUsd;
      const outputFilterUsd = billingUnit === "token" ? outputPrice?.value : discountedUsd;
      const directoryMeta = getModelMeta(model.model_name);
      return {
        name: model.model_name,
        // The metadata table is authoritative for the author: the payload
        // leaves vendor_id empty for some models (Macaron, Veo, Gemma) and
        // would otherwise fall back to the literal "AI".
        vendor: directoryMeta?.vendor ?? vendor,
        official: usesParsedDisplayPrice && officialDisplayPrice ? officialDisplayPrice.text : formatUsdPrice(official),
        discounted: usesParsedDisplayPrice ? displayPrice.text : formatUsdPrice(discountedUsd),
        officialUsd: usesParsedDisplayPrice && officialDisplayPrice ? officialDisplayPrice.value : official,
        discountedUsd,
        input: inputPrice?.text ?? (usesParsedDisplayPrice ? displayPrice.text : formatUsdPrice(discountedUsd)),
        inputOfficial: officialInputPrice?.text ?? (usesParsedDisplayPrice && officialDisplayPrice ? officialDisplayPrice.text : formatUsdPrice(official)),
        output: outputPrice?.text,
        outputOfficial: officialOutputPrice?.text,
        billingUnit,
        inputFilterUsd,
        outputFilterUsd,
        billing: modelBillingLabel(model, displayPrice?.unit),
        capabilities: modelCapabilities(model),
        endpointTypes: model.supported_endpoint_types ?? [],
        priceUnit: displayPrice ? normalizeDisplayUnit(displayPrice.unit) : isTokenBasedModel(model) ? "per 1M tokens" : "per request",
        pricePrefix: displayPrice?.from ? "from" : undefined,
        series: directoryMeta?.series ?? inferSeries(model.model_name),
        contextTokens: directoryMeta?.contextTokens ?? null,
        top10: directoryMeta?.top10,
        iconKey: model.icon || model.vendor_icon || modelIconKey(model.model_name, vendor),
      };
    });
}

function pricedTokenModels(data: PricingData): PricingModel[] {
  const seen = new Set<string>();
  return data.models.filter((model) => {
    if (!isTokenBasedModel(model) || getOfficialPriceUsd(model) <= 0) return false;
    if (seen.has(model.model_name)) return false;
    seen.add(model.model_name);
    return true;
  });
}

// Strike-through = official vendor price; green = after the group ratio
// (i.e. 60-90% of official). The top-up bonus layer is retired.
function toHomeRow(model: PricingModel, data: PricingData): HomePricedModel {
  const official = getOfficialPriceUsd(model);
  const listed = official * getBestGroupRatio(model, data.groupRatio);
  const vendor = model.vendor_name ?? getVendorName(model, data.vendors);
  return {
    name: model.model_name,
    vendor,
    official: formatUsdPrice(official),
    discounted: formatUsdPrice(discountedPriceUsd(listed)),
    officialUsd: official,
    discountedUsd: discountedPriceUsd(listed),
    iconKey: model.icon || model.vendor_icon || modelIconKey(model.model_name, vendor),
  };
}

function normalizeDisplayUnit(unit: string): string {
  return unit.replace(/^\s*\/\s*/, "per ");
}

function modelBillingLabel(model: PricingModel, displayUnit?: string): string {
  const unit = modelBillingUnit(model, displayUnit);
  if (unit === "token") return "Token";
  if (unit === "second") return "Second";
  return "Request";
}

function modelBillingUnit(model: PricingModel, displayUnit?: string): "token" | "request" | "second" {
  if (displayUnit === "/ second") return "second";
  if (displayUnit === "/ request") return "request";
  if (isTokenBasedModel(model)) return "token";
  return "request";
}

const CAPABILITY_LABELS: Record<string, string> = {
  audio: "Audio",
  api: "API",
  cache: "Cache",
  chat: "Chat",
  code: "Code",
  image: "Image",
  json: "JSON",
  reasoning: "Reasoning",
  realtime: "Realtime",
  response: "Responses",
  responses: "Responses",
  think: "Think",
  thinking: "Think",
  tool: "Tools",
  tools: "Tools",
  video: "Video",
  vision: "Vision",
  web: "Web",
};

function modelCapabilities(model: PricingModel): string[] {
  const labels: string[] = [];
  const add = (value: string | undefined) => {
    if (!value) return;
    const key = value.trim().toLowerCase();
    if (!key) return;
    const label = CAPABILITY_LABELS[key] ?? endpointCapabilityLabel(key);
    if (!label) return;
    if (!labels.some((existing) => existing.toLowerCase() === label.toLowerCase())) labels.push(label);
  };

  for (const tag of parseTags(model.tags)) add(tag);
  for (const endpoint of model.supported_endpoint_types ?? []) add(endpoint);
  if (labels.length === 0) add(isTokenBasedModel(model) ? "chat" : "api");
  return labels.slice(0, 3);
}

function endpointCapabilityLabel(value: string): string | undefined {
  if (value.includes("image")) return "Image";
  if (value.includes("video")) return "Video";
  if (value.includes("audio") || value.includes("tts") || value.includes("speech")) return "Audio";
  if (value.includes("embedding")) return "Embeddings";
  if (value.includes("realtime")) return "Realtime";
  if (value.includes("responses")) return "Responses";
  if (value.includes("chat")) return "Chat";
  return undefined;
}
