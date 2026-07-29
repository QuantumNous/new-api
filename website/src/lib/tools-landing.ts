import { type Locale, localizePath } from "./locales";
import { consoleUrl } from "./origins";

export const TOOLS_LANDING_PATH = "/tools";
export const TOOLS_SETUP_COMMAND = "Set up Flatkey from https://flatkey.ai/SKILL.md";

type Card = { title: string; body: string };
type Step = Card & { label: string; meta: string };
type Stat = { value: string; label: string };
type Faq = { question: string; answer: string };

export type ToolsLandingCopy = {
  navLabel: string;
  metaTitle: string;
  metaDescription: string;
  badge: string;
  heroLead: string;
  heroAccent: string;
  heroTail: string;
  heroBody: string;
  commandLabel: string;
  copyLabel: string;
  copiedLabel: string;
  primaryCta: string;
  secondaryCta: string;
  heroNote: string;
  demoPrompt: string;
  demoLines: string[];
  demoBill: string;
  catalogEyebrow: string;
  catalogTitle: string;
  catalogBody: string;
  categories: Card[];
  flowEyebrow: string;
  flowTitle: string;
  flowBody: string;
  steps: Step[];
  balanceEyebrow: string;
  balanceTitle: string;
  balanceBody: string;
  stats: Stat[];
  connectEyebrow: string;
  connectTitle: string;
  connectBody: string;
  methods: Card[];
  faqEyebrow: string;
  faqTitle: string;
  faqs: Faq[];
  finalTitle: string;
  finalBody: string;
  finalCta: string;
};

export const toolsLandingCopy: Record<Locale, ToolsLandingCopy> = {
  en: {
    navLabel: "Tools",
    metaTitle: "Flatkey Tools — 1,000+ AI tools, one key and one balance",
    metaDescription: "Give agents search, enrichment, browser, social, commerce and media tools through one Flatkey API key. Pay per successful call from one shared balance.",
    badge: "Live · 1,000+ metered tools",
    heroLead: "One key for",
    heroAccent: "every job",
    heroTail: "your agent takes on.",
    heroBody: "Search, scrape, enrich, generate, and act—plus use 300+ AI models—through one Flatkey key and one prepaid balance.",
    commandLabel: "Give this line to your agent",
    copyLabel: "Copy",
    copiedLabel: "Copied",
    primaryCta: "Browse tools",
    secondaryCta: "Get an API key",
    heroNote: "No separate provider keys. No idle seats. Flatkey-side failures cost $0.",
    demoPrompt: "Research 14 competitors, enrich the buyers, and prepare a sourced launch brief.",
    demoLines: ["Live web and social signals found", "Companies and decision-makers enriched", "Evidence grouped into a launch brief"],
    demoBill: "$0.83 billed · failed calls $0.00",
    catalogEyebrow: "One catalog",
    catalogTitle: "Tools for the work between prompt and outcome.",
    catalogBody: "Discover capabilities by job, inspect the input schema and exact price, then run them with the same Flatkey key your models already use.",
    categories: [
      { title: "Web research", body: "Search, crawl, extract and summarize current public information." },
      { title: "People & companies", body: "Find, verify and enrich accounts, roles and contact records." },
      { title: "Social intelligence", body: "Research creators, posts, communities, trends and audience signals." },
      { title: "Commerce data", body: "Inspect products, reviews, sellers, listings and marketplace demand." },
      { title: "Browser automation", body: "Navigate pages, collect structured evidence and complete web steps." },
      { title: "Media generation", body: "Create images, video, voice, music and production-ready assets." },
      { title: "Search intelligence", body: "Study keywords, competitors, traffic signals and market demand." },
      { title: "Real-time signals", body: "Bring news, weather and changing external data into agent workflows." },
    ],
    flowEyebrow: "Agent-native runtime",
    flowTitle: "Discover. Inspect. Run.",
    flowBody: "The agent can choose the smallest tool that completes the job, see the contract before execution, and return a traceable result.",
    steps: [
      { label: "01 · DISCOVER", title: "Find tools by intent", body: "Search the live catalog by capability instead of memorizing providers.", meta: "ranked by fit and price" },
      { label: "02 · INSPECT", title: "See inputs and cost", body: "Read required fields, examples, billing unit and exact Flatkey price first.", meta: "schema + price before spend" },
      { label: "03 · RUN", title: "Execute with one key", body: "Use an idempotent request and receive output, latency, charge and remaining balance.", meta: "one response · one ledger" },
    ],
    balanceEyebrow: "No subscription stack",
    balanceTitle: "Models and tools share one balance.",
    balanceBody: "Replace scattered seats, contracts and provider credentials with one prepaid wallet and a request-level ledger.",
    stats: [
      { value: "1,000+", label: "metered tools" },
      { value: "300+", label: "AI models" },
      { value: "1", label: "API key and balance" },
      { value: "$0", label: "Flatkey-side failed calls" },
    ],
    connectEyebrow: "Three ways in",
    connectTitle: "Use the interface your workflow already speaks.",
    connectBody: "The catalog, price and balance stay the same whether a human explores first or an agent calls directly.",
    methods: [
      { title: "Skill", body: "Give SKILL.md to Codex, Claude Code, OpenClaw or another capable agent." },
      { title: "API", body: "List, inspect and run tools from your application with deterministic requests." },
      { title: "Dashboard", body: "Browse the marketplace, test inputs and inspect results before automating." },
    ],
    faqEyebrow: "Common questions",
    faqTitle: "What teams ask before the first call.",
    faqs: [
      { question: "Do I need a key for every provider?", answer: "No. Tools in the Flatkey catalog use one Flatkey API key and the same prepaid balance as supported models." },
      { question: "How is each tool priced?", answer: "Every listing shows its billing unit and Flatkey price before execution. Depending on the tool, billing can be per call, result, second or provider token." },
      { question: "Are failed calls charged?", answer: "Flatkey-side failed calls do not consume balance. The execution response and request ledger show the final charge for every run." },
      { question: "Which agents can use Flatkey Tools?", answer: "Any agent or application that can read the Flatkey skill or call the authenticated API can use supported tools. Availability is subject to the live catalog and account plan." },
      { question: "Can I use my existing Flatkey balance?", answer: "Yes. Pro and higher plans use the same wallet for supported models and Flatkey Tools; no separate tool subscription is required." },
    ],
    finalTitle: "Give your agent a bigger toolbox, not a bigger subscription stack.",
    finalBody: "Open the live catalog, inspect the exact price, and run the first tool with your Flatkey key.",
    finalCta: "Open the Tools Marketplace",
  },
  zh: {
    navLabel: "Tools",
    metaTitle: "Flatkey Tools — 1,000+ AI 工具，一个 Key，一个余额",
    metaDescription: "通过一个 Flatkey API Key，为 Agent 提供搜索、数据补全、浏览器、社媒、电商和媒体工具；成功调用才付费，共用一个余额。",
    badge: "已上线 · 1,000+ 按量计费工具",
    heroLead: "一个 Key，完成 Agent 接下的",
    heroAccent: "每一项工作",
    heroTail: "。",
    heroBody: "搜索、抓取、补全、生成、执行，加上 300+ AI 模型，全部使用一个 Flatkey Key 和一个预付余额。",
    commandLabel: "把这一行交给你的 Agent",
    copyLabel: "复制",
    copiedLabel: "已复制",
    primaryCta: "浏览工具",
    secondaryCta: "获取 API Key",
    heroNote: "无需单独申请供应商 Key，无闲置席位；Flatkey 侧失败调用费用为 $0。",
    demoPrompt: "研究 14 个竞品，补全决策人，并生成带来源的发布简报。",
    demoLines: ["找到实时网页和社媒信号", "补全公司与关键决策人", "把证据整理成发布简报"],
    demoBill: "计费 $0.83 · 失败调用 $0.00",
    catalogEyebrow: "一个目录",
    catalogTitle: "覆盖从 Prompt 到结果之间的工作。",
    catalogBody: "按任务发现能力，先查看输入结构和准确价格，再用模型已经使用的同一个 Flatkey Key 执行。",
    categories: [
      { title: "网页研究", body: "搜索、抓取、提取并总结最新公开信息。" },
      { title: "个人与公司数据", body: "查找、验证并补全公司、职位和联系人记录。" },
      { title: "社媒洞察", body: "研究创作者、帖子、社区、趋势和受众信号。" },
      { title: "电商数据", body: "分析商品、评论、卖家、Listing 与市场需求。" },
      { title: "浏览器自动化", body: "访问页面、收集结构化证据并完成网页步骤。" },
      { title: "媒体生成", body: "生成图片、视频、语音、音乐和可交付素材。" },
      { title: "搜索情报", body: "研究关键词、竞品、流量信号和市场需求。" },
      { title: "实时信号", body: "把新闻、天气和变化中的外部数据接入 Agent 流程。" },
    ],
    flowEyebrow: "为 Agent 原生设计",
    flowTitle: "发现、检查、执行。",
    flowBody: "Agent 能选择完成任务所需的最小工具，执行前看清契约，并返回可追踪结果。",
    steps: [
      { label: "01 · 发现", title: "按意图查找工具", body: "按能力搜索实时目录，无需记住各家供应商。", meta: "按匹配度和价格排序" },
      { label: "02 · 检查", title: "先看输入与费用", body: "先确认必填字段、示例、计费单位和 Flatkey 准确价格。", meta: "消费前看结构与价格" },
      { label: "03 · 执行", title: "一个 Key 直接运行", body: "使用幂等请求，返回结果、延迟、费用和剩余余额。", meta: "一个响应 · 一条账本" },
    ],
    balanceEyebrow: "告别订阅堆叠",
    balanceTitle: "模型与工具共用一个余额。",
    balanceBody: "用一个预付钱包和逐请求账本，替代分散的席位、合同与供应商凭证。",
    stats: [{ value: "1,000+", label: "按量工具" }, { value: "300+", label: "AI 模型" }, { value: "1", label: "API Key 与余额" }, { value: "$0", label: "Flatkey 侧失败调用" }],
    connectEyebrow: "三种接入方式",
    connectTitle: "沿用你的工作流已经会用的界面。",
    connectBody: "无论先由人探索，还是 Agent 直接调用，目录、价格与余额都保持一致。",
    methods: [
      { title: "Skill", body: "把 SKILL.md 交给 Codex、Claude Code、OpenClaw 或其他 Agent。" },
      { title: "API", body: "在应用中用确定性请求列出、检查并执行工具。" },
      { title: "控制台", body: "在自动化前浏览市场、测试输入并检查结果。" },
    ],
    faqEyebrow: "常见问题",
    faqTitle: "团队在第一次调用前最常问的问题。",
    faqs: [
      { question: "每个供应商都需要单独的 Key 吗？", answer: "不需要。Flatkey 目录内的工具使用一个 Flatkey API Key，并与支持的模型共用预付余额。" },
      { question: "每个工具如何计费？", answer: "每个条目都会在执行前展示计费单位和 Flatkey 价格；可能按调用、结果、秒或供应商 Token 计费。" },
      { question: "失败调用会收费吗？", answer: "Flatkey 侧失败调用不消耗余额。每次运行的执行响应和请求账本都会显示最终费用。" },
      { question: "哪些 Agent 可以使用？", answer: "能读取 Flatkey Skill 或调用认证 API 的 Agent 和应用都可使用支持的工具，具体以实时目录和账号套餐为准。" },
      { question: "能使用现有 Flatkey 余额吗？", answer: "可以。Pro 及以上套餐通过同一钱包使用支持的模型和 Flatkey Tools，无需另购工具订阅。" },
    ],
    finalTitle: "给 Agent 更大的工具箱，而不是更长的订阅清单。",
    finalBody: "打开实时目录，查看准确价格，用你的 Flatkey Key 运行第一个工具。",
    finalCta: "打开 Tools Marketplace",
  },
  es: {
    navLabel: "Tools", metaTitle: "Flatkey Tools — más de 1.000 herramientas de IA con una sola clave", metaDescription: "Da a tus agentes búsqueda, enriquecimiento, navegador, datos sociales, comercio y medios con una clave Flatkey y pago por llamada exitosa.", badge: "En vivo · más de 1.000 herramientas medidas", heroLead: "Una clave para", heroAccent: "cada tarea", heroTail: "que asume tu agente.", heroBody: "Busca, extrae, enriquece, genera y actúa, además de usar más de 300 modelos, con una clave y un saldo prepago Flatkey.", commandLabel: "Dale esta línea a tu agente", copyLabel: "Copiar", copiedLabel: "Copiado", primaryCta: "Explorar herramientas", secondaryCta: "Obtener clave API", heroNote: "Sin claves separadas ni asientos ociosos. Los fallos de Flatkey cuestan $0.", demoPrompt: "Investiga 14 competidores, enriquece compradores y crea un informe con fuentes.", demoLines: ["Señales web y sociales encontradas", "Empresas y decisores enriquecidos", "Evidencia agrupada en un informe"], demoBill: "$0,83 facturados · fallos $0,00", catalogEyebrow: "Un catálogo", catalogTitle: "Herramientas para el trabajo entre el prompt y el resultado.", catalogBody: "Descubre por tarea, revisa el esquema y precio exacto, y ejecuta con la misma clave Flatkey de tus modelos.",
    categories: [{ title: "Investigación web", body: "Busca, rastrea, extrae y resume información pública actual." }, { title: "Personas y empresas", body: "Encuentra, verifica y enriquece cuentas, cargos y contactos." }, { title: "Inteligencia social", body: "Analiza creadores, posts, comunidades, tendencias y audiencias." }, { title: "Datos de comercio", body: "Examina productos, reseñas, vendedores, listings y demanda." }, { title: "Automatización web", body: "Navega páginas, recoge evidencia y completa pasos web." }, { title: "Generación multimedia", body: "Crea imágenes, vídeo, voz, música y recursos listos." }, { title: "Inteligencia de búsqueda", body: "Estudia keywords, competencia, tráfico y demanda." }, { title: "Señales en tiempo real", body: "Integra noticias, clima y datos externos cambiantes." }],
    flowEyebrow: "Runtime nativo para agentes", flowTitle: "Descubre. Inspecciona. Ejecuta.", flowBody: "El agente elige la herramienta mínima, ve el contrato antes de gastar y devuelve un resultado trazable.", steps: [{ label: "01 · DESCUBRIR", title: "Buscar por intención", body: "Busca capacidades en el catálogo vivo sin memorizar proveedores.", meta: "ordenado por ajuste y precio" }, { label: "02 · INSPECCIONAR", title: "Ver entradas y coste", body: "Revisa campos, ejemplos, unidad y precio Flatkey antes de gastar.", meta: "esquema + precio primero" }, { label: "03 · EJECUTAR", title: "Usar una sola clave", body: "Recibe salida, latencia, cargo y saldo restante en una respuesta.", meta: "una respuesta · un registro" }],
    balanceEyebrow: "Sin pila de suscripciones", balanceTitle: "Modelos y herramientas comparten saldo.", balanceBody: "Sustituye asientos, contratos y credenciales dispersas por una cartera prepaga y registro por request.", stats: [{ value: "1.000+", label: "herramientas medidas" }, { value: "300+", label: "modelos de IA" }, { value: "1", label: "clave y saldo" }, { value: "$0", label: "fallos de Flatkey" }], connectEyebrow: "Tres formas de entrar", connectTitle: "Usa la interfaz que tu flujo ya conoce.", connectBody: "Catálogo, precio y saldo son iguales para humanos y agentes.", methods: [{ title: "Skill", body: "Da SKILL.md a Codex, Claude Code, OpenClaw u otro agente." }, { title: "API", body: "Lista, inspecciona y ejecuta desde tu aplicación." }, { title: "Panel", body: "Explora, prueba entradas y revisa resultados antes de automatizar." }], faqEyebrow: "Preguntas frecuentes", faqTitle: "Lo que los equipos preguntan antes de la primera llamada.", faqs: [{ question: "¿Necesito una clave por proveedor?", answer: "No. El catálogo usa una clave Flatkey y el mismo saldo que los modelos compatibles." }, { question: "¿Cómo se cobra?", answer: "Cada ficha muestra unidad y precio antes de ejecutar: por llamada, resultado, segundo o token." }, { question: "¿Se cobran los fallos?", answer: "Los fallos del lado Flatkey no consumen saldo; la respuesta y el registro muestran el cargo final." }, { question: "¿Qué agentes son compatibles?", answer: "Cualquier agente o app que lea el Skill o llame a la API, sujeto al catálogo y plan." }, { question: "¿Puedo usar mi saldo actual?", answer: "Sí. Pro y superiores comparten cartera entre modelos y Tools." }], finalTitle: "Más herramientas para tu agente, no más suscripciones.", finalBody: "Abre el catálogo, revisa el precio y ejecuta tu primera herramienta.", finalCta: "Abrir Tools Marketplace",
  },
  fr: {
    navLabel: "Tools", metaTitle: "Flatkey Tools — plus de 1 000 outils IA, une seule clé", metaDescription: "Donnez aux agents recherche, enrichissement, navigateur, données sociales, commerce et médias avec une clé Flatkey et un paiement à l'appel réussi.", badge: "En ligne · plus de 1 000 outils mesurés", heroLead: "Une clé pour", heroAccent: "chaque mission", heroTail: "de votre agent.", heroBody: "Rechercher, extraire, enrichir, générer et agir, avec plus de 300 modèles, via une clé et un solde prépayé Flatkey.", commandLabel: "Donnez cette ligne à votre agent", copyLabel: "Copier", copiedLabel: "Copié", primaryCta: "Explorer les outils", secondaryCta: "Obtenir une clé API", heroNote: "Aucune clé fournisseur séparée, aucun siège inactif. Les échecs côté Flatkey coûtent 0 $.", demoPrompt: "Étudier 14 concurrents, enrichir les acheteurs et produire un brief sourcé.", demoLines: ["Signaux web et sociaux trouvés", "Entreprises et décideurs enrichis", "Preuves regroupées dans un brief"], demoBill: "0,83 $ facturé · échecs 0,00 $", catalogEyebrow: "Un catalogue", catalogTitle: "Les outils entre le prompt et le résultat.", catalogBody: "Découvrez par mission, examinez le schéma et le prix exact, puis exécutez avec la même clé Flatkey que vos modèles.", categories: [{ title: "Recherche web", body: "Recherchez, explorez, extrayez et résumez l'information publique récente." }, { title: "Personnes et entreprises", body: "Trouvez, vérifiez et enrichissez comptes, rôles et contacts." }, { title: "Intelligence sociale", body: "Analysez créateurs, posts, communautés, tendances et audiences." }, { title: "Données commerce", body: "Étudiez produits, avis, vendeurs, listings et demande." }, { title: "Automatisation web", body: "Naviguez, collectez des preuves et accomplissez des étapes web." }, { title: "Génération média", body: "Créez images, vidéo, voix, musique et assets prêts." }, { title: "Intelligence de recherche", body: "Étudiez mots-clés, concurrence, trafic et demande." }, { title: "Signaux temps réel", body: "Intégrez actualités, météo et données externes changeantes." }], flowEyebrow: "Runtime natif agent", flowTitle: "Découvrir. Inspecter. Exécuter.", flowBody: "L'agent choisit le plus petit outil utile, voit le contrat avant dépense et renvoie un résultat traçable.", steps: [{ label: "01 · DÉCOUVRIR", title: "Chercher par intention", body: "Cherchez des capacités sans mémoriser les fournisseurs.", meta: "classé par pertinence et prix" }, { label: "02 · INSPECTER", title: "Voir entrées et coût", body: "Lisez champs, exemples, unité et prix avant dépense.", meta: "schéma + prix d'abord" }, { label: "03 · EXÉCUTER", title: "Une seule clé", body: "Recevez sortie, latence, charge et solde restant.", meta: "une réponse · un registre" }], balanceEyebrow: "Sans pile d'abonnements", balanceTitle: "Modèles et outils partagent un solde.", balanceBody: "Remplacez sièges, contrats et identifiants dispersés par un portefeuille prépayé et un registre par requête.", stats: [{ value: "1 000+", label: "outils mesurés" }, { value: "300+", label: "modèles IA" }, { value: "1", label: "clé et solde" }, { value: "0 $", label: "échecs Flatkey" }], connectEyebrow: "Trois accès", connectTitle: "Utilisez l'interface que votre workflow connaît.", connectBody: "Catalogue, prix et solde restent identiques pour humains et agents.", methods: [{ title: "Skill", body: "Donnez SKILL.md à Codex, Claude Code, OpenClaw ou un autre agent." }, { title: "API", body: "Listez, inspectez et exécutez depuis votre application." }, { title: "Dashboard", body: "Explorez, testez les entrées et contrôlez les résultats." }], faqEyebrow: "Questions fréquentes", faqTitle: "Ce que les équipes demandent avant le premier appel.", faqs: [{ question: "Une clé par fournisseur ?", answer: "Non. Le catalogue utilise une clé Flatkey et le même solde que les modèles compatibles." }, { question: "Comment fonctionne le prix ?", answer: "Chaque fiche affiche unité et prix avant exécution : appel, résultat, seconde ou token." }, { question: "Les échecs sont-ils facturés ?", answer: "Les échecs côté Flatkey ne consomment pas le solde ; réponse et registre montrent la charge finale." }, { question: "Quels agents sont compatibles ?", answer: "Tout agent ou app capable de lire le Skill ou appeler l'API, selon catalogue et plan." }, { question: "Mon solde actuel fonctionne-t-il ?", answer: "Oui. Les plans Pro et supérieurs partagent le portefeuille entre modèles et Tools." }], finalTitle: "Plus d'outils pour l'agent, pas plus d'abonnements.", finalBody: "Ouvrez le catalogue, vérifiez le prix et lancez le premier outil.", finalCta: "Ouvrir Tools Marketplace",
  },
  pt: {
    navLabel: "Tools", metaTitle: "Flatkey Tools — mais de 1.000 ferramentas de IA com uma chave", metaDescription: "Dê aos agentes busca, enriquecimento, browser, social, comércio e mídia com uma chave Flatkey e pagamento por chamada bem-sucedida.", badge: "Ao vivo · 1.000+ ferramentas medidas", heroLead: "Uma chave para", heroAccent: "cada trabalho", heroTail: "do seu agente.", heroBody: "Busque, extraia, enriqueça, gere e aja, além de usar 300+ modelos, com uma chave e saldo pré-pago Flatkey.", commandLabel: "Dê esta linha ao seu agente", copyLabel: "Copiar", copiedLabel: "Copiado", primaryCta: "Explorar ferramentas", secondaryCta: "Obter chave API", heroNote: "Sem chaves separadas ou assentos ociosos. Falhas da Flatkey custam US$ 0.", demoPrompt: "Pesquise 14 concorrentes, enriqueça compradores e crie um briefing com fontes.", demoLines: ["Sinais web e sociais encontrados", "Empresas e decisores enriquecidos", "Evidências agrupadas em briefing"], demoBill: "US$ 0,83 cobrados · falhas US$ 0,00", catalogEyebrow: "Um catálogo", catalogTitle: "Ferramentas entre o prompt e o resultado.", catalogBody: "Descubra por tarefa, veja schema e preço exato, e execute com a mesma chave Flatkey dos modelos.", categories: [{ title: "Pesquisa web", body: "Busque, rastreie, extraia e resuma informação pública atual." }, { title: "Pessoas e empresas", body: "Encontre, verifique e enriqueça contas, cargos e contatos." }, { title: "Inteligência social", body: "Analise criadores, posts, comunidades, tendências e audiências." }, { title: "Dados de comércio", body: "Estude produtos, reviews, vendedores, listings e demanda." }, { title: "Automação web", body: "Navegue, colete evidências e conclua etapas na web." }, { title: "Geração de mídia", body: "Crie imagens, vídeo, voz, música e assets prontos." }, { title: "Inteligência de busca", body: "Estude keywords, concorrentes, tráfego e demanda." }, { title: "Sinais em tempo real", body: "Integre notícias, clima e dados externos em mudança." }], flowEyebrow: "Runtime nativo para agentes", flowTitle: "Descubra. Inspecione. Execute.", flowBody: "O agente escolhe a menor ferramenta necessária, vê o contrato antes de gastar e devolve resultado rastreável.", steps: [{ label: "01 · DESCOBRIR", title: "Buscar por intenção", body: "Pesquise capacidades sem memorizar fornecedores.", meta: "ordenado por fit e preço" }, { label: "02 · INSPECIONAR", title: "Ver entradas e custo", body: "Confira campos, exemplos, unidade e preço antes do gasto.", meta: "schema + preço primeiro" }, { label: "03 · EXECUTAR", title: "Usar uma chave", body: "Receba saída, latência, cobrança e saldo restante.", meta: "uma resposta · um ledger" }], balanceEyebrow: "Sem pilha de assinaturas", balanceTitle: "Modelos e ferramentas compartilham saldo.", balanceBody: "Troque assentos, contratos e credenciais dispersas por carteira pré-paga e ledger por request.", stats: [{ value: "1.000+", label: "ferramentas medidas" }, { value: "300+", label: "modelos de IA" }, { value: "1", label: "chave e saldo" }, { value: "US$ 0", label: "falhas Flatkey" }], connectEyebrow: "Três formas", connectTitle: "Use a interface que seu fluxo já conhece.", connectBody: "Catálogo, preço e saldo são iguais para humanos e agentes.", methods: [{ title: "Skill", body: "Dê SKILL.md ao Codex, Claude Code, OpenClaw ou outro agente." }, { title: "API", body: "Liste, inspecione e execute da sua aplicação." }, { title: "Dashboard", body: "Explore, teste entradas e confira resultados." }], faqEyebrow: "Dúvidas comuns", faqTitle: "O que equipes perguntam antes da primeira chamada.", faqs: [{ question: "Preciso de uma chave por fornecedor?", answer: "Não. O catálogo usa uma chave Flatkey e o mesmo saldo dos modelos compatíveis." }, { question: "Como é o preço?", answer: "Cada item mostra unidade e preço antes de executar: chamada, resultado, segundo ou token." }, { question: "Falhas são cobradas?", answer: "Falhas do lado Flatkey não consomem saldo; resposta e ledger mostram a cobrança final." }, { question: "Quais agentes funcionam?", answer: "Qualquer agente ou app que leia o Skill ou chame a API, conforme catálogo e plano." }, { question: "Posso usar meu saldo atual?", answer: "Sim. Pro e superiores compartilham a carteira entre modelos e Tools." }], finalTitle: "Mais ferramentas para o agente, não mais assinaturas.", finalBody: "Abra o catálogo, confira o preço e execute a primeira ferramenta.", finalCta: "Abrir Tools Marketplace",
  },
  ru: {
    navLabel: "Tools", metaTitle: "Flatkey Tools — 1 000+ AI-инструментов с одним ключом", metaDescription: "Дайте агентам поиск, обогащение, браузер, соцсети, commerce и media через один ключ Flatkey с оплатой за успешный вызов.", badge: "Работает · 1 000+ инструментов", heroLead: "Один ключ для", heroAccent: "каждой задачи", heroTail: "вашего агента.", heroBody: "Поиск, сбор, обогащение, генерация и действия плюс 300+ моделей через один ключ и предоплаченный баланс Flatkey.", commandLabel: "Передайте эту строку агенту", copyLabel: "Копировать", copiedLabel: "Скопировано", primaryCta: "Открыть инструменты", secondaryCta: "Получить API-ключ", heroNote: "Без отдельных ключей и пустующих мест. Ошибки на стороне Flatkey стоят $0.", demoPrompt: "Исследуй 14 конкурентов, обогати покупателей и подготовь brief с источниками.", demoLines: ["Найдены web и social сигналы", "Обогащены компании и лица", "Доказательства собраны в brief"], demoBill: "$0,83 списано · ошибки $0,00", catalogEyebrow: "Один каталог", catalogTitle: "Инструменты между prompt и результатом.", catalogBody: "Ищите по задаче, смотрите схему и точную цену, запускайте тем же ключом Flatkey.", categories: [{ title: "Web-исследование", body: "Ищите, обходите, извлекайте и суммируйте свежие данные." }, { title: "Люди и компании", body: "Находите, проверяйте и обогащайте компании, роли и контакты." }, { title: "Социальная аналитика", body: "Изучайте авторов, посты, сообщества, тренды и аудитории." }, { title: "Commerce-данные", body: "Анализируйте товары, отзывы, продавцов, listings и спрос." }, { title: "Автоматизация браузера", body: "Переходите по страницам, собирайте доказательства и выполняйте шаги." }, { title: "Генерация медиа", body: "Создавайте изображения, видео, голос, музыку и готовые assets." }, { title: "Поисковая аналитика", body: "Изучайте keywords, конкурентов, трафик и спрос." }, { title: "Сигналы реального времени", body: "Добавляйте новости, погоду и меняющиеся внешние данные." }], flowEyebrow: "Runtime для агентов", flowTitle: "Найти. Проверить. Запустить.", flowBody: "Агент выбирает минимальный инструмент, видит контракт до расхода и возвращает трассируемый результат.", steps: [{ label: "01 · НАЙТИ", title: "Поиск по намерению", body: "Ищите возможности, не запоминая поставщиков.", meta: "по соответствию и цене" }, { label: "02 · ПРОВЕРИТЬ", title: "Входы и стоимость", body: "Проверьте поля, примеры, единицу и цену заранее.", meta: "схема + цена до расхода" }, { label: "03 · ЗАПУСТИТЬ", title: "Один ключ", body: "Получите результат, задержку, списание и остаток.", meta: "один ответ · один ledger" }], balanceEyebrow: "Без стека подписок", balanceTitle: "Модели и инструменты используют общий баланс.", balanceBody: "Замените места, договоры и credentials одним кошельком и ledger запросов.", stats: [{ value: "1 000+", label: "инструментов" }, { value: "300+", label: "AI-моделей" }, { value: "1", label: "ключ и баланс" }, { value: "$0", label: "ошибки Flatkey" }], connectEyebrow: "Три способа", connectTitle: "Используйте привычный интерфейс.", connectBody: "Каталог, цена и баланс одинаковы для людей и агентов.", methods: [{ title: "Skill", body: "Передайте SKILL.md в Codex, Claude Code, OpenClaw или другому агенту." }, { title: "API", body: "Получайте список, проверяйте и запускайте из приложения." }, { title: "Dashboard", body: "Исследуйте, тестируйте входы и проверяйте результаты." }], faqEyebrow: "Частые вопросы", faqTitle: "Что спрашивают до первого вызова.", faqs: [{ question: "Нужен ключ каждого поставщика?", answer: "Нет. Каталог использует один ключ Flatkey и общий баланс моделей." }, { question: "Как формируется цена?", answer: "Карточка показывает единицу и цену до запуска: вызов, результат, секунда или token." }, { question: "Ошибки оплачиваются?", answer: "Ошибки Flatkey не расходуют баланс; ответ и ledger показывают итог." }, { question: "Какие агенты поддержаны?", answer: "Любой агент или app, читающий Skill или вызывающий API, с учетом каталога и плана." }, { question: "Можно использовать текущий баланс?", answer: "Да. Pro и выше делят кошелек между моделями и Tools." }], finalTitle: "Больше инструментов, а не подписок.", finalBody: "Откройте каталог, проверьте цену и запустите первый инструмент.", finalCta: "Открыть Tools Marketplace",
  },
  ja: {
    navLabel: "Tools", metaTitle: "Flatkey Tools — 1,000以上のAIツールを1つのキーで", metaDescription: "検索、エンリッチメント、ブラウザ、ソーシャル、コマース、メディアを1つのFlatkeyキーでAgentに提供。成功した呼び出しだけ課金。", badge: "提供中 · 1,000以上の従量制ツール", heroLead: "Agentの", heroAccent: "あらゆる仕事", heroTail: "に1つのキー。", heroBody: "検索、収集、補完、生成、実行、さらに300以上のAIモデルを、1つのFlatkeyキーとプリペイド残高で。", commandLabel: "この1行をAgentに渡す", copyLabel: "コピー", copiedLabel: "コピー済み", primaryCta: "ツールを見る", secondaryCta: "APIキーを取得", heroNote: "個別のprovider keyも遊休seatも不要。Flatkey側の失敗は$0です。", demoPrompt: "14社の競合を調査し、購買担当者を補完して、出典付きlaunch briefを作成。", demoLines: ["最新のweb・socialシグナルを発見", "企業と意思決定者をエンリッチ", "根拠をlaunch briefに整理"], demoBill: "$0.83課金 · 失敗$0.00", catalogEyebrow: "1つのカタログ", catalogTitle: "Promptから成果までの作業を支えるツール。", catalogBody: "仕事から機能を探し、入力schemaと正確な価格を確認し、モデルと同じFlatkeyキーで実行します。", categories: [{ title: "Webリサーチ", body: "最新の公開情報を検索、crawl、抽出、要約します。" }, { title: "人物・企業データ", body: "企業、役職、連絡先を検索、検証、エンリッチします。" }, { title: "ソーシャル分析", body: "creator、投稿、community、trend、audienceを調査します。" }, { title: "コマースデータ", body: "商品、review、seller、listing、需要を分析します。" }, { title: "ブラウザ自動化", body: "ページを移動し、証拠を収集し、web操作を完了します。" }, { title: "メディア生成", body: "画像、動画、音声、音楽、納品用assetを作成します。" }, { title: "検索インテリジェンス", body: "keyword、競合、traffic、需要を調査します。" }, { title: "リアルタイムシグナル", body: "news、weather、変化する外部データをworkflowへ追加します。" }], flowEyebrow: "Agentネイティブruntime", flowTitle: "発見。確認。実行。", flowBody: "Agentは最小のツールを選び、支出前に契約を確認し、追跡可能な結果を返します。", steps: [{ label: "01 · 発見", title: "意図から検索", body: "providerを覚えずにlive catalogから機能を検索。", meta: "適合度と価格で順位付け" }, { label: "02 · 確認", title: "入力と費用を見る", body: "必須項目、例、課金単位、価格を先に確認。", meta: "支出前にschema + 価格" }, { label: "03 · 実行", title: "1つのキーで実行", body: "出力、latency、費用、残高を1つの応答で取得。", meta: "1 response · 1 ledger" }], balanceEyebrow: "サブスクの山をなくす", balanceTitle: "モデルとツールが1つの残高を共有。", balanceBody: "分散したseat、契約、credentialを、プリペイドwalletとrequest ledgerに置き換えます。", stats: [{ value: "1,000+", label: "従量制ツール" }, { value: "300+", label: "AIモデル" }, { value: "1", label: "APIキーと残高" }, { value: "$0", label: "Flatkey側の失敗" }], connectEyebrow: "3つの接続方法", connectTitle: "今のworkflowが理解するinterfaceを使う。", connectBody: "人が探索してもAgentが直接呼んでも、catalog、価格、残高は同じです。", methods: [{ title: "Skill", body: "SKILL.mdをCodex、Claude Code、OpenClawなどに渡します。" }, { title: "API", body: "アプリからlist、inspect、runを確定的に実行します。" }, { title: "Dashboard", body: "自動化前にmarketplaceを探索し、入力と結果を確認します。" }], faqEyebrow: "よくある質問", faqTitle: "最初の呼び出し前に確認したいこと。", faqs: [{ question: "providerごとにキーが必要ですか？", answer: "不要です。Flatkey catalogのツールは1つのキーと対応モデルと同じ残高を使います。" }, { question: "料金体系は？", answer: "実行前に単位と価格を表示します。call、result、second、provider tokenなどです。" }, { question: "失敗も課金されますか？", answer: "Flatkey側の失敗は残高を消費せず、responseとledgerに最終料金が出ます。" }, { question: "どのAgentで使えますか？", answer: "Skillを読めるかAPIを呼べるAgent・appで利用できます。catalogとplanに依存します。" }, { question: "既存残高を使えますか？", answer: "はい。Pro以上はモデルとToolsで同じwalletを使います。" }], finalTitle: "サブスクを増やさず、Agentの道具を増やす。", finalBody: "catalogを開き、価格を確認し、最初のツールを実行しましょう。", finalCta: "Tools Marketplaceを開く",
  },
  vi: {
    navLabel: "Tools", metaTitle: "Flatkey Tools — hơn 1.000 công cụ AI với một key", metaDescription: "Cung cấp tìm kiếm, enrichment, browser, social, commerce và media cho agent bằng một Flatkey key, chỉ trả tiền cho call thành công.", badge: "Đang hoạt động · 1.000+ công cụ tính theo dùng", heroLead: "Một key cho", heroAccent: "mọi công việc", heroTail: "agent nhận làm.", heroBody: "Tìm kiếm, crawl, enrich, tạo và hành động, cộng 300+ model, qua một Flatkey key và số dư trả trước.", commandLabel: "Đưa dòng này cho agent", copyLabel: "Sao chép", copiedLabel: "Đã sao chép", primaryCta: "Xem công cụ", secondaryCta: "Lấy API key", heroNote: "Không cần key riêng hay seat nhàn rỗi. Lỗi phía Flatkey có giá $0.", demoPrompt: "Nghiên cứu 14 đối thủ, enrich người mua và tạo launch brief có nguồn.", demoLines: ["Đã tìm tín hiệu web và social", "Đã enrich công ty và người quyết định", "Đã nhóm bằng chứng vào brief"], demoBill: "Tính $0,83 · call lỗi $0,00", catalogEyebrow: "Một catalog", catalogTitle: "Công cụ cho công việc giữa prompt và kết quả.", catalogBody: "Khám phá theo job, xem schema và giá chính xác, rồi chạy bằng cùng Flatkey key của model.", categories: [{ title: "Nghiên cứu web", body: "Tìm, crawl, trích xuất và tóm tắt dữ liệu công khai mới." }, { title: "Người và công ty", body: "Tìm, xác minh và enrich account, vai trò và liên hệ." }, { title: "Social intelligence", body: "Nghiên cứu creator, post, community, trend và audience." }, { title: "Dữ liệu commerce", body: "Phân tích sản phẩm, review, seller, listing và nhu cầu." }, { title: "Tự động hóa browser", body: "Điều hướng trang, thu thập bằng chứng và hoàn thành bước web." }, { title: "Tạo media", body: "Tạo ảnh, video, voice, nhạc và asset sẵn dùng." }, { title: "Search intelligence", body: "Nghiên cứu keyword, đối thủ, traffic và nhu cầu." }, { title: "Tín hiệu thời gian thực", body: "Đưa news, weather và dữ liệu ngoài đang đổi vào workflow." }], flowEyebrow: "Runtime gốc cho agent", flowTitle: "Khám phá. Kiểm tra. Chạy.", flowBody: "Agent chọn công cụ nhỏ nhất, thấy contract trước khi chi và trả kết quả truy vết được.", steps: [{ label: "01 · KHÁM PHÁ", title: "Tìm theo ý định", body: "Tìm capability mà không cần nhớ provider.", meta: "xếp theo độ hợp và giá" }, { label: "02 · KIỂM TRA", title: "Xem input và chi phí", body: "Xem field, ví dụ, đơn vị và giá trước khi chi.", meta: "schema + giá trước" }, { label: "03 · CHẠY", title: "Một key để chạy", body: "Nhận output, latency, charge và số dư còn lại.", meta: "một response · một ledger" }], balanceEyebrow: "Không chồng subscription", balanceTitle: "Model và tool dùng chung một số dư.", balanceBody: "Thay seat, contract và credential rời rạc bằng ví trả trước và ledger từng request.", stats: [{ value: "1.000+", label: "công cụ theo dùng" }, { value: "300+", label: "model AI" }, { value: "1", label: "key và số dư" }, { value: "$0", label: "lỗi phía Flatkey" }], connectEyebrow: "Ba cách kết nối", connectTitle: "Dùng interface workflow đã biết.", connectBody: "Catalog, giá và số dư giống nhau cho người và agent.", methods: [{ title: "Skill", body: "Đưa SKILL.md cho Codex, Claude Code, OpenClaw hoặc agent khác." }, { title: "API", body: "List, inspect và run từ ứng dụng." }, { title: "Dashboard", body: "Duyệt, thử input và xem kết quả trước tự động hóa." }], faqEyebrow: "Câu hỏi thường gặp", faqTitle: "Điều team hỏi trước call đầu tiên.", faqs: [{ question: "Cần key cho từng provider?", answer: "Không. Catalog dùng một Flatkey key và cùng số dư với model hỗ trợ." }, { question: "Giá thế nào?", answer: "Mỗi listing cho thấy đơn vị và giá trước chạy: call, result, second hoặc token." }, { question: "Call lỗi có bị tính phí?", answer: "Lỗi phía Flatkey không dùng số dư; response và ledger hiện charge cuối." }, { question: "Agent nào dùng được?", answer: "Agent hoặc app đọc Skill hay gọi API được, tùy catalog và plan." }, { question: "Dùng số dư hiện tại được không?", answer: "Có. Pro trở lên dùng chung wallet cho model và Tools." }], finalTitle: "Thêm công cụ cho agent, không thêm subscription.", finalBody: "Mở catalog, xem giá và chạy công cụ đầu tiên.", finalCta: "Mở Tools Marketplace",
  },
  de: {
    navLabel: "Tools", metaTitle: "Flatkey Tools — über 1.000 KI-Tools mit einem Key", metaDescription: "Gib Agents Suche, Enrichment, Browser, Social, Commerce und Medien mit einem Flatkey-Key und bezahle nur erfolgreiche Aufrufe.", badge: "Live · über 1.000 gemessene Tools", heroLead: "Ein Key für", heroAccent: "jeden Job", heroTail: "deines Agents.", heroBody: "Suchen, crawlen, anreichern, generieren und handeln plus 300+ Modelle mit einem Flatkey-Key und Prepaid-Guthaben.", commandLabel: "Gib diese Zeile deinem Agent", copyLabel: "Kopieren", copiedLabel: "Kopiert", primaryCta: "Tools ansehen", secondaryCta: "API-Key holen", heroNote: "Keine separaten Provider-Keys, keine leeren Seats. Flatkey-seitige Fehler kosten $0.", demoPrompt: "Recherchiere 14 Wettbewerber, enrichere Käufer und erstelle ein belegtes Launch-Briefing.", demoLines: ["Web- und Social-Signale gefunden", "Firmen und Entscheider angereichert", "Belege im Launch-Briefing gebündelt"], demoBill: "$0,83 berechnet · Fehler $0,00", catalogEyebrow: "Ein Katalog", catalogTitle: "Tools für die Arbeit zwischen Prompt und Ergebnis.", catalogBody: "Nach Job entdecken, Schema und exakten Preis prüfen und mit demselben Flatkey-Key wie Modelle ausführen.", categories: [{ title: "Web-Recherche", body: "Aktuelle öffentliche Daten suchen, crawlen, extrahieren und zusammenfassen." }, { title: "Personen und Firmen", body: "Accounts, Rollen und Kontakte finden, prüfen und anreichern." }, { title: "Social Intelligence", body: "Creator, Posts, Communities, Trends und Zielgruppen untersuchen." }, { title: "Commerce-Daten", body: "Produkte, Reviews, Seller, Listings und Nachfrage analysieren." }, { title: "Browser-Automation", body: "Seiten navigieren, Belege sammeln und Web-Schritte erledigen." }, { title: "Mediengenerierung", body: "Bilder, Video, Voice, Musik und fertige Assets erstellen." }, { title: "Search Intelligence", body: "Keywords, Wettbewerber, Traffic und Nachfrage untersuchen." }, { title: "Echtzeit-Signale", body: "News, Wetter und wechselnde externe Daten integrieren." }], flowEyebrow: "Agent-nativer Runtime", flowTitle: "Entdecken. Prüfen. Ausführen.", flowBody: "Der Agent wählt das kleinste Tool, sieht den Vertrag vor Ausgaben und liefert ein nachvollziehbares Ergebnis.", steps: [{ label: "01 · ENTDECKEN", title: "Nach Absicht suchen", body: "Capabilities suchen, ohne Provider auswendig zu lernen.", meta: "nach Fit und Preis sortiert" }, { label: "02 · PRÜFEN", title: "Inputs und Kosten sehen", body: "Felder, Beispiele, Einheit und Preis vorher prüfen.", meta: "Schema + Preis vor Ausgaben" }, { label: "03 · AUSFÜHREN", title: "Mit einem Key", body: "Output, Latenz, Kosten und Restguthaben erhalten.", meta: "eine Antwort · ein Ledger" }], balanceEyebrow: "Kein Abo-Stapel", balanceTitle: "Modelle und Tools teilen ein Guthaben.", balanceBody: "Ersetze Seats, Verträge und verstreute Credentials durch Prepaid-Wallet und Request-Ledger.", stats: [{ value: "1.000+", label: "gemessene Tools" }, { value: "300+", label: "KI-Modelle" }, { value: "1", label: "Key und Guthaben" }, { value: "$0", label: "Flatkey-Fehler" }], connectEyebrow: "Drei Zugänge", connectTitle: "Nutze das Interface, das dein Workflow kennt.", connectBody: "Katalog, Preis und Guthaben bleiben für Mensch und Agent gleich.", methods: [{ title: "Skill", body: "Gib SKILL.md an Codex, Claude Code, OpenClaw oder andere Agents." }, { title: "API", body: "Tools aus deiner Anwendung listen, prüfen und ausführen." }, { title: "Dashboard", body: "Marketplace durchsuchen, Inputs testen und Ergebnisse prüfen." }], faqEyebrow: "Häufige Fragen", faqTitle: "Was Teams vor dem ersten Aufruf fragen.", faqs: [{ question: "Brauche ich pro Provider einen Key?", answer: "Nein. Der Flatkey-Katalog nutzt einen Key und dasselbe Guthaben wie unterstützte Modelle." }, { question: "Wie wird abgerechnet?", answer: "Jedes Listing zeigt Einheit und Preis vorab: Aufruf, Ergebnis, Sekunde oder Token." }, { question: "Werden Fehler berechnet?", answer: "Flatkey-seitige Fehler verbrauchen kein Guthaben; Antwort und Ledger zeigen den Endbetrag." }, { question: "Welche Agents funktionieren?", answer: "Jeder Agent oder jede App, die den Skill liest oder die API aufruft, abhängig von Katalog und Plan." }, { question: "Kann ich mein Guthaben nutzen?", answer: "Ja. Pro und höher teilen das Wallet zwischen Modellen und Tools." }], finalTitle: "Mehr Werkzeuge für den Agent, nicht mehr Abos.", finalBody: "Öffne den Katalog, prüfe den Preis und starte das erste Tool.", finalCta: "Tools Marketplace öffnen",
  },
  id: {
    navLabel: "Tools", metaTitle: "Flatkey Tools — 1.000+ alat AI dengan satu key", metaDescription: "Berikan pencarian, enrichment, browser, sosial, commerce, dan media kepada agent melalui satu Flatkey key; bayar hanya panggilan berhasil.", badge: "Live · 1.000+ alat terukur", heroLead: "Satu key untuk", heroAccent: "setiap pekerjaan", heroTail: "agent Anda.", heroBody: "Cari, crawl, enrich, hasilkan, dan bertindak, plus 300+ model, dengan satu Flatkey key dan saldo prabayar.", commandLabel: "Berikan baris ini kepada agent", copyLabel: "Salin", copiedLabel: "Tersalin", primaryCta: "Jelajahi tools", secondaryCta: "Dapatkan API key", heroNote: "Tanpa key provider terpisah atau seat menganggur. Kegagalan sisi Flatkey berbiaya $0.", demoPrompt: "Riset 14 pesaing, enrich pembeli, dan buat launch brief bersumber.", demoLines: ["Sinyal web dan sosial ditemukan", "Perusahaan dan pengambil keputusan diperkaya", "Bukti disusun menjadi brief"], demoBill: "$0,83 ditagih · gagal $0,00", catalogEyebrow: "Satu katalog", catalogTitle: "Tools untuk pekerjaan antara prompt dan hasil.", catalogBody: "Temukan berdasarkan tugas, periksa schema dan harga pasti, lalu jalankan dengan Flatkey key yang sama.", categories: [{ title: "Riset web", body: "Cari, crawl, ekstrak, dan rangkum informasi publik terbaru." }, { title: "Orang dan perusahaan", body: "Temukan, verifikasi, dan enrich account, jabatan, serta kontak." }, { title: "Intelijen sosial", body: "Riset creator, post, komunitas, tren, dan audience." }, { title: "Data commerce", body: "Analisis produk, review, seller, listing, dan permintaan." }, { title: "Otomasi browser", body: "Navigasi halaman, kumpulkan bukti, dan selesaikan langkah web." }, { title: "Generasi media", body: "Buat gambar, video, suara, musik, dan asset siap pakai." }, { title: "Intelijen pencarian", body: "Pelajari keyword, pesaing, traffic, dan permintaan." }, { title: "Sinyal real-time", body: "Masukkan berita, cuaca, dan data eksternal yang berubah." }], flowEyebrow: "Runtime native untuk agent", flowTitle: "Temukan. Periksa. Jalankan.", flowBody: "Agent memilih alat terkecil, melihat contract sebelum belanja, dan mengembalikan hasil terlacak.", steps: [{ label: "01 · TEMUKAN", title: "Cari berdasarkan intent", body: "Cari capability tanpa menghafal provider.", meta: "diurutkan menurut kecocokan dan harga" }, { label: "02 · PERIKSA", title: "Lihat input dan biaya", body: "Periksa field, contoh, unit, dan harga sebelum belanja.", meta: "schema + harga lebih dulu" }, { label: "03 · JALANKAN", title: "Gunakan satu key", body: "Dapatkan output, latency, biaya, dan sisa saldo.", meta: "satu response · satu ledger" }], balanceEyebrow: "Tanpa tumpukan langganan", balanceTitle: "Model dan tools berbagi satu saldo.", balanceBody: "Ganti seat, contract, dan credential terpisah dengan wallet prabayar dan ledger per request.", stats: [{ value: "1.000+", label: "tools terukur" }, { value: "300+", label: "model AI" }, { value: "1", label: "key dan saldo" }, { value: "$0", label: "kegagalan Flatkey" }], connectEyebrow: "Tiga cara masuk", connectTitle: "Gunakan interface yang sudah dikenal workflow.", connectBody: "Katalog, harga, dan saldo sama untuk manusia maupun agent.", methods: [{ title: "Skill", body: "Berikan SKILL.md ke Codex, Claude Code, OpenClaw, atau agent lain." }, { title: "API", body: "List, inspect, dan run tools dari aplikasi Anda." }, { title: "Dashboard", body: "Jelajahi, uji input, dan periksa hasil sebelum otomasi." }], faqEyebrow: "Pertanyaan umum", faqTitle: "Yang ditanyakan tim sebelum panggilan pertama.", faqs: [{ question: "Perlu key untuk tiap provider?", answer: "Tidak. Katalog memakai satu Flatkey key dan saldo yang sama dengan model yang didukung." }, { question: "Bagaimana harganya?", answer: "Setiap listing menunjukkan unit dan harga sebelum jalan: call, result, second, atau token." }, { question: "Apakah kegagalan ditagih?", answer: "Kegagalan sisi Flatkey tidak memakai saldo; response dan ledger menunjukkan biaya akhir." }, { question: "Agent apa yang didukung?", answer: "Agent atau app yang dapat membaca Skill atau memanggil API, sesuai katalog dan plan." }, { question: "Bisa pakai saldo saat ini?", answer: "Ya. Pro dan di atasnya berbagi wallet untuk model dan Tools." }], finalTitle: "Tambah toolbox agent, bukan tumpukan langganan.", finalBody: "Buka katalog, periksa harga, dan jalankan tool pertama.", finalCta: "Buka Tools Marketplace",
  },
};

export function getToolsLandingMetadataInput(locale: Locale) {
  const copy = toolsLandingCopy[locale];
  return { title: copy.metaTitle, description: copy.metaDescription, pathname: TOOLS_LANDING_PATH, locale };
}

export function getToolsMarketplaceUrl(locale: Locale) {
  return consoleUrl("/api-marketplace", `lng=${locale}`);
}

export function getToolsSignupUrl(locale: Locale) {
  return consoleUrl("/sign-up", `redirect=${encodeURIComponent("/api-marketplace")}&lng=${locale}`);
}

export function getLocalizedToolsPath(locale: Locale) {
  return localizePath(TOOLS_LANDING_PATH, locale);
}
