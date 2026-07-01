import type { Locale } from "@/lib/locales";
import {
  getAvailableGroups,
  getVendorName,
  sortPricingModelsBySeries,
  type PricingData,
  type PricingModel,
  type PricingVendor,
} from "@/lib/pricing";

export type PricingSeoVendor = PricingVendor & {
  slug: string;
  displayName: string;
  models: PricingModel[];
};

export type PricingSeoModel = {
  slug: string;
  model: PricingModel;
  vendor?: PricingSeoVendor;
};

export type PricingSeoIndex = {
  vendors: PricingSeoVendor[];
  models: PricingSeoModel[];
};

const KNOWN_VENDOR_SLUGS: Record<string, string> = {
  "字节跳动": "bytedance",
  火山引擎: "volcengine",
  阿里云: "alibaba-cloud",
  阿里巴巴: "alibaba",
  百度: "baidu",
  腾讯: "tencent",
  智谱: "zhipu",
  月之暗面: "moonshot",
  阶跃星辰: "stepfun",
  MiniMax: "minimax",
  OpenAI: "openai",
  Anthropic: "anthropic",
  Google: "google",
  Gemini: "google",
  DeepSeek: "deepseek",
};

const KNOWN_ICON_SLUGS: Record<string, string> = {
  bytedance: "bytedance",
  volcengine: "volcengine",
  openai: "openai",
  anthropic: "anthropic",
  claude: "anthropic",
  google: "google",
  gemini: "google",
  deepseek: "deepseek",
  "deep-seek": "deepseek",
  qwen: "alibaba-cloud",
  alibaba: "alibaba",
  "alibaba-cloud": "alibaba-cloud",
  baidu: "baidu",
  tencent: "tencent",
  moonshot: "moonshot",
  kimi: "moonshot",
  minimax: "minimax",
  zhipu: "zhipu",
};

const ROUTE_SLUG_MAX_LENGTH = 96;
export function buildVendorSlug(vendor: Pick<PricingVendor, "id" | "name" | "icon"> & { slug?: string }): string {
  const explicitSlug = slugifyAscii(vendor.slug);
  if (explicitSlug) return explicitSlug;

  const knownName = KNOWN_VENDOR_SLUGS[vendor.name];
  if (knownName) return knownName;

  const iconSlug = slugifyAscii(vendor.icon);
  if (iconSlug && KNOWN_ICON_SLUGS[iconSlug]) return KNOWN_ICON_SLUGS[iconSlug];
  if (iconSlug) return iconSlug;

  return slugifyAscii(vendor.name) || `vendor-${vendor.id}`;
}

export function buildModelSlug(modelName: string): string {
  return trimRouteSlug(slugifyAscii(modelName) || hashFallbackSlug(modelName, "model"));
}

export function buildPricingSeoIndex(pricing: PricingData): PricingSeoIndex {
  const vendorById = new Map<number, PricingSeoVendor>();
  const vendorByName = new Map<string, PricingSeoVendor>();

  for (const vendor of pricing.vendors) {
    const slug = uniqueSlug(buildVendorSlug(vendor), vendorById.size, (candidate) =>
      [...vendorById.values()].some((entry) => entry.slug === candidate)
    );
    const entry: PricingSeoVendor = {
      ...vendor,
      slug,
      displayName: vendor.name,
      models: [],
    };
    vendorById.set(vendor.id, entry);
    vendorByName.set(vendor.name.toLowerCase(), entry);
  }

  const enrichedModels = sortPricingModelsBySeries(
    pricing.models.map((model) => {
      const vendor = resolveVendor(model, vendorById, vendorByName);
      return {
        ...model,
        model_slug: buildModelSlug(model.model_name),
        vendor_name: model.vendor_name ?? vendor?.displayName ?? getVendorName(model, pricing.vendors),
        vendor_slug: vendor?.slug ?? slugifyAscii(model.vendor_name),
        vendor_icon: model.vendor_icon ?? vendor?.icon,
        vendor_description: model.vendor_description ?? vendor?.description,
        group_ratio: model.group_ratio ?? pricing.groupRatio,
        enable_groups: getAvailableGroups(model, pricing.groupRatio, pricing.usableGroup),
      };
    })
  );

  const modelEntries: PricingSeoModel[] = [];
  const usedModelSlugs = new Set<string>();

  for (const model of enrichedModels) {
    const vendor = resolveVendor(model, vendorById, vendorByName);
    const slug = uniqueSlug(buildModelSlug(model.model_name), usedModelSlugs.size, (candidate) => usedModelSlugs.has(candidate));
    usedModelSlugs.add(slug);
    const modelWithSlug = { ...model, model_slug: slug };
    if (vendor) vendor.models.push(modelWithSlug);
    modelEntries.push({ slug, model: modelWithSlug, vendor });
  }

  const vendors = [...vendorById.values()]
    .map((vendor) => ({ ...vendor, models: sortPricingModelsBySeries(vendor.models) }))
    .filter((vendor) => vendor.models.length > 0)
    .sort((a, b) => a.slug.localeCompare(b.slug, "en", { numeric: true }));

  return {
    vendors,
    models: modelEntries
      .sort((a, b) => a.slug.localeCompare(b.slug, "en", { numeric: true })),
  };
}

export function findVendorSeoEntry(index: PricingSeoIndex, slug: string): PricingSeoVendor | undefined {
  return index.vendors.find((vendor) => vendor.slug === slugifyAscii(slug));
}

export function findModelSeoEntry(index: PricingSeoIndex, slug: string): PricingSeoModel | undefined {
  return index.models.find((model) => model.slug === slugifyAscii(slug));
}

export function vendorPricingHref(localePath: string, vendorSlug: string): string {
  const search = new URLSearchParams({ vendor: vendorSlug });
  return `${localePath}?${search.toString()}`;
}

export function buildVendorSeoTitle(vendor: PricingSeoVendor): string {
  return `${vendor.displayName} API models and pricing`;
}

export function buildVendorSeoDescription(vendor: PricingSeoVendor): string {
  return `Compare ${vendor.displayName} API models on flatkey.ai, including pricing, endpoint coverage, and one-key access for production AI apps.`;
}

export function buildModelSeoTitle(entry: PricingSeoModel): string {
  return `${entry.model.model_name} API pricing`;
}

export function buildModelSeoDescription(entry: PricingSeoModel): string {
  const vendorName = entry.vendor?.displayName ?? entry.model.vendor_name ?? "AI";
  return `Use ${entry.model.model_name} from ${vendorName} through flatkey.ai with OpenAI-compatible access, transparent usage pricing, and one prepaid balance.`;
}

export function pricingSeoCopy(locale: Locale) {
  return SEO_COPY[locale] ?? SEO_COPY.en;
}

function resolveVendor(
  model: PricingModel,
  vendorById: Map<number, PricingSeoVendor>,
  vendorByName: Map<string, PricingSeoVendor>
): PricingSeoVendor | undefined {
  if (model.vendor_id != null) {
    const byId = vendorById.get(model.vendor_id);
    if (byId) return byId;
  }
  if (model.vendor_name) return vendorByName.get(model.vendor_name.toLowerCase());
  return undefined;
}

function slugifyAscii(value: string | undefined): string {
  if (!value) return "";
  return trimRouteSlug(
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-")
  );
}

function trimRouteSlug(slug: string): string {
  return slug.slice(0, ROUTE_SLUG_MAX_LENGTH).replace(/-+$/g, "");
}

function uniqueSlug(baseSlug: string, index: number, exists: (candidate: string) => boolean): string {
  const fallback = baseSlug || `item-${index + 1}`;
  let candidate = fallback;
  let suffix = 2;
  while (exists(candidate)) {
    candidate = trimRouteSlug(`${fallback}-${suffix}`);
    suffix += 1;
  }
  return candidate;
}

function hashFallbackSlug(value: string, prefix: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${Math.abs(hash).toString(36)}`;
}

const SEO_COPY: Record<Locale, {
  vendorEyebrow: string;
  vendorModelsTitle: string;
  vendorPricingCta: string;
  modelEyebrow: string;
  modelPricingCta: string;
  relatedModelsTitle: string;
}> = {
  en: {
    vendorEyebrow: "Provider model directory",
    vendorModelsTitle: "Available models",
    vendorPricingCta: "View pricing",
    modelEyebrow: "Model pricing page",
    modelPricingCta: "Compare pricing",
    relatedModelsTitle: "More models from this provider",
  },
  zh: {
    vendorEyebrow: "供应商模型目录",
    vendorModelsTitle: "可用模型",
    vendorPricingCta: "查看价格",
    modelEyebrow: "模型价格页面",
    modelPricingCta: "比较价格",
    relatedModelsTitle: "该供应商的更多模型",
  },
  es: {
    vendorEyebrow: "Directorio de modelos del proveedor",
    vendorModelsTitle: "Modelos disponibles",
    vendorPricingCta: "Ver precios",
    modelEyebrow: "Página de precios del modelo",
    modelPricingCta: "Comparar precios",
    relatedModelsTitle: "Más modelos de este proveedor",
  },
  fr: {
    vendorEyebrow: "Répertoire des modèles fournisseur",
    vendorModelsTitle: "Modèles disponibles",
    vendorPricingCta: "Voir les tarifs",
    modelEyebrow: "Page tarifaire du modèle",
    modelPricingCta: "Comparer les tarifs",
    relatedModelsTitle: "Autres modèles de ce fournisseur",
  },
  pt: {
    vendorEyebrow: "Diretório de modelos do provedor",
    vendorModelsTitle: "Modelos disponíveis",
    vendorPricingCta: "Ver preços",
    modelEyebrow: "Página de preços do modelo",
    modelPricingCta: "Comparar preços",
    relatedModelsTitle: "Mais modelos deste provedor",
  },
  ru: {
    vendorEyebrow: "Каталог моделей провайдера",
    vendorModelsTitle: "Доступные модели",
    vendorPricingCta: "Смотреть цены",
    modelEyebrow: "Страница цены модели",
    modelPricingCta: "Сравнить цены",
    relatedModelsTitle: "Другие модели этого провайдера",
  },
  ja: {
    vendorEyebrow: "プロバイダーモデル一覧",
    vendorModelsTitle: "利用可能なモデル",
    vendorPricingCta: "料金を見る",
    modelEyebrow: "モデル料金ページ",
    modelPricingCta: "料金を比較",
    relatedModelsTitle: "同じプロバイダーの他のモデル",
  },
  vi: {
    vendorEyebrow: "Danh mục mô hình nhà cung cấp",
    vendorModelsTitle: "Mô hình khả dụng",
    vendorPricingCta: "Xem giá",
    modelEyebrow: "Trang giá mô hình",
    modelPricingCta: "So sánh giá",
    relatedModelsTitle: "Mô hình khác từ nhà cung cấp này",
  },
  de: {
    vendorEyebrow: "Anbieter-Modellverzeichnis",
    vendorModelsTitle: "Verfügbare Modelle",
    vendorPricingCta: "Preise ansehen",
    modelEyebrow: "Modellpreisseite",
    modelPricingCta: "Preise vergleichen",
    relatedModelsTitle: "Weitere Modelle dieses Anbieters",
  },
};
