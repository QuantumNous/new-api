import { modelIconKey } from "@/lib/home-models";
import type { Locale } from "@/lib/locales";
import {
  discountedPriceUsd,
  formatUsdPrice,
  getBestGroupRatio,
  getModelFamilyKey,
  getOfficialPriceUsd,
  getVendorName,
  isTokenBasedModel,
  parseTags,
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
  // (e.g. "%E0%A4%A") must 404, not throw a 500 — and not fall back to the
  // raw slug either, or "gpt-4%" would normalize into a real model hit.
  let decoded: string;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    return null;
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
  cacheRead: string;
  cacheWrite: string;
  imagePrice: string;
  audioInput: string;
  audioOutput: string;
  listPrice: string;
  perMTokens: string;
  availability: string;
  latency: string;
  ttft: string;
  throughput: string;
  requests: string;
  about: string;
  statusOnline: string;
  statusDegraded: string;
  apiTitle: string;
  noData: string;
  backToModels: string;
};

// Price rows carry a copy key resolved on the client (buildModelPublicView has
// no locale). Every key must exist on ModelPublicCopy.
export type ModelPriceLabelKey =
  | "input"
  | "output"
  | "cacheRead"
  | "cacheWrite"
  | "imagePrice"
  | "audioInput"
  | "audioOutput";

export type ModelPublicPriceRow = {
  labelKey: ModelPriceLabelKey;
  list: string;
  discounted: string;
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
    cacheRead: "Cache read",
    cacheWrite: "Cache write",
    imagePrice: "Image",
    audioInput: "Audio input",
    audioOutput: "Audio output",
    listPrice: "List price",
    perMTokens: "/ 1M tokens",
    availability: "Availability (last 30 days)",
    latency: "Latency trend (last 30 days)",
    ttft: "First-token latency",
    throughput: "Throughput",
    requests: "Requests (30 days)",
    about: "About",
    statusOnline: "Operational",
    statusDegraded: "Degraded",
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
    cacheRead: "缓存读取",
    cacheWrite: "缓存写入",
    imagePrice: "图片",
    audioInput: "音频输入",
    audioOutput: "音频输出",
    listPrice: "列表价",
    perMTokens: "/ 1M tokens",
    availability: "可用性(近 30 天)",
    latency: "延迟趋势(近 30 天)",
    ttft: "首字延迟",
    throughput: "吞吐",
    requests: "调用量(近 30 天)",
    about: "模型简介",
    statusOnline: "正常",
    statusDegraded: "降级",
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
    cacheRead: "Lectura de caché",
    cacheWrite: "Escritura de caché",
    imagePrice: "Imagen",
    audioInput: "Audio de entrada",
    audioOutput: "Audio de salida",
    listPrice: "Precio de lista",
    perMTokens: "/ 1M tokens",
    availability: "Disponibilidad (últimos 30 días)",
    latency: "Tendencia de latencia (últimos 30 días)",
    ttft: "Latencia primer token",
    throughput: "Rendimiento",
    requests: "Solicitudes (últimos 30 días)",
    about: "Acerca del modelo",
    statusOnline: "Operativo",
    statusDegraded: "Degradado",
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
    cacheRead: "Lecture du cache",
    cacheWrite: "Écriture du cache",
    imagePrice: "Image",
    audioInput: "Audio en entrée",
    audioOutput: "Audio en sortie",
    listPrice: "Prix catalogue",
    perMTokens: "/ 1M tokens",
    availability: "Disponibilité (30 derniers jours)",
    latency: "Tendance de latence (30 derniers jours)",
    ttft: "Latence 1er token",
    throughput: "Débit",
    requests: "Requêtes (30 derniers jours)",
    about: "À propos du modèle",
    statusOnline: "Opérationnel",
    statusDegraded: "Dégradé",
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
    cacheRead: "Leitura de cache",
    cacheWrite: "Escrita de cache",
    imagePrice: "Imagem",
    audioInput: "Áudio de entrada",
    audioOutput: "Áudio de saída",
    listPrice: "Preço de tabela",
    perMTokens: "/ 1M tokens",
    availability: "Disponibilidade (últimos 30 dias)",
    latency: "Tendência de latência (últimos 30 dias)",
    ttft: "Latência 1º token",
    throughput: "Taxa de transferência",
    requests: "Solicitações (últimos 30 dias)",
    about: "Sobre o modelo",
    statusOnline: "Operacional",
    statusDegraded: "Degradado",
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
    cacheRead: "Чтение кэша",
    cacheWrite: "Запись кэша",
    imagePrice: "Изображение",
    audioInput: "Аудио на входе",
    audioOutput: "Аудио на выходе",
    listPrice: "Прайс",
    perMTokens: "/ 1M токенов",
    availability: "Доступность (последние 30 дней)",
    latency: "Тренд задержки (последние 30 дней)",
    ttft: "Задержка 1-го токена",
    throughput: "Пропускная способность",
    requests: "Запросы (30 дней)",
    about: "О модели",
    statusOnline: "Работает",
    statusDegraded: "Снижено",
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
    cacheRead: "キャッシュ読取",
    cacheWrite: "キャッシュ書込",
    imagePrice: "画像",
    audioInput: "音声入力",
    audioOutput: "音声出力",
    listPrice: "定価",
    perMTokens: "/ 1M tokens",
    availability: "可用性(過去30日)",
    latency: "レイテンシ推移(過去30日)",
    ttft: "初回トークン遅延",
    throughput: "スループット",
    requests: "リクエスト数(過去30日)",
    about: "モデル概要",
    statusOnline: "正常",
    statusDegraded: "劣化",
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
    cacheRead: "Đọc cache",
    cacheWrite: "Ghi cache",
    imagePrice: "Hình ảnh",
    audioInput: "Âm thanh vào",
    audioOutput: "Âm thanh ra",
    listPrice: "Giá niêm yết",
    perMTokens: "/ 1M tokens",
    availability: "Độ khả dụng (30 ngày qua)",
    latency: "Xu hướng độ trễ (30 ngày qua)",
    ttft: "Độ trễ token đầu",
    throughput: "Thông lượng",
    requests: "Lượt gọi (30 ngày qua)",
    about: "Giới thiệu mô hình",
    statusOnline: "Hoạt động",
    statusDegraded: "Suy giảm",
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
    cacheRead: "Cache-Lesen",
    cacheWrite: "Cache-Schreiben",
    imagePrice: "Bild",
    audioInput: "Audio-Eingabe",
    audioOutput: "Audio-Ausgabe",
    listPrice: "Listenpreis",
    perMTokens: "/ 1M Tokens",
    availability: "Verfügbarkeit (letzte 30 Tage)",
    latency: "Latenz-Trend (letzte 30 Tage)",
    ttft: "Erster-Token-Latenz",
    throughput: "Durchsatz",
    requests: "Anfragen (letzte 30 Tage)",
    about: "Über das Modell",
    statusOnline: "Betriebsbereit",
    statusDegraded: "Beeinträchtigt",
    apiTitle: "API-Beispiel",
    noData: "Noch nicht genug Daten",
    backToModels: "Alle Modelle",
  },
};

// Server-side view model for the public page. Strike-through = official
// vendor price; hero = after both discount layers (best group ratio, then
// the top-up bonus ×2/3) — same derivation as the /models directory rows.
// A model's effective input price (after both discount layers) as a number,
// for cross-model comparison rows and JSON-LD.
function discountedInputUsd(model: PricingModel, data: PricingData): number {
  return discountedPriceUsd(getOfficialPriceUsd(model, "input") * getBestGroupRatio(model, data.groupRatio));
}

export type ModelPeer = {
  modelName: string;
  vendorName: string;
  inputPrice: string;
};

export function buildModelPublicView(model: PricingModel, data: PricingData) {
  const vendor = model.vendor_name ?? getVendorName(model, data.vendors);
  const officialInput = getOfficialPriceUsd(model, "input");
  const officialOutput = getOfficialPriceUsd(model, "output");
  const ratio = getBestGroupRatio(model, data.groupRatio);
  const discountedInput = discountedPriceUsd(officialInput * ratio);
  const discountedOutput = discountedPriceUsd(officialOutput * ratio);
  // Savings vs the official list price, the page's core comparison hook.
  const savingsPct =
    officialInput > 0 ? Math.max(0, Math.round((1 - discountedInput / officialInput) * 100)) : 0;

  // Sibling models for the "vs" table (same family) and the related grid (same
  // vendor). Both drive internal links and long-tail comparison queries.
  const family = getModelFamilyKey(model.model_name);
  const peers = data.models.filter((candidate) => candidate.model_name !== model.model_name);
  const toPeer = (candidate: PricingModel): ModelPeer => ({
    modelName: candidate.model_name,
    vendorName: candidate.vendor_name ?? getVendorName(candidate, data.vendors),
    inputPrice: formatUsdPrice(discountedInputUsd(candidate, data)),
  });
  const comparison = peers
    .filter((candidate) => getModelFamilyKey(candidate.model_name) === family)
    .slice(0, 4)
    .map(toPeer);
  const comparisonNames = new Set(comparison.map((peer) => peer.modelName));
  const related = peers
    .filter(
      (candidate) =>
        (candidate.vendor_name ?? getVendorName(candidate, data.vendors)) === vendor &&
        !comparisonNames.has(candidate.model_name)
    )
    .slice(0, 6)
    .map(toPeer);

  // Same derivation as the /models directory rows: strike-through = official
  // vendor price, hero = official × best group ratio × top-up bonus (2/3).
  const row = (labelKey: ModelPriceLabelKey, official: number): ModelPublicPriceRow => ({
    labelKey,
    list: formatUsdPrice(official),
    discounted: formatUsdPrice(discountedPriceUsd(official * ratio)),
  });

  const priceRows: ModelPublicPriceRow[] = [
    row("input", officialInput),
    row("output", officialOutput),
  ];
  // Cache / image / audio prices derive off the input base × their ratio, and
  // only exist for token-billed models (request-billed models have no ratios).
  if (isTokenBasedModel(model)) {
    if (model.cache_ratio != null) priceRows.push(row("cacheRead", officialInput * Number(model.cache_ratio)));
    if (model.create_cache_ratio != null)
      priceRows.push(row("cacheWrite", officialInput * Number(model.create_cache_ratio)));
    if (model.image_ratio != null) priceRows.push(row("imagePrice", officialInput * Number(model.image_ratio)));
    if (model.audio_ratio != null) priceRows.push(row("audioInput", officialInput * Number(model.audio_ratio)));
    if (model.audio_ratio != null && model.audio_completion_ratio != null)
      priceRows.push(
        row("audioOutput", officialInput * Number(model.audio_ratio) * Number(model.audio_completion_ratio))
      );
  }

  return {
    modelName: model.model_name,
    vendorName: vendor,
    vendorDescription: model.vendor_description ?? "",
    description: model.description ?? "",
    tags: parseTags(model.tags),
    iconKey: model.icon || model.vendor_icon || modelIconKey(model.model_name, vendor),
    endpointTypes: model.supported_endpoint_types ?? [],
    kind: classifyPublicModel(model),
    priceRows,
    // Comparison hooks + prose/JSON-LD inputs.
    savingsPct,
    inputList: formatUsdPrice(officialInput),
    inputDiscounted: formatUsdPrice(discountedInput),
    outputDiscounted: formatUsdPrice(discountedOutput),
    inputDiscountedNum: Number(discountedInput.toFixed(6)),
    comparison,
    related,
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

// Python + Node use the OpenAI SDK — flatkey.ai is OpenAI-compatible, so the
// only change from a stock example is base_url + api key.
export function buildModelExamplePython(args: {
  apiBaseUrl: string;
  modelName: string;
  kind: ModelPublicKind;
}): string {
  const head = [
    "from openai import OpenAI",
    "",
    `client = OpenAI(base_url="${args.apiBaseUrl}", api_key=os.environ["FLATKEY_API_KEY"])`,
    "",
  ];
  if (args.kind === "image") {
    return [
      "import os",
      ...head,
      "img = client.images.generate(",
      `    model="${args.modelName}",`,
      '    prompt="A cute cat",',
      '    size="1024x1024",',
      ")",
      "print(img.data[0].url)",
    ].join("\n");
  }
  return [
    "import os",
    ...head,
    "resp = client.chat.completions.create(",
    `    model="${args.modelName}",`,
    '    messages=[{"role": "user", "content": "Say hello in one sentence."}],',
    ")",
    "print(resp.choices[0].message.content)",
  ].join("\n");
}

export function buildModelExampleNode(args: {
  apiBaseUrl: string;
  modelName: string;
  kind: ModelPublicKind;
}): string {
  const head = [
    'import OpenAI from "openai";',
    "",
    `const client = new OpenAI({ baseURL: "${args.apiBaseUrl}", apiKey: process.env.FLATKEY_API_KEY });`,
    "",
  ];
  if (args.kind === "image") {
    return [
      ...head,
      "const img = await client.images.generate({",
      `  model: "${args.modelName}",`,
      '  prompt: "A cute cat",',
      '  size: "1024x1024",',
      "});",
      "console.log(img.data[0].url);",
    ].join("\n");
  }
  return [
    ...head,
    "const resp = await client.chat.completions.create({",
    `  model: "${args.modelName}",`,
    '  messages: [{ role: "user", content: "Say hello in one sentence." }],',
    "});",
    "console.log(resp.choices[0].message.content);",
  ].join("\n");
}
