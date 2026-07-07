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
    colCalls: string;
    perMillion: string;
    viewAll: string;
  };
};

const HOME_COPY: Record<Locale, HomeCopy> = {
  en: {
    hero: {
      badge: "Official models · Stable and secure",
      titleLine1: "Official GPT, Claude and Gemini models.",
      titleLine2: "Up to 33% cheaper.",
      description:
        "flatkey.ai routes your traffic to the official GPT, Claude, and Gemini APIs through one key — same models, same quality, up to 33% lower cost, with stability and security you can verify.",
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
      title: "Official price vs Flatkey",
      subtitle: "Input price per 1M tokens, after the best top-up bonus",
      official: "Official",
      flatkey: "Flatkey",
      inputLabel: "Input / 1M tokens",
      save: "Up to 33% off with the top-up bonus",
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
        desc: "Official models up to 33% cheaper — and one key for 40+ models so every task runs on the right-cost model.",
        points: [
          "Up to 33% off official GPT, Claude, and Gemini pricing",
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
      description: "Discounted price vs official, live latency, 30-day health, and real 30-day call volume for every model.",
      colModel: "Model",
      colOfficial: "Official",
      colFlatkey: "Flatkey",
      colLatency: "Latency",
      colHealth: "30-day health",
      colCalls: "30-day calls",
      perMillion: "$ / 1M input tokens",
      viewAll: "Browse the full model directory",
    },
  },
  zh: {
    hero: {
      badge: "官方模型 · 稳定安全",
      titleLine1: "GPT、Claude、Gemini 官方模型",
      titleLine2: "最高 6.7 折",
      description:
        "flatkey.ai 用一个 key 把你的请求路由到 GPT、Claude、Gemini 官方 API——同样的模型、同样的质量，成本最高低 33%，稳定与安全可实时验证。",
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
      title: "官方价 vs Flatkey",
      subtitle: "每 1M token 输入价，按最优充值赠送计算",
      official: "官方价",
      flatkey: "Flatkey",
      inputLabel: "输入 / 1M tokens",
      save: "充值赠送后最高 6.7 折",
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
        desc: "官方模型最高 6.7 折；一个 key 集成 40+ 模型，不同任务用不同成本的模型，让生产成本大幅下降。",
        points: [
          "GPT、Claude、Gemini 官方价最高 6.7 折",
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
      description: "每个模型的折扣价 vs 官方价、实时延迟、30 天健康度与真实 30 天调用量。",
      colModel: "模型",
      colOfficial: "官方价",
      colFlatkey: "Flatkey",
      colLatency: "延迟",
      colHealth: "30 天健康度",
      colCalls: "30 天调用",
      perMillion: "$ / 1M 输入 tokens",
      viewAll: "浏览完整模型目录",
    },
  },
  es: {
    hero: {
      badge: "Modelos oficiales · Estable y seguro",
      titleLine1: "Modelos oficiales de GPT, Claude y Gemini.",
      titleLine2: "Hasta 33% más barato.",
      description:
        "flatkey.ai enruta tu tráfico a las API oficiales de GPT, Claude y Gemini con una sola key: los mismos modelos, la misma calidad, hasta 33% menos coste, con estabilidad y seguridad verificables.",
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
      title: "Precio oficial vs Flatkey",
      subtitle: "Precio de entrada por 1M de tokens, con el mejor bono de recarga",
      official: "Oficial",
      flatkey: "Flatkey",
      inputLabel: "Entrada / 1M tokens",
      save: "Hasta 33% de descuento con el bono de recarga",
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
        desc: "Modelos oficiales hasta 33% más baratos, y una key para 40+ modelos: cada tarea usa el modelo con el coste adecuado.",
        points: [
          "Hasta 33% de descuento sobre el precio oficial de GPT, Claude y Gemini",
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
      description: "Precio con descuento vs oficial, latencia en vivo, salud de 30 días y volumen real de llamadas de cada modelo.",
      colModel: "Modelo",
      colOfficial: "Oficial",
      colFlatkey: "Flatkey",
      colLatency: "Latencia",
      colHealth: "Salud 30 días",
      colCalls: "Llamadas 30 días",
      perMillion: "$ / 1M tokens de entrada",
      viewAll: "Explorar el directorio completo de modelos",
    },
  },
  fr: {
    hero: {
      badge: "Modèles officiels · Stable et sécurisé",
      titleLine1: "Modèles officiels GPT, Claude et Gemini.",
      titleLine2: "Jusqu'à 33 % moins cher.",
      description:
        "flatkey.ai route votre trafic vers les API officielles GPT, Claude et Gemini avec une seule clé : mêmes modèles, même qualité, jusqu'à 33 % de coût en moins, avec une stabilité et une sécurité vérifiables.",
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
      title: "Prix officiel vs Flatkey",
      subtitle: "Prix d'entrée par 1M de tokens, avec le meilleur bonus de recharge",
      official: "Officiel",
      flatkey: "Flatkey",
      inputLabel: "Entrée / 1M tokens",
      save: "Jusqu'à 33 % de remise avec le bonus de recharge",
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
        desc: "Modèles officiels jusqu'à 33 % moins chers, et une clé pour 40+ modèles : chaque tâche tourne sur le modèle au bon coût.",
        points: [
          "Jusqu'à 33 % de remise sur les prix officiels GPT, Claude et Gemini",
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
      description: "Prix remisé vs officiel, latence en direct, santé sur 30 jours et volume d'appels réel pour chaque modèle.",
      colModel: "Modèle",
      colOfficial: "Officiel",
      colFlatkey: "Flatkey",
      colLatency: "Latence",
      colHealth: "Santé 30 j",
      colCalls: "Appels 30 j",
      perMillion: "$ / 1M tokens d'entrée",
      viewAll: "Parcourir le catalogue complet des modèles",
    },
  },
  pt: {
    hero: {
      badge: "Modelos oficiais · Estável e seguro",
      titleLine1: "Modelos oficiais GPT, Claude e Gemini.",
      titleLine2: "Até 33% mais barato.",
      description:
        "A flatkey.ai roteia seu tráfego para as APIs oficiais de GPT, Claude e Gemini com uma única key: mesmos modelos, mesma qualidade, custo até 33% menor, com estabilidade e segurança verificáveis.",
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
      title: "Preço oficial vs Flatkey",
      subtitle: "Preço de entrada por 1M de tokens, com o melhor bônus de recarga",
      official: "Oficial",
      flatkey: "Flatkey",
      inputLabel: "Entrada / 1M tokens",
      save: "Até 33% de desconto com o bônus de recarga",
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
        desc: "Modelos oficiais até 33% mais baratos, e uma key para 40+ modelos: cada tarefa roda no modelo com o custo certo.",
        points: [
          "Até 33% de desconto sobre o preço oficial de GPT, Claude e Gemini",
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
      description: "Preço com desconto vs oficial, latência ao vivo, saúde de 30 dias e volume real de chamadas de cada modelo.",
      colModel: "Modelo",
      colOfficial: "Oficial",
      colFlatkey: "Flatkey",
      colLatency: "Latência",
      colHealth: "Saúde 30 dias",
      colCalls: "Chamadas 30 dias",
      perMillion: "$ / 1M tokens de entrada",
      viewAll: "Explorar o diretório completo de modelos",
    },
  },
  ru: {
    hero: {
      badge: "Официальные модели · Стабильно и безопасно",
      titleLine1: "Официальные модели GPT, Claude и Gemini.",
      titleLine2: "До 33% дешевле.",
      description:
        "flatkey.ai направляет ваш трафик в официальные API GPT, Claude и Gemini через один ключ: те же модели, то же качество, до 33% ниже стоимость, а стабильность и безопасность можно проверить в реальном времени.",
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
      title: "Официальная цена vs Flatkey",
      subtitle: "Цена входа за 1M токенов с лучшим бонусом пополнения",
      official: "Официально",
      flatkey: "Flatkey",
      inputLabel: "Вход / 1M токенов",
      save: "До 33% скидки с бонусом за пополнение",
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
        desc: "Официальные модели до 33% дешевле, и один ключ на 40+ моделей — каждая задача на модели с подходящей ценой.",
        points: [
          "До 33% скидки от официальных цен GPT, Claude и Gemini",
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
      description: "Цена со скидкой vs официальная, задержка, 30-дневное здоровье и реальный объём вызовов каждой модели.",
      colModel: "Модель",
      colOfficial: "Официально",
      colFlatkey: "Flatkey",
      colLatency: "Задержка",
      colHealth: "Здоровье 30 дн",
      colCalls: "Вызовы 30 дн",
      perMillion: "$ / 1M входных токенов",
      viewAll: "Открыть полный каталог моделей",
    },
  },
  ja: {
    hero: {
      badge: "公式モデル · 安定・安全",
      titleLine1: "GPT・Claude・Gemini の公式モデル。",
      titleLine2: "最大 33% 安く。",
      description:
        "flatkey.ai は 1 つの key であなたのトラフィックを GPT・Claude・Gemini の公式 API にルーティングします。同じモデル、同じ品質、コストは最大 33% 削減。安定性とセキュリティはリアルタイムで確認できます。",
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
      title: "公式価格 vs Flatkey",
      subtitle: "1M トークンあたりの入力価格（最良のチャージ特典適用後）",
      official: "公式",
      flatkey: "Flatkey",
      inputLabel: "入力 / 1M tokens",
      save: "チャージ特典で最大 33% オフ",
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
        desc: "公式モデルが最大 33% オフ。さらに 1 key で 40+ モデルを統合し、タスクごとに最適コストのモデルを使えます。",
        points: [
          "GPT・Claude・Gemini 公式価格から最大 33% オフ",
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
      description: "各モデルの割引価格 vs 公式価格、ライブレイテンシ、30 日健全性、実際の 30 日呼び出し量。",
      colModel: "モデル",
      colOfficial: "公式",
      colFlatkey: "Flatkey",
      colLatency: "レイテンシ",
      colHealth: "30 日健全性",
      colCalls: "30 日呼び出し",
      perMillion: "$ / 1M 入力 tokens",
      viewAll: "モデル一覧をすべて見る",
    },
  },
  vi: {
    hero: {
      badge: "Model chính thức · Ổn định và an toàn",
      titleLine1: "Model chính thức GPT, Claude và Gemini.",
      titleLine2: "Rẻ hơn tới 33%.",
      description:
        "flatkey.ai định tuyến traffic của bạn tới API chính thức của GPT, Claude và Gemini qua một key: cùng model, cùng chất lượng, chi phí thấp hơn tới 33%, với độ ổn định và bảo mật có thể kiểm chứng.",
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
      title: "Giá chính thức vs Flatkey",
      subtitle: "Giá input mỗi 1M token, sau ưu đãi nạp tốt nhất",
      official: "Chính thức",
      flatkey: "Flatkey",
      inputLabel: "Input / 1M tokens",
      save: "Giảm tới 33% với ưu đãi nạp tiền",
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
        desc: "Model chính thức rẻ hơn tới 33%, và một key cho 40+ model — mỗi tác vụ chạy trên model có chi phí phù hợp.",
        points: [
          "Giảm tới 33% so với giá chính thức GPT, Claude, Gemini",
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
      description: "Giá ưu đãi vs chính thức, độ trễ trực tiếp, sức khỏe 30 ngày và khối lượng gọi thật của từng model.",
      colModel: "Model",
      colOfficial: "Chính thức",
      colFlatkey: "Flatkey",
      colLatency: "Độ trễ",
      colHealth: "Sức khỏe 30 ngày",
      colCalls: "Lượt gọi 30 ngày",
      perMillion: "$ / 1M token input",
      viewAll: "Xem toàn bộ danh mục model",
    },
  },
  de: {
    hero: {
      badge: "Offizielle Modelle · Stabil und sicher",
      titleLine1: "Offizielle GPT-, Claude- und Gemini-Modelle.",
      titleLine2: "Bis zu 33% günstiger.",
      description:
        "flatkey.ai leitet deinen Traffic mit einem Key zu den offiziellen GPT-, Claude- und Gemini-APIs: gleiche Modelle, gleiche Qualität, bis zu 33% weniger Kosten — mit nachprüfbarer Stabilität und Sicherheit.",
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
      title: "Offizieller Preis vs Flatkey",
      subtitle: "Input-Preis pro 1M Tokens, mit dem besten Aufladebonus",
      official: "Offiziell",
      flatkey: "Flatkey",
      inputLabel: "Input / 1M Tokens",
      save: "Bis zu 33% Rabatt mit dem Aufladebonus",
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
        desc: "Offizielle Modelle bis zu 33% günstiger — und ein Key für 40+ Modelle, damit jede Aufgabe auf dem Modell mit den richtigen Kosten läuft.",
        points: [
          "Bis zu 33% Rabatt auf offizielle GPT-, Claude- und Gemini-Preise",
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
      description: "Rabattpreis vs offiziell, Live-Latenz, 30-Tage-Gesundheit und echtes 30-Tage-Aufrufvolumen für jedes Modell.",
      colModel: "Modell",
      colOfficial: "Offiziell",
      colFlatkey: "Flatkey",
      colLatency: "Latenz",
      colHealth: "Gesundheit 30 T",
      colCalls: "Aufrufe 30 T",
      perMillion: "$ / 1M Input-Tokens",
      viewAll: "Vollständiges Modellverzeichnis ansehen",
    },
  },
};

export function getHomeCopy(locale: Locale): HomeCopy {
  return HOME_COPY[locale] ?? HOME_COPY.en;
}
