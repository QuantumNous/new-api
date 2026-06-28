import type { SeoInput } from "@/lib/seo";
import type { Locale } from "./locales";
import { buildConsoleUrl, APP_CONSOLE_ORIGIN } from "./origins";

export const GLM_LANDING_PATH = "/glm-5-2";
export const GLM_MODEL_ID = "glm-5.2";
export const GLM_OFFICIAL_PERCENT = "100%";
export const GLM_FLATKEY_PERCENT = "60%";
export const GLM_SAVINGS_PERCENT = "40%";

export type GlmLandingFeature = {
  title: string;
  body: string;
};

export type GlmLandingFaq = {
  question: string;
  answer: string;
};

export type GlmLandingPageCopy = {
  seo: {
    title: string;
    description: string;
  };
  badge: string;
  hero: {
    eyebrow: string;
    title: string;
    highlight: string;
    subtitle: string;
    primaryCta: string;
    secondaryCta: string;
    trustLine: string;
  };
  visual: {
    status: {
      openai: string;
      claude: string;
      curl: string;
    };
    tabs: string[];
    compatibility: string;
    priceSignal: string;
    terminalTitle: string;
  };
  reasonsKicker: string;
  reasonsTitle: string;
  reasons: GlmLandingFeature[];
  pricing: {
    kicker: string;
    title: string;
    subtitle: string;
    officialLabel: string;
    flatkeyLabel: string;
    saveLine: string;
    footnote: string;
  };
  code: {
    kicker: string;
    title: string;
    subtitle: string;
    model: string;
  };
  featuresKicker: string;
  featuresTitle: string;
  features: GlmLandingFeature[];
  finalCta: {
    title: string;
    body: string;
    button: string;
  };
  faqs: GlmLandingFaq[];
};

const english: GlmLandingPageCopy = {
  seo: {
    title: "GLM 5.2 API at 40% off official pricing",
    description:
      "Use the GLM 5.2 API through flatkey.ai at 40% off official pricing: 60% of the official price, OpenAI-compatible, dedicated self-hosted compute, and one API key for production workloads.",
  },
  badge: "GLM 5.2 live now",
  hero: {
    eyebrow: "GLM 5.2 API for builders who need lower cost",
    title: "GLM 5.2 API at",
    highlight: "40% off official",
    subtitle:
      "Run the model everyone is talking about through flatkey: 60% of the official price, on dedicated self-hosted compute. Compatible with OpenAI SDK and Claude Code CLI. One line to switch.",
    primaryCta: "Start with GLM 5.2 - free credit",
    secondaryCta: "See pricing",
    trustLine: "No card to start · OpenAI SDK + Claude Code CLI compatible · Switch in one line",
  },
  visual: {
    status: {
      openai: "drop-in compatibility demo",
      claude: "Claude Code CLI routing",
      curl: "GLM 5.2 model target",
    },
    tabs: ["OpenAI SDK", "Claude Code CLI", "curl"],
    compatibility: "Use the OpenAI SDK pattern or route Claude Code CLI usage through flatkey.",
    priceSignal: `flatkey ${GLM_FLATKEY_PERCENT} · official ${GLM_OFFICIAL_PERCENT}`,
    terminalTitle: "API example",
  },
  reasonsKicker: "Why flatkey for GLM 5.2",
  reasonsTitle: "Two reasons, no catch",
  reasons: [
    {
      title: "60% of the official price",
      body: "Same GLM 5.2 API surface, billed at 60% of what you would pay official. Transparent per-token pricing, no minimums, pay as you go.",
    },
    {
      title: "Dedicated self-hosted compute",
      body: "We run GLM 5.2 on owned GPU capacity, not a thin reseller layer. That gives teams a clearer operating path before they move campaign traffic into production.",
    },
  ],
  pricing: {
    kicker: "Pricing",
    title: "Pay 60%. Get 100%.",
    subtitle: "Exact same GLM 5.2 request shape. You just pay less on every call.",
    officialLabel: "Official GLM 5.2",
    flatkeyLabel: "GLM 5.2 on flatkey",
    saveLine: "Save 40% on every GLM 5.2 call",
    footnote: "Pricing claim follows the campaign offer. Recheck the live billing configuration before launch.",
  },
  code: {
    kicker: "Drop-in code",
    title: "Switch with one base URL",
    subtitle: "Keep the OpenAI SDK or Claude Code CLI workflow. Point traffic to flatkey and set the model name.",
    model: GLM_MODEL_ID,
  },
  featuresKicker: "Built for paid traffic that converts",
  featuresTitle: "Everything a developer expects before trying a model",
  features: [
    { title: "OpenAI SDK + Claude Code CLI", body: "Use chat completions in code, or route Claude Code CLI usage through the same flatkey account." },
    { title: "Own GPU capacity", body: "A dedicated GLM lane gives volume campaigns more predictable headroom." },
    { title: "40% cheaper", body: "Market the value clearly: flatkey bills GLM 5.2 at 60% of official." },
    { title: "Pay USD or local", body: "Simple top-ups and account billing without chasing separate provider accounts." },
    { title: "40+ other models", body: "One key can test GLM, GPT, Claude, Gemini, video, image, and more." },
    { title: "Free credit to start", body: "Let developers create a key and make the first GLM 5.2 call quickly." },
  ],
  finalCta: {
    title: "Launch GLM 5.2 without reworking your stack",
    body: "Create one flatkey API key, point your OpenAI-compatible client at our router, and start testing GLM 5.2 on dedicated compute.",
    button: "Get your GLM 5.2 key",
  },
  faqs: [
    {
      question: "Is this the same model as official GLM 5.2?",
      answer: "The page targets GLM 5.2 compatible API usage through flatkey. Confirm exact runtime availability in the dashboard before production rollout.",
    },
    {
      question: "Do I need to rewrite my OpenAI SDK code?",
      answer: "No. Use the OpenAI-compatible base URL, keep the SDK, and set the model to glm-5.2. Claude Code CLI traffic can also route through flatkey.",
    },
    {
      question: "Who is this page for?",
      answer: "Developers arriving from Google, Reddit, and regional campaigns who want a cheaper GLM 5.2 API key with a familiar integration path.",
    },
  ],
};

const translations: Record<Locale, GlmLandingPageCopy> = {
  en: english,
  zh: {
    ...english,
    seo: {
      title: "GLM 5.2 API 官方价 6 折",
      description:
        "通过 flatkey.ai 使用 GLM 5.2 API，按官方价 60% 计费。兼容 OpenAI，自持算力，一把 API key 支持生产级调用。",
    },
    badge: "GLM 5.2 已上线",
    hero: {
      eyebrow: "为想降低调用成本的开发者准备的 GLM 5.2 API",
      title: "GLM 5.2 API",
      highlight: "官方价 6 折",
      subtitle:
        "用 flatkey 调用大家都在讨论的 GLM 5.2：官方价 60%，运行在 dedicated self-hosted compute 上。兼容 OpenAI SDK 和 Claude Code CLI，改一行即可切换。",
      primaryCta: "开始使用 GLM 5.2 - 送免费额度",
      secondaryCta: "查看价格",
      trustLine: "无需信用卡开始 · 兼容 OpenAI SDK 和 Claude Code CLI · 一行切换",
    },
    visual: {
      status: {
        openai: "兼容接入示例",
        claude: "Claude Code CLI 路由示例",
        curl: "GLM 5.2 模型目标",
      },
      tabs: ["OpenAI SDK", "Claude Code CLI", "curl"],
      compatibility: "代码里沿用 OpenAI SDK，也可以把 Claude Code CLI 用量路由到 flatkey。",
      priceSignal: `flatkey ${GLM_FLATKEY_PERCENT} · 官方 ${GLM_OFFICIAL_PERCENT}`,
      terminalTitle: "API 示例",
    },
    reasonsKicker: "为什么用 flatkey 跑 GLM 5.2",
    reasonsTitle: "两个理由，没有套路",
    reasons: [
      {
        title: "官方价 60%",
        body: "同样的 GLM 5.2 API 形态，按官方价 60% 计费。透明 token 定价，无最低消费，用多少付多少。",
      },
      {
        title: "自持算力",
        body: "flatkey 用自有 GPU 容量承载 GLM 5.2，不是薄代理转售层。把广告流量切到生产前，团队能获得更清晰的运行路径。",
      },
    ],
    pricing: {
      kicker: "价格",
      title: "付 60%，拿 100%。",
      subtitle: "同样的 GLM 5.2 请求形态，只是每次调用更便宜。",
      officialLabel: "官方 GLM 5.2",
      flatkeyLabel: "flatkey 上的 GLM 5.2",
      saveLine: "每次 GLM 5.2 调用节省 40%",
      footnote: "价格承诺来自本次广告活动，上线前需再次核对实时计费配置。",
    },
    code: {
      kicker: "一行接入",
      title: "只改 base URL 即可切换",
      subtitle: "保留 OpenAI SDK 或 Claude Code CLI 工作流，把流量指向 flatkey，并设置模型名。",
      model: GLM_MODEL_ID,
    },
    featuresKicker: "为付费流量转化而设计",
    featuresTitle: "开发者试模型前需要的信息，一屏讲清",
    features: [
      { title: "兼容 OpenAI SDK 和 Claude Code CLI", body: "代码里继续使用 chat completions SDK，也可以把 Claude Code CLI 用量路由到同一个 flatkey 账户。" },
      { title: "自有 GPU 容量", body: "专属 GLM 通道让广告流量和批量调用更有余量。" },
      { title: "便宜 40%", body: "卖点清晰：flatkey 按官方价 60% 计费 GLM 5.2。" },
      { title: "美元或本地支付", body: "统一充值和账户账单，不必维护多个上游账号。" },
      { title: "40+ 其它模型", body: "一把 key 还能测试 GLM、GPT、Claude、Gemini、视频和图像模型。" },
      { title: "免费额度开始", body: "开发者可以快速创建 key，完成第一次 GLM 5.2 调用。" },
    ],
    finalCta: {
      title: "不用重写技术栈，也能上线 GLM 5.2",
      body: "创建一把 flatkey API key，把 OpenAI-compatible 客户端指向我们的 router，即可开始在自持算力上测试 GLM 5.2。",
      button: "获取 GLM 5.2 key",
    },
    faqs: [
      {
        question: "这是和官方一样的 GLM 5.2 吗？",
        answer: "页面面向通过 flatkey 调用 GLM 5.2 兼容 API 的场景。生产上线前请在控制台确认确切运行时可用性。",
      },
      { question: "需要重写 OpenAI SDK 或 Claude Code CLI 工作流吗？", answer: "不需要。代码里使用兼容 OpenAI 的 base URL，保留 SDK，并把 model 设为 glm-5.2；Claude Code CLI 用量也可以路由到 flatkey。" },
      {
        question: "这个页面面向谁？",
        answer: "从 Google、Reddit 和区域广告进入、想要更便宜 GLM 5.2 API key 和熟悉接入方式的开发者。",
      },
    ],
  },
  es: {
    ...english,
    seo: {
      title: "GLM 5.2 API con 40% menos que el precio oficial",
      description:
        "Usa la API GLM 5.2 con flatkey.ai al 60% del precio oficial. Compatible con OpenAI, cómputo dedicado propio y una clave API para producción.",
    },
    badge: "GLM 5.2 disponible",
    hero: {
      eyebrow: "API GLM 5.2 para equipos que quieren menor coste",
      title: "API GLM 5.2 con",
      highlight: "40% menos que oficial",
      subtitle:
        "Ejecuta GLM 5.2 con flatkey: 60% del precio oficial, en cómputo dedicado propio. Compatible con OpenAI. Cambia una línea.",
      primaryCta: "Empieza con GLM 5.2 - crédito gratis",
      secondaryCta: "Ver precios",
      trustLine: "Sin tarjeta para empezar · compatible con OpenAI · cambia una línea",
    },
    visual: {
      status: {
        openai: "demo de compatibilidad",
        claude: "enrutamiento de Claude Code CLI",
        curl: "destino del modelo GLM 5.2",
      },
      tabs: ["OpenAI SDK", "Claude Code CLI", "curl"],
      compatibility: "Usa el patrón del SDK de OpenAI o enruta Claude Code CLI por flatkey.",
      priceSignal: `flatkey ${GLM_FLATKEY_PERCENT} · oficial ${GLM_OFFICIAL_PERCENT}`,
      terminalTitle: "Ejemplo API",
    },
    reasonsKicker: "Por qué flatkey para GLM 5.2",
    reasonsTitle: "Dos razones, sin trampa",
    reasons: [
      {
        title: "60% del precio oficial",
        body: "La misma superficie API de GLM 5.2, facturada al 60% de lo oficial. Precio transparente por token, sin mínimos, pago por uso.",
      },
      {
        title: "Cómputo dedicado propio",
        body: "Ejecutamos GLM 5.2 en capacidad GPU propia, no como una capa fina de reventa. Más estabilidad cuando crece el volumen.",
      },
    ],
    pricing: {
      kicker: "Precio",
      title: "Paga 60%. Recibe 100%.",
      subtitle: "La misma forma de petición de GLM 5.2. Solo pagas menos en cada llamada.",
      officialLabel: "GLM 5.2 oficial",
      flatkeyLabel: "GLM 5.2 en flatkey",
      saveLine: "Ahorra 40% en cada llamada GLM 5.2",
      footnote: "La promesa de precio sigue la campaña. Verifica la configuración de facturación antes del lanzamiento.",
    },
    code: {
      kicker: "Código directo",
      title: "Cambia solo la base URL",
      subtitle: "Mantén el SDK de OpenAI o el flujo de Claude Code CLI. Envía el tráfico a flatkey y define el modelo.",
      model: GLM_MODEL_ID,
    },
    featuresKicker: "Hecho para convertir tráfico pagado",
    featuresTitle: "Lo que un desarrollador espera antes de probar un modelo",
    features: [
      { title: "OpenAI SDK + Claude Code CLI", body: "Usa chat completions en código, o enruta Claude Code CLI por la misma cuenta flatkey." },
      { title: "Capacidad GPU propia", body: "Un carril GLM dedicado ofrece margen más predecible para campañas con volumen." },
      { title: "40% más barato", body: "Valor claro: flatkey factura GLM 5.2 al 60% del precio oficial." },
      { title: "Paga en USD o local", body: "Recargas y facturación simples sin perseguir cuentas de proveedores." },
      { title: "40+ modelos más", body: "Una clave prueba GLM, GPT, Claude, Gemini, video, imagen y más." },
      { title: "Crédito gratis inicial", body: "Crea una clave y realiza la primera llamada GLM 5.2 rápidamente." },
    ],
    finalCta: {
      title: "Lanza GLM 5.2 sin rehacer tu stack",
      body: "Crea una clave flatkey, apunta tu cliente compatible con OpenAI al router y prueba GLM 5.2 en cómputo dedicado.",
      button: "Obtén tu clave GLM 5.2",
    },
    faqs: [
      {
        question: "¿Es el mismo modelo que GLM 5.2 oficial?",
        answer: "La página está pensada para uso de API compatible con GLM 5.2 vía flatkey. Confirma la disponibilidad exacta en el panel antes de producción.",
      },
      { question: "¿Debo reescribir OpenAI SDK o Claude Code CLI?", answer: "No. Usa la base URL compatible con OpenAI, conserva el SDK y define model como glm-5.2. Claude Code CLI también puede ir por flatkey." },
      {
        question: "¿Para quién es esta página?",
        answer: "Desarrolladores que llegan desde Google, Reddit y campañas regionales buscando una API GLM 5.2 más barata y una integración familiar.",
      },
    ],
  },
  fr: {
    ...english,
    seo: {
      title: "API GLM 5.2 à 40% de moins que le prix officiel",
      description:
        "Utilisez l'API GLM 5.2 via flatkey.ai à 60% du prix officiel. Compatible OpenAI, calcul dédié auto-hébergé et une seule clé API.",
    },
    badge: "GLM 5.2 disponible",
    hero: {
      eyebrow: "API GLM 5.2 pour les équipes qui veulent baisser les coûts",
      title: "API GLM 5.2 à",
      highlight: "40% de moins",
      subtitle:
        "Exécutez GLM 5.2 avec flatkey : 60% du prix officiel, sur du calcul dédié auto-hébergé. Compatible OpenAI. Une ligne à changer.",
      primaryCta: "Démarrer avec GLM 5.2 - crédit offert",
      secondaryCta: "Voir les prix",
      trustLine: "Pas de carte au départ · compatible OpenAI · une ligne à changer",
    },
    visual: {
      status: {
        openai: "démo de compatibilité",
        claude: "routage Claude Code CLI",
        curl: "cible du modèle GLM 5.2",
      },
      tabs: ["OpenAI SDK", "Claude Code CLI", "curl"],
      compatibility: "Gardez le SDK OpenAI ou routez Claude Code CLI via flatkey.",
      priceSignal: `flatkey ${GLM_FLATKEY_PERCENT} · officiel ${GLM_OFFICIAL_PERCENT}`,
      terminalTitle: "Exemple API",
    },
    reasonsKicker: "Pourquoi flatkey pour GLM 5.2",
    reasonsTitle: "Deux raisons, sans piège",
    reasons: [
      {
        title: "60% du prix officiel",
        body: "La même surface API GLM 5.2, facturée à 60% du prix officiel. Tarification par token transparente, sans minimum.",
      },
      {
        title: "Calcul dédié auto-hébergé",
        body: "GLM 5.2 tourne sur notre capacité GPU, pas sur une simple couche de revente. Les équipes gardent un chemin d'exploitation plus clair avant de lancer du trafic campagne.",
      },
    ],
    pricing: {
      kicker: "Tarif",
      title: "Payez 60%. Obtenez 100%.",
      subtitle: "La même forme de requête GLM 5.2. Vous payez simplement moins à chaque appel.",
      officialLabel: "GLM 5.2 officiel",
      flatkeyLabel: "GLM 5.2 sur flatkey",
      saveLine: "Économisez 40% sur chaque appel GLM 5.2",
      footnote: "La promesse tarifaire suit l'offre campagne. Revalidez la configuration de facturation avant lancement.",
    },
    code: {
      kicker: "Code direct",
      title: "Changez seulement la base URL",
      subtitle: "Gardez le SDK OpenAI ou le workflow Claude Code CLI. Envoyez le trafic vers flatkey et choisissez le modèle.",
      model: GLM_MODEL_ID,
    },
    featuresKicker: "Conçu pour convertir le trafic payant",
    featuresTitle: "Ce qu'un développeur veut voir avant d'essayer un modèle",
    features: [
      { title: "OpenAI SDK + Claude Code CLI", body: "Utilisez chat completions en code, ou routez Claude Code CLI via le même compte flatkey." },
      { title: "Capacité GPU propre", body: "Une voie GLM dédiée offre plus de marge pour les campagnes à volume." },
      { title: "40% moins cher", body: "Valeur claire : flatkey facture GLM 5.2 à 60% du prix officiel." },
      { title: "Paiement USD ou local", body: "Recharges et facturation simples sans gérer plusieurs comptes fournisseurs." },
      { title: "40+ autres modèles", body: "Une clé teste GLM, GPT, Claude, Gemini, vidéo, image et plus." },
      { title: "Crédit offert", body: "Créez une clé et lancez vite le premier appel GLM 5.2." },
    ],
    finalCta: {
      title: "Lancez GLM 5.2 sans refaire votre stack",
      body: "Créez une clé flatkey, pointez votre client compatible OpenAI vers notre routeur, puis testez GLM 5.2 sur calcul dédié.",
      button: "Obtenir une clé GLM 5.2",
    },
    faqs: [
      {
        question: "Est-ce le même modèle que le GLM 5.2 officiel ?",
        answer: "La page cible l'usage API compatible GLM 5.2 via flatkey. Vérifiez la disponibilité exacte dans le dashboard avant production.",
      },
      { question: "Faut-il réécrire OpenAI SDK ou Claude Code CLI ?", answer: "Non. Utilisez la base URL compatible OpenAI, gardez le SDK et mettez model à glm-5.2. Claude Code CLI peut aussi passer par flatkey." },
      {
        question: "À qui s'adresse cette page ?",
        answer: "Aux développeurs venant de Google, Reddit et campagnes régionales qui veulent une clé GLM 5.2 moins chère avec une intégration familière.",
      },
    ],
  },
  pt: {
    ...english,
    seo: {
      title: "GLM 5.2 API barato com 40% de desconto",
      description:
        "Use a GLM 5.2 API barato pela flatkey.ai: 60% do preço oficial, compatível com OpenAI, computação dedicada própria e uma chave API para produção.",
    },
    badge: "GLM 5.2 disponível",
    hero: {
      eyebrow: "GLM 5.2 API para quem quer reduzir custo",
      title: "GLM 5.2 API com",
      highlight: "40% abaixo do oficial",
      subtitle:
        "Rode o GLM 5.2 pela flatkey: 60% do preço oficial, em computação dedicada própria. Compatível com OpenAI. Uma linha para trocar.",
      primaryCta: "Comece com GLM 5.2 - crédito grátis",
      secondaryCta: "Ver preços",
      trustLine: "Sem cartão para começar · compatível com OpenAI · troque em uma linha",
    },
    visual: {
      status: {
        openai: "demo de compatibilidade",
        claude: "roteamento Claude Code CLI",
        curl: "destino do modelo GLM 5.2",
      },
      tabs: ["OpenAI SDK", "Claude Code CLI", "curl"],
      compatibility: "Use o padrão do SDK OpenAI ou roteie Claude Code CLI pela flatkey.",
      priceSignal: `flatkey ${GLM_FLATKEY_PERCENT} · oficial ${GLM_OFFICIAL_PERCENT}`,
      terminalTitle: "Exemplo API",
    },
    reasonsKicker: "Por que flatkey para GLM 5.2",
    reasonsTitle: "Dois motivos, sem pegadinha",
    reasons: [
      {
        title: "60% do preço oficial",
        body: "A mesma superfície de API GLM 5.2, cobrada a 60% do preço oficial. Preço por token transparente, sem mínimo, pague conforme usa.",
      },
      {
        title: "Computação dedicada própria",
        body: "Rodamos GLM 5.2 em capacidade GPU própria, não em uma camada fina de revenda. Mais estabilidade quando o volume cresce.",
      },
    ],
    pricing: {
      kicker: "Preço",
      title: "Pague 60%. Receba 100%.",
      subtitle: "A mesma forma de requisição GLM 5.2. Você apenas paga menos em cada chamada.",
      officialLabel: "GLM 5.2 oficial",
      flatkeyLabel: "GLM 5.2 na flatkey",
      saveLine: "Economize 40% em cada chamada GLM 5.2",
      footnote: "A promessa de preço segue a campanha. Confira a configuração de cobrança ao vivo antes do lançamento.",
    },
    code: {
      kicker: "Código direto",
      title: "Troque apenas a base URL",
      subtitle: "Mantenha o SDK OpenAI ou o fluxo do Claude Code CLI. Envie o tráfego para a flatkey e defina o modelo.",
      model: GLM_MODEL_ID,
    },
    featuresKicker: "Feito para converter tráfego pago",
    featuresTitle: "Tudo que um dev espera antes de testar um modelo",
    features: [
      { title: "OpenAI SDK + Claude Code CLI", body: "Use chat completions no código, ou roteie Claude Code CLI pela mesma conta flatkey." },
      { title: "Capacidade GPU própria", body: "Uma faixa GLM dedicada dá mais previsibilidade para campanhas com volume." },
      { title: "40% mais barato", body: "Valor claro: a flatkey cobra GLM 5.2 a 60% do preço oficial." },
      { title: "Pague em USD ou local", body: "Recargas e faturamento simples sem manter várias contas de provedores." },
      { title: "40+ outros modelos", body: "Uma chave testa GLM, GPT, Claude, Gemini, vídeo, imagem e mais." },
      { title: "Crédito grátis inicial", body: "Crie uma chave e faça a primeira chamada GLM 5.2 rapidamente." },
    ],
    finalCta: {
      title: "Lance GLM 5.2 sem refazer seu stack",
      body: "Crie uma chave flatkey, aponte seu cliente compatível OpenAI para nosso router e teste GLM 5.2 em computação dedicada.",
      button: "Obter minha chave GLM 5.2",
    },
    faqs: [
      {
        question: "É o mesmo modelo que o GLM 5.2 oficial?",
        answer: "A página mira o uso de API compatível GLM 5.2 pela flatkey. Confirme a disponibilidade exata no dashboard antes de produção.",
      },
      { question: "Preciso reescrever OpenAI SDK ou Claude Code CLI?", answer: "Não. Use a base URL compatível OpenAI, mantenha o SDK e defina model como glm-5.2. Claude Code CLI também pode passar pela flatkey." },
      {
        question: "Para quem é esta página?",
        answer: "Devs vindos de Google, Reddit e campanhas regionais que buscam uma GLM 5.2 API barata com integração familiar.",
      },
    ],
  },
  ru: {
    ...english,
    seo: {
      title: "GLM 5.2 API на 40% дешевле официальной цены",
      description:
        "Используйте GLM 5.2 API через flatkey.ai за 60% официальной цены: OpenAI-compatible, выделенные собственные GPU и один API-ключ.",
    },
    badge: "GLM 5.2 уже доступна",
    hero: {
      eyebrow: "GLM 5.2 API для команд, снижающих стоимость",
      title: "GLM 5.2 API на",
      highlight: "40% дешевле официальной",
      subtitle:
        "Запускайте GLM 5.2 через flatkey: 60% официальной цены, выделенные self-hosted вычисления, OpenAI-compatible, переход в одну строку.",
      primaryCta: "Начать с GLM 5.2 - бесплатный кредит",
      secondaryCta: "Смотреть цены",
      trustLine: "Без карты на старте · OpenAI-compatible · переход в одну строку",
    },
    visual: {
      status: {
        openai: "пример совместимого подключения",
        claude: "маршрутизация Claude Code CLI",
        curl: "целевая модель GLM 5.2",
      },
      tabs: ["OpenAI SDK", "Claude Code CLI", "curl"],
      compatibility: "Используйте паттерн OpenAI SDK или маршрутизируйте Claude Code CLI через flatkey.",
      priceSignal: `flatkey ${GLM_FLATKEY_PERCENT} · official ${GLM_OFFICIAL_PERCENT}`,
      terminalTitle: "Пример API",
    },
    reasonsKicker: "Почему flatkey для GLM 5.2",
    reasonsTitle: "Две причины, без подвоха",
    reasons: [
      {
        title: "60% официальной цены",
        body: "Та же API-поверхность GLM 5.2, тарификация на уровне 60% официальной цены. Прозрачная цена за токены без минимального платежа.",
      },
      {
        title: "Выделенные собственные вычисления",
        body: "Мы запускаем GLM 5.2 на собственной GPU-емкости, а не в тонком reseller-слое. Команды получают более понятный путь эксплуатации перед переносом campaign traffic в production.",
      },
    ],
    pricing: {
      kicker: "Цена",
      title: "Платите 60%. Получаете 100%.",
      subtitle: "Та же форма запроса GLM 5.2. Просто дешевле каждый вызов.",
      officialLabel: "Официальная GLM 5.2",
      flatkeyLabel: "GLM 5.2 на flatkey",
      saveLine: "Экономьте 40% на каждом вызове GLM 5.2",
      footnote: "Ценовое обещание относится к кампании. Перед запуском проверьте актуальную биллинговую конфигурацию.",
    },
    code: {
      kicker: "Drop-in код",
      title: "Поменяйте только base URL",
      subtitle: "Оставьте OpenAI SDK или workflow Claude Code CLI. Направьте трафик в flatkey и задайте модель.",
      model: GLM_MODEL_ID,
    },
    featuresKicker: "Для конверсии платного трафика",
    featuresTitle: "Все, что разработчик ожидает перед пробой модели",
    features: [
      { title: "OpenAI SDK + Claude Code CLI", body: "Используйте chat completions в коде или маршрутизируйте Claude Code CLI через тот же аккаунт flatkey." },
      { title: "Собственные GPU", body: "Выделенный GLM lane дает больший запас для кампаний с объемом." },
      { title: "На 40% дешевле", body: "Позиционирование ясно: flatkey тарифицирует GLM 5.2 как 60% official." },
      { title: "USD или локальная оплата", body: "Пополнения и биллинг без множества аккаунтов провайдеров." },
      { title: "40+ других моделей", body: "Один ключ для GLM, GPT, Claude, Gemini, видео, изображений и не только." },
      { title: "Бесплатный кредит", body: "Быстро создайте ключ и сделайте первый вызов GLM 5.2." },
    ],
    finalCta: {
      title: "Запустите GLM 5.2 без переделки стека",
      body: "Создайте flatkey API key, направьте OpenAI-compatible клиент на наш router и тестируйте GLM 5.2 на выделенных вычислениях.",
      button: "Получить ключ GLM 5.2",
    },
    faqs: [
      {
        question: "Это та же модель, что официальная GLM 5.2?",
        answer: "Страница описывает GLM 5.2 compatible API через flatkey. Перед production проверьте точную доступность runtime в dashboard.",
      },
      { question: "Нужно переписывать OpenAI SDK или Claude Code CLI?", answer: "Нет. Используйте OpenAI-compatible base URL, сохраните SDK и задайте model как glm-5.2. Claude Code CLI также можно направить через flatkey." },
      {
        question: "Для кого эта страница?",
        answer: "Для разработчиков из Google, Reddit и региональных кампаний, которым нужен более дешевый GLM 5.2 API key с привычной интеграцией.",
      },
    ],
  },
  ja: {
    ...english,
    seo: {
      title: "GLM 5.2 APIを公式価格より40%安く",
      description:
        "flatkey.aiでGLM 5.2 APIを公式価格の60%で利用。OpenAI互換、専用セルフホスト計算基盤、プロダクション向けAPIキー。",
    },
    badge: "GLM 5.2 提供中",
    hero: {
      eyebrow: "コストを下げたい開発者向けのGLM 5.2 API",
      title: "GLM 5.2 APIを",
      highlight: "公式より40%安く",
      subtitle:
        "話題のGLM 5.2をflatkey経由で実行。公式価格の60%、専用セルフホスト計算基盤、OpenAI互換。切り替えは1行です。",
      primaryCta: "GLM 5.2を始める - 無料クレジット",
      secondaryCta: "料金を見る",
      trustLine: "カード不要で開始 · OpenAI互換 · 1行で切り替え",
    },
    visual: {
      status: {
        openai: "互換接続デモ",
        claude: "Claude Code CLIルーティング",
        curl: "GLM 5.2モデル指定",
      },
      tabs: ["OpenAI SDK", "Claude Code CLI", "curl"],
      compatibility: "OpenAI SDKのパターンを維持し、Claude Code CLIの利用もflatkey経由にできます。",
      priceSignal: `flatkey ${GLM_FLATKEY_PERCENT} · official ${GLM_OFFICIAL_PERCENT}`,
      terminalTitle: "API例",
    },
    reasonsKicker: "GLM 5.2にflatkeyを選ぶ理由",
    reasonsTitle: "理由は2つ、裏はありません",
    reasons: [
      {
        title: "公式価格の60%",
        body: "同じGLM 5.2 APIサーフェスを公式価格の60%で課金。透明なトークン単価、最低利用額なし、従量課金です。",
      },
      {
        title: "専用セルフホスト計算基盤",
        body: "GLM 5.2を自社GPU容量で実行します。薄い転売レイヤーではなく、キャンペーン流入を本番へ移す前の運用経路を明確にできます。",
      },
    ],
    pricing: {
      kicker: "料金",
      title: "60%払って、100%使う。",
      subtitle: "同じGLM 5.2リクエスト形式。各呼び出しのコストだけが下がります。",
      officialLabel: "公式GLM 5.2",
      flatkeyLabel: "flatkey上のGLM 5.2",
      saveLine: "GLM 5.2の各呼び出しで40%節約",
      footnote: "価格表示はキャンペーン条件に基づきます。公開前に最新の課金設定を再確認してください。",
    },
    code: {
      kicker: "差し替えコード",
      title: "base URLだけを変更",
      subtitle: "OpenAI SDKまたはClaude Code CLIのワークフローを維持し、トラフィックをflatkeyへ向けてモデル名を指定します。",
      model: GLM_MODEL_ID,
    },
    featuresKicker: "広告流入の転換向け",
    featuresTitle: "開発者が試す前に確認したい情報を網羅",
    features: [
      { title: "OpenAI SDK + Claude Code CLI", body: "コードではchat completionsを使い、Claude Code CLIの利用も同じflatkeyアカウントへルーティングできます。" },
      { title: "自社GPU容量", body: "専用GLMレーンでボリュームのあるキャンペーンにも余裕を持たせます。" },
      { title: "40%安い", body: "flatkeyはGLM 5.2を公式価格の60%で課金する、と明確に訴求できます。" },
      { title: "USDまたは現地決済", body: "複数プロバイダーの口座管理なしで、チャージと請求を簡素化します。" },
      { title: "40以上のモデル", body: "1つのキーでGLM、GPT、Claude、Gemini、動画、画像などを試せます。" },
      { title: "無料クレジット開始", body: "キーを作成し、最初のGLM 5.2呼び出しまで素早く進めます。" },
    ],
    finalCta: {
      title: "スタックを変えずにGLM 5.2を開始",
      body: "flatkey APIキーを作成し、OpenAI互換クライアントをrouterに向けるだけで、専用計算基盤上のGLM 5.2を試せます。",
      button: "GLM 5.2キーを取得",
    },
    faqs: [
      {
        question: "公式GLM 5.2と同じモデルですか？",
        answer: "このページはflatkey経由のGLM 5.2互換API利用を対象にしています。本番前にダッシュボードで正確な可用性を確認してください。",
      },
      { question: "OpenAI SDKやClaude Code CLIを書き直す必要はありますか？", answer: "ありません。OpenAI互換base URLを使い、SDKを維持してmodelをglm-5.2に設定します。Claude Code CLIの利用もflatkey経由にできます。" },
      {
        question: "誰向けのページですか？",
        answer: "Google、Reddit、地域キャンペーンから来る、安価なGLM 5.2 APIキーと慣れた接続方法を求める開発者向けです。",
      },
    ],
  },
  vi: {
    ...english,
    seo: {
      title: "GLM 5.2 API rẻ hơn chính thức 40%",
      description:
        "Dùng GLM 5.2 API qua flatkey.ai với 60% giá chính thức. Tương thích OpenAI, compute tự vận hành chuyên dụng và một API key cho production.",
    },
    badge: "GLM 5.2 đã sẵn sàng",
    hero: {
      eyebrow: "GLM 5.2 API cho đội muốn giảm chi phí",
      title: "GLM 5.2 API với",
      highlight: "giảm 40% so với chính thức",
      subtitle:
        "Chạy GLM 5.2 qua flatkey: 60% giá chính thức, trên compute tự vận hành chuyên dụng. Tương thích OpenAI. Đổi chỉ một dòng.",
      primaryCta: "Bắt đầu GLM 5.2 - có credit miễn phí",
      secondaryCta: "Xem giá",
      trustLine: "Không cần thẻ để bắt đầu · tương thích OpenAI · đổi trong một dòng",
    },
    visual: {
      status: {
        openai: "demo tương thích",
        claude: "định tuyến Claude Code CLI",
        curl: "đích model GLM 5.2",
      },
      tabs: ["OpenAI SDK", "Claude Code CLI", "curl"],
      compatibility: "Dùng pattern OpenAI SDK hoặc định tuyến Claude Code CLI qua flatkey.",
      priceSignal: `flatkey ${GLM_FLATKEY_PERCENT} · official ${GLM_OFFICIAL_PERCENT}`,
      terminalTitle: "Ví dụ API",
    },
    reasonsKicker: "Vì sao chọn flatkey cho GLM 5.2",
    reasonsTitle: "Hai lý do, không bẫy",
    reasons: [
      {
        title: "60% giá chính thức",
        body: "Cùng bề mặt API GLM 5.2, tính phí ở mức 60% giá chính thức. Giá theo token minh bạch, không tối thiểu, dùng bao nhiêu trả bấy nhiêu.",
      },
      {
        title: "Compute tự vận hành chuyên dụng",
        body: "GLM 5.2 chạy trên dung lượng GPU của chúng tôi, không phải lớp reseller mỏng. Đội ngũ có đường vận hành rõ hơn trước khi đưa traffic campaign vào production.",
      },
    ],
    pricing: {
      kicker: "Giá",
      title: "Trả 60%. Nhận 100%.",
      subtitle: "Cùng dạng request GLM 5.2. Bạn chỉ trả ít hơn cho mỗi lượt gọi.",
      officialLabel: "GLM 5.2 chính thức",
      flatkeyLabel: "GLM 5.2 trên flatkey",
      saveLine: "Tiết kiệm 40% cho mỗi lượt gọi GLM 5.2",
      footnote: "Cam kết giá theo offer chiến dịch. Kiểm tra lại cấu hình billing trực tiếp trước khi launch.",
    },
    code: {
      kicker: "Code thả vào",
      title: "Đổi một base URL",
      subtitle: "Giữ OpenAI SDK hoặc workflow Claude Code CLI. Trỏ traffic về flatkey và đặt tên model.",
      model: GLM_MODEL_ID,
    },
    featuresKicker: "Tối ưu cho chuyển đổi traffic trả phí",
    featuresTitle: "Những điều dev cần trước khi thử model",
    features: [
      { title: "OpenAI SDK + Claude Code CLI", body: "Dùng chat completions trong code, hoặc định tuyến Claude Code CLI qua cùng tài khoản flatkey." },
      { title: "Dung lượng GPU riêng", body: "Lane GLM chuyên dụng giúp campaign volume có headroom dễ dự đoán hơn." },
      { title: "Rẻ hơn 40%", body: "Thông điệp rõ: flatkey tính GLM 5.2 ở 60% giá chính thức." },
      { title: "Thanh toán USD hoặc local", body: "Top-up và billing đơn giản, không phải quản lý nhiều tài khoản provider." },
      { title: "40+ model khác", body: "Một key thử GLM, GPT, Claude, Gemini, video, image và hơn thế." },
      { title: "Credit miễn phí để bắt đầu", body: "Tạo key và gọi GLM 5.2 lần đầu thật nhanh." },
    ],
    finalCta: {
      title: "Ra mắt GLM 5.2 mà không đổi stack",
      body: "Tạo một flatkey API key, trỏ client OpenAI-compatible tới router, rồi thử GLM 5.2 trên compute chuyên dụng.",
      button: "Lấy key GLM 5.2",
    },
    faqs: [
      {
        question: "Đây có phải cùng model với GLM 5.2 chính thức không?",
        answer: "Trang này nhắm tới việc dùng API tương thích GLM 5.2 qua flatkey. Hãy xác nhận runtime availability trong dashboard trước production.",
      },
      { question: "Có cần viết lại OpenAI SDK hoặc Claude Code CLI không?", answer: "Không. Dùng base URL tương thích OpenAI, giữ SDK, đặt model là glm-5.2. Claude Code CLI cũng có thể đi qua flatkey." },
      {
        question: "Trang này dành cho ai?",
        answer: "Dev đến từ Google, Reddit và campaign khu vực, cần GLM 5.2 API key rẻ hơn cùng cách tích hợp quen thuộc.",
      },
    ],
  },
  de: {
    ...english,
    seo: {
      title: "GLM 5.2 API mit 40% Rabatt auf den offiziellen Preis",
      description:
        "Nutze die GLM 5.2 API ueber flatkey.ai fuer 60% des offiziellen Preises. OpenAI-kompatibel, dedizierte eigene Compute-Kapazitaet und ein API-Key.",
    },
    badge: "GLM 5.2 live",
    hero: {
      eyebrow: "GLM 5.2 API fuer Teams mit niedrigeren Kosten",
      title: "GLM 5.2 API mit",
      highlight: "40% Rabatt auf offiziell",
      subtitle:
        "Fuehre GLM 5.2 ueber flatkey aus: 60% des offiziellen Preises, auf dedizierter eigener Compute-Kapazitaet. OpenAI-kompatibel. Ein Zeilenwechsel.",
      primaryCta: "Mit GLM 5.2 starten - kostenloses Guthaben",
      secondaryCta: "Preise ansehen",
      trustLine: "Keine Karte zum Start · OpenAI-kompatibel · Wechsel in einer Zeile",
    },
    visual: {
      status: {
        openai: "kompatible Integrationsdemo",
        claude: "Claude Code CLI Routing",
        curl: "GLM 5.2 Modellziel",
      },
      tabs: ["OpenAI SDK", "Claude Code CLI", "curl"],
      compatibility: "Nutze das OpenAI-SDK-Muster oder route Claude Code CLI ueber flatkey.",
      priceSignal: `flatkey ${GLM_FLATKEY_PERCENT} · official ${GLM_OFFICIAL_PERCENT}`,
      terminalTitle: "API-Beispiel",
    },
    reasonsKicker: "Warum flatkey fuer GLM 5.2",
    reasonsTitle: "Zwei Gruende, kein Haken",
    reasons: [
      {
        title: "60% des offiziellen Preises",
        body: "Dieselbe GLM 5.2 API-Oberflaeche, abgerechnet zu 60% des offiziellen Preises. Transparente Token-Preise, kein Minimum.",
      },
      {
        title: "Dedizierte eigene Compute-Kapazitaet",
        body: "Wir betreiben GLM 5.2 auf eigener GPU-Kapazitaet, nicht als duenne Reseller-Schicht. Teams erhalten vor Kampagnen-Traffic in Production einen klareren Betriebsweg.",
      },
    ],
    pricing: {
      kicker: "Preis",
      title: "Zahle 60%. Erhalte 100%.",
      subtitle: "Dieselbe GLM 5.2 Request-Form. Du zahlst nur weniger pro Aufruf.",
      officialLabel: "Offizielles GLM 5.2",
      flatkeyLabel: "GLM 5.2 auf flatkey",
      saveLine: "Spare 40% bei jedem GLM 5.2 Aufruf",
      footnote: "Die Preiszusage folgt dem Kampagnenangebot. Vor Launch die Live-Billing-Konfiguration pruefen.",
    },
    code: {
      kicker: "Drop-in Code",
      title: "Nur die base URL wechseln",
      subtitle: "Behalte OpenAI SDK oder Claude-Code-Workflow. Route Traffic zu flatkey und setze den Modellnamen.",
      model: GLM_MODEL_ID,
    },
    featuresKicker: "Fuer bezahlten Traffic, der konvertiert",
    featuresTitle: "Alles, was Entwickler vor dem Modelltest erwarten",
    features: [
      { title: "OpenAI SDK + Claude Code CLI", body: "Nutze chat completions im Code oder route Claude Code CLI ueber denselben flatkey Account." },
      { title: "Eigene GPU-Kapazitaet", body: "Eine dedizierte GLM Lane schafft planbaren Headroom fuer Volumen-Kampagnen." },
      { title: "40% guenstiger", body: "Klares Value Prop: flatkey berechnet GLM 5.2 zu 60% des offiziellen Preises." },
      { title: "USD oder lokal zahlen", body: "Einfache Top-ups und Kontoabrechnung ohne mehrere Provider-Accounts." },
      { title: "40+ weitere Modelle", body: "Ein Key testet GLM, GPT, Claude, Gemini, Video, Bild und mehr." },
      { title: "Kostenloses Startguthaben", body: "Key erstellen und den ersten GLM 5.2 Call schnell ausfuehren." },
    ],
    finalCta: {
      title: "GLM 5.2 starten, ohne den Stack umzubauen",
      body: "Erstelle einen flatkey API-Key, zeige deinen OpenAI-kompatiblen Client auf unseren Router und teste GLM 5.2 auf dedizierter Compute-Kapazitaet.",
      button: "GLM 5.2 Key holen",
    },
    faqs: [
      {
        question: "Ist das dasselbe Modell wie offizielles GLM 5.2?",
        answer: "Die Seite zielt auf GLM 5.2 kompatible API-Nutzung ueber flatkey. Pruefe die genaue Runtime-Verfuegbarkeit im Dashboard vor Produktion.",
      },
      { question: "Muss ich OpenAI SDK oder Claude Code CLI neu schreiben?", answer: "Nein. Nutze die OpenAI-kompatible base URL, behalte das SDK und setze model auf glm-5.2. Claude Code CLI kann ebenfalls ueber flatkey laufen." },
      {
        question: "Fuer wen ist diese Seite?",
        answer: "Fuer Entwickler aus Google-, Reddit- und regionalen Kampagnen, die einen guenstigeren GLM 5.2 API-Key mit vertrauter Integration wollen.",
      },
    ],
  },
};

export function getGlmLandingPageCopy(locale: Locale): GlmLandingPageCopy {
  return translations[locale] ?? translations.en;
}

export function getGlmLandingMetadataInput(locale: Locale): SeoInput {
  const copy = getGlmLandingPageCopy(locale);
  return {
    title: copy.seo.title,
    description: copy.seo.description,
    pathname: GLM_LANDING_PATH,
    locale,
  };
}

export function getGlmLandingCtaUrl(origin = APP_CONSOLE_ORIGIN): string {
  return buildConsoleUrl("/sign-up", origin, "redirect=/keys");
}
