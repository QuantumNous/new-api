import { modelIconKey } from "@/lib/home-models";
import type { Locale } from "@/lib/locales";
import {
  discountedPriceUsd,
  formatUsdPrice,
  getBestGroupRatio,
  getOfficialPriceUsd,
  getVendorName,
  type PricingData,
  type PricingModel,
} from "@/lib/pricing";

// Public per-model page (rankings / directory click-through target).
// Slug resolution + demo-kind classification + localized UI copy.

export type ModelPublicKind = "chat" | "image";

const CHAT_ENDPOINT_TYPES = new Set([
  "openai",
  "openai-response",
  "openai-response-compact",
  "anthropic",
  "gemini",
]);
const IMAGE_NAME_PATTERN = /(^|[-_.])(image|banana)/i;

// Rankings and usage logs carry alias model names that may not match the
// pricing list verbatim: channel-suffixed ("claude-opus-4-8-fk") or
// vendor-prefixed ("anthropic/claude-sonnet-4.5") variants. Normalize both
// sides so known model families never dead-end.
export function normalizeModelKey(name: string): string {
  let normalized = name.toLowerCase();
  const slash = normalized.lastIndexOf("/");
  if (slash >= 0) normalized = normalized.slice(slash + 1);
  normalized = normalized.replace(/-fk$/, "");
  return normalized.replace(/[^a-z0-9]/g, "");
}

export function resolvePublicModel(models: PricingModel[], slug: string): PricingModel | null {
  // Slugs come straight from the URL: malformed percent-encoding
  // (e.g. "%E0%A4%A") must resolve to null/404, not throw a 500.
  let decoded: string;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    decoded = slug;
  }
  const exact = models.find((model) => model.model_name === decoded);
  if (exact) return exact;
  const key = normalizeModelKey(decoded);
  if (!key) return null;
  return models.find((model) => normalizeModelKey(model.model_name) === key) ?? null;
}

export function modelPublicPath(modelName: string): string {
  return `/models/${encodeURIComponent(modelName)}`;
}

// Which request example the page shows. Image-generation models demo
// /v1/images/generations; everything else demos chat completions.
export function classifyPublicModel(model: PricingModel): ModelPublicKind {
  const types = model.supported_endpoint_types ?? [];
  if (types.includes("image-generation") || IMAGE_NAME_PATTERN.test(model.model_name)) {
    return "image";
  }
  if (types.length === 0 || types.some((type) => CHAT_ENDPOINT_TYPES.has(type))) {
    return "chat";
  }
  return "chat";
}

export type ModelPublicCopy = {
  successRate: string;
  stackedDiscount: string;
  upToOff: string;
  discountNote: string;
  pricing: string;
  input: string;
  output: string;
  listPrice: string;
  perMTokens: string;
  availability: string;
  latency: string;
  apiTitle: string;
  noData: string;
  backToModels: string;
};

export const MODEL_PUBLIC_COPY: Record<Locale, ModelPublicCopy> = {
  en: {
    successRate: "30-day success rate",
    stackedDiscount: "Stacked discount",
    upToOff: "up to 50% off",
    discountNote:
      "Models are priced at 60–90% of the official list. Top up $200 and get $100 free — both discounts stack, as low as 50% of the official price.",
    pricing: "Pricing",
    input: "Input",
    output: "Output",
    listPrice: "List price",
    perMTokens: "/ 1M tokens",
    availability: "Availability (last 30 days)",
    latency: "Latency trend (last 30 days)",
    apiTitle: "API example",
    noData: "Not enough data yet",
    backToModels: "All models",
  },
  zh: {
    successRate: "30 天成功率",
    stackedDiscount: "叠加折扣",
    upToOff: "最低 5 折",
    discountNote:
      "模型定价为官方的 60–90%。充值 $200 送 $100,两重折扣叠加,最低可达官方价 5 折。",
    pricing: "定价",
    input: "输入",
    output: "输出",
    listPrice: "列表价",
    perMTokens: "/ 1M tokens",
    availability: "可用性(近 30 天)",
    latency: "延迟趋势(近 30 天)",
    apiTitle: "API 示例",
    noData: "数据积累中",
    backToModels: "全部模型",
  },
  es: {
    successRate: "Tasa de éxito (30 días)",
    stackedDiscount: "Descuento acumulado",
    upToOff: "hasta 50% de descuento",
    discountNote:
      "Los modelos cuestan el 60–90% del precio oficial. Recarga $200 y recibe $100 gratis: ambos descuentos se acumulan, hasta el 50% del precio oficial.",
    pricing: "Precios",
    input: "Entrada",
    output: "Salida",
    listPrice: "Precio de lista",
    perMTokens: "/ 1M tokens",
    availability: "Disponibilidad (últimos 30 días)",
    latency: "Tendencia de latencia (últimos 30 días)",
    apiTitle: "Ejemplo de API",
    noData: "Aún sin datos suficientes",
    backToModels: "Todos los modelos",
  },
  fr: {
    successRate: "Taux de réussite (30 jours)",
    stackedDiscount: "Remise cumulée",
    upToOff: "jusqu'à 50% de remise",
    discountNote:
      "Les modèles sont facturés 60–90% du prix officiel. Rechargez 200 $ et recevez 100 $ offerts — les deux remises se cumulent, jusqu'à 50% du prix officiel.",
    pricing: "Tarifs",
    input: "Entrée",
    output: "Sortie",
    listPrice: "Prix catalogue",
    perMTokens: "/ 1M tokens",
    availability: "Disponibilité (30 derniers jours)",
    latency: "Tendance de latence (30 derniers jours)",
    apiTitle: "Exemple d'API",
    noData: "Pas encore assez de données",
    backToModels: "Tous les modèles",
  },
  pt: {
    successRate: "Taxa de sucesso (30 dias)",
    stackedDiscount: "Desconto acumulado",
    upToOff: "até 50% de desconto",
    discountNote:
      "Os modelos custam 60–90% do preço oficial. Recarregue $200 e ganhe $100 grátis — os dois descontos se acumulam, chegando a 50% do preço oficial.",
    pricing: "Preços",
    input: "Entrada",
    output: "Saída",
    listPrice: "Preço de tabela",
    perMTokens: "/ 1M tokens",
    availability: "Disponibilidade (últimos 30 dias)",
    latency: "Tendência de latência (últimos 30 dias)",
    apiTitle: "Exemplo de API",
    noData: "Ainda sem dados suficientes",
    backToModels: "Todos os modelos",
  },
  ru: {
    successRate: "Успешность за 30 дней",
    stackedDiscount: "Суммируемая скидка",
    upToOff: "до 50% скидки",
    discountNote:
      "Модели стоят 60–90% официальной цены. Пополните на $200 и получите $100 бесплатно — обе скидки суммируются, до 50% официальной цены.",
    pricing: "Цены",
    input: "Ввод",
    output: "Вывод",
    listPrice: "Прайс",
    perMTokens: "/ 1M токенов",
    availability: "Доступность (последние 30 дней)",
    latency: "Тренд задержки (последние 30 дней)",
    apiTitle: "Пример API",
    noData: "Пока недостаточно данных",
    backToModels: "Все модели",
  },
  ja: {
    successRate: "30日間成功率",
    stackedDiscount: "重ね掛け割引",
    upToOff: "最大50%オフ",
    discountNote:
      "モデル価格は公式の60–90%。$200チャージで$100分プレゼント — 両方の割引が重なり、公式価格の最大50%に。",
    pricing: "料金",
    input: "入力",
    output: "出力",
    listPrice: "定価",
    perMTokens: "/ 1M tokens",
    availability: "可用性(過去30日)",
    latency: "レイテンシ推移(過去30日)",
    apiTitle: "APIサンプル",
    noData: "データ蓄積中",
    backToModels: "すべてのモデル",
  },
  vi: {
    successRate: "Tỷ lệ thành công 30 ngày",
    stackedDiscount: "Giảm giá cộng dồn",
    upToOff: "giảm tới 50%",
    discountNote:
      "Giá mô hình bằng 60–90% giá chính thức. Nạp $200 tặng $100 — hai mức giảm cộng dồn, thấp nhất bằng 50% giá chính thức.",
    pricing: "Giá",
    input: "Đầu vào",
    output: "Đầu ra",
    listPrice: "Giá niêm yết",
    perMTokens: "/ 1M tokens",
    availability: "Độ khả dụng (30 ngày qua)",
    latency: "Xu hướng độ trễ (30 ngày qua)",
    apiTitle: "Ví dụ API",
    noData: "Chưa đủ dữ liệu",
    backToModels: "Tất cả mô hình",
  },
  de: {
    successRate: "Erfolgsquote (30 Tage)",
    stackedDiscount: "Kombinierter Rabatt",
    upToOff: "bis zu 50% Rabatt",
    discountNote:
      "Modelle kosten 60–90% des offiziellen Preises. $200 aufladen, $100 geschenkt — beide Rabatte kombinieren sich, bis zu 50% des offiziellen Preises.",
    pricing: "Preise",
    input: "Eingabe",
    output: "Ausgabe",
    listPrice: "Listenpreis",
    perMTokens: "/ 1M Tokens",
    availability: "Verfügbarkeit (letzte 30 Tage)",
    latency: "Latenz-Trend (letzte 30 Tage)",
    apiTitle: "API-Beispiel",
    noData: "Noch nicht genug Daten",
    backToModels: "Alle Modelle",
  },
};

// Server-side view model for the public page. Strike-through = official
// vendor price; hero = after both discount layers (best group ratio, then
// the top-up bonus ×2/3) — same derivation as the /models directory rows.
export function buildModelPublicView(model: PricingModel, data: PricingData) {
  const vendor = model.vendor_name ?? getVendorName(model, data.vendors);
  const officialInput = getOfficialPriceUsd(model, "input");
  const officialOutput = getOfficialPriceUsd(model, "output");
  const ratio = getBestGroupRatio(model, data.groupRatio);
  return {
    modelName: model.model_name,
    vendorName: vendor,
    iconKey: model.icon || model.vendor_icon || modelIconKey(model.model_name, vendor),
    endpointTypes: model.supported_endpoint_types ?? [],
    kind: classifyPublicModel(model),
    inputListPrice: formatUsdPrice(officialInput),
    inputDiscounted: formatUsdPrice(discountedPriceUsd(officialInput * ratio)),
    outputListPrice: formatUsdPrice(officialOutput),
    outputDiscounted: formatUsdPrice(discountedPriceUsd(officialOutput * ratio)),
  };
}

// POSIX single-quote escaping: close the quote, emit an escaped quote,
// reopen. Keeps the copied command intact for any body content.
function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function buildModelExampleCurl(args: {
  apiBaseUrl: string;
  modelName: string;
  kind: ModelPublicKind;
}): string {
  const body =
    args.kind === "image"
      ? JSON.stringify({ model: args.modelName, prompt: "A cute cat", size: "1024x1024" })
      : JSON.stringify({
          model: args.modelName,
          messages: [{ role: "user", content: "Say hello in one sentence." }],
        });
  const path = args.kind === "image" ? "/images/generations" : "/chat/completions";
  return [
    `curl "${args.apiBaseUrl}${path}" \\`,
    '  -H "Content-Type: application/json" \\',
    '  -H "Authorization: Bearer $FLATKEY_API_KEY" \\',
    `  -d ${shellSingleQuote(body)}`,
  ].join("\n");
}
