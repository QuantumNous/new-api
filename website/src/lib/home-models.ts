import {
  discountedPriceUsd,
  formatUsdPrice,
  getModelPriceUsd,
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
};

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

function pricedTokenModels(data: PricingData): PricingModel[] {
  const seen = new Set<string>();
  return data.models.filter((model) => {
    if (!isTokenBasedModel(model) || getModelPriceUsd(model) <= 0) return false;
    if (seen.has(model.model_name)) return false;
    seen.add(model.model_name);
    return true;
  });
}

function toHomeRow(model: PricingModel, data: PricingData): HomePricedModel {
  const official = getModelPriceUsd(model);
  return {
    name: model.model_name,
    vendor: model.vendor_name ?? getVendorName(model, data.vendors),
    official: formatUsdPrice(official),
    discounted: formatUsdPrice(discountedPriceUsd(official)),
  };
}
