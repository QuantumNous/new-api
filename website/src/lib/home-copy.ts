import type { Locale } from "./locales";

// Copy for the redesigned homepage (2026-07 ops doc): hero price story,
// live health section, value blocks, and the all-models table.
export type HomeCopy = {
  hero: {
    badge: string;
    titleLine1: string;
    titleLine2: string;
    description: string;
    ctaTrial: string;
    ctaModels: string;
  };
  stats: { value: string; label: string }[];
  compare: {
    title: string;
    subtitle: string;
    badge: string;
    layers: string[];
    official: string;
    flatkey: string;
    inputLabel: string;
    save: string;
  };
  health: {
    eyebrow: string;
    title: string;
    description: string;
    uptimeLabel: string;
    latencyLabel: string;
    callsLabel: string;
    trendLabel: string;
    empty: string;
    viewAll: string;
  };
  usage: {
    title: string;
    subtitle: string;
    tokensLabel: string;
  };
  values: {
    eyebrow: string;
    title: string;
    reliability: { title: string; desc: string; points: string[] };
    cost: { title: string; desc: string; points: string[] };
    privacy: { title: string; desc: string; points: string[] };
    learnMore: string;
  };
  table: {
    eyebrow: string;
    title: string;
    description: string;
    colModel: string;
    colOfficial: string;
    colFlatkey: string;
    colLatency: string;
    colHealth: string;
    perMillion: string;
    viewAll: string;
  };
};

const HOME_COPY: Record<Locale, HomeCopy> = {
  en: {
    hero: {
      badge: "Official models · Stable and secure",
      titleLine1: "Official GPT, Claude and Gemini models.",
      titleLine2: "As low as 50% off.",
      description:
        "flatkey.ai routes your traffic to the official GPT, Claude, and Gemini APIs through one key. Model prices run 60-90% of official list, and topping up $200 gets $100 free — stacked, as low as half the official price, stable and secure.",
      ctaTrial: "Start free trial",
      ctaModels: "View model health",
    },
    stats: [
      { value: "46B", label: "tokens served monthly" },
      { value: "4K+", label: "paying users" },
      { value: "45", label: "models behind one key" },
      { value: "100+", label: "enterprises in production" },
    ],
    compare: {
      title: "Two discounts, stacked",
      subtitle: "Input price per 1M tokens",
      badge: "As low as -50%",
      layers: ["Model prices: 60-90% of official list", "Top up $200, get $100 free — you pay 2/3"],
      official: "Official",
      flatkey: "After bonus",
      inputLabel: "Input / 1M tokens",
      save: "Both discounts stack — as low as 50% of the official price",
    },
    health: {
      eyebrow: "Live model health",
      title: "30-day health, measured on real traffic",
      description:
        "Every number below comes from real production calls routed through flatkey.ai — success rate, latency, and volume over the last 30 days. No synthetic benchmarks.",
      uptimeLabel: "30-day success rate",
      latencyLabel: "Average latency",
      callsLabel: "30-day calls",
      trendLabel: "Success rate, last 30 days",
      empty: "Collecting data…",
      viewAll: "See all model health",
    },
    usage: {
      title: "Top models",
      subtitle: "Daily token usage by model across the past month",
      tokensLabel: "tokens",
    },
    values: {
      eyebrow: "Why teams pick flatkey.ai",
      title: "Reliable, cheaper, and private by design",
      reliability: {
        title: "Stable and reliable",
        desc: "100+ enterprises and 4K+ paying users run on flatkey.ai every day.",
        points: [
          "99.9% average success rate over the last 30 days",
          "Automatic failover across multiple upstream providers",
          "Live health dashboards for every model",
        ],
      },
      cost: {
        title: "Cut your model spend",
        desc: "Model prices at 60-90% of official, and the top-up bonus takes another third off — as low as 50% of official. One key for 40+ models so every task runs on the right-cost model.",
        points: [
          "60-90% of official pricing, stacked with the top-up bonus — as low as 50% off",
          "40+ models integrated behind one key",
          "Route cheap tasks to cheap models, hard tasks to frontier models",
        ],
      },
      privacy: {
        title: "Privacy guaranteed",
        desc: "Our servers and storage follow GDPR, SOC 2, and ISO 27001 practices. We do not store your prompts or completions.",
        points: [
          "GDPR compliant infrastructure",
          "SOC 2 and ISO 27001 aligned controls",
          "Zero retention of your request content",
        ],
      },
      learnMore: "Learn more",
    },
    table: {
      eyebrow: "All models",
      title: "45 models, one key — prices, latency, and health",
      description: "The 10 busiest models: after-bonus price vs official, TTFT latency, and 30-day health. The full directory lives on the models page.",
      colModel: "Model",
      colOfficial: "Official",
      colFlatkey: "After bonus",
      colLatency: "Latency",
      colHealth: "30-day health",
      perMillion: "$ / 1M input tokens",
      viewAll: "Browse the full model directory",
    },
  },
  zh: {
    hero: {
      badge: "官方模型 · 稳定安全",
      titleLine1: "GPT、Claude、Gemini 官方模型",
      titleLine2: "最低 5 折",
      description:
        "flatkey.ai 用一个 key 把你的请求路由到 GPT、Claude、Gemini 官方 API——模型定价为官方 6～9 折，充值 $200 再送 $100，两层优惠叠加最低 5 折，稳定安全。",
      ctaTrial: "免费试用",
      ctaModels: "查看模型健康度",
    },
    stats: [
      { value: "46B", label: "每月处理 Token" },
      { value: "4K+", label: "付费用户" },
      { value: "45", label: "个模型一个 key" },
      { value: "100+", label: "企业生产环境在用" },
    ],
    compare: {
      title: "双重优惠",
      subtitle: "每 1M token 输入价",
      badge: "低至 5 折",
      layers: ["模型定价：官方 6～9 折", "充值 $200 送 $100：实付 2/3"],
      official: "官方价",
      flatkey: "充值后",
      inputLabel: "输入 / 1M tokens",
      save: "两层优惠叠加，最低为官方价 5 折",
    },
    health: {
      eyebrow: "实时模型健康度",
      title: "最近 30 天健康度，来自真实调用",
      description:
        "以下所有数字都来自 flatkey.ai 真实生产流量——最近 30 天的成功率、延迟与调用量，不是合成测试。",
      uptimeLabel: "30 天成功率",
      latencyLabel: "平均延迟",
      callsLabel: "30 天调用量",
      trendLabel: "成功率（最近 30 天）",
      empty: "数据采集中…",
      viewAll: "查看全部模型健康度",
    },
    usage: {
      title: "Top 模型",
      subtitle: "最近一个月每日各模型 token 用量",
      tokensLabel: "tokens",
    },
    values: {
      eyebrow: "为什么选择 flatkey.ai",
      title: "稳定可靠、更低成本、隐私保证",
      reliability: {
        title: "稳定可靠",
        desc: "100+ 企业与 4K+ 付费用户每天在 flatkey.ai 上运行生产业务。",
        points: [
          "最近 30 天平均成功率 99.9%",
          "多上游供应方自动路由切换",
          "每个模型都有实时健康度看板",
        ],
      },
      cost: {
        title: "降低成本",
        desc: "模型价为官方 6～9 折，充值赠送再省 1/3，叠加最低 5 折；一个 key 集成 40+ 模型，不同任务用不同成本的模型。",
        points: [
          "官方 6～9 折 × 充值赠送，最低 5 折",
          "一个 key 集成 40+ 模型",
          "轻任务用低价模型，难任务用旗舰模型",
        ],
      },
      privacy: {
        title: "隐私保证",
        desc: "服务器与存储符合 GDPR、SOC 2、ISO 27001 隐私规范，不存储你的请求内容。",
        points: [
          "基础设施符合 GDPR",
          "对齐 SOC 2 与 ISO 27001 控制项",
          "请求内容零留存",
        ],
      },
      learnMore: "了解更多",
    },
    table: {
      eyebrow: "全部模型",
      title: "45 个模型一个 key——价格、延迟、健康度",
      description: "最热门的 10 个模型：充值后价格 vs 官方价、首字延迟与 30 天健康度。完整列表见模型页。",
      colModel: "模型",
      colOfficial: "官方价",
      colFlatkey: "充值后",
      colLatency: "延迟",
      colHealth: "30 天健康度",
      perMillion: "$ / 1M 输入 tokens",
      viewAll: "浏览完整模型目录",
    },
  },
  es: {
    hero: {
      badge: "Modelos oficiales · Estable y seguro",
      titleLine1: "Modelos oficiales de GPT, Claude y Gemini.",
      titleLine2: "Hasta 50% de descuento.",
      description:
        "flatkey.ai enruta tu tráfico a las API oficiales de GPT, Claude y Gemini con una sola key. Los precios de modelo son el 60-90% del oficial y al recargar $200 recibes $100 gratis: combinados, hasta la mitad del precio oficial, estable y seguro.",
      ctaTrial: "Prueba gratis",
      ctaModels: "Ver salud de los modelos",
    },
    stats: [
      { value: "46B", label: "tokens servidos al mes" },
      { value: "4K+", label: "usuarios de pago" },
      { value: "45", label: "modelos con una key" },
      { value: "100+", label: "empresas en producción" },
    ],
    compare: {
      title: "Dos descuentos combinados",
      subtitle: "Precio de entrada por 1M de tokens",
      badge: "Hasta -50%",
      layers: ["Precio de modelo: 60-90% del oficial", "Recarga $200 y recibe $100 gratis: pagas 2/3"],
      official: "Oficial",
      flatkey: "Con bono",
      inputLabel: "Entrada / 1M tokens",
      save: "Los dos descuentos se combinan: hasta el 50% del precio oficial",
    },
    health: {
      eyebrow: "Salud de modelos en vivo",
      title: "Salud de 30 días, medida con tráfico real",
      description:
        "Cada número proviene de llamadas de producción reales enrutadas por flatkey.ai: tasa de éxito, latencia y volumen de los últimos 30 días. Sin benchmarks sintéticos.",
      uptimeLabel: "Tasa de éxito (30 días)",
      latencyLabel: "Latencia media",
      callsLabel: "Llamadas en 30 días",
      trendLabel: "Tasa de éxito, últimos 30 días",
      empty: "Recopilando datos…",
      viewAll: "Ver la salud de todos los modelos",
    },
    usage: {
      title: "Modelos top",
      subtitle: "Uso diario de tokens por modelo en el último mes",
      tokensLabel: "tokens",
    },
    values: {
      eyebrow: "Por qué eligen flatkey.ai",
      title: "Fiable, más barato y privado por diseño",
      reliability: {
        title: "Estable y fiable",
        desc: "Más de 100 empresas y 4K+ usuarios de pago usan flatkey.ai cada día.",
        points: [
          "99,9% de tasa de éxito media en 30 días",
          "Conmutación automática entre varios proveedores",
          "Paneles de salud en vivo para cada modelo",
        ],
      },
      cost: {
        title: "Reduce tu gasto en modelos",
        desc: "Precios de modelo al 60-90% del oficial y el bono de recarga quita otro tercio: hasta el 50% del oficial. Una key para 40+ modelos.",
        points: [
          "60-90% del precio oficial, combinado con el bono de recarga: hasta 50% menos",
          "40+ modelos integrados con una key",
          "Tareas simples a modelos baratos, tareas difíciles a modelos frontier",
        ],
      },
      privacy: {
        title: "Privacidad garantizada",
        desc: "Nuestros servidores y almacenamiento siguen prácticas GDPR, SOC 2 e ISO 27001. No almacenamos tus prompts ni respuestas.",
        points: [
          "Infraestructura conforme a GDPR",
          "Controles alineados con SOC 2 e ISO 27001",
          "Cero retención del contenido de tus peticiones",
        ],
      },
      learnMore: "Más información",
    },
    table: {
      eyebrow: "Todos los modelos",
      title: "45 modelos, una key: precios, latencia y salud",
      description: "Los 10 modelos más usados: precio con bono vs oficial, latencia TTFT y salud de 30 días. El directorio completo está en la página de modelos.",
      colModel: "Modelo",
      colOfficial: "Oficial",
      colFlatkey: "Con bono",
      colLatency: "Latencia",
      colHealth: "Salud 30 días",
      perMillion: "$ / 1M tokens de entrada",
      viewAll: "Explorar el directorio completo de modelos",
    },
  },
  fr: {
    hero: {
      badge: "Modèles officiels · Stable et sécurisé",
      titleLine1: "Modèles officiels GPT, Claude et Gemini.",
      titleLine2: "Jusqu'à 50 % de remise.",
      description:
        "flatkey.ai route votre trafic vers les API officielles GPT, Claude et Gemini avec une seule clé. Les prix des modèles sont à 60-90 % du tarif officiel, et recharger 200 $ offre 100 $ : cumulés, jusqu'à la moitié du prix officiel, stable et sécurisé.",
      ctaTrial: "Essai gratuit",
      ctaModels: "Voir la santé des modèles",
    },
    stats: [
      { value: "46B", label: "tokens servis par mois" },
      { value: "4K+", label: "utilisateurs payants" },
      { value: "45", label: "modèles avec une clé" },
      { value: "100+", label: "entreprises en production" },
    ],
    compare: {
      title: "Deux remises cumulées",
      subtitle: "Prix d'entrée par 1M de tokens",
      badge: "Jusqu'à -50 %",
      layers: ["Prix des modèles : 60-90 % du tarif officiel", "Rechargez 200 $, recevez 100 $ : vous payez 2/3"],
      official: "Officiel",
      flatkey: "Avec bonus",
      inputLabel: "Entrée / 1M tokens",
      save: "Les deux remises se cumulent : jusqu'à 50 % du prix officiel",
    },
    health: {
      eyebrow: "Santé des modèles en direct",
      title: "Santé sur 30 jours, mesurée sur du trafic réel",
      description:
        "Chaque chiffre provient d'appels de production réels routés par flatkey.ai : taux de réussite, latence et volume des 30 derniers jours. Aucun benchmark synthétique.",
      uptimeLabel: "Taux de réussite (30 j)",
      latencyLabel: "Latence moyenne",
      callsLabel: "Appels sur 30 j",
      trendLabel: "Taux de réussite, 30 derniers jours",
      empty: "Collecte des données…",
      viewAll: "Voir la santé de tous les modèles",
    },
    usage: {
      title: "Top modèles",
      subtitle: "Usage quotidien de tokens par modèle sur le dernier mois",
      tokensLabel: "tokens",
    },
    values: {
      eyebrow: "Pourquoi choisir flatkey.ai",
      title: "Fiable, moins cher et privé par conception",
      reliability: {
        title: "Stable et fiable",
        desc: "Plus de 100 entreprises et 4K+ utilisateurs payants utilisent flatkey.ai chaque jour.",
        points: [
          "99,9 % de taux de réussite moyen sur 30 jours",
          "Bascule automatique entre plusieurs fournisseurs",
          "Tableaux de santé en direct pour chaque modèle",
        ],
      },
      cost: {
        title: "Réduisez vos coûts de modèles",
        desc: "Prix des modèles à 60-90 % du tarif officiel, et le bonus de recharge retire encore un tiers : jusqu'à 50 % du prix officiel. Une clé pour 40+ modèles.",
        points: [
          "60-90 % du tarif officiel, cumulé au bonus de recharge : jusqu'à -50 %",
          "40+ modèles intégrés derrière une clé",
          "Tâches simples sur modèles économiques, tâches dures sur modèles frontier",
        ],
      },
      privacy: {
        title: "Confidentialité garantie",
        desc: "Nos serveurs et notre stockage suivent les pratiques GDPR, SOC 2 et ISO 27001. Nous ne stockons ni vos prompts ni vos réponses.",
        points: [
          "Infrastructure conforme au RGPD",
          "Contrôles alignés SOC 2 et ISO 27001",
          "Zéro rétention du contenu de vos requêtes",
        ],
      },
      learnMore: "En savoir plus",
    },
    table: {
      eyebrow: "Tous les modèles",
      title: "45 modèles, une clé : prix, latence et santé",
      description: "Les 10 modèles les plus utilisés : prix avec bonus vs officiel, latence TTFT et santé sur 30 jours. Le catalogue complet est sur la page modèles.",
      colModel: "Modèle",
      colOfficial: "Officiel",
      colFlatkey: "Avec bonus",
      colLatency: "Latence",
      colHealth: "Santé 30 j",
      perMillion: "$ / 1M tokens d'entrée",
      viewAll: "Parcourir le catalogue complet des modèles",
    },
  },
  pt: {
    hero: {
      badge: "Modelos oficiais · Estável e seguro",
      titleLine1: "Modelos oficiais GPT, Claude e Gemini.",
      titleLine2: "Até 50% de desconto.",
      description:
        "A flatkey.ai roteia seu tráfego para as APIs oficiais de GPT, Claude e Gemini com uma única key. Os preços dos modelos ficam em 60-90% do oficial e recarregar $200 dá $100 grátis: somados, até a metade do preço oficial, estável e seguro.",
      ctaTrial: "Teste grátis",
      ctaModels: "Ver saúde dos modelos",
    },
    stats: [
      { value: "46B", label: "tokens servidos por mês" },
      { value: "4K+", label: "usuários pagantes" },
      { value: "45", label: "modelos com uma key" },
      { value: "100+", label: "empresas em produção" },
    ],
    compare: {
      title: "Dois descontos somados",
      subtitle: "Preço de entrada por 1M de tokens",
      badge: "Até -50%",
      layers: ["Preço do modelo: 60-90% do oficial", "Recarregue $200, ganhe $100: você paga 2/3"],
      official: "Oficial",
      flatkey: "Com bônus",
      inputLabel: "Entrada / 1M tokens",
      save: "Os dois descontos se somam: até 50% do preço oficial",
    },
    health: {
      eyebrow: "Saúde dos modelos ao vivo",
      title: "Saúde de 30 dias, medida em tráfego real",
      description:
        "Cada número vem de chamadas reais de produção roteadas pela flatkey.ai: taxa de sucesso, latência e volume dos últimos 30 dias. Sem benchmarks sintéticos.",
      uptimeLabel: "Taxa de sucesso (30 dias)",
      latencyLabel: "Latência média",
      callsLabel: "Chamadas em 30 dias",
      trendLabel: "Taxa de sucesso, últimos 30 dias",
      empty: "Coletando dados…",
      viewAll: "Ver a saúde de todos os modelos",
    },
    usage: {
      title: "Modelos top",
      subtitle: "Uso diário de tokens por modelo no último mês",
      tokensLabel: "tokens",
    },
    values: {
      eyebrow: "Por que escolher a flatkey.ai",
      title: "Confiável, mais barato e privado por padrão",
      reliability: {
        title: "Estável e confiável",
        desc: "Mais de 100 empresas e 4K+ usuários pagantes usam a flatkey.ai todos os dias.",
        points: [
          "99,9% de taxa média de sucesso em 30 dias",
          "Failover automático entre vários provedores",
          "Painéis de saúde ao vivo para cada modelo",
        ],
      },
      cost: {
        title: "Reduza o gasto com modelos",
        desc: "Preços de modelo a 60-90% do oficial e o bônus de recarga tira mais um terço: até 50% do oficial. Uma key para 40+ modelos.",
        points: [
          "60-90% do preço oficial, somado ao bônus de recarga: até 50% off",
          "40+ modelos integrados com uma key",
          "Tarefas simples em modelos baratos, tarefas difíceis em modelos frontier",
        ],
      },
      privacy: {
        title: "Privacidade garantida",
        desc: "Nossos servidores e armazenamento seguem práticas GDPR, SOC 2 e ISO 27001. Não armazenamos seus prompts nem respostas.",
        points: [
          "Infraestrutura em conformidade com o GDPR",
          "Controles alinhados a SOC 2 e ISO 27001",
          "Zero retenção do conteúdo das suas requisições",
        ],
      },
      learnMore: "Saiba mais",
    },
    table: {
      eyebrow: "Todos os modelos",
      title: "45 modelos, uma key: preços, latência e saúde",
      description: "Os 10 modelos mais usados: preço com bônus vs oficial, latência TTFT e saúde de 30 dias. O diretório completo está na página de modelos.",
      colModel: "Modelo",
      colOfficial: "Oficial",
      colFlatkey: "Com bônus",
      colLatency: "Latência",
      colHealth: "Saúde 30 dias",
      perMillion: "$ / 1M tokens de entrada",
      viewAll: "Explorar o diretório completo de modelos",
    },
  },
  ru: {
    hero: {
      badge: "Официальные модели · Стабильно и безопасно",
      titleLine1: "Официальные модели GPT, Claude и Gemini.",
      titleLine2: "До 50% дешевле.",
      description:
        "flatkey.ai направляет ваш трафик в официальные API GPT, Claude и Gemini через один ключ. Цены моделей — 60-90% от официальных, а при пополнении на $200 вы получаете $100 в подарок: вместе это до половины официальной цены, стабильно и безопасно.",
      ctaTrial: "Бесплатный доступ",
      ctaModels: "Смотреть здоровье моделей",
    },
    stats: [
      { value: "46B", label: "токенов в месяц" },
      { value: "4K+", label: "платящих пользователей" },
      { value: "45", label: "моделей за одним ключом" },
      { value: "100+", label: "компаний в продакшене" },
    ],
    compare: {
      title: "Две скидки вместе",
      subtitle: "Цена входа за 1M токенов",
      badge: "До -50%",
      layers: ["Цена модели: 60-90% от официальной", "Пополните $200, получите $100: платите 2/3"],
      official: "Официально",
      flatkey: "С бонусом",
      inputLabel: "Вход / 1M токенов",
      save: "Скидки складываются: до 50% от официальной цены",
    },
    health: {
      eyebrow: "Здоровье моделей в реальном времени",
      title: "Здоровье за 30 дней на реальном трафике",
      description:
        "Все цифры ниже — из реальных продакшен-вызовов через flatkey.ai: success rate, задержка и объём за последние 30 дней. Никаких синтетических бенчмарков.",
      uptimeLabel: "Success rate за 30 дней",
      latencyLabel: "Средняя задержка",
      callsLabel: "Вызовы за 30 дней",
      trendLabel: "Success rate, последние 30 дней",
      empty: "Собираем данные…",
      viewAll: "Здоровье всех моделей",
    },
    usage: {
      title: "Топ моделей",
      subtitle: "Ежедневное использование токенов по моделям за месяц",
      tokensLabel: "токенов",
    },
    values: {
      eyebrow: "Почему выбирают flatkey.ai",
      title: "Надёжно, дешевле и приватно",
      reliability: {
        title: "Стабильно и надёжно",
        desc: "100+ компаний и 4K+ платящих пользователей ежедневно работают через flatkey.ai.",
        points: [
          "99,9% средний success rate за 30 дней",
          "Автоматическое переключение между провайдерами",
          "Live-дашборды здоровья для каждой модели",
        ],
      },
      cost: {
        title: "Снижайте расходы на модели",
        desc: "Цены моделей 60-90% от официальных, бонус пополнения снимает ещё треть — до 50% от официальной цены. Один ключ на 40+ моделей.",
        points: [
          "60-90% от официальной цены плюс бонус пополнения — до 50% скидки",
          "40+ моделей за одним ключом",
          "Простые задачи — на дешёвых моделях, сложные — на frontier",
        ],
      },
      privacy: {
        title: "Гарантия приватности",
        desc: "Серверы и хранилище соответствуют практикам GDPR, SOC 2 и ISO 27001. Мы не храним ваши prompts и ответы.",
        points: [
          "Инфраструктура соответствует GDPR",
          "Контроли по SOC 2 и ISO 27001",
          "Нулевое хранение содержимого запросов",
        ],
      },
      learnMore: "Подробнее",
    },
    table: {
      eyebrow: "Все модели",
      title: "45 моделей, один ключ: цены, задержка, здоровье",
      description: "10 самых загруженных моделей: цена с бонусом vs официальная, задержка TTFT и 30-дневное здоровье. Полный каталог — на странице моделей.",
      colModel: "Модель",
      colOfficial: "Официально",
      colFlatkey: "С бонусом",
      colLatency: "Задержка",
      colHealth: "Здоровье 30 дн",
      perMillion: "$ / 1M входных токенов",
      viewAll: "Открыть полный каталог моделей",
    },
  },
  ja: {
    hero: {
      badge: "公式モデル · 安定・安全",
      titleLine1: "GPT・Claude・Gemini の公式モデル。",
      titleLine2: "最安で半額。",
      description:
        "flatkey.ai は 1 つの key でトラフィックを GPT・Claude・Gemini の公式 API にルーティングします。モデル価格は公式の 60〜90%、さらに $200 チャージで $100 プレゼント。二重の割引で最安なら公式の半額、安定・安全です。",
      ctaTrial: "無料で試す",
      ctaModels: "モデルの健全性を見る",
    },
    stats: [
      { value: "46B", label: "月間処理トークン" },
      { value: "4K+", label: "有料ユーザー" },
      { value: "45", label: "モデルを 1 key で" },
      { value: "100+", label: "企業が本番利用" },
    ],
    compare: {
      title: "二重の割引",
      subtitle: "1M トークンあたりの入力価格",
      badge: "最安 -50%",
      layers: ["モデル価格：公式の 60〜90%", "$200 チャージで $100 進呈：支払いは 2/3"],
      official: "公式",
      flatkey: "チャージ後",
      inputLabel: "入力 / 1M tokens",
      save: "割引は重ねがけ：最安で公式価格の 50%",
    },
    health: {
      eyebrow: "モデル健全性（ライブ）",
      title: "実トラフィックで測った直近 30 日の健全性",
      description:
        "以下の数字はすべて flatkey.ai を経由した実際の本番呼び出しに基づきます。直近 30 日の成功率・レイテンシ・呼び出し量で、合成ベンチマークではありません。",
      uptimeLabel: "30 日成功率",
      latencyLabel: "平均レイテンシ",
      callsLabel: "30 日呼び出し数",
      trendLabel: "成功率（直近 30 日）",
      empty: "データ収集中…",
      viewAll: "全モデルの健全性を見る",
    },
    usage: {
      title: "トップモデル",
      subtitle: "過去 1 か月のモデル別・日次トークン使用量",
      tokensLabel: "tokens",
    },
    values: {
      eyebrow: "flatkey.ai が選ばれる理由",
      title: "安定・低コスト・プライバシー保証",
      reliability: {
        title: "安定・信頼",
        desc: "100+ 社の企業と 4K+ の有料ユーザーが毎日 flatkey.ai を利用しています。",
        points: [
          "直近 30 日の平均成功率 99.9%",
          "複数の上流プロバイダー間で自動フェイルオーバー",
          "全モデルのライブ健全性ダッシュボード",
        ],
      },
      cost: {
        title: "コスト削減",
        desc: "モデル価格は公式の 60〜90%、チャージ特典でさらに 1/3 オフ——最安で公式の半額。1 key で 40+ モデルを統合できます。",
        points: [
          "公式の 60〜90% × チャージ特典で、最安 50% オフ",
          "1 key で 40+ モデルを統合",
          "軽いタスクは低価格モデル、難しいタスクはフロンティアモデルへ",
        ],
      },
      privacy: {
        title: "プライバシー保証",
        desc: "サーバーとストレージは GDPR・SOC 2・ISO 27001 の基準に準拠。プロンプトも応答も保存しません。",
        points: [
          "GDPR 準拠のインフラ",
          "SOC 2・ISO 27001 に整合した統制",
          "リクエスト内容のゼロ保持",
        ],
      },
      learnMore: "詳しく見る",
    },
    table: {
      eyebrow: "全モデル",
      title: "45 モデルを 1 key で——価格・レイテンシ・健全性",
      description: "利用の多い上位 10 モデル：チャージ後価格 vs 公式価格、TTFT レイテンシ、30 日健全性。全モデルはモデルページへ。",
      colModel: "モデル",
      colOfficial: "公式",
      colFlatkey: "チャージ後",
      colLatency: "レイテンシ",
      colHealth: "30 日健全性",
      perMillion: "$ / 1M 入力 tokens",
      viewAll: "モデル一覧をすべて見る",
    },
  },
  vi: {
    hero: {
      badge: "Model chính thức · Ổn định và an toàn",
      titleLine1: "Model chính thức GPT, Claude và Gemini.",
      titleLine2: "Rẻ hơn tới 50%.",
      description:
        "flatkey.ai định tuyến traffic của bạn tới API chính thức của GPT, Claude và Gemini qua một key. Giá model bằng 60-90% giá chính thức, nạp $200 tặng $100: cộng dồn, thấp nhất bằng một nửa giá chính thức, ổn định và an toàn.",
      ctaTrial: "Dùng thử miễn phí",
      ctaModels: "Xem sức khỏe model",
    },
    stats: [
      { value: "46B", label: "token xử lý mỗi tháng" },
      { value: "4K+", label: "người dùng trả phí" },
      { value: "45", label: "model sau một key" },
      { value: "100+", label: "doanh nghiệp dùng production" },
    ],
    compare: {
      title: "Hai ưu đãi cộng dồn",
      subtitle: "Giá input mỗi 1M token",
      badge: "Thấp nhất -50%",
      layers: ["Giá model: 60-90% giá chính thức", "Nạp $200 tặng $100: chỉ trả 2/3"],
      official: "Chính thức",
      flatkey: "Sau ưu đãi",
      inputLabel: "Input / 1M tokens",
      save: "Hai ưu đãi cộng dồn: thấp nhất bằng 50% giá chính thức",
    },
    health: {
      eyebrow: "Sức khỏe model trực tiếp",
      title: "Sức khỏe 30 ngày, đo trên traffic thật",
      description:
        "Mọi con số bên dưới đều đến từ các cuộc gọi production thật qua flatkey.ai — tỷ lệ thành công, độ trễ và khối lượng trong 30 ngày gần nhất. Không phải benchmark tổng hợp.",
      uptimeLabel: "Tỷ lệ thành công 30 ngày",
      latencyLabel: "Độ trễ trung bình",
      callsLabel: "Lượt gọi trong 30 ngày",
      trendLabel: "Tỷ lệ thành công, 30 ngày gần nhất",
      empty: "Đang thu thập dữ liệu…",
      viewAll: "Xem sức khỏe tất cả model",
    },
    usage: {
      title: "Model hàng đầu",
      subtitle: "Lượng token dùng mỗi ngày theo model trong tháng qua",
      tokensLabel: "tokens",
    },
    values: {
      eyebrow: "Vì sao chọn flatkey.ai",
      title: "Ổn định, rẻ hơn và riêng tư",
      reliability: {
        title: "Ổn định, đáng tin cậy",
        desc: "Hơn 100 doanh nghiệp và 4K+ người dùng trả phí chạy trên flatkey.ai mỗi ngày.",
        points: [
          "Tỷ lệ thành công trung bình 99,9% trong 30 ngày",
          "Tự động chuyển đổi giữa nhiều nhà cung cấp",
          "Bảng sức khỏe trực tiếp cho từng model",
        ],
      },
      cost: {
        title: "Giảm chi phí model",
        desc: "Giá model bằng 60-90% chính thức, ưu đãi nạp giảm thêm 1/3 — thấp nhất 50% giá chính thức. Một key cho 40+ model.",
        points: [
          "60-90% giá chính thức, cộng ưu đãi nạp: giảm tới 50%",
          "40+ model tích hợp sau một key",
          "Tác vụ nhẹ dùng model rẻ, tác vụ khó dùng model frontier",
        ],
      },
      privacy: {
        title: "Bảo đảm quyền riêng tư",
        desc: "Máy chủ và lưu trữ tuân thủ GDPR, SOC 2 và ISO 27001. Chúng tôi không lưu prompt hay phản hồi của bạn.",
        points: [
          "Hạ tầng tuân thủ GDPR",
          "Kiểm soát theo SOC 2 và ISO 27001",
          "Không lưu giữ nội dung request",
        ],
      },
      learnMore: "Tìm hiểu thêm",
    },
    table: {
      eyebrow: "Tất cả model",
      title: "45 model, một key — giá, độ trễ, sức khỏe",
      description: "10 model được dùng nhiều nhất: giá sau ưu đãi vs chính thức, độ trễ TTFT và sức khỏe 30 ngày. Danh mục đầy đủ ở trang model.",
      colModel: "Model",
      colOfficial: "Chính thức",
      colFlatkey: "Sau ưu đãi",
      colLatency: "Độ trễ",
      colHealth: "Sức khỏe 30 ngày",
      perMillion: "$ / 1M token input",
      viewAll: "Xem toàn bộ danh mục model",
    },
  },
  de: {
    hero: {
      badge: "Offizielle Modelle · Stabil und sicher",
      titleLine1: "Offizielle GPT-, Claude- und Gemini-Modelle.",
      titleLine2: "Bis zu 50% günstiger.",
      description:
        "flatkey.ai leitet deinen Traffic mit einem Key zu den offiziellen GPT-, Claude- und Gemini-APIs. Modellpreise liegen bei 60-90% des offiziellen Listenpreises, und wer $200 auflädt, bekommt $100 geschenkt: kombiniert bis zu 50% des offiziellen Preises, stabil und sicher.",
      ctaTrial: "Kostenlos testen",
      ctaModels: "Modell-Gesundheit ansehen",
    },
    stats: [
      { value: "46B", label: "Tokens pro Monat" },
      { value: "4K+", label: "zahlende Nutzer" },
      { value: "45", label: "Modelle hinter einem Key" },
      { value: "100+", label: "Unternehmen in Produktion" },
    ],
    compare: {
      title: "Zwei Rabatte, kombiniert",
      subtitle: "Input-Preis pro 1M Tokens",
      badge: "Bis zu -50%",
      layers: ["Modellpreise: 60-90% des offiziellen Listenpreises", "$200 aufladen, $100 geschenkt: du zahlst 2/3"],
      official: "Offiziell",
      flatkey: "Mit Bonus",
      inputLabel: "Input / 1M Tokens",
      save: "Beide Rabatte kombiniert: bis zu 50% des offiziellen Preises",
    },
    health: {
      eyebrow: "Live-Modell-Gesundheit",
      title: "30-Tage-Gesundheit, gemessen an echtem Traffic",
      description:
        "Jede Zahl stammt aus echten Produktions-Calls über flatkey.ai — Erfolgsrate, Latenz und Volumen der letzten 30 Tage. Keine synthetischen Benchmarks.",
      uptimeLabel: "Erfolgsrate (30 Tage)",
      latencyLabel: "Durchschnittliche Latenz",
      callsLabel: "Aufrufe in 30 Tagen",
      trendLabel: "Erfolgsrate, letzte 30 Tage",
      empty: "Daten werden gesammelt…",
      viewAll: "Gesundheit aller Modelle ansehen",
    },
    usage: {
      title: "Top-Modelle",
      subtitle: "Tägliche Token-Nutzung pro Modell im letzten Monat",
      tokensLabel: "Tokens",
    },
    values: {
      eyebrow: "Warum Teams flatkey.ai wählen",
      title: "Zuverlässig, günstiger und privat by design",
      reliability: {
        title: "Stabil und zuverlässig",
        desc: "100+ Unternehmen und 4K+ zahlende Nutzer laufen täglich über flatkey.ai.",
        points: [
          "99,9% durchschnittliche Erfolgsrate über 30 Tage",
          "Automatisches Failover über mehrere Upstream-Anbieter",
          "Live-Gesundheitsdashboards für jedes Modell",
        ],
      },
      cost: {
        title: "Modellkosten senken",
        desc: "Modellpreise bei 60-90% des offiziellen Preises, der Aufladebonus spart ein weiteres Drittel — bis zu 50% des offiziellen Preises. Ein Key für 40+ Modelle.",
        points: [
          "60-90% des offiziellen Preises, kombiniert mit dem Aufladebonus: bis zu -50%",
          "40+ Modelle hinter einem Key",
          "Leichte Aufgaben auf günstige Modelle, harte auf Frontier-Modelle",
        ],
      },
      privacy: {
        title: "Datenschutz garantiert",
        desc: "Unsere Server und Speicher folgen GDPR-, SOC-2- und ISO-27001-Praktiken. Wir speichern weder Prompts noch Antworten.",
        points: [
          "GDPR-konforme Infrastruktur",
          "An SOC 2 und ISO 27001 ausgerichtete Kontrollen",
          "Keine Aufbewahrung deiner Request-Inhalte",
        ],
      },
      learnMore: "Mehr erfahren",
    },
    table: {
      eyebrow: "Alle Modelle",
      title: "45 Modelle, ein Key — Preise, Latenz und Gesundheit",
      description: "Die 10 meistgenutzten Modelle: Preis mit Bonus vs offiziell, TTFT-Latenz und 30-Tage-Gesundheit. Das vollständige Verzeichnis gibt es auf der Modellseite.",
      colModel: "Modell",
      colOfficial: "Offiziell",
      colFlatkey: "Mit Bonus",
      colLatency: "Latenz",
      colHealth: "Gesundheit 30 T",
      perMillion: "$ / 1M Input-Tokens",
      viewAll: "Vollständiges Modellverzeichnis ansehen",
    },
  },
};

export function getHomeCopy(locale: Locale): HomeCopy {
  return HOME_COPY[locale] ?? HOME_COPY.en;
}
