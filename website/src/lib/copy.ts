import type { Locale } from "./locales";
import { BLOG_COPY, type BlogCopy } from "./blog-copy";

type Copy = {
  nav: {
    pricing: string;
    modelPricing: string;
    home: string;
    console: string;
    rankings: string;
    blog: string;
    about: string;
    app: string;
    signIn: string;
    toggle: string;
    toggleTheme: string;
    light: string;
    dark: string;
    system: string;
    notifications: string;
    systemAnnouncements: string;
    latestPlatformUpdates: string;
    notice: string;
    timeline: string;
    noAnnouncements: string;
    noSystemAnnouncements: string;
    loading: string;
    close: string;
  };
  home: {
    title: string;
    description: string;
    primary: string;
    secondary: string;
    hero: {
      badge: string;
      titleLine1: string;
      titleLine2: string;
      toolsLabel: string;
      toolsDescription: string;
      moreApps: string;
    };
    stats: {
      items: { value: string; label: string }[];
    };
    features: {
      eyebrow: string;
      titleLine1: string;
      titleLine2: string;
      items: { title: string; desc: string }[];
    };
    models: {
      title: string;
      description: string;
      tag: string;
    };
    about: {
      eyebrow: string;
      title: string;
      description: string;
      items: { title: string; desc: string }[];
    };
    productHighlights: {
      eyebrow: string;
      title: string;
      description: string;
      items: { title: string; desc: string }[];
    };
    howItWorks: {
      eyebrow: string;
      title: string;
      steps: { num: string; title: string; desc: string }[];
    };
    cta: {
      titleLine1: string;
      titleLine2: string;
      description: string;
    };
    terminal: {
      request: string;
      response: string;
      cost: string;
      tokens: string;
      ms: string;
      responses: Record<string, string>;
    };
  };
  footer: {
    tagline: string;
    trustedVerifiedBy: string;
    emailSupport: string;
    termsOfService: string;
    privacyPolicy: string;
    serviceLevelAgreement: string;
    refundPolicy: string;
    supportEmail: string;
    defaultCopyright: string;
    projectAttributionSuffix: string;
  };
  blog: BlogCopy;
};

export type HomeTerminalCopy = Copy["home"]["terminal"];

type BaseCopy = Omit<Copy, "blog">;

const copies: Record<Locale, BaseCopy> = {
  en: {
    nav: {
      pricing: "Pricing",
      modelPricing: "Models",
      home: "Home",
      console: "Console",
      rankings: "Rankings",
      blog: "Blog",
      about: "About",
      app: "Open app",
      signIn: "Sign in",
      toggle: "Toggle navigation menu",
      toggleTheme: "Toggle theme",
      light: "Light",
      dark: "Dark",
      system: "System",
      notifications: "Notifications",
      systemAnnouncements: "System Announcements",
      latestPlatformUpdates: "Latest platform updates and notices",
      notice: "Notice",
      timeline: "Timeline",
      noAnnouncements: "No announcements at this time",
      noSystemAnnouncements: "No system announcements",
      loading: "Loading...",
      close: "Close",
    },
    home: {
      title: "One API gateway for production AI teams",
      description:
        "flatkey.ai unifies model access, routing, billing, usage analytics, and operational controls for teams shipping AI products.",
      primary: "Get a key",
      secondary: "View Pricing",
      hero: {
        badge: "Multi-model compatible, enterprise-ready",
        titleLine1: "Every model.",
        titleLine2: "One key. Flat rate.",
        toolsLabel: "Works with your current tools",
        toolsDescription: "Supports one-click configuration and perfectly adapts to NewAPI multi-protocol configuration.",
        moreApps: "More Apps",
      },
      stats: {
        items: [
          { value: "200+", label: "models behind one key" },
          { value: "1", label: "OpenAI-compatible base URL" },
          { value: "24/7", label: "usage and billing visibility" },
          { value: "1", label: "dashboard for keys and routing" },
        ],
      },
      features: {
        eyebrow: "Why flatkey",
        titleLine1: "One place for access,",
        titleLine2: "pricing, and control",
        items: [
          {
            title: "One-click access",
            desc: "Get one API key and call every connected AI model without applying for each provider separately.",
          },
          {
            title: "Stable and reliable",
            desc: "Intelligently route multiple upstream accounts with automatic switching and load balancing to avoid frequent errors.",
          },
          {
            title: "Pay as you go",
            desc: "Bill by actual usage, set quota limits, and keep team consumption clear at a glance.",
          },
        ],
      },
      models: {
        title: "Recommended AI models",
        description: "Curated top models selected by the flatkey community",
        tag: "text-to-text",
      },
      about: {
        eyebrow: "About flatkey.ai",
        title: "A unified API layer for modern AI products",
        description:
          "flatkey.ai provides hosted software and prepaid account balance for metered AI API usage. Usage charges are calculated from model input, output, and cache-hit prices multiplied by token usage.",
        items: [
          {
            title: "What flatkey.ai is",
            desc: "flatkey.ai is a unified AI API gateway that lets teams call supported AI models through one API key, one base URL, and one dashboard.",
          },
          {
            title: "Problem it solves",
            desc: "It reduces separate provider accounts, scattered API keys, inconsistent routing, and fragmented usage tracking for teams building AI features.",
          },
          {
            title: "Who uses it",
            desc: "flatkey.ai is built for developers, AI product teams, automation builders, and operations teams that need predictable access to multiple models.",
          },
        ],
      },
      productHighlights: {
        eyebrow: "Product focus",
        title: "Built for teams shipping AI features",
        description:
          "flatkey keeps model access, routing, billing, and usage policy in one place so teams can move faster without extra provider management.",
        items: [
          {
            title: "AI product teams",
            desc: "Add model access to your product without managing separate provider accounts, keys, and SDK changes.",
          },
          {
            title: "Operations and finance",
            desc: "Keep token spend, recharge records, and team usage visible in one dashboard.",
          },
          {
            title: "Automation builders",
            desc: "Route high-volume workflows to suitable models while keeping failures and cost easier to review.",
          },
          {
            title: "Model evaluation and iteration",
            desc: "Compare providers, switch models, and keep existing OpenAI-compatible clients pointed at the same base URL.",
          },
        ],
      },
      howItWorks: {
        eyebrow: "How it fits together",
        title: "From homepage to production calls",
        steps: [
          { num: "1", title: "Get one key", desc: "Create a flatkey account, open the dashboard, and generate an API key for your app." },
          { num: "2", title: "Change the base URL", desc: "Point your OpenAI-compatible client to {{apiBaseUrl}} and keep your existing SDK." },
          { num: "3", title: "Monitor and optimize", desc: "Review usage, cost, routing, and errors from the same product dashboard." },
        ],
      },
      cta: {
        titleLine1: "Ready to replace",
        titleLine2: "model chaos with one key?",
        description: "Start from the flatkey homepage, manage your product dashboard, and keep {{host}} as the stable API endpoint.",
      },
      terminal: {
        request: "Request",
        response: "Response",
        cost: "Cost",
        tokens: "tokens",
        ms: "ms",
        responses: {
          "gpt-chat": "Chat request routed.",
          responses: "Response workflow ready.",
          claude: "Claude message routed.",
          gemini: "Gemini request served.",
        },
      },
    },
    footer: {
      tagline: "Secure, reliable, affordable",
      trustedVerifiedBy: "TRUSTED & VERIFIED BY",
      emailSupport: "Email: support@flatkey.ai",
      termsOfService: "Terms of Service",
      privacyPolicy: "Privacy Policy",
      serviceLevelAgreement: "Service Level Agreement",
      refundPolicy: "Refund Policy",
      supportEmail: "Support: support@flatkey.ai",
      defaultCopyright: "All rights reserved.",
      projectAttributionSuffix: "AI API gateway and model operations platform.",
    },
  },
  zh: {
    nav: {
      pricing: "价格",
      modelPricing: "模型",
      home: "主页",
      console: "控制台",
      rankings: "排行",
      blog: "博客",
      about: "关于",
      app: "打开应用",
      signIn: "登录",
      toggle: "切换导航菜单",
      toggleTheme: "切换主题",
      light: "浅色",
      dark: "深色",
      system: "跟随系统",
      notifications: "通知",
      systemAnnouncements: "系统公告",
      latestPlatformUpdates: "最新平台更新和通知",
      notice: "通知",
      timeline: "时间线",
      noAnnouncements: "目前暂无公告",
      noSystemAnnouncements: "暂无系统公告",
      loading: "加载中...",
      close: "关闭",
    },
    home: {
      title: "面向生产团队的一站式 AI API 网关",
      description: "flatkey.ai 统一模型接入、路由、计费、用量分析和运营控制，帮助团队稳定交付 AI 产品。",
      primary: "获取密钥",
      secondary: "查看定价",
      hero: {
        badge: "兼容多模型，面向企业级场景",
        titleLine1: "所有模型。",
        titleLine2: "一个密钥。统一费率。",
        toolsLabel: "兼容你正在使用的工具",
        toolsDescription: "支持一键配置，并完美适配 NewAPI 多协议配置。",
        moreApps: "更多应用",
      },
      stats: {
        items: [
          { value: "200+", label: "一个密钥接入的模型" },
          { value: "1", label: "兼容 OpenAI 的基础 URL" },
          { value: "24/7", label: "用量与账单可见性" },
          { value: "1", label: "管理密钥与路由的控制台" },
        ],
      },
      features: {
        eyebrow: "为什么选择 flatkey",
        titleLine1: "接入、定价与控制，",
        titleLine2: "集中在一个地方",
        items: [
          {
            title: "一键接入",
            desc: "获取一个 API 密钥，即可调用所有已接入的 AI 模型，无需分别申请各家供应商账号。",
          },
          {
            title: "稳定可靠",
            desc: "智能路由多个上游账号，自动切换与负载均衡，减少频繁报错。",
          },
          {
            title: "按量付费",
            desc: "按实际用量计费，设置额度限制，并让团队消耗一目了然。",
          },
        ],
      },
      models: {
        title: "推荐 AI 模型",
        description: "由 flatkey 社区精选的热门模型",
        tag: "文本转文本",
      },
      about: {
        eyebrow: "关于 flatkey.ai",
        title: "面向现代 AI 产品的统一 API 层",
        description: "flatkey.ai 提供托管软件与预付账户余额，用于按量计费的 AI API 使用。用量费用根据模型输入、输出和缓存命中价格乘以 token 使用量计算。",
        items: [
          {
            title: "flatkey.ai 是什么",
            desc: "flatkey.ai 是统一的 AI API 网关，让团队通过一个 API 密钥、一个基础 URL 和一个控制台调用支持的 AI 模型。",
          },
          {
            title: "解决的问题",
            desc: "它减少团队构建 AI 功能时分散的供应商账号、API 密钥、路由差异和割裂的用量追踪。",
          },
          {
            title: "适用人群",
            desc: "flatkey.ai 面向需要稳定接入多个模型的开发者、AI 产品团队、自动化构建者和运营团队。",
          },
        ],
      },
      productHighlights: {
        eyebrow: "产品重点",
        title: "为交付 AI 功能的团队打造",
        description: "flatkey 将模型接入、路由、计费和用量策略集中管理，让团队无需额外管理供应商也能更快推进。",
        items: [
          {
            title: "AI 产品团队",
            desc: "无需管理分散的供应商账号、密钥和 SDK 变更，即可为产品增加模型能力。",
          },
          {
            title: "运营与财务",
            desc: "在一个控制台中查看 token 支出、充值记录和团队用量。",
          },
          {
            title: "自动化构建者",
            desc: "将高频工作流路由到合适模型，同时更容易复盘失败与成本。",
          },
          {
            title: "模型评估与迭代",
            desc: "比较供应商、切换模型，并让现有兼容 OpenAI 的客户端继续指向同一个基础 URL。",
          },
        ],
      },
      howItWorks: {
        eyebrow: "如何组合使用",
        title: "从官网到生产调用",
        steps: [
          { num: "1", title: "获取一个密钥", desc: "创建 flatkey 账号，打开控制台，为你的应用生成 API 密钥。" },
          { num: "2", title: "更换基础 URL", desc: "将兼容 OpenAI 的客户端指向 {{apiBaseUrl}}，继续使用现有 SDK。" },
          { num: "3", title: "监控并优化", desc: "在同一个产品控制台查看用量、成本、路由和错误。" },
        ],
      },
      cta: {
        titleLine1: "准备好用一个密钥",
        titleLine2: "替代混乱的模型管理了吗？",
        description: "从 flatkey 官网开始，管理你的产品控制台，并将 {{host}} 作为稳定的 API 端点。",
      },
      terminal: {
        request: "请求",
        response: "响应",
        cost: "成本",
        tokens: "token",
        ms: "毫秒",
        responses: {
          "gpt-chat": "聊天请求已路由。",
          responses: "响应工作流已就绪。",
          claude: "Claude 消息已路由。",
          gemini: "Gemini 请求已完成。",
        },
      },
    },
    footer: {
      tagline: "安全、可靠、便宜",
      trustedVerifiedBy: "可信与认证",
      emailSupport: "邮箱：support@flatkey.ai",
      termsOfService: "服务条款",
      privacyPolicy: "隐私政策",
      serviceLevelAgreement: "服务等级协议",
      refundPolicy: "退款政策",
      supportEmail: "支持：support@flatkey.ai",
      defaultCopyright: "保留所有权利。",
      projectAttributionSuffix: "AI API 网关与模型运营平台。",
    },
  },
  es: {
    nav: {
      pricing: "Precios",
      modelPricing: "Modelos",
      home: "Inicio",
      console: "Consola",
      rankings: "Rankings",
      blog: "Blog",
      about: "Acerca de",
      app: "Abrir app",
      signIn: "Iniciar sesión",
      toggle: "Alternar menú de navegación",
      toggleTheme: "Cambiar tema",
      light: "Claro",
      dark: "Oscuro",
      system: "Sistema",
      notifications: "Notificaciones",
      systemAnnouncements: "Anuncios del sistema",
      latestPlatformUpdates: "Últimas actualizaciones y avisos de la plataforma",
      notice: "Aviso",
      timeline: "Cronología",
      noAnnouncements: "No hay anuncios por ahora",
      noSystemAnnouncements: "No hay anuncios del sistema",
      loading: "Cargando...",
      close: "Cerrar",
    },
    home: {
      title: "Una puerta de enlace API para equipos de IA en producción",
      description:
        "flatkey.ai unifica acceso a modelos, enrutamiento, facturación, analítica de uso y controles operativos.",
      primary: "Obtener una clave",
      secondary: "Ver precios",
      hero: {
        badge: "Compatible con múltiples modelos y listo para empresas",
        titleLine1: "Todos los modelos.",
        titleLine2: "Una clave. Tarifa plana.",
        toolsLabel: "Funciona con tus herramientas actuales",
        toolsDescription: "Admite configuración con un clic y se adapta perfectamente a la configuración multiprotocolo de NewAPI.",
        moreApps: "Más apps",
      },
      stats: {
        items: [
          { value: "200+", label: "modelos detrás de una clave" },
          { value: "1", label: "URL base compatible con OpenAI" },
          { value: "24/7", label: "visibilidad de uso y facturación" },
          { value: "1", label: "panel para claves y enrutamiento" },
        ],
      },
      features: {
        eyebrow: "Por qué flatkey",
        titleLine1: "Un solo lugar para acceso,",
        titleLine2: "precios y control",
        items: [
          { title: "Acceso con un clic", desc: "Obtén una clave API y llama a todos los modelos de IA conectados sin solicitar acceso a cada proveedor por separado." },
          { title: "Estable y confiable", desc: "Enruta de forma inteligente varias cuentas upstream con conmutación automática y balanceo de carga para evitar errores frecuentes." },
          { title: "Pago por uso", desc: "Factura por uso real, define límites de cuota y mantén claro el consumo del equipo de un vistazo." },
        ],
      },
      models: {
        title: "Modelos de IA recomendados",
        description: "Modelos destacados seleccionados por la comunidad de flatkey",
        tag: "texto a texto",
      },
      about: {
        eyebrow: "Acerca de flatkey.ai",
        title: "Una capa API unificada para productos de IA modernos",
        description:
          "flatkey.ai ofrece software alojado y saldo prepago para uso medido de API de IA. Los cargos se calculan con los precios de entrada, salida y aciertos de caché del modelo multiplicados por el uso de tokens.",
        items: [
          { title: "Qué es flatkey.ai", desc: "flatkey.ai es una puerta de enlace API de IA unificada que permite a los equipos llamar modelos compatibles con una clave API, una URL base y un panel." },
          { title: "Problema que resuelve", desc: "Reduce cuentas de proveedor separadas, claves API dispersas, enrutamiento inconsistente y seguimiento de uso fragmentado para equipos que crean funciones de IA." },
          { title: "Quién lo usa", desc: "flatkey.ai está creado para desarrolladores, equipos de producto de IA, automatizadores y equipos de operaciones que necesitan acceso predecible a varios modelos." },
        ],
      },
      productHighlights: {
        eyebrow: "Enfoque del producto",
        title: "Diseñado para equipos que lanzan funciones de IA",
        description: "flatkey mantiene acceso a modelos, enrutamiento, facturación y políticas de uso en un solo lugar para que los equipos avancen más rápido sin gestión adicional de proveedores.",
        items: [
          { title: "Equipos de producto de IA", desc: "Añade acceso a modelos a tu producto sin gestionar cuentas de proveedor, claves ni cambios de SDK por separado." },
          { title: "Operaciones y finanzas", desc: "Mantén visibles el gasto de tokens, los registros de recarga y el uso del equipo en un panel." },
          { title: "Constructores de automatización", desc: "Enruta flujos de alto volumen a modelos adecuados mientras facilitas la revisión de fallos y costes." },
          { title: "Evaluación e iteración de modelos", desc: "Compara proveedores, cambia modelos y conserva tus clientes compatibles con OpenAI apuntando a la misma URL base." },
        ],
      },
      howItWorks: {
        eyebrow: "Cómo encaja todo",
        title: "De la página de inicio a llamadas de producción",
        steps: [
          { num: "1", title: "Obtén una clave", desc: "Crea una cuenta de flatkey, abre el panel y genera una clave API para tu app." },
          { num: "2", title: "Cambia la URL base", desc: "Apunta tu cliente compatible con OpenAI a {{apiBaseUrl}} y conserva tu SDK actual." },
          { num: "3", title: "Monitorea y optimiza", desc: "Revisa uso, coste, enrutamiento y errores desde el mismo panel de producto." },
        ],
      },
      cta: {
        titleLine1: "¿Listo para reemplazar",
        titleLine2: "el caos de modelos con una clave?",
        description: "Empieza en la página de flatkey, gestiona tu panel de producto y mantén {{host}} como endpoint API estable.",
      },
      terminal: {
        request: "Solicitud",
        response: "Respuesta",
        cost: "Coste",
        tokens: "tokens",
        ms: "ms",
        responses: {
          "gpt-chat": "Solicitud de chat enrutada.",
          responses: "Flujo de respuestas listo.",
          claude: "Mensaje de Claude enrutado.",
          gemini: "Solicitud de Gemini servida.",
        },
      },
    },
    footer: {
      tagline: "Seguro, fiable y asequible",
      trustedVerifiedBy: "DE CONFIANZA Y VERIFICADO POR",
      emailSupport: "Email: support@flatkey.ai",
      termsOfService: "Términos del servicio",
      privacyPolicy: "Política de privacidad",
      serviceLevelAgreement: "Acuerdo de nivel de servicio",
      refundPolicy: "Política de reembolso",
      supportEmail: "Soporte: support@flatkey.ai",
      defaultCopyright: "Todos los derechos reservados.",
      projectAttributionSuffix: "Gateway de API de IA y plataforma de operaciones de modelos.",
    },
  },
  fr: {
    nav: {
      pricing: "Tarifs",
      modelPricing: "Modèles",
      home: "Accueil",
      console: "Console",
      rankings: "Classements",
      blog: "Blog",
      about: "À propos",
      app: "Ouvrir l'app",
      signIn: "Se connecter",
      toggle: "Basculer le menu de navigation",
      toggleTheme: "Changer le thème",
      light: "Clair",
      dark: "Sombre",
      system: "Système",
      notifications: "Notifications",
      systemAnnouncements: "Annonces système",
      latestPlatformUpdates: "Dernières mises à jour et avis de la plateforme",
      notice: "Avis",
      timeline: "Chronologie",
      noAnnouncements: "Aucune annonce pour le moment",
      noSystemAnnouncements: "Aucune annonce système",
      loading: "Chargement...",
      close: "Fermer",
    },
    home: {
      title: "Une passerelle API pour les équipes IA en production",
      description:
        "flatkey.ai unifie l'accès aux modèles, le routage, la facturation, l'analyse d'usage et les contrôles opérationnels.",
      primary: "Obtenir une clé",
      secondary: "Voir les tarifs",
      hero: {
        badge: "Compatible multi-modèles, prêt pour l'entreprise",
        titleLine1: "Tous les modèles.",
        titleLine2: "Une clé. Un tarif clair.",
        toolsLabel: "Fonctionne avec vos outils actuels",
        toolsDescription: "Prend en charge la configuration en un clic et s'adapte parfaitement à la configuration multiprotocole de NewAPI.",
        moreApps: "Plus d'apps",
      },
      stats: {
        items: [
          { value: "200+", label: "modèles derrière une seule clé" },
          { value: "1", label: "URL de base compatible OpenAI" },
          { value: "24/7", label: "visibilité sur l'usage et la facturation" },
          { value: "1", label: "tableau de bord pour clés et routage" },
        ],
      },
      features: {
        eyebrow: "Pourquoi flatkey",
        titleLine1: "Un seul endroit pour l'accès,",
        titleLine2: "les tarifs et le contrôle",
        items: [
          { title: "Accès en un clic", desc: "Obtenez une clé API et appelez tous les modèles IA connectés sans demander chaque fournisseur séparément." },
          { title: "Stable et fiable", desc: "Routez intelligemment plusieurs comptes upstream avec bascule automatique et équilibrage de charge pour éviter les erreurs fréquentes." },
          { title: "Paiement à l'usage", desc: "Facturez selon l'utilisation réelle, fixez des limites de quota et gardez la consommation de l'équipe lisible." },
        ],
      },
      models: {
        title: "Modèles IA recommandés",
        description: "Modèles phares sélectionnés par la communauté flatkey",
        tag: "texte vers texte",
      },
      about: {
        eyebrow: "À propos de flatkey.ai",
        title: "Une couche API unifiée pour les produits IA modernes",
        description:
          "flatkey.ai fournit un logiciel hébergé et un solde prépayé pour l'usage mesuré des API IA. Les frais sont calculés à partir des prix d'entrée, de sortie et de cache-hit multipliés par l'usage en tokens.",
        items: [
          { title: "Ce qu'est flatkey.ai", desc: "flatkey.ai est une passerelle API IA unifiée qui permet aux équipes d'appeler les modèles pris en charge avec une clé API, une URL de base et un tableau de bord." },
          { title: "Le problème résolu", desc: "Il réduit les comptes fournisseurs séparés, les clés API dispersées, les routages incohérents et le suivi d'usage fragmenté pour les équipes qui créent des fonctions IA." },
          { title: "Qui l'utilise", desc: "flatkey.ai est conçu pour les développeurs, les équipes produit IA, les créateurs d'automatisation et les équipes opérations qui ont besoin d'un accès prévisible à plusieurs modèles." },
        ],
      },
      productHighlights: {
        eyebrow: "Orientation produit",
        title: "Conçu pour les équipes qui livrent des fonctions IA",
        description: "flatkey rassemble l'accès aux modèles, le routage, la facturation et les politiques d'usage pour aider les équipes à avancer plus vite sans gestion fournisseur supplémentaire.",
        items: [
          { title: "Équipes produit IA", desc: "Ajoutez l'accès aux modèles à votre produit sans gérer séparément comptes fournisseurs, clés et changements de SDK." },
          { title: "Opérations et finance", desc: "Gardez les dépenses de tokens, les recharges et l'usage de l'équipe visibles dans un tableau de bord." },
          { title: "Créateurs d'automatisation", desc: "Routez les workflows à fort volume vers les bons modèles tout en facilitant l'analyse des échecs et des coûts." },
          { title: "Évaluation et itération des modèles", desc: "Comparez les fournisseurs, changez de modèle et gardez vos clients compatibles OpenAI sur la même URL de base." },
        ],
      },
      howItWorks: {
        eyebrow: "Comment tout s'assemble",
        title: "De la page d'accueil aux appels en production",
        steps: [
          { num: "1", title: "Obtenir une clé", desc: "Créez un compte flatkey, ouvrez le tableau de bord et générez une clé API pour votre app." },
          { num: "2", title: "Changer l'URL de base", desc: "Pointez votre client compatible OpenAI vers {{apiBaseUrl}} et conservez votre SDK actuel." },
          { num: "3", title: "Surveiller et optimiser", desc: "Consultez usage, coûts, routage et erreurs depuis le même tableau de bord produit." },
        ],
      },
      cta: {
        titleLine1: "Prêt à remplacer",
        titleLine2: "le chaos des modèles par une seule clé ?",
        description: "Commencez depuis la page flatkey, gérez votre tableau de bord produit et gardez {{host}} comme endpoint API stable.",
      },
      terminal: {
        request: "Requête",
        response: "Réponse",
        cost: "Coût",
        tokens: "tokens",
        ms: "ms",
        responses: {
          "gpt-chat": "Requête chat routée.",
          responses: "Workflow de réponse prêt.",
          claude: "Message Claude routé.",
          gemini: "Requête Gemini servie.",
        },
      },
    },
    footer: {
      tagline: "Securise, fiable et abordable",
      trustedVerifiedBy: "FIABLE ET VERIFIE PAR",
      emailSupport: "E-mail : support@flatkey.ai",
      termsOfService: "Conditions d'utilisation",
      privacyPolicy: "Politique de confidentialite",
      serviceLevelAgreement: "Accord de niveau de service",
      refundPolicy: "Politique de remboursement",
      supportEmail: "Support : support@flatkey.ai",
      defaultCopyright: "Tous droits reserves.",
      projectAttributionSuffix: "Passerelle API IA et plateforme d'exploitation des modeles.",
    },
  },
  pt: {
    nav: {
      pricing: "Preços",
      modelPricing: "Modelos",
      home: "Início",
      console: "Console",
      rankings: "Rankings",
      blog: "Blog",
      about: "Sobre",
      app: "Abrir app",
      signIn: "Entrar",
      toggle: "Alternar menu de navegação",
      toggleTheme: "Alternar tema",
      light: "Claro",
      dark: "Escuro",
      system: "Sistema",
      notifications: "Notificações",
      systemAnnouncements: "Anúncios do sistema",
      latestPlatformUpdates: "Últimas atualizações e avisos da plataforma",
      notice: "Aviso",
      timeline: "Linha do tempo",
      noAnnouncements: "Nenhum anúncio no momento",
      noSystemAnnouncements: "Nenhum anúncio do sistema",
      loading: "Carregando...",
      close: "Fechar",
    },
    home: {
      title: "Um gateway de API para equipes de IA em produção",
      description:
        "flatkey.ai unifica acesso a modelos, roteamento, cobrança, análise de uso e controles operacionais.",
      primary: "Obter uma chave",
      secondary: "Ver preços",
      hero: {
        badge: "Compatível com múltiplos modelos e pronto para empresas",
        titleLine1: "Todos os modelos.",
        titleLine2: "Uma chave. Tarifa clara.",
        toolsLabel: "Funciona com suas ferramentas atuais",
        toolsDescription: "Suporta configuração com um clique e se adapta perfeitamente à configuração multiprotocolo do NewAPI.",
        moreApps: "Mais apps",
      },
      stats: {
        items: [
          { value: "200+", label: "modelos por trás de uma chave" },
          { value: "1", label: "URL base compatível com OpenAI" },
          { value: "24/7", label: "visibilidade de uso e cobrança" },
          { value: "1", label: "painel para chaves e roteamento" },
        ],
      },
      features: {
        eyebrow: "Por que flatkey",
        titleLine1: "Um só lugar para acesso,",
        titleLine2: "preços e controle",
        items: [
          { title: "Acesso com um clique", desc: "Obtenha uma chave de API e chame todos os modelos de IA conectados sem solicitar cada provedor separadamente." },
          { title: "Estável e confiável", desc: "Roteie várias contas upstream de forma inteligente com troca automática e balanceamento de carga para evitar erros frequentes." },
          { title: "Pague conforme o uso", desc: "Cobre pelo uso real, defina limites de cota e mantenha o consumo da equipe claro rapidamente." },
        ],
      },
      models: {
        title: "Modelos de IA recomendados",
        description: "Principais modelos selecionados pela comunidade flatkey",
        tag: "texto para texto",
      },
      about: {
        eyebrow: "Sobre flatkey.ai",
        title: "Uma camada de API unificada para produtos modernos de IA",
        description:
          "flatkey.ai fornece software hospedado e saldo pré-pago para uso medido de API de IA. As cobranças são calculadas com preços de entrada, saída e acertos de cache do modelo multiplicados pelo uso de tokens.",
        items: [
          { title: "O que é flatkey.ai", desc: "flatkey.ai é um gateway de API de IA unificado que permite às equipes chamar modelos compatíveis com uma chave de API, uma URL base e um painel." },
          { title: "Problema que resolve", desc: "Reduz contas de provedores separadas, chaves de API dispersas, roteamento inconsistente e rastreamento de uso fragmentado para equipes que criam recursos de IA." },
          { title: "Quem usa", desc: "flatkey.ai foi criado para desenvolvedores, equipes de produto de IA, criadores de automação e equipes de operações que precisam de acesso previsível a vários modelos." },
        ],
      },
      productHighlights: {
        eyebrow: "Foco do produto",
        title: "Criado para equipes que lançam recursos de IA",
        description: "flatkey mantém acesso a modelos, roteamento, cobrança e políticas de uso em um só lugar para que as equipes avancem mais rápido sem gestão extra de provedores.",
        items: [
          { title: "Equipes de produto de IA", desc: "Adicione acesso a modelos ao seu produto sem gerenciar contas de provedores, chaves e mudanças de SDK separadas." },
          { title: "Operações e finanças", desc: "Mantenha gastos de tokens, registros de recarga e uso da equipe visíveis em um painel." },
          { title: "Criadores de automação", desc: "Roteie fluxos de alto volume para modelos adequados enquanto facilita a análise de falhas e custos." },
          { title: "Avaliação e iteração de modelos", desc: "Compare provedores, troque modelos e mantenha clientes compatíveis com OpenAI apontados para a mesma URL base." },
        ],
      },
      howItWorks: {
        eyebrow: "Como tudo se conecta",
        title: "Da página inicial às chamadas em produção",
        steps: [
          { num: "1", title: "Obtenha uma chave", desc: "Crie uma conta flatkey, abra o painel e gere uma chave de API para seu app." },
          { num: "2", title: "Altere a URL base", desc: "Aponte seu cliente compatível com OpenAI para {{apiBaseUrl}} e mantenha seu SDK atual." },
          { num: "3", title: "Monitore e otimize", desc: "Revise uso, custo, roteamento e erros no mesmo painel de produto." },
        ],
      },
      cta: {
        titleLine1: "Pronto para trocar",
        titleLine2: "o caos de modelos por uma chave?",
        description: "Comece pela página da flatkey, gerencie seu painel de produto e mantenha {{host}} como endpoint de API estável.",
      },
      terminal: {
        request: "Requisição",
        response: "Resposta",
        cost: "Custo",
        tokens: "tokens",
        ms: "ms",
        responses: {
          "gpt-chat": "Requisição de chat roteada.",
          responses: "Fluxo de resposta pronto.",
          claude: "Mensagem Claude roteada.",
          gemini: "Requisição Gemini atendida.",
        },
      },
    },
    footer: {
      tagline: "Seguro, confiavel e acessivel",
      trustedVerifiedBy: "CONFIAVEL E VERIFICADO POR",
      emailSupport: "Email: support@flatkey.ai",
      termsOfService: "Termos de serviço",
      privacyPolicy: "Politica de privacidade",
      serviceLevelAgreement: "Acordo de nivel de servico",
      refundPolicy: "Politica de reembolso",
      supportEmail: "Suporte: support@flatkey.ai",
      defaultCopyright: "Todos os direitos reservados.",
      projectAttributionSuffix: "Gateway de API de IA e plataforma de operacoes de modelos.",
    },
  },
  ru: {
    nav: {
      pricing: "Цены",
      modelPricing: "Модели",
      home: "Главная",
      console: "Консоль",
      rankings: "Рейтинги",
      blog: "Блог",
      about: "О нас",
      app: "Открыть приложение",
      signIn: "Войти",
      toggle: "Переключить меню навигации",
      toggleTheme: "Переключить тему",
      light: "Светлая",
      dark: "Темная",
      system: "Системная",
      notifications: "Уведомления",
      systemAnnouncements: "Системные объявления",
      latestPlatformUpdates: "Последние обновления и уведомления платформы",
      notice: "Уведомление",
      timeline: "Хронология",
      noAnnouncements: "Сейчас нет объявлений",
      noSystemAnnouncements: "Нет системных объявлений",
      loading: "Загрузка...",
      close: "Закрыть",
    },
    home: {
      title: "Единый API-шлюз для AI-команд в продакшене",
      description:
        "flatkey.ai объединяет доступ к моделям, маршрутизацию, биллинг, аналитику использования и операционный контроль.",
      primary: "Получить ключ",
      secondary: "Смотреть цены",
      hero: {
        badge: "Совместимость с разными моделями, готово для бизнеса",
        titleLine1: "Все модели.",
        titleLine2: "Один ключ. Единый тариф.",
        toolsLabel: "Работает с вашими текущими инструментами",
        toolsDescription: "Поддерживает настройку в один клик и точно адаптируется к мультипротокольной конфигурации NewAPI.",
        moreApps: "Больше приложений",
      },
      stats: {
        items: [
          { value: "200+", label: "моделей за одним ключом" },
          { value: "1", label: "базовый URL, совместимый с OpenAI" },
          { value: "24/7", label: "прозрачность использования и биллинга" },
          { value: "1", label: "панель для ключей и маршрутизации" },
        ],
      },
      features: {
        eyebrow: "Почему flatkey",
        titleLine1: "Одна точка для доступа,",
        titleLine2: "цен и контроля",
        items: [
          { title: "Доступ в один клик", desc: "Получите один API-ключ и вызывайте все подключенные AI-модели без отдельных заявок к каждому провайдеру." },
          { title: "Стабильно и надежно", desc: "Интеллектуально маршрутизируйте несколько upstream-аккаунтов с автоматическим переключением и балансировкой нагрузки, чтобы избежать частых ошибок." },
          { title: "Оплата по факту", desc: "Платите за фактическое использование, задавайте лимиты квот и держите расход команды на виду." },
        ],
      },
      models: {
        title: "Рекомендуемые AI-модели",
        description: "Лучшие модели, отобранные сообществом flatkey",
        tag: "текст в текст",
      },
      about: {
        eyebrow: "О flatkey.ai",
        title: "Единый API-слой для современных AI-продуктов",
        description:
          "flatkey.ai предоставляет размещенное ПО и предоплаченный баланс для тарифицируемого использования AI API. Стоимость рассчитывается по ценам входа, выхода и cache-hit модели, умноженным на использование токенов.",
        items: [
          { title: "Что такое flatkey.ai", desc: "flatkey.ai — единый AI API-шлюз, через который команды вызывают поддерживаемые модели с одним API-ключом, одним базовым URL и одной панелью." },
          { title: "Какую проблему решает", desc: "Он сокращает отдельные аккаунты провайдеров, разрозненные API-ключи, непоследовательную маршрутизацию и фрагментированный учет использования для команд, создающих AI-функции." },
          { title: "Кто использует", desc: "flatkey.ai создан для разработчиков, AI-продуктовых команд, создателей автоматизаций и операционных команд, которым нужен предсказуемый доступ к нескольким моделям." },
        ],
      },
      productHighlights: {
        eyebrow: "Фокус продукта",
        title: "Для команд, выпускающих AI-функции",
        description: "flatkey держит доступ к моделям, маршрутизацию, биллинг и политики использования в одном месте, чтобы команды быстрее двигались без лишнего управления провайдерами.",
        items: [
          { title: "AI-продуктовые команды", desc: "Добавляйте доступ к моделям в продукт без управления отдельными аккаунтами провайдеров, ключами и изменениями SDK." },
          { title: "Операции и финансы", desc: "Держите расходы токенов, записи пополнений и использование команды видимыми в одной панели." },
          { title: "Создатели автоматизаций", desc: "Маршрутизируйте высоконагруженные workflow к подходящим моделям и проще анализируйте сбои и затраты." },
          { title: "Оценка и итерация моделей", desc: "Сравнивайте провайдеров, переключайте модели и оставляйте существующие OpenAI-совместимые клиенты на том же базовом URL." },
        ],
      },
      howItWorks: {
        eyebrow: "Как это работает вместе",
        title: "От главной страницы к production-вызовам",
        steps: [
          { num: "1", title: "Получите один ключ", desc: "Создайте аккаунт flatkey, откройте панель и сгенерируйте API-ключ для приложения." },
          { num: "2", title: "Смените базовый URL", desc: "Направьте OpenAI-совместимый клиент на {{apiBaseUrl}} и сохраните текущий SDK." },
          { num: "3", title: "Отслеживайте и оптимизируйте", desc: "Смотрите использование, стоимость, маршрутизацию и ошибки в одной продуктовой панели." },
        ],
      },
      cta: {
        titleLine1: "Готовы заменить",
        titleLine2: "хаос моделей одним ключом?",
        description: "Начните с сайта flatkey, управляйте продуктовой панелью и используйте {{host}} как стабильный API endpoint.",
      },
      terminal: {
        request: "Запрос",
        response: "Ответ",
        cost: "Стоимость",
        tokens: "токены",
        ms: "мс",
        responses: {
          "gpt-chat": "Чат-запрос маршрутизирован.",
          responses: "Workflow ответа готов.",
          claude: "Сообщение Claude маршрутизировано.",
          gemini: "Запрос Gemini обслужен.",
        },
      },
    },
    footer: {
      tagline: "Безопасно, надежно и доступно",
      trustedVerifiedBy: "НАДЕЖНОСТЬ И ПРОВЕРКА",
      emailSupport: "Email: support@flatkey.ai",
      termsOfService: "Условия использования",
      privacyPolicy: "Политика конфиденциальности",
      serviceLevelAgreement: "Соглашение об уровне обслуживания",
      refundPolicy: "Политика возврата",
      supportEmail: "Поддержка: support@flatkey.ai",
      defaultCopyright: "Все права защищены.",
      projectAttributionSuffix: "AI API-шлюз и платформа управления моделями.",
    },
  },
  ja: {
    nav: {
      pricing: "料金",
      modelPricing: "モデル",
      home: "ホーム",
      console: "コンソール",
      rankings: "ランキング",
      blog: "ブログ",
      about: "概要",
      app: "アプリを開く",
      signIn: "ログイン",
      toggle: "ナビゲーションメニューを切り替え",
      toggleTheme: "テーマを切り替え",
      light: "ライト",
      dark: "ダーク",
      system: "システム",
      notifications: "通知",
      systemAnnouncements: "システムのお知らせ",
      latestPlatformUpdates: "最新のプラットフォーム更新と通知",
      notice: "通知",
      timeline: "タイムライン",
      noAnnouncements: "現在お知らせはありません",
      noSystemAnnouncements: "システムのお知らせはありません",
      loading: "読み込み中...",
      close: "閉じる",
    },
    home: {
      title: "本番 AI チームのための API ゲートウェイ",
      description:
        "flatkey.ai はモデル接続、ルーティング、課金、利用分析、運用管理を一つにまとめます。",
      primary: "キーを取得",
      secondary: "料金を見る",
      hero: {
        badge: "マルチモデル対応、エンタープライズ向け",
        titleLine1: "すべてのモデル。",
        titleLine2: "ひとつのキー。明快な料金。",
        toolsLabel: "現在のツールと連携",
        toolsDescription: "ワンクリック設定に対応し、NewAPI のマルチプロトコル設定に自然に適応します。",
        moreApps: "その他のアプリ",
      },
      stats: {
        items: [
          { value: "200+", label: "ひとつのキーで使えるモデル" },
          { value: "1", label: "OpenAI 互換のベース URL" },
          { value: "24/7", label: "利用量と請求の可視化" },
          { value: "1", label: "キーとルーティングのダッシュボード" },
        ],
      },
      features: {
        eyebrow: "flatkey が選ばれる理由",
        titleLine1: "アクセス、料金、管理を",
        titleLine2: "ひとつの場所に",
        items: [
          { title: "ワンクリック接続", desc: "ひとつの API キーで、接続済みのすべての AI モデルを各プロバイダーへ個別申請せずに呼び出せます。" },
          { title: "安定して信頼できる", desc: "複数の upstream アカウントを自動切り替えと負荷分散で賢くルーティングし、頻繁なエラーを避けます。" },
          { title: "使った分だけ支払い", desc: "実際の利用量で課金し、クォータ上限を設定し、チームの消費を一目で把握できます。" },
        ],
      },
      models: {
        title: "おすすめ AI モデル",
        description: "flatkey コミュニティが選んだ主要モデル",
        tag: "テキストからテキスト",
      },
      about: {
        eyebrow: "flatkey.ai について",
        title: "現代の AI プロダクト向け統合 API レイヤー",
        description:
          "flatkey.ai は、従量制 AI API 利用のためのホスト型ソフトウェアとプリペイド残高を提供します。利用料金は、モデルの入力、出力、キャッシュヒット価格に token 使用量を掛けて計算されます。",
        items: [
          { title: "flatkey.ai とは", desc: "flatkey.ai は、対応 AI モデルをひとつの API キー、ひとつのベース URL、ひとつのダッシュボードから呼び出せる統合 AI API ゲートウェイです。" },
          { title: "解決する課題", desc: "AI 機能を作るチームにおける、別々のプロバイダーアカウント、散らばった API キー、不統一なルーティング、分断された利用追跡を減らします。" },
          { title: "利用するチーム", desc: "flatkey.ai は、複数モデルへの予測可能なアクセスを必要とする開発者、AI プロダクトチーム、自動化ビルダー、運用チーム向けです。" },
        ],
      },
      productHighlights: {
        eyebrow: "プロダクトの焦点",
        title: "AI 機能を出荷するチームのために",
        description: "flatkey はモデル接続、ルーティング、課金、利用ポリシーを一箇所にまとめ、追加のプロバイダー管理なしでチームが速く進めるようにします。",
        items: [
          { title: "AI プロダクトチーム", desc: "プロバイダーアカウント、キー、SDK 変更を個別に管理せず、製品にモデルアクセスを追加できます。" },
          { title: "運用と財務", desc: "token 支出、チャージ履歴、チーム利用量をひとつのダッシュボードで確認できます。" },
          { title: "自動化ビルダー", desc: "高ボリュームのワークフローを適切なモデルへルーティングし、失敗とコストを見直しやすくします。" },
          { title: "モデル評価と反復", desc: "プロバイダーを比較し、モデルを切り替え、既存の OpenAI 互換クライアントは同じベース URL のまま使えます。" },
        ],
      },
      howItWorks: {
        eyebrow: "全体の流れ",
        title: "ホームページから本番呼び出しまで",
        steps: [
          { num: "1", title: "ひとつのキーを取得", desc: "flatkey アカウントを作成し、ダッシュボードを開いてアプリ用の API キーを生成します。" },
          { num: "2", title: "ベース URL を変更", desc: "OpenAI 互換クライアントを {{apiBaseUrl}} に向け、既存の SDK をそのまま使います。" },
          { num: "3", title: "監視して最適化", desc: "同じプロダクトダッシュボードで利用量、コスト、ルーティング、エラーを確認します。" },
        ],
      },
      cta: {
        titleLine1: "モデル管理の混乱を",
        titleLine2: "ひとつのキーに置き換えませんか？",
        description: "flatkey のホームページから始め、プロダクトダッシュボードを管理し、{{host}} を安定した API エンドポイントとして使えます。",
      },
      terminal: {
        request: "リクエスト",
        response: "レスポンス",
        cost: "コスト",
        tokens: "tokens",
        ms: "ms",
        responses: {
          "gpt-chat": "チャットリクエストをルーティングしました。",
          responses: "レスポンスワークフローの準備ができました。",
          claude: "Claude メッセージをルーティングしました。",
          gemini: "Gemini リクエストを処理しました。",
        },
      },
    },
    footer: {
      tagline: "安全、信頼、低価格",
      trustedVerifiedBy: "信頼と認証",
      emailSupport: "メール: support@flatkey.ai",
      termsOfService: "利用規約",
      privacyPolicy: "プライバシーポリシー",
      serviceLevelAgreement: "サービスレベル契約",
      refundPolicy: "返金ポリシー",
      supportEmail: "サポート: support@flatkey.ai",
      defaultCopyright: "All rights reserved.",
      projectAttributionSuffix: "AI API ゲートウェイとモデル運用プラットフォーム。",
    },
  },
  vi: {
    nav: {
      pricing: "Giá",
      modelPricing: "Mô hình",
      home: "Trang chủ",
      console: "Bảng điều khiển",
      rankings: "Xếp hạng",
      blog: "Blog",
      about: "Giới thiệu",
      app: "Mở ứng dụng",
      signIn: "Đăng nhập",
      toggle: "Bật/tắt menu điều hướng",
      toggleTheme: "Đổi giao diện",
      light: "Sáng",
      dark: "Tối",
      system: "Hệ thống",
      notifications: "Thông báo",
      systemAnnouncements: "Thông báo hệ thống",
      latestPlatformUpdates: "Cập nhật và thông báo mới nhất của nền tảng",
      notice: "Thông báo",
      timeline: "Dòng thời gian",
      noAnnouncements: "Hiện chưa có thông báo",
      noSystemAnnouncements: "Không có thông báo hệ thống",
      loading: "Đang tải...",
      close: "Đóng",
    },
    home: {
      title: "Một cổng API cho đội ngũ AI vận hành sản phẩm",
      description:
        "flatkey.ai hợp nhất truy cập mô hình, định tuyến, tính phí, phân tích sử dụng và kiểm soát vận hành.",
      primary: "Lấy khóa",
      secondary: "Xem giá",
      hero: {
        badge: "Tương thích nhiều mô hình, sẵn sàng cho doanh nghiệp",
        titleLine1: "Mọi mô hình.",
        titleLine2: "Một khóa. Một mức giá rõ ràng.",
        toolsLabel: "Hoạt động với công cụ hiện tại của bạn",
        toolsDescription: "Hỗ trợ cấu hình một nhấp và thích ứng hoàn hảo với cấu hình đa giao thức NewAPI.",
        moreApps: "Ứng dụng khác",
      },
      stats: {
        items: [
          { value: "200+", label: "mô hình sau một khóa" },
          { value: "1", label: "URL cơ sở tương thích OpenAI" },
          { value: "24/7", label: "hiển thị mức dùng và tính phí" },
          { value: "1", label: "bảng điều khiển cho khóa và định tuyến" },
        ],
      },
      features: {
        eyebrow: "Vì sao chọn flatkey",
        titleLine1: "Một nơi cho truy cập,",
        titleLine2: "giá và kiểm soát",
        items: [
          { title: "Truy cập một nhấp", desc: "Nhận một khóa API và gọi mọi mô hình AI đã kết nối mà không cần đăng ký từng nhà cung cấp riêng." },
          { title: "Ổn định và tin cậy", desc: "Định tuyến thông minh nhiều tài khoản upstream với tự động chuyển đổi và cân bằng tải để tránh lỗi thường xuyên." },
          { title: "Trả theo mức dùng", desc: "Tính phí theo sử dụng thực tế, đặt giới hạn quota và theo dõi mức tiêu thụ của đội ngũ rõ ràng." },
        ],
      },
      models: {
        title: "Mô hình AI được đề xuất",
        description: "Các mô hình nổi bật do cộng đồng flatkey tuyển chọn",
        tag: "văn bản sang văn bản",
      },
      about: {
        eyebrow: "Giới thiệu flatkey.ai",
        title: "Một lớp API hợp nhất cho sản phẩm AI hiện đại",
        description:
          "flatkey.ai cung cấp phần mềm lưu trữ và số dư tài khoản trả trước cho việc sử dụng API AI theo mức đo. Phí sử dụng được tính từ giá đầu vào, đầu ra và cache-hit của mô hình nhân với lượng token sử dụng.",
        items: [
          { title: "flatkey.ai là gì", desc: "flatkey.ai là cổng API AI hợp nhất cho phép đội ngũ gọi các mô hình được hỗ trợ bằng một khóa API, một URL cơ sở và một bảng điều khiển." },
          { title: "Vấn đề giải quyết", desc: "Nó giảm tài khoản nhà cung cấp riêng lẻ, khóa API phân tán, định tuyến không nhất quán và theo dõi sử dụng rời rạc cho đội ngũ xây dựng tính năng AI." },
          { title: "Ai sử dụng", desc: "flatkey.ai dành cho nhà phát triển, đội ngũ sản phẩm AI, người xây dựng tự động hóa và đội vận hành cần truy cập dự đoán được vào nhiều mô hình." },
        ],
      },
      productHighlights: {
        eyebrow: "Trọng tâm sản phẩm",
        title: "Xây dựng cho đội ngũ phát hành tính năng AI",
        description: "flatkey giữ truy cập mô hình, định tuyến, tính phí và chính sách sử dụng ở một nơi để đội ngũ đi nhanh hơn mà không phải quản lý thêm nhà cung cấp.",
        items: [
          { title: "Đội ngũ sản phẩm AI", desc: "Thêm truy cập mô hình vào sản phẩm mà không quản lý riêng tài khoản nhà cung cấp, khóa và thay đổi SDK." },
          { title: "Vận hành và tài chính", desc: "Theo dõi chi tiêu token, lịch sử nạp và mức dùng của đội ngũ trong một bảng điều khiển." },
          { title: "Người xây dựng tự động hóa", desc: "Định tuyến workflow khối lượng lớn tới mô hình phù hợp, đồng thời dễ xem lại lỗi và chi phí hơn." },
          { title: "Đánh giá và lặp mô hình", desc: "So sánh nhà cung cấp, chuyển đổi mô hình và giữ các client tương thích OpenAI hiện có trỏ tới cùng URL cơ sở." },
        ],
      },
      howItWorks: {
        eyebrow: "Cách mọi thứ kết nối",
        title: "Từ trang chủ đến lời gọi production",
        steps: [
          { num: "1", title: "Nhận một khóa", desc: "Tạo tài khoản flatkey, mở bảng điều khiển và tạo khóa API cho ứng dụng của bạn." },
          { num: "2", title: "Đổi URL cơ sở", desc: "Trỏ client tương thích OpenAI tới {{apiBaseUrl}} và giữ SDK hiện tại." },
          { num: "3", title: "Giám sát và tối ưu", desc: "Xem mức dùng, chi phí, định tuyến và lỗi từ cùng một bảng điều khiển sản phẩm." },
        ],
      },
      cta: {
        titleLine1: "Sẵn sàng thay thế",
        titleLine2: "sự hỗn loạn mô hình bằng một khóa?",
        description: "Bắt đầu từ trang chủ flatkey, quản lý bảng điều khiển sản phẩm và giữ {{host}} làm endpoint API ổn định.",
      },
      terminal: {
        request: "Yêu cầu",
        response: "Phản hồi",
        cost: "Chi phí",
        tokens: "tokens",
        ms: "ms",
        responses: {
          "gpt-chat": "Yêu cầu chat đã được định tuyến.",
          responses: "Luồng phản hồi đã sẵn sàng.",
          claude: "Tin nhắn Claude đã được định tuyến.",
          gemini: "Yêu cầu Gemini đã được xử lý.",
        },
      },
    },
    footer: {
      tagline: "An toàn, đáng tin cậy, giá tốt",
      trustedVerifiedBy: "ĐƯỢC TIN CẬY VÀ XÁC MINH BỞI",
      emailSupport: "Email: support@flatkey.ai",
      termsOfService: "Điều khoản dịch vụ",
      privacyPolicy: "Chính sách quyền riêng tư",
      serviceLevelAgreement: "Thỏa thuận mức dịch vụ",
      refundPolicy: "Chính sách hoàn tiền",
      supportEmail: "Hỗ trợ: support@flatkey.ai",
      defaultCopyright: "Bảo lưu mọi quyền.",
      projectAttributionSuffix: "Cổng API AI và nền tảng vận hành mô hình.",
    },
  },
  de: {
    nav: {
      pricing: "Preise",
      modelPricing: "Modelle",
      home: "Startseite",
      console: "Konsole",
      rankings: "Rankings",
      blog: "Blog",
      about: "Über uns",
      app: "App öffnen",
      signIn: "Anmelden",
      toggle: "Navigationsmenü umschalten",
      toggleTheme: "Design umschalten",
      light: "Hell",
      dark: "Dunkel",
      system: "System",
      notifications: "Benachrichtigungen",
      systemAnnouncements: "Systemankündigungen",
      latestPlatformUpdates: "Neueste Plattform-Updates und Hinweise",
      notice: "Hinweis",
      timeline: "Zeitachse",
      noAnnouncements: "Derzeit keine Ankündigungen",
      noSystemAnnouncements: "Keine Systemankündigungen",
      loading: "Wird geladen...",
      close: "Schließen",
    },
    home: {
      title: "Ein API-Gateway für AI-Teams im Produktivbetrieb",
      description:
        "flatkey.ai vereint Modellzugriff, Routing, Abrechnung, Nutzungsanalysen und Betriebssteuerung für Teams, die AI-Produkte ausliefern.",
      primary: "Schlüssel holen",
      secondary: "Preise ansehen",
      hero: {
        badge: "Multi-Modell-kompatibel, Enterprise-ready",
        titleLine1: "Jedes Modell.",
        titleLine2: "Ein Schlüssel. Pauschalpreis.",
        toolsLabel: "Funktioniert mit deinen aktuellen Tools",
        toolsDescription: "Unterstützt Ein-Klick-Konfiguration und passt sich perfekt an die NewAPI-Multi-Protokoll-Konfiguration an.",
        moreApps: "Weitere Apps",
      },
      stats: {
        items: [
          { value: "200+", label: "Modelle hinter einem Schlüssel" },
          { value: "1", label: "OpenAI-kompatible Basis-URL" },
          { value: "24/7", label: "Einblick in Nutzung und Abrechnung" },
          { value: "1", label: "Dashboard für Schlüssel und Routing" },
        ],
      },
      features: {
        eyebrow: "Warum flatkey",
        titleLine1: "Ein Ort für Zugriff,",
        titleLine2: "Preise und Kontrolle",
        items: [
          {
            title: "Zugriff mit einem Klick",
            desc: "Hol dir einen API-Schlüssel und rufe jedes verbundene AI-Modell auf, ohne dich bei jedem Anbieter einzeln zu registrieren.",
          },
          {
            title: "Stabil und zuverlässig",
            desc: "Leite mehrere Upstream-Konten intelligent weiter — mit automatischem Wechsel und Lastverteilung, um häufige Fehler zu vermeiden.",
          },
          {
            title: "Bezahlen nach Verbrauch",
            desc: "Rechne nach tatsächlicher Nutzung ab, lege Kontingentgrenzen fest und behalte den Team-Verbrauch jederzeit im Blick.",
          },
        ],
      },
      models: {
        title: "Empfohlene AI-Modelle",
        description: "Kuratierte Top-Modelle, ausgewählt von der flatkey-Community",
        tag: "Text-zu-Text",
      },
      about: {
        eyebrow: "Über flatkey.ai",
        title: "Eine einheitliche API-Schicht für moderne AI-Produkte",
        description:
          "flatkey.ai bietet gehostete Software und ein Prepaid-Kontoguthaben für die nutzungsbasierte AI-API-Abrechnung. Die Nutzungsgebühren ergeben sich aus den Modellpreisen für Eingabe, Ausgabe und Cache-Hit multipliziert mit der Token-Nutzung.",
        items: [
          {
            title: "Was flatkey.ai ist",
            desc: "flatkey.ai ist ein einheitliches AI-API-Gateway, mit dem Teams unterstützte AI-Modelle über einen API-Schlüssel, eine Basis-URL und ein Dashboard aufrufen.",
          },
          {
            title: "Welches Problem es löst",
            desc: "Es reduziert getrennte Anbieterkonten, verstreute API-Schlüssel, uneinheitliches Routing und fragmentierte Nutzungsverfolgung für Teams, die AI-Funktionen entwickeln.",
          },
          {
            title: "Wer es nutzt",
            desc: "flatkey.ai ist für Entwickler, AI-Produktteams, Automatisierungs-Builder und Betriebsteams gebaut, die planbaren Zugriff auf mehrere Modelle brauchen.",
          },
        ],
      },
      productHighlights: {
        eyebrow: "Produktfokus",
        title: "Gebaut für Teams, die AI-Funktionen ausliefern",
        description:
          "flatkey hält Modellzugriff, Routing, Abrechnung und Nutzungsrichtlinien an einem Ort, damit Teams schneller vorankommen — ohne zusätzlichen Anbieter-Verwaltungsaufwand.",
        items: [
          {
            title: "AI-Produktteams",
            desc: "Füge deinem Produkt Modellzugriff hinzu, ohne separate Anbieterkonten, Schlüssel und SDK-Änderungen zu verwalten.",
          },
          {
            title: "Betrieb und Finanzen",
            desc: "Behalte Token-Ausgaben, Aufladungsdatensätze und Team-Nutzung in einem Dashboard im Blick.",
          },
          {
            title: "Automatisierungs-Builder",
            desc: "Leite Workflows mit hohem Volumen an passende Modelle weiter und behalte Fehler und Kosten leichter im Blick.",
          },
          {
            title: "Modellbewertung und Iteration",
            desc: "Vergleiche Anbieter, wechsle Modelle und lass bestehende OpenAI-kompatible Clients auf dieselbe Basis-URL zeigen.",
          },
        ],
      },
      howItWorks: {
        eyebrow: "Wie alles zusammenpasst",
        title: "Von der Startseite zu produktiven Aufrufen",
        steps: [
          { num: "1", title: "Einen Schlüssel holen", desc: "Erstelle ein flatkey-Konto, öffne das Dashboard und generiere einen API-Schlüssel für deine App." },
          { num: "2", title: "Die Basis-URL ändern", desc: "Lass deinen OpenAI-kompatiblen Client auf {{apiBaseUrl}} zeigen und behalte dein vorhandenes SDK." },
          { num: "3", title: "Überwachen und optimieren", desc: "Prüfe Nutzung, Kosten, Routing und Fehler im selben Produkt-Dashboard." },
        ],
      },
      cta: {
        titleLine1: "Bereit, das Modell-Chaos",
        titleLine2: "durch einen Schlüssel zu ersetzen?",
        description: "Starte auf der flatkey-Startseite, verwalte dein Produkt-Dashboard und behalte {{host}} als stabilen API-Endpunkt.",
      },
      terminal: {
        request: "Anfrage",
        response: "Antwort",
        cost: "Kosten",
        tokens: "Tokens",
        ms: "ms",
        responses: {
          "gpt-chat": "Chat-Anfrage weitergeleitet.",
          responses: "Antwort-Workflow bereit.",
          claude: "Claude-Nachricht weitergeleitet.",
          gemini: "Gemini-Anfrage bedient.",
        },
      },
    },
    footer: {
      tagline: "Sicher, zuverlässig und günstig",
      trustedVerifiedBy: "VERTRAUT UND VERIFIZIERT VON",
      emailSupport: "E-Mail: support@flatkey.ai",
      termsOfService: "Nutzungsbedingungen",
      privacyPolicy: "Datenschutzrichtlinie",
      serviceLevelAgreement: "Service-Level-Agreement",
      refundPolicy: "Rückerstattungsrichtlinie",
      supportEmail: "Support: support@flatkey.ai",
      defaultCopyright: "Alle Rechte vorbehalten.",
      projectAttributionSuffix: "AI-API-Gateway und Plattform für Modellbetrieb.",
    },
  },
};

export function getCopy(locale: Locale): Copy {
  const resolvedLocale = copies[locale] ? locale : "en";
  return {
    ...copies[resolvedLocale],
    blog: BLOG_COPY[resolvedLocale],
  };
}
