import { ArrowRight, Ban, Boxes, CheckCircle2, Code2, DollarSign, Gauge, KeyRound, Mail, Wallet } from "lucide-react";
import { SiteShell } from "@/components/site-shell";
import { PricingPlansGrid } from "@/components/pricing-plans-grid";
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
import { SIGN_UP_URL, pricingCheckoutUrl } from "@/lib/pricing-links";

type PricingPageProps = {
  locale: Locale;
  search?: PricingSearch;
};

type PricingPageBaseCopy = {
  modelsDirectory: string;
  modelPricing: string;
  description: string;
  quickStartSteps: string[];
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
  selfServeTitle: string;
  selfServeDescription: string;
  trustSignals: string[];
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

type PricingPageLocalizedUiCopy = {
  pricingHeroTitle: string;
  pricingHeroDescription: string;
  modelsEyebrow: string;
  modelsDescription: string;
  topUpPlanName: string;
  bonus10Caption: string;
  bonus20Caption: string;
  bonus200Caption: string;
  customPlanCaption: string;
  apiWorkloadsDescription: string;
  bestValueDescription: string;
  popularBadge: string;
  bonus10Label: string;
  bonus20Label: string;
  bonus200Label: string;
  enterprisePlanName: string;
  customPriceLabel: string;
  enterprisePlanDescription: string;
  contactPlanCta: string;
  highestPrepaidValue: string;
  customMonthlyUsage: string;
  teamProcurementSupport: string;
  customRoutingDiscounts: string;
  enterpriseContactCloseLabel: string;
  enterpriseContactEyebrow: string;
  enterpriseContactTitle: string;
  enterpriseContactDescription: string;
};

type PricingPageCopy = PricingPageBaseCopy & PricingPageLocalizedUiCopy;

const PRICING_COPY: Record<Locale, PricingPageBaseCopy> = {
  en: {
    modelsDirectory: "Models Directory",
    modelPricing: "One API key for every top AI model",
    description: "Top up $10, create an API key, and call GPT, Claude, Gemini, DeepSeek, image, audio, and video models from one OpenAI-compatible gateway.",
    quickStartSteps: ["Top up $10", "Create an API key", "Call GPT, Claude, Gemini, DeepSeek, and video models"],
    plansEyebrow: "Top-up bonus",
    plansTitle: "Start calling models in minutes, not after procurement",
    plansDescription: "Use one prepaid balance across model families. See live prices below, then start with a small top-up before scaling.",
    websitePackage: "Website package",
    prepaidBalanceTitle: "Prepaid balance for top AI models",
    startingPackage: "starting package, pay as you go with the balance you add",
    packageBullets: [
      "Successful payment adds prepaid balance.",
      "Usage is charged by model input, output, and cache-hit token prices.",
      "Bonus credit on every top-up",
      "One API key for everything",
      "Zero vendor lock-in",
      "Usage analytics & cost control",
      "Enterprise-grade privacy",
      "One unified invoice for all providers",
    ],
    getFreeApiKey: "Get free API key",
    enterpriseTeams: "Enterprise teams",
    contactSales: "Contact sales for higher monthly usage and greater discounts.",
    selfServeTitle: "Self-serve API start",
    selfServeDescription: "No contract required. Add balance, create a key, copy the base_url, and test your first request.",
    trustSignals: ["Prepaid balance, no surprise bill", "Usage analytics and cost controls", "Enterprise-grade privacy", "One invoice across providers"],
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
    modelPricing: "一个 API 密钥调用所有主流 AI 模型",
    description: "充值 $10，创建 API 密钥，即可通过一个 OpenAI 兼容网关调用 GPT、Claude、Gemini、DeepSeek、图像、音频和视频模型。",
    quickStartSteps: ["充值 $10", "创建 API 密钥", "调用 GPT、Claude、Gemini、DeepSeek 和视频模型"],
    plansEyebrow: "充值即送",
    plansTitle: "几分钟开始调用模型，不用先走采购",
    plansDescription: "一份预付余额覆盖多个模型家族。先看下方实时价格，再用小额充值测试，稳定后再扩量。",
    websitePackage: "官网套餐",
    prepaidBalanceTitle: "用于热门 AI 模型的预付余额",
    startingPackage: "起始套餐，充值多少就按量使用多少",
    packageBullets: ["支付成功后增加预付余额。", "用量按模型输入、输出和缓存命中 token 价格计费。", "每次充值均送额度", "一个 API 密钥覆盖全部能力", "无供应商锁定", "用量分析与成本控制", "企业级隐私", "所有供应商统一开票"],
    getFreeApiKey: "获取免费 API 密钥",
    enterpriseTeams: "企业团队",
    contactSales: "联系销售，获取更高月用量和更大折扣。",
    selfServeTitle: "自助开始 API 调用",
    selfServeDescription: "无需合同。充值、创建密钥、复制 base_url，即可测试第一条请求。",
    trustSignals: ["预付余额，无意外账单", "用量分析与成本控制", "企业级隐私", "所有供应商统一开票"],
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
    modelPricing: "Una clave API para todos los modelos de IA líderes",
    description: "Recarga $10, crea una clave API y llama a GPT, Claude, Gemini, DeepSeek, modelos de imagen, audio y vídeo desde una gateway compatible con OpenAI.",
    quickStartSteps: ["Recarga $10", "Crea una clave API", "Llama a GPT, Claude, Gemini, DeepSeek y modelos de vídeo"],
    plansEyebrow: "Bono de recarga",
    plansTitle: "Empieza a llamar modelos en minutos, sin compras largas",
    plansDescription: "Usa un saldo prepago para varias familias de modelos. Revisa precios en vivo abajo y empieza con una recarga pequeña antes de escalar.",
    websitePackage: "Paquete del sitio",
    prepaidBalanceTitle: "Saldo prepago para modelos de IA líderes",
    startingPackage: "paquete inicial, paga por uso con el saldo que agregues",
    packageBullets: ["El pago exitoso añade saldo prepago.", "El uso se cobra por precios de tokens de entrada, salida y cache-hit del modelo.", "Crédito extra en cada recarga", "Una clave API para todo", "Sin bloqueo de proveedor", "Analítica de uso y control de costes", "Privacidad de nivel empresarial", "Una factura unificada para todos los proveedores"],
    getFreeApiKey: "Obtener clave API gratis",
    enterpriseTeams: "Equipos empresariales",
    contactSales: "Contacta con ventas para mayor uso mensual y más descuentos.",
    selfServeTitle: "Inicio API autoservicio",
    selfServeDescription: "Sin contrato. Añade saldo, crea una clave, copia base_url y prueba tu primera solicitud.",
    trustSignals: ["Saldo prepago, sin factura sorpresa", "Analítica de uso y control de costes", "Privacidad de nivel empresarial", "Una factura para todos los proveedores"],
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
    modelPricing: "Une clé API pour tous les grands modèles IA",
    description: "Rechargez 10 $, créez une clé API et appelez GPT, Claude, Gemini, DeepSeek, image, audio et vidéo depuis une gateway compatible OpenAI.",
    quickStartSteps: ["Rechargez 10 $", "Créez une clé API", "Appelez GPT, Claude, Gemini, DeepSeek et les modèles vidéo"],
    plansEyebrow: "Bonus de recharge",
    plansTitle: "Appelez des modèles en quelques minutes, sans cycle d'achat",
    plansDescription: "Utilisez un solde prépayé pour plusieurs familles de modèles. Consultez les prix live ci-dessous, puis démarrez avec une petite recharge.",
    websitePackage: "Forfait du site",
    prepaidBalanceTitle: "Solde prépayé pour les meilleurs modèles IA",
    startingPackage: "forfait de départ, paiement à l'usage avec le solde ajouté",
    packageBullets: ["Un paiement réussi ajoute du solde prépayé.", "L'usage est facturé selon les prix de tokens d'entrée, sortie et cache-hit.", "Crédit bonus à chaque recharge", "Une clé API pour tout", "Aucun verrouillage fournisseur", "Analyse d'usage et contrôle des coûts", "Confidentialité de niveau entreprise", "Une facture unifiée pour tous les fournisseurs"],
    getFreeApiKey: "Obtenir une clé API gratuite",
    enterpriseTeams: "Équipes entreprise",
    contactSales: "Contactez les ventes pour plus d'usage mensuel et de meilleures remises.",
    selfServeTitle: "Démarrage API en libre-service",
    selfServeDescription: "Pas de contrat. Ajoutez du solde, créez une clé, copiez base_url et testez votre première requête.",
    trustSignals: ["Solde prépayé, pas de surprise", "Analyse d'usage et contrôle des coûts", "Confidentialité entreprise", "Une facture pour tous les fournisseurs"],
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
    modelPricing: "Uma chave API para todos os principais modelos de IA",
    description: "Recarregue $10, crie uma chave API e chame GPT, Claude, Gemini, DeepSeek, imagem, áudio e vídeo por um gateway compatível com OpenAI.",
    quickStartSteps: ["Recarregue $10", "Crie uma chave API", "Chame GPT, Claude, Gemini, DeepSeek e modelos de vídeo"],
    plansEyebrow: "Bônus de recarga",
    plansTitle: "Comece a chamar modelos em minutos, sem processo de compra",
    plansDescription: "Use um saldo pré-pago em várias famílias de modelos. Veja preços ao vivo abaixo e comece com uma pequena recarga antes de escalar.",
    websitePackage: "Pacote do site",
    prepaidBalanceTitle: "Saldo pré-pago para os principais modelos de IA",
    startingPackage: "pacote inicial, pague conforme o uso com o saldo adicionado",
    packageBullets: ["O pagamento bem-sucedido adiciona saldo pré-pago.", "O uso é cobrado pelos preços de tokens de entrada, saída e cache-hit do modelo.", "Crédito bônus em cada recarga", "Uma chave API para tudo", "Sem bloqueio de fornecedor", "Análise de uso e controle de custos", "Privacidade de nível empresarial", "Uma fatura unificada para todos os provedores"],
    getFreeApiKey: "Obter chave API grátis",
    enterpriseTeams: "Equipes empresariais",
    contactSales: "Fale com vendas para maior uso mensal e maiores descontos.",
    selfServeTitle: "Início API self-service",
    selfServeDescription: "Sem contrato. Adicione saldo, crie uma chave, copie base_url e teste sua primeira requisição.",
    trustSignals: ["Saldo pré-pago, sem surpresa na fatura", "Análise de uso e controle de custos", "Privacidade de nível empresarial", "Uma fatura para todos os provedores"],
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
    modelPricing: "Один API-ключ для всех ведущих AI-моделей",
    description: "Пополните $10, создайте API-ключ и вызывайте GPT, Claude, Gemini, DeepSeek, image, audio и video модели через OpenAI-compatible gateway.",
    quickStartSteps: ["Пополните $10", "Создайте API-ключ", "Вызывайте GPT, Claude, Gemini, DeepSeek и video модели"],
    plansEyebrow: "Бонус за пополнение",
    plansTitle: "Начните вызывать модели за минуты, без закупочного процесса",
    plansDescription: "Используйте один предоплаченный баланс для разных семейств моделей. Посмотрите live-цены ниже и начните с малого пополнения.",
    websitePackage: "Пакет сайта",
    prepaidBalanceTitle: "Предоплаченный баланс для ведущих AI-моделей",
    startingPackage: "стартовый пакет, оплата по факту с добавленного баланса",
    packageBullets: ["Успешный платеж добавляет предоплаченный баланс.", "Использование списывается по ценам входных, выходных и cache-hit токенов модели.", "Бонусный кредит при каждом пополнении", "Один API-ключ для всего", "Без привязки к поставщику", "Аналитика использования и контроль затрат", "Конфиденциальность корпоративного уровня", "Один единый счет для всех провайдеров"],
    getFreeApiKey: "Получить бесплатный API-ключ",
    enterpriseTeams: "Корпоративные команды",
    contactSales: "Свяжитесь с продажами для большего месячного объема и скидок.",
    selfServeTitle: "Самостоятельный старт API",
    selfServeDescription: "Без договора. Добавьте баланс, создайте ключ, скопируйте base_url и протестируйте первый запрос.",
    trustSignals: ["Предоплата, без неожиданных счетов", "Аналитика использования и контроль затрат", "Корпоративная приватность", "Один счет для всех провайдеров"],
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
    modelPricing: "主要 AI モデルを 1 つの API キーで",
    description: "$10 をチャージし、API キーを作成すれば、OpenAI 互換 gateway から GPT、Claude、Gemini、DeepSeek、画像、音声、動画モデルを呼び出せます。",
    quickStartSteps: ["$10 をチャージ", "API キーを作成", "GPT、Claude、Gemini、DeepSeek、動画モデルを呼び出し"],
    plansEyebrow: "チャージ特典",
    plansTitle: "調達を待たずに、数分でモデル呼び出しを開始",
    plansDescription: "1 つのプリペイド残高で複数のモデルファミリーを利用できます。下のライブ料金を見て、小額チャージから始められます。",
    websitePackage: "Web サイトパッケージ",
    prepaidBalanceTitle: "主要 AI モデル向けプリペイド残高",
    startingPackage: "開始パッケージ、追加した残高で使った分だけ支払い",
    packageBullets: ["支払い成功後にプリペイド残高が追加されます。", "利用量はモデルの入力、出力、cache-hit token 価格で課金されます。", "毎回のチャージにボーナスクレジット", "すべてに使えるひとつの API キー", "ベンダーロックインなし", "利用分析とコスト管理", "エンタープライズ級プライバシー", "すべてのプロバイダーをひとつの請求書に統合"],
    getFreeApiKey: "無料 API キーを取得",
    enterpriseTeams: "エンタープライズチーム",
    contactSales: "より大きな月間利用量と割引について営業にお問い合わせください。",
    selfServeTitle: "セルフサービス API 開始",
    selfServeDescription: "契約不要。残高追加、キー作成、base_url コピーで最初のリクエストをテストできます。",
    trustSignals: ["プリペイド残高、想定外請求なし", "利用分析とコスト管理", "エンタープライズ級プライバシー", "全プロバイダーを 1 つの請求書に統合"],
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
    modelPricing: "Một khóa API cho mọi mô hình AI hàng đầu",
    description: "Nạp $10, tạo khóa API và gọi GPT, Claude, Gemini, DeepSeek, hình ảnh, âm thanh và video qua gateway tương thích OpenAI.",
    quickStartSteps: ["Nạp $10", "Tạo khóa API", "Gọi GPT, Claude, Gemini, DeepSeek và mô hình video"],
    plansEyebrow: "Thưởng nạp tiền",
    plansTitle: "Bắt đầu gọi mô hình trong vài phút, không cần mua sắm phức tạp",
    plansDescription: "Dùng một số dư trả trước cho nhiều họ mô hình. Xem giá trực tiếp bên dưới, rồi bắt đầu bằng khoản nạp nhỏ trước khi mở rộng.",
    websitePackage: "Gói website",
    prepaidBalanceTitle: "Số dư trả trước cho các mô hình AI hàng đầu",
    startingPackage: "gói khởi đầu, trả theo mức dùng bằng số dư bạn nạp",
    packageBullets: ["Thanh toán thành công sẽ cộng số dư trả trước.", "Mức dùng được tính theo giá token đầu vào, đầu ra và cache-hit của mô hình.", "Credit thưởng mỗi lần nạp", "Một khóa API cho mọi thứ", "Không khóa nhà cung cấp", "Phân tích sử dụng và kiểm soát chi phí", "Quyền riêng tư cấp doanh nghiệp", "Một hóa đơn thống nhất cho mọi nhà cung cấp"],
    getFreeApiKey: "Nhận khóa API miễn phí",
    enterpriseTeams: "Đội ngũ doanh nghiệp",
    contactSales: "Liên hệ kinh doanh để có mức dùng hằng tháng cao hơn và chiết khấu lớn hơn.",
    selfServeTitle: "Bắt đầu API tự phục vụ",
    selfServeDescription: "Không cần hợp đồng. Thêm số dư, tạo khóa, sao chép base_url và thử request đầu tiên.",
    trustSignals: ["Số dư trả trước, không hóa đơn bất ngờ", "Phân tích sử dụng và kiểm soát chi phí", "Quyền riêng tư cấp doanh nghiệp", "Một hóa đơn cho mọi nhà cung cấp"],
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
  de: {
    modelsDirectory: "Modellverzeichnis",
    modelPricing: "Ein API-Schlüssel für alle führenden AI-Modelle",
    description: "Lade $10 auf, erstelle einen API-Schlüssel und rufe GPT, Claude, Gemini, DeepSeek, Bild-, Audio- und Videomodelle über ein OpenAI-kompatibles Gateway auf.",
    quickStartSteps: ["$10 aufladen", "API-Schlüssel erstellen", "GPT, Claude, Gemini, DeepSeek und Videomodelle aufrufen"],
    plansEyebrow: "Aufladebonus",
    plansTitle: "Modelle in Minuten aufrufen, ohne Beschaffungsprozess",
    plansDescription: "Nutze ein Prepaid-Guthaben für mehrere Modellfamilien. Prüfe Live-Preise unten und starte mit einer kleinen Aufladung.",
    websitePackage: "Website-Paket",
    prepaidBalanceTitle: "Prepaid-Guthaben für führende AI-Modelle",
    startingPackage: "Startpaket, zahle nach Verbrauch mit dem aufgeladenen Guthaben",
    packageBullets: ["Eine erfolgreiche Zahlung erhöht das Prepaid-Guthaben.", "Die Nutzung wird nach den Token-Preisen des Modells für Eingabe, Ausgabe und Cache-Hit abgerechnet.", "Bonusguthaben bei jeder Aufladung", "Ein API-Schlüssel für alles", "Keine Anbieterbindung", "Nutzungsanalysen und Kostenkontrolle", "Datenschutz auf Enterprise-Niveau", "Eine einheitliche Rechnung für alle Anbieter"],
    getFreeApiKey: "Kostenlosen API-Schlüssel erhalten",
    enterpriseTeams: "Enterprise-Teams",
    contactSales: "Kontaktiere den Vertrieb für höhere monatliche Nutzung und größere Rabatte.",
    selfServeTitle: "Self-Service API-Start",
    selfServeDescription: "Kein Vertrag nötig. Guthaben hinzufügen, Schlüssel erstellen, base_url kopieren und erste Anfrage testen.",
    trustSignals: ["Prepaid-Guthaben, keine Überraschungsrechnung", "Nutzungsanalysen und Kostenkontrolle", "Datenschutz auf Enterprise-Niveau", "Eine Rechnung für alle Anbieter"],
    minimumPackage: "Mindest-Website-Paket",
    modelsThroughBalance: "Modelle über ein einziges Guthaben verfügbar",
    sharedBalance: "Guthaben für GPT, Claude, Gemini, DeepSeek und mehr",
    meteredTokenTypes: "gemessene Token-Typen: Eingabe, Ausgabe, Cache-Hit",
    noBundleLockIn: "feste Paketbindung",
    seoEyebrow: "AI-lesbare Preisübersicht",
    seoTitle: "flatkey.ai Modellpreise, Abrechnung und Anbieterabdeckung",
    seoParagraph1: "flatkey.ai veröffentlicht serverseitig gerenderte Modellpreise für {{modelCount}} AI-Modelle von {{vendorCount}} Anbietern. Suchmaschinen und AI-Assistenten können Modellnamen, Anbieter, Endpoint-Typen und Eingabe-/Ausgabepreise direkt aus dem Seiten-HTML lesen.",
    seoParagraph2: "Die Preise sind nach Token-basierten und anfragebasierten Modellen gegliedert. Token-Modelle zeigen Preise für Eingabe, Ausgabe, Cache-Hit und gruppenangepasste Preise, während Anfrage-Modelle die Abrechnung pro Anfrage für den produktiven API-Einsatz darstellen.",
    seoParagraph3Prefix: "Anbieter-Filter-URLs wie",
    seoParagraph3Middle: "und",
    seoParagraph3Suffix: "bieten crawlbare Einstiegspunkte für anbieterspezifische AI-Modellpreise.",
  },
};

const PRICING_UI_COPY: Record<Locale, PricingPageLocalizedUiCopy> = {
  en: {
    pricingHeroTitle: "Every top-up earns bonus credit — up to 50% off",
    pricingHeroDescription: "Models are priced at 60–90% of the official list. Top up $200 and get $100 free — both discounts stack, as low as 50% of the official price. Bonus is credited instantly, forever.",
    modelsEyebrow: "Models",
    modelsDescription: "Discover live model availability, pricing, endpoint support, and model detail pages.",
    topUpPlanName: "Top up {{price}}",
    bonus10Caption: "Pay $10, get $13 in credit",
    bonus20Caption: "Pay $20, get $28 in credit",
    bonus200Caption: "Pay $200, get $300 in credit",
    customPlanCaption: "Custom usage, routing, and invoicing",
    apiWorkloadsDescription: "Best for trying real API workloads.",
    bestValueDescription: "Best value for production testing, team workflows, and sustained model traffic.",
    popularBadge: "Most Popular",
    bonus10Label: "+3 free bonus",
    bonus20Label: "+8 free bonus",
    bonus200Label: "+100 free bonus",
    enterprisePlanName: "Enterprise",
    customPriceLabel: "Custom",
    enterprisePlanDescription: "For higher monthly usage, invoicing, team procurement, or custom routing discounts.",
    contactPlanCta: "Contact Us",
    highestPrepaidValue: "Highest prepaid value",
    customMonthlyUsage: "Custom monthly usage",
    teamProcurementSupport: "Team procurement support",
    customRoutingDiscounts: "Custom routing discounts",
    enterpriseContactCloseLabel: "Close enterprise contact form",
    enterpriseContactEyebrow: "Enterprise teams",
    enterpriseContactTitle: "Contact sales",
    enterpriseContactDescription: "Need higher monthly usage, invoicing, team procurement, or custom routing discounts? Send the form and we will follow up.",
  },
  zh: {
    pricingHeroTitle: "每次充值都送额度，最低 5 折",
    pricingHeroDescription: "模型定价为官方 6～9 折，充值 $200 再送 $100，两层优惠叠加最低 5 折。赠送即时到账，永久有效。",
    modelsEyebrow: "模型",
    modelsDescription: "查看实时模型可用性、价格、端点支持和模型详情页。",
    topUpPlanName: "充值 {{price}}",
    bonus10Caption: "充 $10 到账 $13",
    bonus20Caption: "充 $20 到账 $28",
    bonus200Caption: "充 $200 到账 $300",
    customPlanCaption: "定制用量、路由和发票",
    apiWorkloadsDescription: "适合跑真实 API 工作负载。",
    bestValueDescription: "适合生产测试、团队流程和持续模型流量的高性价比选择。",
    popularBadge: "最受欢迎",
    bonus10Label: "+3 免费赠送",
    bonus20Label: "+8 免费赠送",
    bonus200Label: "+100 免费赠送",
    enterprisePlanName: "企业版",
    customPriceLabel: "定制",
    enterprisePlanDescription: "适合更高月用量、发票、团队采购或定制路由折扣。",
    contactPlanCta: "联系销售",
    highestPrepaidValue: "最高预付价值",
    customMonthlyUsage: "定制月度用量",
    teamProcurementSupport: "团队采购支持",
    customRoutingDiscounts: "定制路由折扣",
    enterpriseContactCloseLabel: "关闭企业联系表单",
    enterpriseContactEyebrow: "企业团队",
    enterpriseContactTitle: "联系销售",
    enterpriseContactDescription: "需要更高月用量、发票、团队采购或定制路由折扣？提交表单后我们会跟进。",
  },
  es: {
    pricingHeroTitle: "Cada recarga otorga crédito extra — hasta 50% menos",
    pricingHeroDescription: "Los modelos cuestan el 60-90% del precio oficial. Recarga $200 y recibe $100 gratis: los dos descuentos se combinan, hasta el 50% del precio oficial. El bono se acredita al instante, para siempre.",
    modelsEyebrow: "Modelos",
    modelsDescription: "Consulta disponibilidad en vivo, precios, soporte de endpoints y páginas de detalle de modelos.",
    topUpPlanName: "Recargar {{price}}",
    bonus10Caption: "Paga $10, recibe $13 en crédito",
    bonus20Caption: "Paga $20, recibe $28 en crédito",
    bonus200Caption: "Paga $200, recibe $300 en crédito",
    customPlanCaption: "Uso, routing y facturación a medida",
    apiWorkloadsDescription: "Ideal para cargas de trabajo API reales.",
    bestValueDescription: "Mejor valor para pruebas de producción, flujos de equipo y tráfico sostenido de modelos.",
    popularBadge: "Más popular",
    bonus10Label: "+3 de bono gratis",
    bonus20Label: "+8 de bono gratis",
    bonus200Label: "+100 de bono gratis",
    enterprisePlanName: "Empresa",
    customPriceLabel: "A medida",
    enterprisePlanDescription: "Para mayor uso mensual, facturación, compras de equipo o descuentos de routing personalizados.",
    contactPlanCta: "Contactar ventas",
    highestPrepaidValue: "Mayor valor prepago",
    customMonthlyUsage: "Uso mensual personalizado",
    teamProcurementSupport: "Soporte para compras de equipo",
    customRoutingDiscounts: "Descuentos de routing personalizados",
    enterpriseContactCloseLabel: "Cerrar formulario de contacto empresarial",
    enterpriseContactEyebrow: "Equipos empresariales",
    enterpriseContactTitle: "Contactar ventas",
    enterpriseContactDescription: "¿Necesitas más uso mensual, facturación, compras de equipo o descuentos de routing personalizados? Envía el formulario y te responderemos.",
  },
  fr: {
    pricingHeroTitle: "Chaque recharge offre du crédit bonus — jusqu'à 50 % de moins",
    pricingHeroDescription: "Les modèles sont à 60-90 % du tarif officiel. Rechargez 200 $ et recevez 100 $ offerts — les deux remises se cumulent, jusqu'à 50 % du prix officiel. Le bonus est crédité instantanément, pour toujours.",
    modelsEyebrow: "Modèles",
    modelsDescription: "Découvrez la disponibilité live, les tarifs, le support des endpoints et les pages détaillées des modèles.",
    topUpPlanName: "Recharger {{price}}",
    bonus10Caption: "Payez $10, recevez $13 de crédit",
    bonus20Caption: "Payez $20, recevez $28 de crédit",
    bonus200Caption: "Payez $200, recevez $300 de crédit",
    customPlanCaption: "Usage, routage et facturation sur mesure",
    apiWorkloadsDescription: "Idéal pour tester de vraies charges API.",
    bestValueDescription: "Meilleur rapport valeur pour tests de production, workflows d'équipe et trafic modèle continu.",
    popularBadge: "Le plus populaire",
    bonus10Label: "+3 de bonus gratuit",
    bonus20Label: "+8 de bonus gratuit",
    bonus200Label: "+100 de bonus gratuit",
    enterprisePlanName: "Entreprise",
    customPriceLabel: "Sur mesure",
    enterprisePlanDescription: "Pour un usage mensuel plus élevé, la facturation, les achats d'équipe ou des remises de routage personnalisées.",
    contactPlanCta: "Contacter les ventes",
    highestPrepaidValue: "Valeur prépayée maximale",
    customMonthlyUsage: "Usage mensuel personnalisé",
    teamProcurementSupport: "Support achats d'équipe",
    customRoutingDiscounts: "Remises de routage personnalisées",
    enterpriseContactCloseLabel: "Fermer le formulaire de contact entreprise",
    enterpriseContactEyebrow: "Équipes entreprise",
    enterpriseContactTitle: "Contacter les ventes",
    enterpriseContactDescription: "Besoin de plus d'usage mensuel, de facturation, d'achats d'équipe ou de remises de routage personnalisées ? Envoyez le formulaire et nous vous répondrons.",
  },
  pt: {
    pricingHeroTitle: "Cada recarga rende crédito bônus — até 50% de desconto",
    pricingHeroDescription: "Os modelos custam 60-90% do preço oficial. Recarregue $200 e ganhe $100 grátis — os dois descontos se somam, até 50% do preço oficial. O bônus cai na hora, para sempre.",
    modelsEyebrow: "Modelos",
    modelsDescription: "Veja disponibilidade ao vivo, preços, suporte a endpoints e páginas de detalhes dos modelos.",
    topUpPlanName: "Recarregar {{price}}",
    bonus10Caption: "Pague $10, receba $13 em crédito",
    bonus20Caption: "Pague $20, receba $28 em crédito",
    bonus200Caption: "Pague $200, receba $300 em crédito",
    customPlanCaption: "Uso, roteamento e faturamento sob medida",
    apiWorkloadsDescription: "Ideal para workloads reais de API.",
    bestValueDescription: "Melhor valor para testes em produção, fluxos de equipe e tráfego contínuo de modelos.",
    popularBadge: "Mais popular",
    bonus10Label: "+3 de bônus grátis",
    bonus20Label: "+8 de bônus grátis",
    bonus200Label: "+100 de bônus grátis",
    enterprisePlanName: "Empresarial",
    customPriceLabel: "Sob medida",
    enterprisePlanDescription: "Para maior uso mensal, faturamento, compras de equipe ou descontos personalizados de roteamento.",
    contactPlanCta: "Falar com vendas",
    highestPrepaidValue: "Maior valor pré-pago",
    customMonthlyUsage: "Uso mensal personalizado",
    teamProcurementSupport: "Suporte a compras de equipe",
    customRoutingDiscounts: "Descontos personalizados de roteamento",
    enterpriseContactCloseLabel: "Fechar formulário de contato empresarial",
    enterpriseContactEyebrow: "Equipes empresariais",
    enterpriseContactTitle: "Falar com vendas",
    enterpriseContactDescription: "Precisa de maior uso mensal, faturamento, compras de equipe ou descontos personalizados de roteamento? Envie o formulário e entraremos em contato.",
  },
  ru: {
    pricingHeroTitle: "Пополняйте и получайте бонусный кредит — до 50% дешевле",
    pricingHeroDescription: "Цены моделей — 60-90% от официальных. Пополните $200 и получите $100 бесплатно — скидки складываются, до 50% от официальной цены. Бонус зачисляется мгновенно, навсегда.",
    modelsEyebrow: "Модели",
    modelsDescription: "Смотрите live-доступность моделей, цены, поддержку endpoints и страницы деталей моделей.",
    topUpPlanName: "Пополнить на {{price}}",
    bonus10Caption: "Заплатите $10 — получите $13 кредита",
    bonus20Caption: "Заплатите $20 — получите $28 кредита",
    bonus200Caption: "Заплатите $200 — получите $300 кредита",
    customPlanCaption: "Индивидуальное использование, маршрутизация и счета",
    apiWorkloadsDescription: "Лучший выбор для реальных API-нагрузок.",
    bestValueDescription: "Лучшее соотношение цены для production-тестов, командных процессов и стабильного model traffic.",
    popularBadge: "Самый популярный",
    bonus10Label: "+3 бесплатного бонуса",
    bonus20Label: "+8 бесплатного бонуса",
    bonus200Label: "+100 бесплатного бонуса",
    enterprisePlanName: "Enterprise",
    customPriceLabel: "Индивидуально",
    enterprisePlanDescription: "Для большего месячного объема, счетов, закупок командой или индивидуальных routing-скидок.",
    contactPlanCta: "Связаться с продажами",
    highestPrepaidValue: "Максимальная ценность предоплаты",
    customMonthlyUsage: "Индивидуальный месячный объем",
    teamProcurementSupport: "Поддержка закупок команды",
    customRoutingDiscounts: "Индивидуальные routing-скидки",
    enterpriseContactCloseLabel: "Закрыть форму контакта Enterprise",
    enterpriseContactEyebrow: "Enterprise-команды",
    enterpriseContactTitle: "Связаться с продажами",
    enterpriseContactDescription: "Нужен больший месячный объем, счета, командные закупки или индивидуальные routing-скидки? Отправьте форму, и мы свяжемся с вами.",
  },
  ja: {
    pricingHeroTitle: "チャージでボーナス進呈 — 最大50%オフ",
    pricingHeroDescription: "モデル価格は公式の 60〜90%。$200 チャージで $100 進呈 — 割引は重ねがけで、最安で公式価格の 50%。ボーナスは即時付与、期限なし。",
    modelsEyebrow: "モデル",
    modelsDescription: "ライブのモデル可用性、料金、エンドポイント対応、モデル詳細ページを確認できます。",
    topUpPlanName: "{{price}} をチャージ",
    bonus10Caption: "$10 のチャージで $13 分に",
    bonus20Caption: "$20 のチャージで $28 分に",
    bonus200Caption: "$200 のチャージで $300 分に",
    customPlanCaption: "利用量、ルーティング、請求をカスタム",
    apiWorkloadsDescription: "実際の API ワークロードに最適。",
    bestValueDescription: "本番テスト、チームワークフロー、継続的なモデル利用に最適な価値です。",
    popularBadge: "人気",
    bonus10Label: "+3 無料ボーナス",
    bonus20Label: "+8 無料ボーナス",
    bonus200Label: "+100 無料ボーナス",
    enterprisePlanName: "エンタープライズ",
    customPriceLabel: "カスタム",
    enterprisePlanDescription: "より高い月間利用量、請求書、チーム調達、カスタムルーティング割引向け。",
    contactPlanCta: "営業に相談",
    highestPrepaidValue: "最大のプリペイド価値",
    customMonthlyUsage: "カスタム月間利用量",
    teamProcurementSupport: "チーム調達サポート",
    customRoutingDiscounts: "カスタムルーティング割引",
    enterpriseContactCloseLabel: "エンタープライズ問い合わせフォームを閉じる",
    enterpriseContactEyebrow: "エンタープライズチーム",
    enterpriseContactTitle: "営業に相談",
    enterpriseContactDescription: "より高い月間利用量、請求書、チーム調達、カスタムルーティング割引が必要ですか？フォームを送信いただければご連絡します。",
  },
  vi: {
    pricingHeroTitle: "Nạp tiền nhận credit thưởng — rẻ hơn tới 50%",
    pricingHeroDescription: "Giá model bằng 60-90% giá chính thức. Nạp $200 tặng thêm $100 — hai ưu đãi cộng dồn, thấp nhất bằng 50% giá chính thức. Credit thưởng cộng ngay, vĩnh viễn.",
    modelsEyebrow: "Mô hình",
    modelsDescription: "Xem availability trực tiếp, giá, hỗ trợ endpoint và trang chi tiết mô hình.",
    topUpPlanName: "Nạp {{price}}",
    bonus10Caption: "Nạp $10, nhận $13 credit",
    bonus20Caption: "Nạp $20, nhận $28 credit",
    bonus200Caption: "Nạp $200, nhận $300 credit",
    customPlanCaption: "Usage, routing và invoice tùy chỉnh",
    apiWorkloadsDescription: "Phù hợp nhất cho workload API thực tế.",
    bestValueDescription: "Giá trị tốt nhất cho thử nghiệm production, workflow nhóm và traffic mô hình ổn định.",
    popularBadge: "Phổ biến nhất",
    bonus10Label: "+3 bonus miễn phí",
    bonus20Label: "+8 bonus miễn phí",
    bonus200Label: "+100 bonus miễn phí",
    enterprisePlanName: "Doanh nghiệp",
    customPriceLabel: "Tùy chỉnh",
    enterprisePlanDescription: "Cho usage tháng cao hơn, invoice, procurement nhóm hoặc giảm giá routing tùy chỉnh.",
    contactPlanCta: "Liên hệ sales",
    highestPrepaidValue: "Giá trị trả trước cao nhất",
    customMonthlyUsage: "Usage tháng tùy chỉnh",
    teamProcurementSupport: "Hỗ trợ procurement nhóm",
    customRoutingDiscounts: "Giảm giá routing tùy chỉnh",
    enterpriseContactCloseLabel: "Đóng form liên hệ doanh nghiệp",
    enterpriseContactEyebrow: "Đội ngũ doanh nghiệp",
    enterpriseContactTitle: "Liên hệ sales",
    enterpriseContactDescription: "Cần usage tháng cao hơn, invoice, procurement nhóm hoặc giảm giá routing tùy chỉnh? Gửi form và chúng tôi sẽ phản hồi.",
  },
  de: {
    pricingHeroTitle: "Aufladen und Bonusguthaben erhalten — bis zu 50% günstiger",
    pricingHeroDescription: "Modellpreise liegen bei 60-90% des offiziellen Listenpreises. $200 aufladen, $100 geschenkt — beide Rabatte kombiniert: bis zu 50% des offiziellen Preises. Bonus sofort gutgeschrieben, dauerhaft.",
    modelsEyebrow: "Modelle",
    modelsDescription: "Entdecke Live-Verfügbarkeit, Preise, Endpoint-Support und Modell-Detailseiten.",
    topUpPlanName: "{{price}} aufladen",
    bonus10Caption: "Zahle $10, erhalte $13 Guthaben",
    bonus20Caption: "Zahle $20, erhalte $28 Guthaben",
    bonus200Caption: "Zahle $200, erhalte $300 Guthaben",
    customPlanCaption: "Individuelle Nutzung, Routing und Rechnungen",
    apiWorkloadsDescription: "Ideal für echte API-Workloads.",
    bestValueDescription: "Bester Wert für Produktionstests, Team-Workflows und dauerhaften Modell-Traffic.",
    popularBadge: "Am beliebtesten",
    bonus10Label: "+3 Gratisbonus",
    bonus20Label: "+8 Gratisbonus",
    bonus200Label: "+100 Gratisbonus",
    enterprisePlanName: "Enterprise",
    customPriceLabel: "Individuell",
    enterprisePlanDescription: "Für höhere Monatsnutzung, Rechnungen, Team-Procurement oder individuelle Routing-Rabatte.",
    contactPlanCta: "Vertrieb kontaktieren",
    highestPrepaidValue: "Höchster Prepaid-Wert",
    customMonthlyUsage: "Individuelle Monatsnutzung",
    teamProcurementSupport: "Support für Team-Procurement",
    customRoutingDiscounts: "Individuelle Routing-Rabatte",
    enterpriseContactCloseLabel: "Enterprise-Kontaktformular schließen",
    enterpriseContactEyebrow: "Enterprise-Teams",
    enterpriseContactTitle: "Vertrieb kontaktieren",
    enterpriseContactDescription: "Benötigst du höhere Monatsnutzung, Rechnungen, Team-Procurement oder individuelle Routing-Rabatte? Sende das Formular und wir melden uns.",
  },
};

export function getPricingPageCopy(locale: Locale): PricingPageCopy {
  const baseCopy = PRICING_COPY[locale] ?? PRICING_COPY.en;
  const uiCopy = PRICING_UI_COPY[locale] ?? PRICING_UI_COPY.en;
  return { ...baseCopy, ...uiCopy };
}

function pricingCopy(locale: Locale): PricingPageCopy {
  return getPricingPageCopy(locale);
}

export type PricingPlan = {
  name: string;
  price: string;
  caption: string;
  description: string;
  cta: string;
  badge?: string;
  discount?: string;
  featured: boolean;
  action: "checkout" | "contact";
  currency?: PricingCurrency;
  amount?: number;
  amountMinor?: number;
  stripeLookupKey?: string;
  checkoutUrl?: string;
  features: string[];
};

type PricingFaq = {
  question: string;
  answer: string;
};

const PRICING_FAQ_TITLE: Record<Locale, string> = {
  en: "Pricing FAQ",
  zh: "定价常见问题",
  es: "Preguntas frecuentes sobre precios",
  fr: "FAQ tarifs",
  pt: "FAQ de preços",
  ru: "FAQ по ценам",
  ja: "料金 FAQ",
  vi: "FAQ về giá",
  de: "Preis-FAQ",
};

const PRICING_FAQS: Record<Locale, PricingFaq[]> = {
  en: [
    { question: "How does the top-up bonus work?", answer: "Every top-up earns bonus credit, forever: +$3 on $10, +$8 on $20, +$100 on $200. The bonus lands in your balance instantly and is spent like normal credit. Models are also priced at 60–90% of the official list — stacked with the bonus, as low as 50% of the official price." },
    { question: "Is this a monthly subscription?", answer: "No. The self-serve plans are prepaid top-ups. Balance is consumed only when API requests use models." },
    { question: "Which models can use the same balance?", answer: "One balance can route across GPT, Claude, Gemini, DeepSeek, image, audio, and video models through one OpenAI-compatible gateway." },
    { question: "Can I see how the balance is consumed?", answer: "Yes. Usage is metered by model, token type, and request logs so teams can review spend and control cost." },
    { question: "When should I choose Enterprise?", answer: "Choose Enterprise for larger monthly usage, invoicing, procurement, custom routing discounts, or team-level controls." },
  ],
  zh: [
    { question: "充值赠送是怎么算的？", answer: "每次充值都送额度，永久有效：充 $10 送 $3、充 $20 送 $8、充 $200 送 $100。赠送即时到账，和普通余额一样使用。模型定价本身为官方 6～9 折，与充值赠送叠加最低 5 折。" },
    { question: "这是月订阅吗？", answer: "不是。自助套餐是预付充值，只有发起模型 API 请求时才消耗余额。" },
    { question: "同一个余额可以调用哪些模型？", answer: "一个余额可通过 OpenAI 兼容网关调用 GPT、Claude、Gemini、DeepSeek、图像、音频和视频模型。" },
    { question: "能看到余额怎么消耗吗？", answer: "可以。系统按模型、token 类型和请求日志计量，团队可以复盘支出并控制成本。" },
    { question: "什么时候选 Enterprise？", answer: "月用量更大、需要发票/采购流程、定制路由折扣或团队级管控时，选择 Enterprise。" },
  ],
  es: [
    { question: "¿Cómo funciona el bono de recarga?", answer: "Cada recarga otorga crédito extra, para siempre: +$3 en $10, +$8 en $20, +$100 en $200. El bono se acredita al instante y se usa como saldo normal. Además, los modelos cuestan el 60-90% del precio oficial: combinado con el bono, hasta el 50% del precio oficial." },
    { question: "¿Es una suscripción mensual?", answer: "No. Los planes self-service son recargas prepago. El saldo solo se consume cuando las solicitudes API usan modelos." },
    { question: "¿Qué modelos usan el mismo saldo?", answer: "Un saldo puede enrutar GPT, Claude, Gemini, DeepSeek, imagen, audio y vídeo desde una gateway compatible con OpenAI." },
    { question: "¿Puedo ver cómo se consume el saldo?", answer: "Sí. El uso se mide por modelo, tipo de token y logs de solicitudes para revisar gasto y controlar costes." },
    { question: "¿Cuándo conviene Enterprise?", answer: "Elige Enterprise para mayor uso mensual, facturación, compras, descuentos de routing personalizados o controles de equipo." },
  ],
  fr: [
    { question: "Comment fonctionne le bonus de recharge ?", answer: "Chaque recharge offre du crédit bonus, pour toujours : +3 $ sur 10 $, +8 $ sur 20 $, +100 $ sur 200 $. Le bonus est crédité instantanément et se dépense comme un solde normal. De plus, les modèles sont à 60-90 % du tarif officiel : cumulé avec le bonus, jusqu'à 50 % du prix officiel." },
    { question: "Est-ce un abonnement mensuel ?", answer: "Non. Les plans self-service sont des recharges prépayées. Le solde est consommé seulement quand les requêtes API utilisent des modèles." },
    { question: "Quels modèles utilisent le même solde ?", answer: "Un seul solde peut router GPT, Claude, Gemini, DeepSeek, image, audio et vidéo via une gateway compatible OpenAI." },
    { question: "Puis-je voir comment le solde est consommé ?", answer: "Oui. L'usage est mesuré par modèle, type de token et logs de requêtes pour suivre la dépense et contrôler les coûts." },
    { question: "Quand choisir Enterprise ?", answer: "Choisissez Enterprise pour un usage mensuel élevé, facturation, achats, remises de routage personnalisées ou contrôles d'équipe." },
  ],
  pt: [
    { question: "Como funciona o bônus de recarga?", answer: "Cada recarga rende crédito bônus, para sempre: +$3 em $10, +$8 em $20, +$100 em $200. O bônus cai na hora e é gasto como saldo normal. Além disso, os modelos custam 60-90% do preço oficial — somado ao bônus, até 50% do preço oficial." },
    { question: "Isso é uma assinatura mensal?", answer: "Não. Os planos self-service são recargas pré-pagas. O saldo só é consumido quando chamadas de API usam modelos." },
    { question: "Quais modelos usam o mesmo saldo?", answer: "Um saldo pode rotear GPT, Claude, Gemini, DeepSeek, imagem, áudio e vídeo por um gateway compatível com OpenAI." },
    { question: "Posso ver como o saldo é consumido?", answer: "Sim. O uso é medido por modelo, tipo de token e logs de requisição para revisar gastos e controlar custos." },
    { question: "Quando escolher Enterprise?", answer: "Escolha Enterprise para maior uso mensal, faturamento, compras, descontos personalizados de roteamento ou controles de equipe." },
  ],
  ru: [
    { question: "Как работает бонус за пополнение?", answer: "Каждое пополнение даёт бонусный кредит, навсегда: +$3 к $10, +$8 к $20, +$100 к $200. Бонус зачисляется мгновенно и тратится как обычный баланс. Кроме того, цены моделей — 60-90% от официальных: вместе с бонусом до 50% от официальной цены." },
    { question: "Это месячная подписка?", answer: "Нет. Self-serve планы работают как prepaid top-up. Баланс расходуется только при API-запросах к моделям." },
    { question: "Какие модели используют один баланс?", answer: "Один баланс может маршрутизировать GPT, Claude, Gemini, DeepSeek, image, audio и video через OpenAI-compatible gateway." },
    { question: "Можно увидеть, как расходуется баланс?", answer: "Да. Использование измеряется по модели, типу токена и логам запросов, чтобы команда видела расходы и контролировала стоимость." },
    { question: "Когда выбирать Enterprise?", answer: "Enterprise подходит для большого месячного объема, invoice/procurement, кастомных routing discounts и командных контролей." },
  ],
  ja: [
    { question: "チャージ特典はどのような仕組みですか？", answer: "チャージのたびにボーナスクレジットを進呈、期限なし：$10 で +$3、$20 で +$8、$200 で +$100。ボーナスは即時付与され、通常の残高と同じように使えます。さらにモデル価格自体が公式の 60〜90%。特典と合わせて最安で公式価格の 50%です。" },
    { question: "月額サブスクリプションですか？", answer: "いいえ。セルフサービスプランはプリペイドチャージです。モデル API リクエストを使った分だけ残高を消費します。" },
    { question: "同じ残高でどのモデルを使えますか？", answer: "1 つの残高で GPT、Claude、Gemini、DeepSeek、画像、音声、動画モデルを OpenAI 互換 gateway 経由で利用できます。" },
    { question: "残高の消費内訳は見えますか？", answer: "はい。モデル、token 種別、リクエストログ別に計量され、支出の確認とコスト管理ができます。" },
    { question: "Enterprise はいつ選ぶべきですか？", answer: "月間利用量が大きい場合、請求書・購買対応、カスタム routing 割引、チーム管理が必要な場合に適しています。" },
  ],
  vi: [
    { question: "Thưởng nạp tiền hoạt động thế nào?", answer: "Mỗi lần nạp đều được tặng credit, vĩnh viễn: +$3 khi nạp $10, +$8 khi nạp $20, +$100 khi nạp $200. Credit thưởng cộng ngay và dùng như số dư bình thường. Ngoài ra giá model bằng 60-90% giá chính thức — cộng dồn với thưởng nạp, thấp nhất bằng 50% giá chính thức." },
    { question: "Đây có phải thuê bao hằng tháng không?", answer: "Không. Các gói self-serve là nạp trả trước. Số dư chỉ bị trừ khi request API dùng mô hình." },
    { question: "Những mô hình nào dùng chung một số dư?", answer: "Một số dư có thể route GPT, Claude, Gemini, DeepSeek, hình ảnh, âm thanh và video qua gateway tương thích OpenAI." },
    { question: "Có xem được số dư tiêu thụ thế nào không?", answer: "Có. Usage được đo theo mô hình, loại token và log request để đội ngũ xem chi phí và kiểm soát ngân sách." },
    { question: "Khi nào nên chọn Enterprise?", answer: "Chọn Enterprise khi có mức dùng tháng lớn, cần invoice/procurement, chiết khấu routing riêng hoặc kiểm soát cấp đội ngũ." },
  ],
  de: [
    { question: "Wie funktioniert der Aufladebonus?", answer: "Jede Aufladung bringt Bonusguthaben, dauerhaft: +$3 bei $10, +$8 bei $20, +$100 bei $200. Der Bonus wird sofort gutgeschrieben und wie normales Guthaben verbraucht. Zudem liegen die Modellpreise bei 60-90% des offiziellen Listenpreises — kombiniert mit dem Bonus bis zu 50% des offiziellen Preises." },
    { question: "Ist das ein Monatsabo?", answer: "Nein. Self-Service-Pläne sind Prepaid-Aufladungen. Guthaben wird nur verbraucht, wenn API-Requests Modelle nutzen." },
    { question: "Welche Modelle nutzen dasselbe Guthaben?", answer: "Ein Guthaben kann GPT, Claude, Gemini, DeepSeek, Bild, Audio und Video über ein OpenAI-kompatibles Gateway routen." },
    { question: "Kann ich sehen, wie Guthaben verbraucht wird?", answer: "Ja. Nutzung wird nach Modell, Token-Typ und Request-Logs gemessen, damit Teams Ausgaben prüfen und Kosten steuern können." },
    { question: "Wann sollte ich Enterprise wählen?", answer: "Enterprise passt für höhere Monatsnutzung, Rechnungsstellung, Procurement, eigene Routing-Rabatte oder Team-Kontrollen." },
  ],
};

export function getPricingPageFaqs(locale: Locale): PricingFaq[] {
  return PRICING_FAQS[locale] ?? PRICING_FAQS.en;
}

export const LOCALIZED_TOP_UP_PRICES = {
  USD: [10, 20, 200],
  BRL: [49.9, 99.9, 990],
  JPY: [1500, 3000, 30000],
} as const;

export const TOP_UP_PACKAGE_AMOUNTS = [10, 20, 200] as const;

export type PricingCurrency = keyof typeof LOCALIZED_TOP_UP_PRICES;

function pricingCurrency(locale: Locale): PricingCurrency {
  if (locale === "pt") return "BRL";
  if (locale === "ja") return "JPY";
  return "USD";
}

function formatTopUpPrice(currency: PricingCurrency, index: number): string {
  const amount = LOCALIZED_TOP_UP_PRICES[currency][index];
  if (currency === "BRL") return `R$${amount.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: amount % 1 === 0 ? 0 : 2 })}`;
  if (currency === "JPY") return `¥${amount.toLocaleString("en-US")}`;
  return `$${amount.toLocaleString("en-US")}`;
}

function topUpPlanName(currency: PricingCurrency, index: number, copy: PricingPageCopy): string {
  return copy.topUpPlanName.replace("{{price}}", formatTopUpPrice(currency, index));
}

function localizedTopUpAmount(currency: PricingCurrency, index: number): number {
  return LOCALIZED_TOP_UP_PRICES[currency][index];
}

function topUpPackageAmount(index: number): number {
  return TOP_UP_PACKAGE_AMOUNTS[index];
}

function topUpAmountMinor(currency: PricingCurrency, amount: number): number {
  return currency === "JPY" ? amount : Math.round(amount * 100);
}

function stripeLookupKey(currency: PricingCurrency, amountMinor: number): string {
  return `topup-${currency.toLowerCase()}-${amountMinor}`;
}

function checkoutPlanFields(currency: PricingCurrency, index: number) {
  const displayAmount = localizedTopUpAmount(currency, index);
  const amount = topUpPackageAmount(index);
  const amountMinor = topUpAmountMinor(currency, displayAmount);
  const lookupKey = stripeLookupKey(currency, amountMinor);

  return {
    action: "checkout" as const,
    currency,
    amount,
    amountMinor,
    stripeLookupKey: lookupKey,
    checkoutUrl: pricingCheckoutUrl({
      amount,
      currency,
      amountMinor,
      stripeLookupKey: lookupKey,
    }),
  };
}

export function getPricingPlans(locale: Locale): PricingPlan[] {
  const copy = pricingCopy(locale);
  const currency = pricingCurrency(locale);
  return [
    {
      name: topUpPlanName(currency, 0, copy),
      price: formatTopUpPrice(currency, 0),
      caption: copy.bonus10Caption,
      description: copy.selfServeDescription,
      cta: topUpPlanName(currency, 0, copy),
      badge: copy.popularBadge,
      discount: copy.bonus10Label,
      featured: true,
      ...checkoutPlanFields(currency, 0),
      features: [copy.trustSignals[0], copy.packageBullets[3], copy.packageBullets[4], copy.packageBullets[5]],
    },
    {
      name: topUpPlanName(currency, 1, copy),
      price: formatTopUpPrice(currency, 1),
      caption: copy.bonus20Caption,
      description: copy.apiWorkloadsDescription,
      cta: topUpPlanName(currency, 1, copy),
      discount: copy.bonus20Label,
      featured: false,
      ...checkoutPlanFields(currency, 1),
      features: [copy.packageBullets[2], copy.trustSignals[1], copy.trustSignals[2], copy.trustSignals[3]],
    },
    {
      name: topUpPlanName(currency, 2, copy),
      price: formatTopUpPrice(currency, 2),
      caption: copy.bonus200Caption,
      description: copy.bestValueDescription,
      cta: topUpPlanName(currency, 2, copy),
      discount: copy.bonus200Label,
      featured: false,
      ...checkoutPlanFields(currency, 2),
      features: [copy.highestPrepaidValue, copy.trustSignals[1], copy.trustSignals[2], copy.trustSignals[3]],
    },
    {
      name: copy.enterprisePlanName,
      price: copy.customPriceLabel,
      caption: copy.customPlanCaption,
      description: copy.enterprisePlanDescription,
      cta: copy.contactPlanCta,
      featured: false,
      action: "contact",
      features: [copy.customMonthlyUsage, copy.teamProcurementSupport, copy.customRoutingDiscounts, copy.trustSignals[3]],
    },
  ];
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
  const copy = pricingCopy(props.locale);
  const plans = getPricingPlans(props.locale);
  const faqs = getPricingPageFaqs(props.locale);

  return (
    <SiteShell locale={props.locale} pathname="/pricing">
      <main className="relative min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#f7f5ff_0%,#ffffff_48%,#f4f1ff_100%)] dark:bg-[linear-gradient(180deg,#050712_0%,#080b18_46%,#040511_100%)]">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(124,58,237,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(124,58,237,0.07)_1px,transparent_1px)] bg-[size:4.5rem_4.5rem] opacity-60 dark:bg-[linear-gradient(to_right,rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.05)_1px,transparent_1px)] dark:opacity-55" />
        <div className="relative mx-auto max-w-7xl px-4 pt-24 pb-16 sm:px-6 lg:px-8">
          <header className="mx-auto max-w-3xl text-center">
            <p className="mx-auto mb-4 inline-flex rounded-full border border-violet-400/25 bg-violet-500/10 px-4 py-1.5 text-xs font-bold tracking-[0.18em] text-violet-700 uppercase dark:border-violet-300/25 dark:bg-violet-300/10 dark:text-violet-200">
              {copy.plansEyebrow}
            </p>
            <h1 className="text-[clamp(2.5rem,6vw,4.75rem)] leading-[0.98] font-black tracking-tight text-slate-950 dark:text-white">
              {copy.pricingHeroTitle}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
              {copy.pricingHeroDescription}
            </p>
          </header>

          <PricingPlansGrid
            plans={plans}
            locale={props.locale}
            contactCopy={{
              closeLabel: copy.enterpriseContactCloseLabel,
              eyebrow: copy.enterpriseContactEyebrow,
              title: copy.enterpriseContactTitle,
              description: copy.enterpriseContactDescription,
            }}
          />

          <section className="mt-10">
            <div className="mb-5 flex items-end justify-between gap-4">
              <h2 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">{PRICING_FAQ_TITLE[props.locale] ?? PRICING_FAQ_TITLE.en}</h2>
              <div className="hidden h-px flex-1 bg-gradient-to-r from-violet-500/18 to-transparent sm:block" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {faqs.map((faq) => (
                <article key={faq.question} className="rounded-2xl border border-violet-500/14 bg-white/72 p-5 shadow-[0_20px_70px_-58px_rgba(91,33,182,0.6)] dark:border-white/10 dark:bg-white/[0.055]">
                  <h3 className="text-base font-black text-slate-950 dark:text-white">{faq.question}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{faq.answer}</p>
                </article>
              ))}
            </div>
          </section>

        </div>
      </main>
    </SiteShell>
  );
}

export async function ModelsPage(props: PricingPageProps) {
  const pricing = await getPricingData();
  const allModels = enrichVendorNames(pricing.models, pricing.vendors, pricing.groupRatio, pricing.usableGroup);
  const copy = pricingCopy(props.locale);

  return (
    <SiteShell locale={props.locale} pathname="/models">
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
            <p className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-violet-400/35 bg-violet-500/10 px-4 py-1.5 text-xs font-semibold tracking-[0.18em] text-violet-700 uppercase shadow-[0_0_28px_rgba(168,85,247,0.14)] dark:border-violet-300/25 dark:bg-violet-300/10 dark:text-violet-200">
              <span className="size-1.5 rounded-full bg-violet-500 shadow-[0_0_12px_rgba(168,85,247,0.9)] dark:bg-violet-300" />
              {copy.modelsEyebrow}
            </p>
            <h1 className="bg-[linear-gradient(90deg,#171321_0%,#7c3aed_46%,#2563eb_100%)] bg-clip-text text-[clamp(2.6rem,7vw,5rem)] leading-[0.98] font-black tracking-tight text-transparent dark:bg-[linear-gradient(90deg,#ffffff_0%,#c4b5fd_48%,#93c5fd_100%)] dark:bg-clip-text">
              {copy.modelsDirectory}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300 sm:text-base">
              {copy.modelsDescription}
            </p>
          </header>

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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
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
          <div className="rounded-2xl border border-emerald-500/18 bg-emerald-500/[0.055] p-4">
            <p className="text-xs font-medium tracking-widest text-emerald-700 uppercase">{copy.selfServeTitle}</p>
            <h3 className="mt-2 text-lg font-bold tracking-tight">{copy.packageBullets[2]}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{copy.selfServeDescription}</p>
            <div className="mt-4 grid gap-2">
              {[
                { label: "$10", value: copy.bonus10Label },
                { label: "$20", value: copy.bonus20Label },
                { label: "$200", value: copy.bonus200Label },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/14 bg-white/70 px-3 py-2">
                  <span className="text-sm font-medium text-slate-700">{item.label}</span>
                  <span className="text-right text-xs font-bold text-emerald-700">{item.value}</span>
                </div>
              ))}
            </div>
            <a
              className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white shadow-[0_16px_34px_-18px_rgba(5,150,105,0.75)] transition-colors hover:bg-emerald-500"
              href={SIGN_UP_URL}
            >
              {copy.getFreeApiKey}
              <ArrowRight className="ml-2 size-4" />
            </a>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {copy.trustSignals.map((signal) => (
              <div key={signal} className="flex items-start gap-2 rounded-xl border border-violet-500/12 bg-white/58 px-3 py-3 text-sm leading-5 text-slate-700">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-violet-600" />
                <span>{signal}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 border-t border-violet-500/12 pt-4">
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
          </div>
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

function QuickStartSteps(props: { steps: string[] }) {
  const icons = [Wallet, KeyRound, Code2] as const;
  return (
    <div className="mx-auto mt-6 grid max-w-3xl gap-2 text-left sm:grid-cols-3">
      {props.steps.map((step, index) => {
        const Icon = icons[index] ?? CheckCircle2;
        return (
          <div key={step} className="flex items-center gap-3 rounded-2xl border border-violet-500/14 bg-white/68 px-4 py-3 shadow-[0_16px_44px_-34px_rgba(91,33,182,0.72)] backdrop-blur-sm">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-700">
              <Icon className="size-4" />
            </span>
            <span className="text-sm font-bold text-slate-800">{step}</span>
          </div>
        );
      })}
    </div>
  );
}

function PricingSeoContent(props: { locale: Locale; modelCount: number; vendorCount: number }) {
  const copy = pricingCopy(props.locale);
  return (
    <section className="mt-10 rounded-3xl border border-violet-500/12 bg-white/70 p-6 shadow-[0_20px_70px_-58px_rgba(91,33,182,0.6)] backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.055] dark:shadow-[0_20px_70px_-58px_rgba(124,58,237,0.95)]">
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
          {copy.seoParagraph3Prefix} <code className="rounded bg-muted px-1.5 py-0.5 dark:bg-white/10 dark:text-slate-200">/models?vendor=OpenAI</code> {copy.seoParagraph3Middle} <code className="rounded bg-muted px-1.5 py-0.5 dark:bg-white/10 dark:text-slate-200">/models?vendor=Anthropic</code> {copy.seoParagraph3Suffix}
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
