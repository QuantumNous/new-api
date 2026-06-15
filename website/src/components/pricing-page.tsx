import { ArrowRight, Ban, Boxes, CheckCircle2, DollarSign, Gauge, Mail, Wallet } from "lucide-react";
import { SiteShell } from "@/components/site-shell";
import {
  getPricingData,
  getVendorName,
  getAvailableGroups,
  type PricingModel,
  type PricingVendor,
  type PricingSearch,
} from "@/lib/pricing";
import { PricingExplorer } from "@/components/pricing-explorer";
import { FlatkeyTallyEmbed } from "@/components/flatkey-tally-embed";
import type { Locale } from "@/lib/locales";
import { consoleUrl } from "@/lib/origins";

type PricingPageProps = {
  locale: Locale;
  search?: PricingSearch;
};

const SIGN_UP_URL = consoleUrl("/sign-up");

type PricingPageCopy = {
  modelsDirectory: string;
  modelPricing: string;
  description: string;
  plansEyebrow: string;
  plansTitle: string;
  plansDescription: string;
  websitePackage: string;
  prepaidBalanceTitle: string;
  startingPackage: string;
  packageBullets: string[];
  getFreeApiKey: string;
  enterpriseTeams: string;
  contactSales: string;
  minimumPackage: string;
  modelsThroughBalance: string;
  sharedBalance: string;
  meteredTokenTypes: string;
  noBundleLockIn: string;
  seoEyebrow: string;
  seoTitle: string;
  seoParagraph1: string;
  seoParagraph2: string;
  seoParagraph3Prefix: string;
  seoParagraph3Middle: string;
  seoParagraph3Suffix: string;
};

const PRICING_COPY: Record<Locale, PricingPageCopy> = {
  en: {
    modelsDirectory: "Models Directory",
    modelPricing: "Model Pricing",
    description: "Discover curated AI models, compare pricing and capabilities, and choose the right model for every scenario.",
    plansEyebrow: "Plans and top-up packages",
    plansTitle: "Transparent pricing for every AI model",
    plansDescription: "Start from $10 to try leading models like GPT-5.1, Claude Opus 4.7, Gemini 3.5 Flash, DeepSeek V4, and more with one prepaid balance.",
    websitePackage: "Website package",
    prepaidBalanceTitle: "Prepaid balance for top AI models",
    startingPackage: "starting package, pay as you go with the balance you add",
    packageBullets: [
      "Successful payment adds prepaid balance.",
      "Usage is charged by model input, output, and cache-hit token prices.",
      "Permanently 20-40% cheaper",
      "One API key for everything",
      "Zero vendor lock-in",
      "Usage analytics & cost control",
      "Enterprise-grade privacy",
      "One unified invoice for all providers",
    ],
    getFreeApiKey: "Get free API key",
    enterpriseTeams: "Enterprise teams",
    contactSales: "Contact sales for higher monthly usage and greater discounts.",
    minimumPackage: "minimum website package",
    modelsThroughBalance: "models available through one balance",
    sharedBalance: "balance across GPT, Claude, Gemini, DeepSeek, and more",
    meteredTokenTypes: "metered token types: input, output, cache-hit",
    noBundleLockIn: "fixed bundle lock-in",
    seoEyebrow: "AI-readable pricing summary",
    seoTitle: "flatkey.ai model pricing, billing, and provider coverage",
    seoParagraph1: "flatkey.ai publishes server-rendered model pricing for {{modelCount}} AI models across {{vendorCount}} providers. Search engines and AI assistants can read model names, vendors, endpoint types, and input/output pricing directly from the page HTML.",
    seoParagraph2: "Pricing is organized by token-based and request-based models. Token models expose input, output, cache-hit, and group-adjusted prices, while request models show per-request billing for production API usage.",
    seoParagraph3Prefix: "Vendor filter URLs such as",
    seoParagraph3Middle: "and",
    seoParagraph3Suffix: "provide crawlable entry points for provider-specific AI model pricing.",
  },
  zh: {
    modelsDirectory: "模型目录",
    modelPricing: "模型定价",
    description: "浏览精选 AI 模型，比较价格与能力，为每个场景选择合适模型。",
    plansEyebrow: "套餐与充值包",
    plansTitle: "每个 AI 模型都有透明价格",
    plansDescription: "从 $10 起即可用一份预付余额试用 GPT-5.1、Claude Opus 4.7、Gemini 3.5 Flash、DeepSeek V4 等领先模型。",
    websitePackage: "官网套餐",
    prepaidBalanceTitle: "用于热门 AI 模型的预付余额",
    startingPackage: "起始套餐，充值多少就按量使用多少",
    packageBullets: ["支付成功后增加预付余额。", "用量按模型输入、输出和缓存命中 token 价格计费。", "长期便宜 20-40%", "一个 API 密钥覆盖全部能力", "无供应商锁定", "用量分析与成本控制", "企业级隐私", "所有供应商统一开票"],
    getFreeApiKey: "获取免费 API 密钥",
    enterpriseTeams: "企业团队",
    contactSales: "联系销售，获取更高月用量和更大折扣。",
    minimumPackage: "官网最低套餐",
    modelsThroughBalance: "可通过同一余额使用的模型",
    sharedBalance: "覆盖 GPT、Claude、Gemini、DeepSeek 等模型的余额",
    meteredTokenTypes: "计量 token 类型：输入、输出、缓存命中",
    noBundleLockIn: "固定套餐锁定",
    seoEyebrow: "AI 可读定价摘要",
    seoTitle: "flatkey.ai 模型定价、账单与供应商覆盖",
    seoParagraph1: "flatkey.ai 为 {{vendorCount}} 个供应商的 {{modelCount}} 个 AI 模型发布服务端渲染定价。搜索引擎和 AI 助手可直接从页面 HTML 读取模型名、供应商、端点类型以及输入/输出价格。",
    seoParagraph2: "价格按 token 计费和按请求计费模型组织。token 模型展示输入、输出、缓存命中和按分组调整后的价格，请求模型展示生产 API 使用的单请求计费。",
    seoParagraph3Prefix: "供应商筛选 URL，例如",
    seoParagraph3Middle: "和",
    seoParagraph3Suffix: "为特定供应商的 AI 模型定价提供可爬取入口。",
  },
  es: {
    modelsDirectory: "Directorio de modelos",
    modelPricing: "Precios de modelos",
    description: "Descubre modelos de IA seleccionados, compara precios y capacidades, y elige el modelo adecuado para cada escenario.",
    plansEyebrow: "Planes y paquetes de recarga",
    plansTitle: "Precios transparentes para cada modelo de IA",
    plansDescription: "Empieza desde $10 para probar modelos como GPT-5.1, Claude Opus 4.7, Gemini 3.5 Flash, DeepSeek V4 y más con un saldo prepago.",
    websitePackage: "Paquete del sitio",
    prepaidBalanceTitle: "Saldo prepago para modelos de IA líderes",
    startingPackage: "paquete inicial, paga por uso con el saldo que agregues",
    packageBullets: ["El pago exitoso añade saldo prepago.", "El uso se cobra por precios de tokens de entrada, salida y cache-hit del modelo.", "20-40% más barato de forma permanente", "Una clave API para todo", "Sin bloqueo de proveedor", "Analítica de uso y control de costes", "Privacidad de nivel empresarial", "Una factura unificada para todos los proveedores"],
    getFreeApiKey: "Obtener clave API gratis",
    enterpriseTeams: "Equipos empresariales",
    contactSales: "Contacta con ventas para mayor uso mensual y más descuentos.",
    minimumPackage: "paquete mínimo del sitio",
    modelsThroughBalance: "modelos disponibles con un saldo",
    sharedBalance: "saldo para GPT, Claude, Gemini, DeepSeek y más",
    meteredTokenTypes: "tipos de token medidos: entrada, salida, cache-hit",
    noBundleLockIn: "bloqueo de paquete fijo",
    seoEyebrow: "Resumen de precios legible por IA",
    seoTitle: "Precios, facturación y cobertura de proveedores de flatkey.ai",
    seoParagraph1: "flatkey.ai publica precios de modelos renderizados en servidor para {{modelCount}} modelos de IA de {{vendorCount}} proveedores. Los motores de búsqueda y asistentes de IA pueden leer nombres, proveedores, tipos de endpoint y precios de entrada/salida directamente desde el HTML.",
    seoParagraph2: "Los precios se organizan por modelos basados en tokens y por solicitud. Los modelos por token muestran precios de entrada, salida, cache-hit y ajustes por grupo; los modelos por solicitud muestran facturación por request para uso API en producción.",
    seoParagraph3Prefix: "Las URL de filtro por proveedor como",
    seoParagraph3Middle: "y",
    seoParagraph3Suffix: "ofrecen puntos de entrada rastreables para precios de modelos de IA por proveedor.",
  },
  fr: {
    modelsDirectory: "Répertoire des modèles",
    modelPricing: "Tarifs des modèles",
    description: "Découvrez des modèles IA sélectionnés, comparez tarifs et capacités, et choisissez le bon modèle pour chaque scénario.",
    plansEyebrow: "Plans et recharges",
    plansTitle: "Des tarifs transparents pour chaque modèle IA",
    plansDescription: "Commencez à partir de 10 $ pour essayer GPT-5.1, Claude Opus 4.7, Gemini 3.5 Flash, DeepSeek V4 et plus avec un solde prépayé.",
    websitePackage: "Forfait du site",
    prepaidBalanceTitle: "Solde prépayé pour les meilleurs modèles IA",
    startingPackage: "forfait de départ, paiement à l'usage avec le solde ajouté",
    packageBullets: ["Un paiement réussi ajoute du solde prépayé.", "L'usage est facturé selon les prix de tokens d'entrée, sortie et cache-hit.", "20-40 % moins cher en continu", "Une clé API pour tout", "Aucun verrouillage fournisseur", "Analyse d'usage et contrôle des coûts", "Confidentialité de niveau entreprise", "Une facture unifiée pour tous les fournisseurs"],
    getFreeApiKey: "Obtenir une clé API gratuite",
    enterpriseTeams: "Équipes entreprise",
    contactSales: "Contactez les ventes pour plus d'usage mensuel et de meilleures remises.",
    minimumPackage: "forfait minimum du site",
    modelsThroughBalance: "modèles disponibles via un seul solde",
    sharedBalance: "solde partagé pour GPT, Claude, Gemini, DeepSeek et plus",
    meteredTokenTypes: "types de tokens mesurés : entrée, sortie, cache-hit",
    noBundleLockIn: "verrouillage par forfait fixe",
    seoEyebrow: "Résumé tarifaire lisible par IA",
    seoTitle: "Tarifs, facturation et couverture fournisseurs de flatkey.ai",
    seoParagraph1: "flatkey.ai publie des tarifs de modèles rendus côté serveur pour {{modelCount}} modèles IA chez {{vendorCount}} fournisseurs. Les moteurs de recherche et assistants IA peuvent lire noms, fournisseurs, endpoints et prix d'entrée/sortie depuis le HTML.",
    seoParagraph2: "Les tarifs sont organisés entre modèles au token et modèles à la requête. Les modèles au token exposent les prix d'entrée, sortie, cache-hit et ajustés par groupe, tandis que les modèles à la requête montrent la facturation par appel API.",
    seoParagraph3Prefix: "Les URL de filtre fournisseur comme",
    seoParagraph3Middle: "et",
    seoParagraph3Suffix: "fournissent des entrées explorables pour les tarifs par fournisseur.",
  },
  pt: {
    modelsDirectory: "Diretório de modelos",
    modelPricing: "Preços dos modelos",
    description: "Descubra modelos de IA selecionados, compare preços e capacidades e escolha o modelo certo para cada cenário.",
    plansEyebrow: "Planos e pacotes de recarga",
    plansTitle: "Preços transparentes para cada modelo de IA",
    plansDescription: "Comece a partir de $10 para testar GPT-5.1, Claude Opus 4.7, Gemini 3.5 Flash, DeepSeek V4 e mais com um saldo pré-pago.",
    websitePackage: "Pacote do site",
    prepaidBalanceTitle: "Saldo pré-pago para os principais modelos de IA",
    startingPackage: "pacote inicial, pague conforme o uso com o saldo adicionado",
    packageBullets: ["O pagamento bem-sucedido adiciona saldo pré-pago.", "O uso é cobrado pelos preços de tokens de entrada, saída e cache-hit do modelo.", "20-40% mais barato permanentemente", "Uma chave API para tudo", "Sem bloqueio de fornecedor", "Análise de uso e controle de custos", "Privacidade de nível empresarial", "Uma fatura unificada para todos os provedores"],
    getFreeApiKey: "Obter chave API grátis",
    enterpriseTeams: "Equipes empresariais",
    contactSales: "Fale com vendas para maior uso mensal e maiores descontos.",
    minimumPackage: "pacote mínimo do site",
    modelsThroughBalance: "modelos disponíveis por um saldo",
    sharedBalance: "saldo para GPT, Claude, Gemini, DeepSeek e mais",
    meteredTokenTypes: "tipos de token medidos: entrada, saída, cache-hit",
    noBundleLockIn: "bloqueio de pacote fixo",
    seoEyebrow: "Resumo de preços legível por IA",
    seoTitle: "Preços, cobrança e cobertura de provedores da flatkey.ai",
    seoParagraph1: "flatkey.ai publica preços renderizados no servidor para {{modelCount}} modelos de IA em {{vendorCount}} provedores. Motores de busca e assistentes de IA podem ler nomes, provedores, endpoints e preços de entrada/saída diretamente do HTML.",
    seoParagraph2: "Os preços são organizados por modelos baseados em tokens e por requisição. Modelos por token exibem preços de entrada, saída, cache-hit e ajustados por grupo; modelos por requisição mostram cobrança por chamada API.",
    seoParagraph3Prefix: "URLs de filtro por provedor como",
    seoParagraph3Middle: "e",
    seoParagraph3Suffix: "fornecem entradas rastreáveis para preços por provedor.",
  },
  ru: {
    modelsDirectory: "Каталог моделей",
    modelPricing: "Цены моделей",
    description: "Изучайте отобранные AI-модели, сравнивайте цены и возможности и выбирайте подходящую модель для каждого сценария.",
    plansEyebrow: "Планы и пополнения",
    plansTitle: "Прозрачные цены для каждой AI-модели",
    plansDescription: "Начните с $10, чтобы попробовать GPT-5.1, Claude Opus 4.7, Gemini 3.5 Flash, DeepSeek V4 и другие модели с одним предоплаченным балансом.",
    websitePackage: "Пакет сайта",
    prepaidBalanceTitle: "Предоплаченный баланс для ведущих AI-моделей",
    startingPackage: "стартовый пакет, оплата по факту с добавленного баланса",
    packageBullets: ["Успешный платеж добавляет предоплаченный баланс.", "Использование списывается по ценам входных, выходных и cache-hit токенов модели.", "Постоянно дешевле на 20-40%", "Один API-ключ для всего", "Без привязки к поставщику", "Аналитика использования и контроль затрат", "Конфиденциальность корпоративного уровня", "Один единый счет для всех провайдеров"],
    getFreeApiKey: "Получить бесплатный API-ключ",
    enterpriseTeams: "Корпоративные команды",
    contactSales: "Свяжитесь с продажами для большего месячного объема и скидок.",
    minimumPackage: "минимальный пакет сайта",
    modelsThroughBalance: "моделей доступны через один баланс",
    sharedBalance: "баланс для GPT, Claude, Gemini, DeepSeek и других",
    meteredTokenTypes: "измеряемые типы токенов: вход, выход, cache-hit",
    noBundleLockIn: "привязка к фиксированному пакету",
    seoEyebrow: "Сводка цен, читаемая AI",
    seoTitle: "Цены моделей, биллинг и покрытие провайдеров flatkey.ai",
    seoParagraph1: "flatkey.ai публикует server-rendered цены для {{modelCount}} AI-моделей у {{vendorCount}} провайдеров. Поисковые системы и AI-ассистенты могут читать имена моделей, провайдеров, типы endpoint и цены входа/выхода прямо из HTML.",
    seoParagraph2: "Цены организованы по token-based и request-based моделям. Token-модели показывают цены входа, выхода, cache-hit и групповые корректировки; request-модели показывают оплату за запрос для production API.",
    seoParagraph3Prefix: "URL фильтра по провайдеру, например",
    seoParagraph3Middle: "и",
    seoParagraph3Suffix: "дают индексируемые входы для цен AI-моделей конкретного провайдера.",
  },
  ja: {
    modelsDirectory: "モデルディレクトリ",
    modelPricing: "モデル料金",
    description: "厳選された AI モデルを見つけ、料金と機能を比較し、各シナリオに適したモデルを選べます。",
    plansEyebrow: "プランとチャージパッケージ",
    plansTitle: "すべての AI モデルに透明な料金",
    plansDescription: "$10 から、ひとつのプリペイド残高で GPT-5.1、Claude Opus 4.7、Gemini 3.5 Flash、DeepSeek V4 などを試せます。",
    websitePackage: "Web サイトパッケージ",
    prepaidBalanceTitle: "主要 AI モデル向けプリペイド残高",
    startingPackage: "開始パッケージ、追加した残高で使った分だけ支払い",
    packageBullets: ["支払い成功後にプリペイド残高が追加されます。", "利用量はモデルの入力、出力、cache-hit token 価格で課金されます。", "常に 20-40% 安価", "すべてに使えるひとつの API キー", "ベンダーロックインなし", "利用分析とコスト管理", "エンタープライズ級プライバシー", "すべてのプロバイダーをひとつの請求書に統合"],
    getFreeApiKey: "無料 API キーを取得",
    enterpriseTeams: "エンタープライズチーム",
    contactSales: "より大きな月間利用量と割引について営業にお問い合わせください。",
    minimumPackage: "Web サイト最小パッケージ",
    modelsThroughBalance: "ひとつの残高で利用できるモデル",
    sharedBalance: "GPT、Claude、Gemini、DeepSeek などで使える残高",
    meteredTokenTypes: "計測 token 種別：入力、出力、cache-hit",
    noBundleLockIn: "固定バンドルのロックイン",
    seoEyebrow: "AI が読める料金概要",
    seoTitle: "flatkey.ai のモデル料金、請求、プロバイダー対応",
    seoParagraph1: "flatkey.ai は {{vendorCount}} プロバイダーにまたがる {{modelCount}} 個の AI モデル料金をサーバーレンダリングで公開します。検索エンジンと AI アシスタントは、モデル名、プロバイダー、endpoint 種別、入力/出力料金を HTML から直接読めます。",
    seoParagraph2: "料金は token-based と request-based のモデルに整理されています。token モデルは入力、出力、cache-hit、グループ調整後価格を示し、request モデルは本番 API 利用のリクエスト単位課金を示します。",
    seoParagraph3Prefix: "プロバイダーフィルター URL、たとえば",
    seoParagraph3Middle: "や",
    seoParagraph3Suffix: "はプロバイダー別 AI モデル料金のクロール可能な入口になります。",
  },
  vi: {
    modelsDirectory: "Danh mục mô hình",
    modelPricing: "Giá mô hình",
    description: "Khám phá các mô hình AI tuyển chọn, so sánh giá và năng lực, rồi chọn mô hình phù hợp cho từng kịch bản.",
    plansEyebrow: "Gói và nạp tiền",
    plansTitle: "Giá minh bạch cho mọi mô hình AI",
    plansDescription: "Bắt đầu từ $10 để thử GPT-5.1, Claude Opus 4.7, Gemini 3.5 Flash, DeepSeek V4 và nhiều mô hình khác bằng một số dư trả trước.",
    websitePackage: "Gói website",
    prepaidBalanceTitle: "Số dư trả trước cho các mô hình AI hàng đầu",
    startingPackage: "gói khởi đầu, trả theo mức dùng bằng số dư bạn nạp",
    packageBullets: ["Thanh toán thành công sẽ cộng số dư trả trước.", "Mức dùng được tính theo giá token đầu vào, đầu ra và cache-hit của mô hình.", "Luôn rẻ hơn 20-40%", "Một khóa API cho mọi thứ", "Không khóa nhà cung cấp", "Phân tích sử dụng và kiểm soát chi phí", "Quyền riêng tư cấp doanh nghiệp", "Một hóa đơn thống nhất cho mọi nhà cung cấp"],
    getFreeApiKey: "Nhận khóa API miễn phí",
    enterpriseTeams: "Đội ngũ doanh nghiệp",
    contactSales: "Liên hệ kinh doanh để có mức dùng hằng tháng cao hơn và chiết khấu lớn hơn.",
    minimumPackage: "gói website tối thiểu",
    modelsThroughBalance: "mô hình dùng chung một số dư",
    sharedBalance: "số dư cho GPT, Claude, Gemini, DeepSeek và hơn nữa",
    meteredTokenTypes: "loại token đo lường: đầu vào, đầu ra, cache-hit",
    noBundleLockIn: "khóa gói cố định",
    seoEyebrow: "Tóm tắt giá cho AI đọc",
    seoTitle: "Giá mô hình, tính phí và phạm vi nhà cung cấp của flatkey.ai",
    seoParagraph1: "flatkey.ai công bố giá mô hình được render phía server cho {{modelCount}} mô hình AI trên {{vendorCount}} nhà cung cấp. Công cụ tìm kiếm và trợ lý AI có thể đọc tên mô hình, nhà cung cấp, loại endpoint và giá đầu vào/đầu ra trực tiếp từ HTML.",
    seoParagraph2: "Giá được tổ chức theo mô hình tính theo token và theo request. Mô hình token hiển thị giá đầu vào, đầu ra, cache-hit và giá điều chỉnh theo group; mô hình request hiển thị phí theo request cho API production.",
    seoParagraph3Prefix: "URL lọc theo nhà cung cấp như",
    seoParagraph3Middle: "và",
    seoParagraph3Suffix: "cung cấp điểm vào có thể crawl cho giá mô hình AI theo nhà cung cấp.",
  },
};

function pricingCopy(locale: Locale): PricingPageCopy {
  return PRICING_COPY[locale] ?? PRICING_COPY.en;
}

export function parsePricingSearch(searchParams?: Record<string, string | string[] | undefined>): PricingSearch {
  return {
    q: parseParam(searchParams?.q),
    vendor: parseParam(searchParams?.vendor),
    endpoint: parseParam(searchParams?.endpoint),
    quota: parseParam(searchParams?.quota),
  };
}

export async function PricingPage(props: PricingPageProps) {
  const pricing = await getPricingData();
  const allModels = enrichVendorNames(pricing.models, pricing.vendors, pricing.groupRatio, pricing.usableGroup);
  const copy = pricingCopy(props.locale);

  return (
    <SiteShell locale={props.locale} pathname="/pricing">
      <main className="model-square-page relative min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#f4f0ff_0%,#fbfaff_32%,#ffffff_62%,#f4f1ff_100%)] dark:bg-[linear-gradient(180deg,#050712_0%,#080b18_36%,#070712_72%,#03040b_100%)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(124,58,237,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(124,58,237,0.08)_1px,transparent_1px)] bg-[size:4.5rem_4.5rem] opacity-70 dark:bg-[linear-gradient(to_right,rgba(148,163,184,0.055)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.045)_1px,transparent_1px)] dark:opacity-45"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[640px] opacity-75"
          style={{
            background: [
              "radial-gradient(ellipse 56% 46% at 22% 8%, rgba(168,85,247,0.30) 0%, transparent 68%)",
              "radial-gradient(ellipse 46% 36% at 78% 6%, rgba(99,102,241,0.28) 0%, transparent 70%)",
              "radial-gradient(ellipse 48% 34% at 50% 46%, rgba(217,70,239,0.18) 0%, transparent 72%)",
            ].join(", "),
            maskImage: "linear-gradient(to bottom, black 40%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, black 40%, transparent 100%)",
          }}
        />
        <div className="relative mx-auto w-full max-w-[1800px] px-3 pt-16 pb-8 sm:px-6 sm:pt-20 sm:pb-10 xl:px-8">
          <header className="mx-auto mb-6 max-w-3xl pt-5 text-center sm:mb-10 sm:pt-10">
            <p className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-violet-400/35 bg-violet-500/10 px-4 py-1.5 text-xs font-semibold tracking-[0.18em] text-violet-700 uppercase shadow-[0_0_28px_rgba(168,85,247,0.14)]">
              <span className="size-1.5 rounded-full bg-violet-500 shadow-[0_0_12px_rgba(168,85,247,0.9)]" />
              {copy.modelsDirectory}
            </p>
            <h1 className="bg-[linear-gradient(90deg,#171321_0%,#7c3aed_46%,#2563eb_100%)] bg-clip-text text-[clamp(2.6rem,7vw,5rem)] leading-[0.98] font-black tracking-tight text-transparent">
              {copy.modelPricing}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
              {copy.description}
            </p>
          </header>

          <PricingPackages locale={props.locale} />

          <PricingExplorer
            locale={props.locale}
            models={allModels}
            vendors={pricing.vendors}
            groupRatio={pricing.groupRatio}
            usableGroup={pricing.usableGroup}
            endpointMap={pricing.supportedEndpoint}
            autoGroups={pricing.autoGroups}
            initialSearch={props.search}
          />

          <PricingSeoContent locale={props.locale} modelCount={allModels.length} vendorCount={pricing.vendors.length} />
        </div>
      </main>
    </SiteShell>
  );
}

function PricingPackages(props: { locale: Locale }) {
  const copy = pricingCopy(props.locale);
  const highlights = [
    [DollarSign, "$10", copy.minimumPackage],
    [Boxes, "100+", copy.modelsThroughBalance],
    [Wallet, "1", copy.sharedBalance],
    [Gauge, "3", copy.meteredTokenTypes],
    [Ban, "0", copy.noBundleLockIn],
  ] as const;

  return (
    <section className="mb-8 rounded-3xl border border-violet-500/16 bg-white/62 p-5 shadow-[0_24px_70px_-52px_rgba(91,33,182,0.78)] backdrop-blur-sm sm:p-6">
      <div className="mb-5">
        <p className="text-muted-foreground mb-2 text-xs font-medium tracking-widest uppercase">{copy.plansEyebrow}</p>
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{copy.plansTitle}</h2>
        <p className="text-muted-foreground mt-3 text-sm leading-7 md:whitespace-nowrap">
          {copy.plansDescription}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {["GPT-5.1", "Claude Opus 4.7", "Gemini 3.5 Flash", "DeepSeek V4", "More"].map((modelName) => (
            <span key={modelName} className="rounded-full border border-violet-500/15 bg-violet-500/6 px-3 py-1 text-xs font-medium text-violet-800">
              {modelName}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <article className="rounded-2xl border border-violet-500/14 bg-white/66 p-5">
          <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">{copy.websitePackage}</p>
          <h3 className="mt-2 text-base font-semibold tracking-tight">{copy.prepaidBalanceTitle}</h3>
          <div className="mt-5 flex items-end gap-2">
            <span className="text-4xl font-bold tracking-tight">$10</span>
            <span className="text-muted-foreground pb-1 text-sm">{copy.startingPackage}</span>
          </div>
          <div className="mt-5 space-y-3 text-sm">
            {copy.packageBullets.map((point) => (
              <p key={point} className="flex gap-2 leading-6">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-violet-600" />
                <span>{point}</span>
              </p>
            ))}
          </div>
          <a
            className="flatkey-primary-cta mt-6 inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium shadow-[0_16px_34px_-18px_rgba(15,23,42,0.55)] transition-opacity hover:opacity-90"
            href={SIGN_UP_URL}
          >
            {copy.getFreeApiKey}
            <ArrowRight className="ml-2 size-4" />
          </a>
        </article>

        <article className="rounded-2xl border border-violet-500/14 bg-white/66 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">{copy.enterpriseTeams}</p>
              <h3 className="mt-2 text-base font-semibold tracking-tight">{copy.contactSales}</h3>
            </div>
            <a
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-violet-500/16 bg-violet-500/8 px-3 text-sm font-semibold text-violet-700 transition-colors hover:border-violet-500/25 hover:bg-violet-500/12 hover:text-violet-600"
              href="mailto:support@flatkey.ai"
            >
              <Mail className="size-4" />
              support@flatkey.ai
            </a>
          </div>
          <FlatkeyTallyEmbed locale={props.locale} className="mt-5 rounded-xl border border-violet-500/12 bg-white/62 p-3 shadow-[0_18px_46px_-36px_rgba(91,33,182,0.5)]" />
        </article>
      </div>

      <div className="mt-5 border-t border-violet-500/12 pt-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {highlights.map(([Icon, metric, label]) => (
            <div key={label} className="flex gap-3 rounded-xl border border-violet-500/12 bg-white/58 px-4 py-4">
              <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/8 text-violet-700">
                <Icon className="size-4" />
              </span>
              <div>
                <p className="text-xl font-bold text-violet-700">{metric}</p>
                <p className="text-muted-foreground mt-1 text-xs leading-5">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingSeoContent(props: { locale: Locale; modelCount: number; vendorCount: number }) {
  const copy = pricingCopy(props.locale);
  return (
    <section className="mt-10 rounded-3xl border border-violet-500/12 bg-white/70 p-6 shadow-[0_20px_70px_-58px_rgba(91,33,182,0.6)] backdrop-blur-sm">
      <p className="text-muted-foreground mb-2 text-xs font-medium tracking-widest uppercase">{copy.seoEyebrow}</p>
      <h2 className="text-xl font-bold tracking-tight">{copy.seoTitle}</h2>
      <div className="mt-4 grid gap-4 text-sm leading-7 text-muted-foreground md:grid-cols-3">
        <p>
          {copy.seoParagraph1.replace("{{modelCount}}", props.modelCount.toLocaleString()).replace("{{vendorCount}}", props.vendorCount.toLocaleString())}
        </p>
        <p>
          {copy.seoParagraph2}
        </p>
        <p>
          {copy.seoParagraph3Prefix} <code className="rounded bg-muted px-1.5 py-0.5">/pricing?vendor=OpenAI</code> {copy.seoParagraph3Middle} <code className="rounded bg-muted px-1.5 py-0.5">/pricing?vendor=Anthropic</code> {copy.seoParagraph3Suffix}
        </p>
      </div>
    </section>
  );
}

function enrichVendorNames(
  models: PricingModel[],
  vendors: PricingVendor[],
  groupRatio: Record<string, number>,
  usableGroup: Record<string, { desc: string; ratio: number }>
) {
  return models.map((model) => ({
    ...model,
    vendor_name: getVendorName(model, vendors),
    vendor_icon: model.vendor_icon ?? vendors.find((vendor) => vendor.id === model.vendor_id)?.icon,
    vendor_description: model.vendor_description ?? vendors.find((vendor) => vendor.id === model.vendor_id)?.description,
    group_ratio: model.group_ratio ?? groupRatio,
    enable_groups: getAvailableGroups(model, groupRatio, usableGroup),
  }));
}

function parseParam(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() || undefined;
}
