import {
  discountedPriceUsd,
  formatUsdPrice,
  getBestGroupRatio,
  getOfficialPriceUsd,
  getVendorName,
  isTokenBasedModel,
  sortPricingModelsBySeries,
  type PricingData,
  type PricingModel,
} from "./pricing";

export type HomePricedModel = {
  name: string;
  vendor: string;
  official: string;
  discounted: string;
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

// Flagship picks for the hero price comparison, one per official family.
const FLAGSHIP_PATTERNS: RegExp[] = [/^gpt-5/i, /^claude-opus/i, /^claude-sonnet/i, /^gemini-[\d.]+.*pro/i];
// Variants that never read as "the flagship" of a family.
const NON_FLAGSHIP = /[-_.](mini|nano|lite|flash|haiku|preview|codex|image|audio|realtime|embedding)/i;

export function pickFlagshipModels(data: PricingData, limit = 4): HomePricedModel[] {
  const priced = pricedTokenModels(data);
  const rows: HomePricedModel[] = [];
  for (const pattern of FLAGSHIP_PATTERNS) {
    const candidates = priced
      .filter((model) => pattern.test(model.model_name) && !NON_FLAGSHIP.test(model.model_name))
      .sort((a, b) => b.model_name.localeCompare(a.model_name));
    const pick = candidates[0];
    if (pick) rows.push(toHomeRow(pick, data));
    if (rows.length >= limit) break;
  }
  return rows;
}

export function buildHomeModelRows(data: PricingData): HomePricedModel[] {
  return sortPricingModelsBySeries(pricedTokenModels(data)).map((model) => toHomeRow(model, data));
}

// Rows for an externally filtered/sorted model list (the /models directory).
// Includes per-request models; their prices carry a "/req" suffix since the
// table header is phrased per 1M tokens.
export function buildRowsForModels(
  models: PricingModel[],
  vendors: PricingData["vendors"],
  groupRatio: Record<string, number>
): HomePricedModel[] {
  return models
    .filter((model) => getOfficialPriceUsd(model) > 0)
    .map((model) => {
      const official = getOfficialPriceUsd(model);
      const listed = official * getBestGroupRatio(model, groupRatio);
      const vendor = model.vendor_name ?? getVendorName(model, vendors);
      const suffix = isTokenBasedModel(model) ? "" : " /req";
      return {
        name: model.model_name,
        vendor,
        official: `${formatUsdPrice(official)}${suffix}`,
        discounted: `${formatUsdPrice(discountedPriceUsd(listed))}${suffix}`,
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

// Strike-through = official vendor price; green = after both discount layers
// (best group ratio, i.e. 60-90% of official, then the top-up bonus ×2/3).
function toHomeRow(model: PricingModel, data: PricingData): HomePricedModel {
  const official = getOfficialPriceUsd(model);
  const listed = official * getBestGroupRatio(model, data.groupRatio);
  const vendor = model.vendor_name ?? getVendorName(model, data.vendors);
  return {
    name: model.model_name,
    vendor,
    official: formatUsdPrice(official),
    discounted: formatUsdPrice(discountedPriceUsd(listed)),
    iconKey: model.icon || model.vendor_icon || modelIconKey(model.model_name, vendor),
  };
}
