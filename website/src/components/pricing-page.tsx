import { ArrowRight, Ban, Boxes, CheckCircle2, Code2, DollarSign, Gauge, KeyRound, Mail, Wallet } from "lucide-react";
import Image from "next/image";
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
  costExamplesTitle: string;
  costExamples: Array<{ label: string; value: string }>;
  officialPlusProof: {
    medal: string;
    officialLabel: string;
    officialValue: string;
    flatkeyLabel: string;
    flatkeyValue: string;
    proof: string;
  };
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
  lowestEntryCaption: string;
  threeXCaption: string;
  fortyXCaption: string;
  customPlanCaption: string;
  bestFirstTopUpDescription: string;
  bestValueDescription: string;
  popularBadge: string;
  discount40: string;
  discount50: string;
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
    plansEyebrow: "Plans and top-up packages",
    plansTitle: "Start calling models in minutes, not after procurement",
    plansDescription: "Use one prepaid balance across model families. See live prices below, then start with a small top-up before scaling.",
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
    selfServeTitle: "Self-serve API start",
    selfServeDescription: "No contract required. Add balance, create a key, copy the base_url, and test your first request.",
    costExamplesTitle: "3X the official Plus plan usage",
    costExamples: [
      { label: "Built for real API workloads", value: "more runs than a fixed Plus seat" },
      { label: "One balance across top models", value: "GPT, Claude, Gemini, DeepSeek, image, and video" },
      { label: "40% lower effective cost", value: "more usage before your next top-up" },
    ],
    officialPlusProof: {
      medal: "Official token burn verified",
      officialLabel: "Official Plus",
      officialValue: "Fixed seat, fixed bundle",
      flatkeyLabel: "$20 Flatkey top-up",
      flatkeyValue: "Metered API balance",
      proof: "$20 reaches 3X official Plus-style usable workload because every dollar becomes metered token balance: no seat overhead, lower routed unit cost, and no forced bundle waste.",
    },
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
    plansEyebrow: "套餐与充值包",
    plansTitle: "几分钟开始调用模型，不用先走采购",
    plansDescription: "一份预付余额覆盖多个模型家族。先看下方实时价格，再用小额充值测试，稳定后再扩量。",
    websitePackage: "官网套餐",
    prepaidBalanceTitle: "用于热门 AI 模型的预付余额",
    startingPackage: "起始套餐，充值多少就按量使用多少",
    packageBullets: ["支付成功后增加预付余额。", "用量按模型输入、输出和缓存命中 token 价格计费。", "长期便宜 20-40%", "一个 API 密钥覆盖全部能力", "无供应商锁定", "用量分析与成本控制", "企业级隐私", "所有供应商统一开票"],
    getFreeApiKey: "获取免费 API 密钥",
    enterpriseTeams: "企业团队",
    contactSales: "联系销售，获取更高月用量和更大折扣。",
    selfServeTitle: "自助开始 API 调用",
    selfServeDescription: "无需合同。充值、创建密钥、复制 base_url，即可测试第一条请求。",
    costExamplesTitle: "相当于官方 Plus 套餐 3X 用量",
    costExamples: [
      { label: "面向真实 API 工作负载", value: "比固定 Plus 席位可跑更多任务" },
      { label: "一个余额覆盖主流模型", value: "GPT、Claude、Gemini、DeepSeek、图像和视频" },
      { label: "有效成本低 40%", value: "下次充值前获得更多可用量" },
    ],
    officialPlusProof: {
      medal: "官方 token 消耗验证",
      officialLabel: "官方 Plus",
      officialValue: "固定席位，固定套餐",
      flatkeyLabel: "$20 Flatkey 充值",
      flatkeyValue: "按量 API 余额",
      proof: "$20 能做到 3X 官方 Plus 风格可用工作量，因为每一美元都转成按量 token 余额：没有席位开销、路由单价更低，也没有固定套餐浪费。",
    },
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
    plansEyebrow: "Planes y paquetes de recarga",
    plansTitle: "Empieza a llamar modelos en minutos, sin compras largas",
    plansDescription: "Usa un saldo prepago para varias familias de modelos. Revisa precios en vivo abajo y empieza con una recarga pequeña antes de escalar.",
    websitePackage: "Paquete del sitio",
    prepaidBalanceTitle: "Saldo prepago para modelos de IA líderes",
    startingPackage: "paquete inicial, paga por uso con el saldo que agregues",
    packageBullets: ["El pago exitoso añade saldo prepago.", "El uso se cobra por precios de tokens de entrada, salida y cache-hit del modelo.", "20-40% más barato de forma permanente", "Una clave API para todo", "Sin bloqueo de proveedor", "Analítica de uso y control de costes", "Privacidad de nivel empresarial", "Una factura unificada para todos los proveedores"],
    getFreeApiKey: "Obtener clave API gratis",
    enterpriseTeams: "Equipos empresariales",
    contactSales: "Contacta con ventas para mayor uso mensual y más descuentos.",
    selfServeTitle: "Inicio API autoservicio",
    selfServeDescription: "Sin contrato. Añade saldo, crea una clave, copia base_url y prueba tu primera solicitud.",
    costExamplesTitle: "3X el uso del plan Plus oficial",
    costExamples: [
      { label: "Para cargas API reales", value: "más ejecuciones que un asiento Plus fijo" },
      { label: "Un saldo para modelos líderes", value: "GPT, Claude, Gemini, DeepSeek, imagen y vídeo" },
      { label: "40% menos coste efectivo", value: "más uso antes de la siguiente recarga" },
    ],
    officialPlusProof: {
      medal: "Consumo oficial de tokens verificado",
      officialLabel: "Plus oficial",
      officialValue: "Asiento fijo, paquete fijo",
      flatkeyLabel: "Recarga Flatkey de $20",
      flatkeyValue: "Saldo API medido",
      proof: "$20 alcanzan 3X de carga útil estilo Plus oficial porque cada dólar se convierte en saldo medido de tokens: sin coste de asiento, menor coste unitario enrutado y sin desperdicio de paquete fijo.",
    },
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
    plansEyebrow: "Plans et recharges",
    plansTitle: "Appelez des modèles en quelques minutes, sans cycle d'achat",
    plansDescription: "Utilisez un solde prépayé pour plusieurs familles de modèles. Consultez les prix live ci-dessous, puis démarrez avec une petite recharge.",
    websitePackage: "Forfait du site",
    prepaidBalanceTitle: "Solde prépayé pour les meilleurs modèles IA",
    startingPackage: "forfait de départ, paiement à l'usage avec le solde ajouté",
    packageBullets: ["Un paiement réussi ajoute du solde prépayé.", "L'usage est facturé selon les prix de tokens d'entrée, sortie et cache-hit.", "20-40 % moins cher en continu", "Une clé API pour tout", "Aucun verrouillage fournisseur", "Analyse d'usage et contrôle des coûts", "Confidentialité de niveau entreprise", "Une facture unifiée pour tous les fournisseurs"],
    getFreeApiKey: "Obtenir une clé API gratuite",
    enterpriseTeams: "Équipes entreprise",
    contactSales: "Contactez les ventes pour plus d'usage mensuel et de meilleures remises.",
    selfServeTitle: "Démarrage API en libre-service",
    selfServeDescription: "Pas de contrat. Ajoutez du solde, créez une clé, copiez base_url et testez votre première requête.",
    costExamplesTitle: "3X l'usage du plan Plus officiel",
    costExamples: [
      { label: "Pour de vraies charges API", value: "plus d'exécutions qu'un siège Plus fixe" },
      { label: "Un solde pour les modèles leaders", value: "GPT, Claude, Gemini, DeepSeek, image et vidéo" },
      { label: "40 % de coût effectif en moins", value: "plus d'usage avant la prochaine recharge" },
    ],
    officialPlusProof: {
      medal: "Consommation officielle de tokens vérifiée",
      officialLabel: "Plus officiel",
      officialValue: "Siège fixe, bundle fixe",
      flatkeyLabel: "Recharge Flatkey de 20 $",
      flatkeyValue: "Solde API mesuré",
      proof: "20 $ atteignent 3X de charge utile type Plus officiel, car chaque dollar devient du solde token mesuré : pas de coût de siège, coût unitaire routé plus bas et pas de gaspillage de bundle fixe.",
    },
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
    plansEyebrow: "Planos e pacotes de recarga",
    plansTitle: "Comece a chamar modelos em minutos, sem processo de compra",
    plansDescription: "Use um saldo pré-pago em várias famílias de modelos. Veja preços ao vivo abaixo e comece com uma pequena recarga antes de escalar.",
    websitePackage: "Pacote do site",
    prepaidBalanceTitle: "Saldo pré-pago para os principais modelos de IA",
    startingPackage: "pacote inicial, pague conforme o uso com o saldo adicionado",
    packageBullets: ["O pagamento bem-sucedido adiciona saldo pré-pago.", "O uso é cobrado pelos preços de tokens de entrada, saída e cache-hit do modelo.", "20-40% mais barato permanentemente", "Uma chave API para tudo", "Sem bloqueio de fornecedor", "Análise de uso e controle de custos", "Privacidade de nível empresarial", "Uma fatura unificada para todos os provedores"],
    getFreeApiKey: "Obter chave API grátis",
    enterpriseTeams: "Equipes empresariais",
    contactSales: "Fale com vendas para maior uso mensal e maiores descontos.",
    selfServeTitle: "Início API self-service",
    selfServeDescription: "Sem contrato. Adicione saldo, crie uma chave, copie base_url e teste sua primeira requisição.",
    costExamplesTitle: "3X o uso do plano Plus oficial",
    costExamples: [
      { label: "Para cargas reais de API", value: "mais execuções que um assento Plus fixo" },
      { label: "Um saldo para modelos líderes", value: "GPT, Claude, Gemini, DeepSeek, imagem e vídeo" },
      { label: "40% menos custo efetivo", value: "mais uso antes da próxima recarga" },
    ],
    officialPlusProof: {
      medal: "Consumo oficial de tokens verificado",
      officialLabel: "Plus oficial",
      officialValue: "Assento fixo, pacote fixo",
      flatkeyLabel: "Recarga Flatkey de $20",
      flatkeyValue: "Saldo API medido",
      proof: "$20 chegam a 3X de workload útil no estilo Plus oficial porque cada dólar vira saldo medido de tokens: sem custo de assento, menor custo unitário roteado e sem desperdício de pacote fixo.",
    },
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
    plansEyebrow: "Планы и пополнения",
    plansTitle: "Начните вызывать модели за минуты, без закупочного процесса",
    plansDescription: "Используйте один предоплаченный баланс для разных семейств моделей. Посмотрите live-цены ниже и начните с малого пополнения.",
    websitePackage: "Пакет сайта",
    prepaidBalanceTitle: "Предоплаченный баланс для ведущих AI-моделей",
    startingPackage: "стартовый пакет, оплата по факту с добавленного баланса",
    packageBullets: ["Успешный платеж добавляет предоплаченный баланс.", "Использование списывается по ценам входных, выходных и cache-hit токенов модели.", "Постоянно дешевле на 20-40%", "Один API-ключ для всего", "Без привязки к поставщику", "Аналитика использования и контроль затрат", "Конфиденциальность корпоративного уровня", "Один единый счет для всех провайдеров"],
    getFreeApiKey: "Получить бесплатный API-ключ",
    enterpriseTeams: "Корпоративные команды",
    contactSales: "Свяжитесь с продажами для большего месячного объема и скидок.",
    selfServeTitle: "Самостоятельный старт API",
    selfServeDescription: "Без договора. Добавьте баланс, создайте ключ, скопируйте base_url и протестируйте первый запрос.",
    costExamplesTitle: "3X использования официального Plus-плана",
    costExamples: [
      { label: "Для реальных API-нагрузок", value: "больше запусков, чем фиксированное Plus-место" },
      { label: "Один баланс для топ-моделей", value: "GPT, Claude, Gemini, DeepSeek, image и video" },
      { label: "Эффективная стоимость ниже на 40%", value: "больше использования до следующего пополнения" },
    ],
    officialPlusProof: {
      medal: "Проверено по официальному расходу токенов",
      officialLabel: "Официальный Plus",
      officialValue: "Фиксированное место и пакет",
      flatkeyLabel: "Пополнение Flatkey на $20",
      flatkeyValue: "Измеряемый API-баланс",
      proof: "$20 дают 3X полезной нагрузки в стиле официального Plus, потому что каждый доллар становится измеряемым token-балансом: без стоимости места, с более низкой routed unit cost и без потерь фиксированного пакета.",
    },
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
    plansEyebrow: "プランとチャージパッケージ",
    plansTitle: "調達を待たずに、数分でモデル呼び出しを開始",
    plansDescription: "1 つのプリペイド残高で複数のモデルファミリーを利用できます。下のライブ料金を見て、小額チャージから始められます。",
    websitePackage: "Web サイトパッケージ",
    prepaidBalanceTitle: "主要 AI モデル向けプリペイド残高",
    startingPackage: "開始パッケージ、追加した残高で使った分だけ支払い",
    packageBullets: ["支払い成功後にプリペイド残高が追加されます。", "利用量はモデルの入力、出力、cache-hit token 価格で課金されます。", "常に 20-40% 安価", "すべてに使えるひとつの API キー", "ベンダーロックインなし", "利用分析とコスト管理", "エンタープライズ級プライバシー", "すべてのプロバイダーをひとつの請求書に統合"],
    getFreeApiKey: "無料 API キーを取得",
    enterpriseTeams: "エンタープライズチーム",
    contactSales: "より大きな月間利用量と割引について営業にお問い合わせください。",
    selfServeTitle: "セルフサービス API 開始",
    selfServeDescription: "契約不要。残高追加、キー作成、base_url コピーで最初のリクエストをテストできます。",
    costExamplesTitle: "公式 Plus プランの 3X 利用量",
    costExamples: [
      { label: "実際の API ワークロード向け", value: "固定 Plus 席より多く実行" },
      { label: "主要モデルをひとつの残高で", value: "GPT、Claude、Gemini、DeepSeek、画像、動画" },
      { label: "実効コスト 40% 低減", value: "次のチャージまでより多く使える" },
    ],
    officialPlusProof: {
      medal: "公式 token 消費で検証済み",
      officialLabel: "公式 Plus",
      officialValue: "固定席、固定バンドル",
      flatkeyLabel: "$20 Flatkey チャージ",
      flatkeyValue: "従量制 API 残高",
      proof: "$20 で公式 Plus 風の利用可能ワークロード 3X に届くのは、すべての支払いが従量制 token 残高になるためです。席料なし、低いルーティング単価、固定バンドルの無駄なし。",
    },
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
    plansEyebrow: "Gói và nạp tiền",
    plansTitle: "Bắt đầu gọi mô hình trong vài phút, không cần mua sắm phức tạp",
    plansDescription: "Dùng một số dư trả trước cho nhiều họ mô hình. Xem giá trực tiếp bên dưới, rồi bắt đầu bằng khoản nạp nhỏ trước khi mở rộng.",
    websitePackage: "Gói website",
    prepaidBalanceTitle: "Số dư trả trước cho các mô hình AI hàng đầu",
    startingPackage: "gói khởi đầu, trả theo mức dùng bằng số dư bạn nạp",
    packageBullets: ["Thanh toán thành công sẽ cộng số dư trả trước.", "Mức dùng được tính theo giá token đầu vào, đầu ra và cache-hit của mô hình.", "Luôn rẻ hơn 20-40%", "Một khóa API cho mọi thứ", "Không khóa nhà cung cấp", "Phân tích sử dụng và kiểm soát chi phí", "Quyền riêng tư cấp doanh nghiệp", "Một hóa đơn thống nhất cho mọi nhà cung cấp"],
    getFreeApiKey: "Nhận khóa API miễn phí",
    enterpriseTeams: "Đội ngũ doanh nghiệp",
    contactSales: "Liên hệ kinh doanh để có mức dùng hằng tháng cao hơn và chiết khấu lớn hơn.",
    selfServeTitle: "Bắt đầu API tự phục vụ",
    selfServeDescription: "Không cần hợp đồng. Thêm số dư, tạo khóa, sao chép base_url và thử request đầu tiên.",
    costExamplesTitle: "3X mức dùng của gói Plus chính thức",
    costExamples: [
      { label: "Cho workload API thật", value: "nhiều lượt chạy hơn một ghế Plus cố định" },
      { label: "Một số dư cho các mô hình hàng đầu", value: "GPT, Claude, Gemini, DeepSeek, hình ảnh và video" },
      { label: "Chi phí hiệu dụng thấp hơn 40%", value: "dùng nhiều hơn trước lần nạp tiếp theo" },
    ],
    officialPlusProof: {
      medal: "Đã xác minh bằng mức tiêu thụ token chính thức",
      officialLabel: "Plus chính thức",
      officialValue: "Ghế cố định, gói cố định",
      flatkeyLabel: "Nạp Flatkey $20",
      flatkeyValue: "Số dư API tính theo mức dùng",
      proof: "$20 đạt 3X workload dùng được kiểu Plus chính thức vì mỗi đô la trở thành số dư token tính theo mức dùng: không phí ghế, đơn giá định tuyến thấp hơn và không lãng phí gói cố định.",
    },
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
    plansEyebrow: "Pläne und Aufladepakete",
    plansTitle: "Modelle in Minuten aufrufen, ohne Beschaffungsprozess",
    plansDescription: "Nutze ein Prepaid-Guthaben für mehrere Modellfamilien. Prüfe Live-Preise unten und starte mit einer kleinen Aufladung.",
    websitePackage: "Website-Paket",
    prepaidBalanceTitle: "Prepaid-Guthaben für führende AI-Modelle",
    startingPackage: "Startpaket, zahle nach Verbrauch mit dem aufgeladenen Guthaben",
    packageBullets: ["Eine erfolgreiche Zahlung erhöht das Prepaid-Guthaben.", "Die Nutzung wird nach den Token-Preisen des Modells für Eingabe, Ausgabe und Cache-Hit abgerechnet.", "Dauerhaft 20-40% günstiger", "Ein API-Schlüssel für alles", "Keine Anbieterbindung", "Nutzungsanalysen und Kostenkontrolle", "Datenschutz auf Enterprise-Niveau", "Eine einheitliche Rechnung für alle Anbieter"],
    getFreeApiKey: "Kostenlosen API-Schlüssel erhalten",
    enterpriseTeams: "Enterprise-Teams",
    contactSales: "Kontaktiere den Vertrieb für höhere monatliche Nutzung und größere Rabatte.",
    selfServeTitle: "Self-Service API-Start",
    selfServeDescription: "Kein Vertrag nötig. Guthaben hinzufügen, Schlüssel erstellen, base_url kopieren und erste Anfrage testen.",
    costExamplesTitle: "3X Nutzung des offiziellen Plus-Plans",
    costExamples: [
      { label: "Für echte API-Workloads", value: "mehr Läufe als ein fester Plus-Sitz" },
      { label: "Ein Guthaben für Top-Modelle", value: "GPT, Claude, Gemini, DeepSeek, Bild und Video" },
      { label: "40% geringere effektive Kosten", value: "mehr Nutzung vor der nächsten Aufladung" },
    ],
    officialPlusProof: {
      medal: "Offizieller Token-Verbrauch verifiziert",
      officialLabel: "Offizieller Plus",
      officialValue: "Fester Sitz, festes Paket",
      flatkeyLabel: "$20 Flatkey-Aufladung",
      flatkeyValue: "Gemessenes API-Guthaben",
      proof: "$20 erreichen 3X nutzbare Workload im Stil des offiziellen Plus-Plans, weil jeder Dollar zu gemessenem Token-Guthaben wird: keine Sitzkosten, geringere geroutete Stückkosten und keine Verschwendung durch feste Pakete.",
    },
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
    pricingHeroTitle: "Simple pricing for one AI API gateway",
    pricingHeroDescription: "Start with prepaid balance, route across top models, and scale usage without buying fixed monthly bundles.",
    modelsEyebrow: "Models",
    modelsDescription: "Discover live model availability, pricing, endpoint support, and model detail pages.",
    topUpPlanName: "Top up {{price}}",
    lowestEntryCaption: "Lowest entry to get started",
    threeXCaption: "3X more usage than the official plan",
    fortyXCaption: "40X more usage than the official plan",
    customPlanCaption: "Custom usage, routing, and invoicing",
    bestFirstTopUpDescription: "Best first top-up for trying real API workloads with a clear discount.",
    bestValueDescription: "Best value for production testing, team workflows, and sustained model traffic.",
    popularBadge: "Most Popular",
    discount40: "40% OFF",
    discount50: "50% OFF",
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
    pricingHeroTitle: "一个 AI API 网关的清晰定价",
    pricingHeroDescription: "从预付余额开始，路由到主流模型，按需扩展用量，不必购买固定月度套餐。",
    modelsEyebrow: "模型",
    modelsDescription: "查看实时模型可用性、价格、端点支持和模型详情页。",
    topUpPlanName: "充值 {{price}}",
    lowestEntryCaption: "最低门槛，快速开始",
    threeXCaption: "比官方套餐多 3X 用量",
    fortyXCaption: "比官方套餐多 40X 用量",
    customPlanCaption: "定制用量、路由和发票",
    bestFirstTopUpDescription: "适合首次尝试真实 API 工作负载，并享受明确折扣。",
    bestValueDescription: "适合生产测试、团队流程和持续模型流量的高性价比选择。",
    popularBadge: "最受欢迎",
    discount40: "立减 40%",
    discount50: "立减 50%",
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
    pricingHeroTitle: "Precios simples para una gateway API de IA",
    pricingHeroDescription: "Empieza con saldo prepago, enruta entre modelos líderes y escala sin comprar paquetes mensuales fijos.",
    modelsEyebrow: "Modelos",
    modelsDescription: "Consulta disponibilidad en vivo, precios, soporte de endpoints y páginas de detalle de modelos.",
    topUpPlanName: "Recargar {{price}}",
    lowestEntryCaption: "Entrada mínima para empezar",
    threeXCaption: "3X más uso que el plan oficial",
    fortyXCaption: "40X más uso que el plan oficial",
    customPlanCaption: "Uso, routing y facturación a medida",
    bestFirstTopUpDescription: "La mejor primera recarga para probar workloads API reales con un descuento claro.",
    bestValueDescription: "Mejor valor para pruebas de producción, flujos de equipo y tráfico sostenido de modelos.",
    popularBadge: "Más popular",
    discount40: "40% de descuento",
    discount50: "50% de descuento",
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
    pricingHeroTitle: "Des tarifs simples pour une gateway API IA",
    pricingHeroDescription: "Démarrez avec un solde prépayé, routez vers les meilleurs modèles et montez en charge sans bundle mensuel fixe.",
    modelsEyebrow: "Modèles",
    modelsDescription: "Découvrez la disponibilité live, les tarifs, le support des endpoints et les pages détaillées des modèles.",
    topUpPlanName: "Recharger {{price}}",
    lowestEntryCaption: "Point d'entrée le plus bas",
    threeXCaption: "3X plus d'usage que le plan officiel",
    fortyXCaption: "40X plus d'usage que le plan officiel",
    customPlanCaption: "Usage, routage et facturation sur mesure",
    bestFirstTopUpDescription: "Meilleure première recharge pour tester de vraies charges API avec une remise claire.",
    bestValueDescription: "Meilleur rapport valeur pour tests de production, workflows d'équipe et trafic modèle continu.",
    popularBadge: "Le plus populaire",
    discount40: "40 % de remise",
    discount50: "50 % de remise",
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
    pricingHeroTitle: "Preços simples para um gateway API de IA",
    pricingHeroDescription: "Comece com saldo pré-pago, roteie entre modelos líderes e escale o uso sem comprar pacotes mensais fixos.",
    modelsEyebrow: "Modelos",
    modelsDescription: "Veja disponibilidade ao vivo, preços, suporte a endpoints e páginas de detalhes dos modelos.",
    topUpPlanName: "Recarregar {{price}}",
    lowestEntryCaption: "Menor entrada para começar",
    threeXCaption: "3X mais uso que o plano oficial",
    fortyXCaption: "40X mais uso que o plano oficial",
    customPlanCaption: "Uso, roteamento e faturamento sob medida",
    bestFirstTopUpDescription: "Melhor primeira recarga para testar workloads reais de API com desconto claro.",
    bestValueDescription: "Melhor valor para testes em produção, fluxos de equipe e tráfego contínuo de modelos.",
    popularBadge: "Mais popular",
    discount40: "40% de desconto",
    discount50: "50% de desconto",
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
    pricingHeroTitle: "Простые цены для одного AI API gateway",
    pricingHeroDescription: "Начните с предоплаченного баланса, маршрутизируйте запросы к топ-моделям и масштабируйте использование без фиксированных месячных пакетов.",
    modelsEyebrow: "Модели",
    modelsDescription: "Смотрите live-доступность моделей, цены, поддержку endpoints и страницы деталей моделей.",
    topUpPlanName: "Пополнить на {{price}}",
    lowestEntryCaption: "Минимальный вход для старта",
    threeXCaption: "В 3X больше использования, чем официальный план",
    fortyXCaption: "В 40X больше использования, чем официальный план",
    customPlanCaption: "Индивидуальное использование, маршрутизация и счета",
    bestFirstTopUpDescription: "Лучшее первое пополнение для проверки реальных API-нагрузок с понятной скидкой.",
    bestValueDescription: "Лучшее соотношение цены для production-тестов, командных процессов и стабильного model traffic.",
    popularBadge: "Самый популярный",
    discount40: "Скидка 40%",
    discount50: "Скидка 50%",
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
    pricingHeroTitle: "1つの AI API ゲートウェイのシンプルな料金",
    pricingHeroDescription: "プリペイド残高から始め、主要モデルへルーティングし、固定月額バンドルなしで利用量を拡張できます。",
    modelsEyebrow: "モデル",
    modelsDescription: "ライブのモデル可用性、料金、エンドポイント対応、モデル詳細ページを確認できます。",
    topUpPlanName: "{{price}} をチャージ",
    lowestEntryCaption: "最小の開始パッケージ",
    threeXCaption: "公式プラン比 3X の利用量",
    fortyXCaption: "公式プラン比 40X の利用量",
    customPlanCaption: "利用量、ルーティング、請求をカスタム",
    bestFirstTopUpDescription: "実際の API ワークロードを明確な割引で試す最初のチャージに最適です。",
    bestValueDescription: "本番テスト、チームワークフロー、継続的なモデル利用に最適な価値です。",
    popularBadge: "人気",
    discount40: "40% 割引",
    discount50: "50% 割引",
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
    pricingHeroTitle: "Bảng giá đơn giản cho một gateway API AI",
    pricingHeroDescription: "Bắt đầu bằng số dư trả trước, route qua các mô hình hàng đầu và mở rộng usage mà không cần gói tháng cố định.",
    modelsEyebrow: "Mô hình",
    modelsDescription: "Xem availability trực tiếp, giá, hỗ trợ endpoint và trang chi tiết mô hình.",
    topUpPlanName: "Nạp {{price}}",
    lowestEntryCaption: "Mức thấp nhất để bắt đầu",
    threeXCaption: "Usage nhiều hơn 3X so với gói chính thức",
    fortyXCaption: "Usage nhiều hơn 40X so với gói chính thức",
    customPlanCaption: "Usage, routing và invoice tùy chỉnh",
    bestFirstTopUpDescription: "Khoản nạp đầu tiên tốt nhất để thử workload API thật với mức giảm giá rõ ràng.",
    bestValueDescription: "Giá trị tốt nhất cho thử nghiệm production, workflow nhóm và traffic mô hình ổn định.",
    popularBadge: "Phổ biến nhất",
    discount40: "Giảm 40%",
    discount50: "Giảm 50%",
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
    pricingHeroTitle: "Einfache Preise für ein AI-API-Gateway",
    pricingHeroDescription: "Starte mit Prepaid-Guthaben, route über Top-Modelle und skaliere Nutzung ohne feste Monatsbundles.",
    modelsEyebrow: "Modelle",
    modelsDescription: "Entdecke Live-Verfügbarkeit, Preise, Endpoint-Support und Modell-Detailseiten.",
    topUpPlanName: "{{price}} aufladen",
    lowestEntryCaption: "Niedrigster Einstieg zum Start",
    threeXCaption: "3X mehr Nutzung als der offizielle Plan",
    fortyXCaption: "40X mehr Nutzung als der offizielle Plan",
    customPlanCaption: "Individuelle Nutzung, Routing und Rechnungen",
    bestFirstTopUpDescription: "Beste erste Aufladung zum Testen echter API-Workloads mit klarem Rabatt.",
    bestValueDescription: "Bester Wert für Produktionstests, Team-Workflows und dauerhaften Modell-Traffic.",
    popularBadge: "Am beliebtesten",
    discount40: "40% Rabatt",
    discount50: "50% Rabatt",
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
    { question: "How does the $20 plan reach 3X official Plus-style usage?", answer: "Flatkey turns the top-up into metered API balance. You avoid seat overhead, route through lower unit costs, and do not waste unused fixed-bundle capacity." },
    { question: "Is this a monthly subscription?", answer: "No. The self-serve plans are prepaid top-ups. Balance is consumed only when API requests use models." },
    { question: "Which models can use the same balance?", answer: "One balance can route across GPT, Claude, Gemini, DeepSeek, image, audio, and video models through one OpenAI-compatible gateway." },
    { question: "Can I see how the balance is consumed?", answer: "Yes. Usage is metered by model, token type, and request logs so teams can review spend and control cost." },
    { question: "When should I choose Enterprise?", answer: "Choose Enterprise for larger monthly usage, invoicing, procurement, custom routing discounts, or team-level controls." },
  ],
  zh: [
    { question: "$20 套餐为什么能做到 3X 官方 Plus 风格用量？", answer: "Flatkey 把充值转成按量 API 余额。没有席位开销，路由单价更低，也不会浪费固定套餐里用不完的容量。" },
    { question: "这是月订阅吗？", answer: "不是。自助套餐是预付充值，只有发起模型 API 请求时才消耗余额。" },
    { question: "同一个余额可以调用哪些模型？", answer: "一个余额可通过 OpenAI 兼容网关调用 GPT、Claude、Gemini、DeepSeek、图像、音频和视频模型。" },
    { question: "能看到余额怎么消耗吗？", answer: "可以。系统按模型、token 类型和请求日志计量，团队可以复盘支出并控制成本。" },
    { question: "什么时候选 Enterprise？", answer: "月用量更大、需要发票/采购流程、定制路由折扣或团队级管控时，选择 Enterprise。" },
  ],
  es: [
    { question: "¿Cómo logra el plan de $20 un uso 3X tipo Plus oficial?", answer: "Flatkey convierte la recarga en saldo API medido. Evitas coste de asiento, usas menor coste unitario y no desperdicias capacidad de un paquete fijo." },
    { question: "¿Es una suscripción mensual?", answer: "No. Los planes self-service son recargas prepago. El saldo solo se consume cuando las solicitudes API usan modelos." },
    { question: "¿Qué modelos usan el mismo saldo?", answer: "Un saldo puede enrutar GPT, Claude, Gemini, DeepSeek, imagen, audio y vídeo desde una gateway compatible con OpenAI." },
    { question: "¿Puedo ver cómo se consume el saldo?", answer: "Sí. El uso se mide por modelo, tipo de token y logs de solicitudes para revisar gasto y controlar costes." },
    { question: "¿Cuándo conviene Enterprise?", answer: "Elige Enterprise para mayor uso mensual, facturación, compras, descuentos de routing personalizados o controles de equipo." },
  ],
  fr: [
    { question: "Comment le plan à 20 $ atteint-il 3X l'usage type Plus officiel ?", answer: "Flatkey transforme la recharge en solde API mesuré. Vous évitez le coût de siège, profitez d'un coût unitaire plus bas et ne gaspillez pas un bundle fixe." },
    { question: "Est-ce un abonnement mensuel ?", answer: "Non. Les plans self-service sont des recharges prépayées. Le solde est consommé seulement quand les requêtes API utilisent des modèles." },
    { question: "Quels modèles utilisent le même solde ?", answer: "Un seul solde peut router GPT, Claude, Gemini, DeepSeek, image, audio et vidéo via une gateway compatible OpenAI." },
    { question: "Puis-je voir comment le solde est consommé ?", answer: "Oui. L'usage est mesuré par modèle, type de token et logs de requêtes pour suivre la dépense et contrôler les coûts." },
    { question: "Quand choisir Enterprise ?", answer: "Choisissez Enterprise pour un usage mensuel élevé, facturation, achats, remises de routage personnalisées ou contrôles d'équipe." },
  ],
  pt: [
    { question: "Como o plano de $20 chega a 3X do uso estilo Plus oficial?", answer: "A Flatkey transforma a recarga em saldo API medido. Você evita custo de assento, usa custo unitário menor e não desperdiça capacidade de pacote fixo." },
    { question: "Isso é uma assinatura mensal?", answer: "Não. Os planos self-service são recargas pré-pagas. O saldo só é consumido quando chamadas de API usam modelos." },
    { question: "Quais modelos usam o mesmo saldo?", answer: "Um saldo pode rotear GPT, Claude, Gemini, DeepSeek, imagem, áudio e vídeo por um gateway compatível com OpenAI." },
    { question: "Posso ver como o saldo é consumido?", answer: "Sim. O uso é medido por modelo, tipo de token e logs de requisição para revisar gastos e controlar custos." },
    { question: "Quando escolher Enterprise?", answer: "Escolha Enterprise para maior uso mensal, faturamento, compras, descontos personalizados de roteamento ou controles de equipe." },
  ],
  ru: [
    { question: "Как план за $20 дает 3X использования в стиле официального Plus?", answer: "Flatkey превращает пополнение в измеряемый API-баланс. Нет стоимости места, ниже unit cost маршрутизации и нет потерь фиксированного пакета." },
    { question: "Это месячная подписка?", answer: "Нет. Self-serve планы работают как prepaid top-up. Баланс расходуется только при API-запросах к моделям." },
    { question: "Какие модели используют один баланс?", answer: "Один баланс может маршрутизировать GPT, Claude, Gemini, DeepSeek, image, audio и video через OpenAI-compatible gateway." },
    { question: "Можно увидеть, как расходуется баланс?", answer: "Да. Использование измеряется по модели, типу токена и логам запросов, чтобы команда видела расходы и контролировала стоимость." },
    { question: "Когда выбирать Enterprise?", answer: "Enterprise подходит для большого месячного объема, invoice/procurement, кастомных routing discounts и командных контролей." },
  ],
  ja: [
    { question: "$20 プランはどうやって公式 Plus 風の 3X 利用量になりますか？", answer: "Flatkey はチャージを従量制 API 残高に変換します。席料がなく、ルーティング単価が低く、固定バンドルの未使用分も無駄になりません。" },
    { question: "月額サブスクリプションですか？", answer: "いいえ。セルフサービスプランはプリペイドチャージです。モデル API リクエストを使った分だけ残高を消費します。" },
    { question: "同じ残高でどのモデルを使えますか？", answer: "1 つの残高で GPT、Claude、Gemini、DeepSeek、画像、音声、動画モデルを OpenAI 互換 gateway 経由で利用できます。" },
    { question: "残高の消費内訳は見えますか？", answer: "はい。モデル、token 種別、リクエストログ別に計量され、支出の確認とコスト管理ができます。" },
    { question: "Enterprise はいつ選ぶべきですか？", answer: "月間利用量が大きい場合、請求書・購買対応、カスタム routing 割引、チーム管理が必要な場合に適しています。" },
  ],
  vi: [
    { question: "Gói $20 đạt 3X mức dùng kiểu Plus chính thức bằng cách nào?", answer: "Flatkey biến khoản nạp thành số dư API tính theo mức dùng. Không có phí ghế, đơn giá định tuyến thấp hơn và không lãng phí dung lượng gói cố định." },
    { question: "Đây có phải thuê bao hằng tháng không?", answer: "Không. Các gói self-serve là nạp trả trước. Số dư chỉ bị trừ khi request API dùng mô hình." },
    { question: "Những mô hình nào dùng chung một số dư?", answer: "Một số dư có thể route GPT, Claude, Gemini, DeepSeek, hình ảnh, âm thanh và video qua gateway tương thích OpenAI." },
    { question: "Có xem được số dư tiêu thụ thế nào không?", answer: "Có. Usage được đo theo mô hình, loại token và log request để đội ngũ xem chi phí và kiểm soát ngân sách." },
    { question: "Khi nào nên chọn Enterprise?", answer: "Chọn Enterprise khi có mức dùng tháng lớn, cần invoice/procurement, chiết khấu routing riêng hoặc kiểm soát cấp đội ngũ." },
  ],
  de: [
    { question: "Wie erreicht der $20-Plan 3X Nutzung im Stil des offiziellen Plus-Plans?", answer: "Flatkey wandelt die Aufladung in gemessenes API-Guthaben um. Keine Sitzkosten, geringere Routing-Stückkosten und keine Verschwendung durch ein festes Paket." },
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
      caption: copy.lowestEntryCaption,
      description: copy.selfServeDescription,
      cta: copy.getFreeApiKey,
      featured: false,
      ...checkoutPlanFields(currency, 0),
      features: [copy.trustSignals[0], copy.packageBullets[3], copy.packageBullets[4], copy.packageBullets[5]],
    },
    {
      name: topUpPlanName(currency, 1, copy),
      price: formatTopUpPrice(currency, 1),
      caption: copy.threeXCaption,
      description: copy.bestFirstTopUpDescription,
      cta: copy.getFreeApiKey,
      badge: copy.popularBadge,
      discount: copy.discount40,
      featured: true,
      ...checkoutPlanFields(currency, 1),
      features: [copy.packageBullets[2], copy.trustSignals[1], copy.trustSignals[2], copy.trustSignals[3]],
    },
    {
      name: topUpPlanName(currency, 2, copy),
      price: formatTopUpPrice(currency, 2),
      caption: copy.fortyXCaption,
      description: copy.bestValueDescription,
      cta: copy.getFreeApiKey,
      discount: copy.discount50,
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

          <section className="mt-8 overflow-hidden rounded-2xl border border-violet-500/14 bg-white/72 p-5 shadow-[0_24px_80px_-58px_rgba(91,33,182,0.68)] dark:border-white/10 dark:bg-white/[0.055] dark:shadow-[0_24px_80px_-58px_rgba(124,58,237,0.95)] sm:p-6">
            <div className="grid gap-5 lg:grid-cols-[0.92fr_1.08fr] lg:items-stretch">
              <figure className="relative overflow-hidden rounded-2xl border border-violet-500/16 bg-slate-950 text-white shadow-[0_24px_80px_-54px_rgba(91,33,182,0.95)]">
                <div className="relative min-h-[360px]">
                  <Image
                    src="/lp/openai-10b-token-plaque.jpg"
                    alt={copy.officialPlusProof.medal}
                    fill
                    sizes="(min-width: 1024px) 520px, 100vw"
                    className="object-cover"
                    priority={false}
                  />
                  <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.16)_0%,rgba(15,23,42,0.22)_42%,rgba(15,23,42,0.88)_100%)]" />
                  <div className="absolute top-4 left-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/35 px-3 py-1 text-[11px] font-bold tracking-wide text-white uppercase backdrop-blur-md">
                    <CheckCircle2 className="size-3.5" />
                    {copy.officialPlusProof.medal}
                  </div>
                  <figcaption className="absolute inset-x-0 bottom-0 p-5">
                    <div className="flex items-end gap-4">
                      <div className="flex size-20 shrink-0 items-center justify-center rounded-full border border-white/24 bg-white/14 text-3xl font-black shadow-inner shadow-white/12 backdrop-blur-md">
                      3X
                      </div>
                      <div>
                        <h2 className="text-2xl leading-tight font-black tracking-tight">{copy.costExamplesTitle}</h2>
                        <p className="mt-2 text-sm leading-6 text-white/84">{copy.officialPlusProof.proof}</p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-white/14 bg-black/28 p-3 backdrop-blur-md">
                        <p className="text-xs font-bold text-white/65 uppercase">{copy.officialPlusProof.officialLabel}</p>
                        <p className="mt-1 text-sm font-bold text-white">{copy.officialPlusProof.officialValue}</p>
                      </div>
                      <div className="rounded-xl border border-white/18 bg-white/14 p-3 backdrop-blur-md">
                        <p className="text-xs font-bold text-white/65 uppercase">{copy.officialPlusProof.flatkeyLabel}</p>
                        <p className="mt-1 text-sm font-bold text-white">{copy.officialPlusProof.flatkeyValue}</p>
                      </div>
                    </div>
                  </figcaption>
                </div>
              </figure>
              <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-1">
                {copy.costExamples.map((item, index) => {
                  const Icon = [Gauge, Wallet, DollarSign][index] ?? CheckCircle2;
                  return (
                    <div key={item.label} className="flex gap-3 rounded-xl border border-emerald-500/14 bg-emerald-500/[0.055] p-4 dark:border-emerald-300/15 dark:bg-emerald-300/[0.07]">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:bg-emerald-300/10 dark:text-emerald-200">
                        <Icon className="size-4" />
                      </span>
                      <span>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{item.label}</p>
                        <p className="mt-1 text-sm leading-5 text-emerald-700 dark:text-emerald-200">{item.value}</p>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

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
            <h3 className="mt-2 text-lg font-bold tracking-tight">{copy.costExamplesTitle}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{copy.selfServeDescription}</p>
            <div className="mt-4 grid gap-2">
              {copy.costExamples.map((item) => (
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
