import {
  ArrowRight,
  BadgeDollarSign,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Gauge,
  KeyRound,
  LineChart,
  Route,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import Image from "next/image";
import { ClaudeCodeInstallTabs } from "@/components/claude-code-install-tabs";
import { SiteShell } from "@/components/site-shell";
import { CLAUDE_CODE_BASE_URL, CLAUDE_CODE_KEY_URL } from "@/lib/claude-code-use-case";
import type { Locale } from "@/lib/locales";
import { consoleUrl } from "@/lib/origins";

type UseCaseConfig = {
  pathname: string;
  toolName: string;
  endpointText: string;
  installMode?: "coding-agent" | "image-buddy";
  badge: string;
  headlineLead: string;
  headlineAccent: string;
  intro: string;
  selectInstruction: string;
  directLabel: string;
  flatkeyLabel: string;
  moreUsageLine: string;
  useCases: Array<{ title: string; body: string }>;
  faqs: Array<{ question: string; answer: string }>;
};

type UseCaseSlug = "claude-code" | "codex" | "image-buddy";

type PageCopy = {
  ctaGetKey: string;
  ctaInstall: string;
  metricCheap: string;
  metricCheapLabel: string;
  metricSetup: string;
  metricSetupLabel: string;
  metricKey: string;
  metricKeyLabel: string;
  usagePill: string;
  officialPrice: string;
  officialSpend: string;
  flatkeyCheap: string;
  oneKeyBalance: (toolName: string) => string;
  valueProps: Array<{ title: string; body: string }>;
  quickStartTitle: string;
  quickStartSuffix: string;
  quickStartModelNote?: string;
  quickStartGithubLabel?: string;
  getKeyLink: string;
  whyUsage: (toolName: string) => string;
  whyUsageBody: (toolName: string) => string;
  comparisonTitle: string;
  comparisonHeaders: [string, string, string];
  comparisonRows: Array<[string, string, string]>;
  actionCards: (toolName: string) => Array<{ title: string; body: string }>;
  faqTitle: string;
  finalTitle: (toolName: string) => string;
  finalBody: (toolName: string) => string;
};

type Props = {
  config: UseCaseConfig;
  locale: Locale;
};

const signUpUrl = consoleUrl("/sign-up");
const IMAGE_BUDDY_GITHUB_URL = "https://github.com/flatkey-ai/awesome-images";

export const CLAUDE_CODE_USE_CASE: UseCaseConfig = {
  pathname: "/use-case/claude-code",
  toolName: "Claude Code",
  endpointText: CLAUDE_CODE_BASE_URL,
  badge: "Claude Code through Flatkey · at least 40% cheaper",
  headlineLead: "Use Claude Code at least",
  headlineAccent: "40% cheaper",
  intro:
    "Keep the official Claude Code workflow customers already want, but route it through Flatkey for at least 40% lower metered usage, one prepaid balance, and visible spend.",
  selectInstruction: "Select Claude Code when the installer asks which coding agent to configure.",
  directLabel: "Official Claude Code setup",
  flatkeyLabel: "Flatkey-routed Claude Code",
  moreUsageLine: "Use more Claude Code without losing spend control.",
  useCases: [
    { title: "Repository exploration", body: "Let Claude Code scan, explain, and map large codebases while usage lands in Flatkey." },
    { title: "Refactor loops", body: "Run more edit-test-review cycles with visible cost and prepaid balance control." },
    { title: "Team onboarding", body: "Give every engineer the same command, key page, and Claude Code routing path." },
    { title: "Client engineering work", body: "Keep client Claude Code sessions under one auditable usage trail." },
  ],
  faqs: [
    { question: "What base URL does Claude Code use?", answer: "Claude Code is configured with https://router.flatkey.ai and your Flatkey API key." },
    { question: "Where do users create the key?", answer: "Create or copy the API key at https://console.flatkey.ai/keys before running the installer." },
    { question: "Which option should users choose in the installer?", answer: "Choose Claude Code when prompted, then restart the terminal and run claude." },
    { question: "Why does this help usage grow?", answer: "Claude Code creates repeated model calls during real coding work. Flatkey makes that cheaper, prepaid, visible, and controlled." },
  ],
};

export const CODEX_USE_CASE: UseCaseConfig = {
  pathname: "/use-case/codex",
  toolName: "Codex",
  endpointText: "https://router.flatkey.ai/v1",
  badge: "Codex CLI through Flatkey · at least 40% cheaper",
  headlineLead: "Use Codex at least",
  headlineAccent: "40% cheaper",
  intro:
    "Keep the OpenAI-compatible Codex CLI workflow, but route it through Flatkey for at least 40% lower metered usage, one prepaid balance, and visible spend.",
  selectInstruction: "Select Codex CLI when the installer asks which coding agent to configure.",
  directLabel: "Official Codex setup",
  flatkeyLabel: "Flatkey-routed Codex",
  moreUsageLine: "Use more Codex without losing spend control.",
  useCases: [
    { title: "CLI coding sessions", body: "Route Codex prompts, edits, and follow-up runs through one Flatkey balance." },
    { title: "Automated fix loops", body: "Use Codex for bug fixes and test iteration while each request remains measurable." },
    { title: "Customer onboarding", body: "Give users one copy-paste command instead of manual API and config instructions." },
    { title: "Team cost control", body: "Keep Codex usage visible with model logs, balance records, and centralized billing." },
  ],
  faqs: [
    { question: "What endpoint does Codex use?", answer: "Codex CLI is configured against the OpenAI-compatible https://router.flatkey.ai/v1 endpoint." },
    { question: "Where do users create the key?", answer: "Create or copy the API key at https://console.flatkey.ai/keys before running the installer." },
    { question: "Which option should users choose in the installer?", answer: "Choose Codex CLI when prompted, then restart the terminal and run codex." },
    { question: "Why does this help usage grow?", answer: "Codex creates repeated model calls during real terminal work. Flatkey makes that cheaper, prepaid, visible, and controlled." },
  ],
};

export const IMAGE_BUDDY_USE_CASE: UseCaseConfig = {
  pathname: "/use-case/image-buddy",
  toolName: "Image Buddy",
  endpointText: "npx @flatkey-ai/image-buddy",
  installMode: "image-buddy",
  badge: "Image generation with Flatkey · around 40% cheaper",
  headlineLead: "Generate commercial images",
  headlineAccent: "with Image Buddy",
  intro:
    "Use Flatkey.ai for lower-cost image generation and Image Buddy for commercial prompts that turn a short idea into usable product images, ads, avatars, app visuals, and ecommerce creatives.",
  selectInstruction: "Run the CLI directly with one install command, one onboard command, and one generate command.",
  directLabel: "Raw image generation",
  flatkeyLabel: "Flatkey + Image Buddy",
  moreUsageLine: "Generate more usable images with lower cost and less prompt work.",
  useCases: [
    { title: "Product marketing images", body: "Turn a short product idea into polished hero images for landing pages and campaigns." },
    { title: "Multilingual image workflows", body: "Give teams a simple CLI they can run from any terminal." },
    { title: "Ecommerce and social ads", body: "Create product shots, UGC-style ad stills, posters, and vertical demo creatives." },
    { title: "Template-driven generation", body: "Use templates like product-shot plus a short ecommerce hint, without learning every variable name." },
  ],
  faqs: [
    { question: "What does Image Buddy install?", answer: "It installs the @flatkey-ai/image-buddy CLI and uses your Flatkey API key to generate images." },
    { question: "Where do users create the key?", answer: "Create or copy the API key at https://console.flatkey.ai/keys before running image-buddy onboard." },
    { question: "Can teams run it without setup docs?", answer: "Yes. The quickstart covers install, onboard, and generate with three commands." },
    { question: "Why does this help image usage grow?", answer: "Flatkey lowers generation cost while Image Buddy removes prompt friction with templates, hints, and a local demo gallery." },
  ],
};

const localizedImageBuddyUseCases: Record<Locale, UseCaseConfig> = {
  en: IMAGE_BUDDY_USE_CASE,
  zh: {
    ...IMAGE_BUDDY_USE_CASE,
    badge: "通过 Flatkey 生成图片 · 约便宜 40%",
    headlineLead: "用 Image Buddy 生成",
    headlineAccent: "商业可用图片",
    intro: "用 Flatkey.ai 降低生图成本，再用 Image Buddy 的商业提示词库把一句话变成可用的产品图、广告图、头像、App 图和电商素材。",
    selectInstruction: "直接运行 CLI：一次安装、一次初始化、一次生成。",
    directLabel: "裸生图流程",
    flatkeyLabel: "Flatkey + Image Buddy",
    moreUsageLine: "用更低成本和更少提示词调试生成更多可用图片。",
    useCases: [
      { title: "产品营销图", body: "把一句产品想法生成落地页、广告和活动可用的主视觉。" },
      { title: "多语言图片工作流", body: "给不同语言用户同一套可以直接在终端运行的 CLI。" },
      { title: "电商与社媒广告", body: "生成产品图、UGC 广告封面、海报和竖版 demo 素材。" },
      { title: "模板化生成", body: "用 product-shot 这类模板加一个电商短 hint，不必学习每个变量名。" },
    ],
    faqs: [
      { question: "Image Buddy 会安装什么？", answer: "它安装 @flatkey-ai/image-buddy CLI，并用你的 Flatkey API key 生成图片。" },
      { question: "用户在哪里创建 key？", answer: "运行 image-buddy onboard 前，在 https://console.flatkey.ai/keys 创建或复制 API key。" },
      { question: "团队不用额外文档也能跑吗？", answer: "可以。快速开始只需要安装、初始化和生成三条命令。" },
      { question: "为什么这能提升生图用量？", answer: "Flatkey 降低生成成本，Image Buddy 用模板、hint 和本地 demo gallery 降低提示词门槛。" },
    ],
  },
  es: {
    ...IMAGE_BUDDY_USE_CASE,
    badge: "Generación de imágenes con Flatkey · cerca de 40% más barata",
    headlineLead: "Genera imágenes comerciales",
    headlineAccent: "con Image Buddy",
    intro: "Usa Flatkey.ai para reducir el coste de generación de imágenes e Image Buddy para convertir una idea corta en imágenes de producto, anuncios, avatares, visuales de app y creatividades ecommerce.",
    selectInstruction: "Ejecuta la CLI directamente: instalar, inicializar y generar.",
    directLabel: "Generación de imágenes manual",
    flatkeyLabel: "Flatkey + Image Buddy",
    moreUsageLine: "Genera más imágenes utilizables con menor coste y menos trabajo de prompt.",
    useCases: [
      { title: "Imágenes de producto", body: "Convierte una idea de producto en hero images para landing pages y campañas." },
      { title: "Flujos multilingües", body: "Da a los equipos una CLI simple que pueden ejecutar desde cualquier terminal." },
      { title: "Ecommerce y anuncios sociales", body: "Crea fotos de producto, frames UGC, posters y creatividades verticales." },
      { title: "Generación con plantillas", body: "Usa plantillas como product-shot con un hint ecommerce corto, sin aprender cada variable." },
    ],
    faqs: [
      { question: "¿Qué instala Image Buddy?", answer: "Instala la CLI @flatkey-ai/image-buddy y usa tu API key de Flatkey para generar imágenes." },
      { question: "¿Dónde se crea la key?", answer: "Crea o copia la API key en https://console.flatkey.ai/keys antes de ejecutar image-buddy onboard." },
      { question: "¿Pueden usarlo los equipos sin documentación extra?", answer: "Sí. El quickstart cubre instalar, inicializar y generar con tres comandos." },
      { question: "¿Por qué aumenta el uso de imágenes?", answer: "Flatkey baja el coste e Image Buddy reduce la fricción con plantillas, hints y una demo gallery local." },
    ],
  },
  fr: {
    ...IMAGE_BUDDY_USE_CASE,
    badge: "Génération d'images avec Flatkey · environ 40% moins chère",
    headlineLead: "Générez des images commerciales",
    headlineAccent: "avec Image Buddy",
    intro: "Utilisez Flatkey.ai pour réduire le coût de génération d'images et Image Buddy pour transformer une idée courte en visuels produit, publicités, avatars, écrans d'app et créations ecommerce.",
    selectInstruction: "Lancez directement le CLI : installation, initialisation, génération.",
    directLabel: "Génération d'image brute",
    flatkeyLabel: "Flatkey + Image Buddy",
    moreUsageLine: "Générez plus d'images exploitables avec moins de coût et moins de travail de prompt.",
    useCases: [
      { title: "Images marketing produit", body: "Transformez une idée produit en visuels hero pour landing pages et campagnes." },
      { title: "Workflows multilingues", body: "Donnez aux équipes un CLI simple à lancer depuis n'importe quel terminal." },
      { title: "Ecommerce et social ads", body: "Créez photos produit, frames UGC, posters et créations verticales." },
      { title: "Génération par template", body: "Utilisez des templates comme product-shot avec un court hint ecommerce, sans apprendre chaque variable." },
    ],
    faqs: [
      { question: "Qu'installe Image Buddy ?", answer: "Il installe le CLI @flatkey-ai/image-buddy et utilise votre clé API Flatkey pour générer des images." },
      { question: "Où créer la clé ?", answer: "Créez ou copiez la clé API sur https://console.flatkey.ai/keys avant image-buddy onboard." },
      { question: "Les équipes peuvent-elles l'utiliser sans documentation supplémentaire ?", answer: "Oui. Le quickstart couvre installation, initialisation et génération en trois commandes." },
      { question: "Pourquoi cela augmente l'usage image ?", answer: "Flatkey baisse le coût, Image Buddy réduit la friction avec templates, hints et demo gallery locale." },
    ],
  },
  pt: {
    ...IMAGE_BUDDY_USE_CASE,
    badge: "Geração de imagens com Flatkey · cerca de 40% mais barata",
    headlineLead: "Gere imagens comerciais",
    headlineAccent: "com Image Buddy",
    intro: "Use Flatkey.ai para reduzir o custo de geração de imagens e Image Buddy para transformar uma ideia curta em imagens de produto, anúncios, avatares, visuais de app e criativos ecommerce.",
    selectInstruction: "Rode a CLI diretamente: instalar, inicializar e gerar.",
    directLabel: "Geração de imagem pura",
    flatkeyLabel: "Flatkey + Image Buddy",
    moreUsageLine: "Gere mais imagens utilizáveis com menor custo e menos trabalho de prompt.",
    useCases: [
      { title: "Imagens de produto", body: "Transforme uma ideia de produto em hero images para landing pages e campanhas." },
      { title: "Fluxos multilíngues", body: "Dê às equipes uma CLI simples que roda em qualquer terminal." },
      { title: "Ecommerce e social ads", body: "Crie fotos de produto, frames UGC, pôsteres e criativos verticais." },
      { title: "Geração por template", body: "Use templates como product-shot com um hint curto de ecommerce, sem aprender cada variável." },
    ],
    faqs: [
      { question: "O que o Image Buddy instala?", answer: "Ele instala a CLI @flatkey-ai/image-buddy e usa sua API key Flatkey para gerar imagens." },
      { question: "Onde criar a key?", answer: "Crie ou copie a API key em https://console.flatkey.ai/keys antes de rodar image-buddy onboard." },
      { question: "Equipes conseguem usar sem docs extras?", answer: "Sim. O quickstart cobre instalar, inicializar e gerar com três comandos." },
      { question: "Por que isso aumenta o uso de imagem?", answer: "Flatkey reduz custo e Image Buddy reduz fricção com templates, hints e uma demo gallery local." },
    ],
  },
  ru: {
    ...IMAGE_BUDDY_USE_CASE,
    badge: "Генерация изображений с Flatkey · примерно на 40% дешевле",
    headlineLead: "Создавайте коммерческие изображения",
    headlineAccent: "с Image Buddy",
    intro: "Используйте Flatkey.ai для более дешевой генерации изображений, а Image Buddy — чтобы превращать короткую идею в продуктовые изображения, рекламу, аватары, UI-визуалы и ecommerce-креативы.",
    selectInstruction: "Запустите CLI напрямую: установка, инициализация и генерация.",
    directLabel: "Ручная генерация изображений",
    flatkeyLabel: "Flatkey + Image Buddy",
    moreUsageLine: "Создавайте больше полезных изображений дешевле и с меньшей работой над prompt.",
    useCases: [
      { title: "Продуктовый маркетинг", body: "Превращайте идею продукта в hero-визуалы для лендингов и кампаний." },
      { title: "Мультиязычные workflows", body: "Дайте командам простой CLI, который запускается из любого терминала." },
      { title: "Ecommerce и social ads", body: "Создавайте product shots, UGC-кадры, постеры и вертикальные креативы." },
      { title: "Генерация по шаблонам", body: "Используйте шаблоны вроде product-shot с коротким ecommerce hint без изучения переменных." },
    ],
    faqs: [
      { question: "Что устанавливает Image Buddy?", answer: "CLI @flatkey-ai/image-buddy, который использует ваш Flatkey API key для генерации изображений." },
      { question: "Где создать key?", answer: "Создайте или скопируйте API key на https://console.flatkey.ai/keys перед image-buddy onboard." },
      { question: "Можно ли использовать без дополнительных docs?", answer: "Да. Quickstart покрывает установку, инициализацию и генерацию тремя командами." },
      { question: "Почему это увеличивает image usage?", answer: "Flatkey снижает стоимость, а Image Buddy убирает трение через templates, hints и локальную demo gallery." },
    ],
  },
  ja: {
    ...IMAGE_BUDDY_USE_CASE,
    badge: "Flatkey で画像生成 · 約 40% 安く",
    headlineLead: "Image Buddy で",
    headlineAccent: "商用画像を生成",
    intro: "Flatkey.ai で画像生成コストを下げ、Image Buddy の商用プロンプト集で短いアイデアを商品画像、広告、アバター、アプリ画像、EC クリエイティブに変換します。",
    selectInstruction: "CLI を直接実行します。インストール、初期化、生成の 3 コマンドです。",
    directLabel: "素の画像生成",
    flatkeyLabel: "Flatkey + Image Buddy",
    moreUsageLine: "低コストかつ少ない prompt 作業で、使える画像を増やせます。",
    useCases: [
      { title: "商品マーケティング画像", body: "短い商品アイデアからランディングページや広告用の hero image を作成します。" },
      { title: "多言語画像ワークフロー", body: "どのターミナルからでも実行できるシンプルな CLI を提供します。" },
      { title: "EC と SNS 広告", body: "商品写真、UGC 風広告フレーム、ポスター、縦型クリエイティブを作成します。" },
      { title: "テンプレート生成", body: "product-shot などのテンプレートを短い EC hint で使え、変数名を覚える必要がありません。" },
    ],
    faqs: [
      { question: "Image Buddy は何をインストールしますか？", answer: "@flatkey-ai/image-buddy CLI をインストールし、Flatkey API key で画像を生成します。" },
      { question: "key はどこで作りますか？", answer: "image-buddy onboard の前に https://console.flatkey.ai/keys で API key を作成またはコピーします。" },
      { question: "追加ドキュメントなしで使えますか？", answer: "はい。quickstart はインストール、初期化、生成の 3 コマンドだけです。" },
      { question: "なぜ画像利用が増えますか？", answer: "Flatkey がコストを下げ、Image Buddy が templates、hints、local demo gallery で prompt の手間を減らします。" },
    ],
  },
  vi: {
    ...IMAGE_BUDDY_USE_CASE,
    badge: "Tạo ảnh với Flatkey · rẻ hơn khoảng 40%",
    headlineLead: "Tạo ảnh thương mại",
    headlineAccent: "với Image Buddy",
    intro: "Dùng Flatkey.ai để giảm chi phí tạo ảnh, và dùng Image Buddy để biến một ý tưởng ngắn thành ảnh sản phẩm, quảng cáo, avatar, hình app và creative ecommerce.",
    selectInstruction: "Chạy CLI trực tiếp: cài đặt, khởi tạo, rồi tạo ảnh.",
    directLabel: "Tạo ảnh thủ công",
    flatkeyLabel: "Flatkey + Image Buddy",
    moreUsageLine: "Tạo nhiều ảnh dùng được hơn với chi phí thấp hơn và ít chỉnh prompt hơn.",
    useCases: [
      { title: "Ảnh marketing sản phẩm", body: "Biến ý tưởng sản phẩm thành hero image cho landing page và chiến dịch." },
      { title: "Workflow đa ngôn ngữ", body: "Cung cấp CLI đơn giản chạy được từ mọi terminal." },
      { title: "Ecommerce và social ads", body: "Tạo ảnh sản phẩm, frame quảng cáo UGC, poster và creative dọc." },
      { title: "Tạo bằng template", body: "Dùng template như product-shot với hint ecommerce ngắn, không cần học từng biến." },
    ],
    faqs: [
      { question: "Image Buddy cài gì?", answer: "Nó cài CLI @flatkey-ai/image-buddy và dùng Flatkey API key để tạo ảnh." },
      { question: "Tạo key ở đâu?", answer: "Tạo hoặc copy API key tại https://console.flatkey.ai/keys trước khi chạy image-buddy onboard." },
      { question: "Team có dùng được mà không cần docs thêm không?", answer: "Có. Quickstart gồm ba lệnh: cài đặt, khởi tạo và tạo ảnh." },
      { question: "Vì sao tăng usage tạo ảnh?", answer: "Flatkey giảm chi phí, Image Buddy giảm ma sát bằng templates, hints và demo gallery local." },
    ],
  },
  de: {
    ...IMAGE_BUDDY_USE_CASE,
    badge: "Bildgenerierung mit Flatkey · etwa 40% günstiger",
    headlineLead: "Kommerzielle Bilder generieren",
    headlineAccent: "mit Image Buddy",
    intro: "Nutze Flatkey.ai für günstigere Bildgenerierung und Image Buddy, um kurze Ideen in Produktbilder, Ads, Avatare, App-Visuals und Ecommerce-Creatives zu verwandeln.",
    selectInstruction: "Nutze die CLI direkt: installieren, initialisieren und generieren.",
    directLabel: "Rohe Bildgenerierung",
    flatkeyLabel: "Flatkey + Image Buddy",
    moreUsageLine: "Mehr nutzbare Bilder mit weniger Kosten und weniger Prompt-Arbeit generieren.",
    useCases: [
      { title: "Produktmarketing-Bilder", body: "Verwandle eine Produktidee in Hero Images für Landingpages und Kampagnen." },
      { title: "Mehrsprachige Workflows", body: "Gib Teams eine einfache CLI, die in jedem Terminal läuft." },
      { title: "Ecommerce und Social Ads", body: "Erstelle Produktfotos, UGC-Frames, Poster und vertikale Creatives." },
      { title: "Template-basierte Generierung", body: "Nutze Templates wie product-shot mit kurzem Ecommerce-Hint, ohne Variablen zu lernen." },
    ],
    faqs: [
      { question: "Was installiert Image Buddy?", answer: "Die CLI @flatkey-ai/image-buddy, die mit deinem Flatkey API key Bilder generiert." },
      { question: "Wo erstelle ich den key?", answer: "Erstelle oder kopiere den API key unter https://console.flatkey.ai/keys vor image-buddy onboard." },
      { question: "Können Teams es ohne zusätzliche Doku nutzen?", answer: "Ja. Der Quickstart deckt Installation, Onboarding und Generierung mit drei Befehlen ab." },
      { question: "Warum steigert das Image Usage?", answer: "Flatkey senkt Kosten, Image Buddy reduziert Reibung durch Templates, Hints und eine lokale Demo Gallery." },
    ],
  },
};

const localizedUseCases: Record<Locale, Partial<Record<UseCaseSlug, UseCaseConfig>>> = {
  en: {
    "claude-code": CLAUDE_CODE_USE_CASE,
    codex: CODEX_USE_CASE,
    "image-buddy": IMAGE_BUDDY_USE_CASE,
  },
  zh: {
    "claude-code": {
      ...CLAUDE_CODE_USE_CASE,
      badge: "通过 Flatkey 使用 Claude Code · 至少比官方便宜 40%",
      headlineLead: "用 Flatkey 跑 Claude Code，至少",
      headlineAccent: "便宜 40%",
      intro: "保留客户想要的官方 Claude Code 工作流，同时通过 Flatkey 路由，把计量用量成本至少降低 40%，并获得统一预付余额和可见用量。",
      selectInstruction: "安装器询问要配置哪个编码代理时，选择 Claude Code。",
      directLabel: "官方 Claude Code 配置",
      flatkeyLabel: "Flatkey 路由的 Claude Code",
      moreUsageLine: "更多使用 Claude Code，同时不失去成本控制。",
      useCases: [
        { title: "代码库探索", body: "让 Claude Code 扫描、解释并梳理大型代码库，同时用量进入 Flatkey。" },
        { title: "重构循环", body: "以可见成本和预付余额控制运行更多编辑、测试、复审循环。" },
        { title: "团队接入", body: "给每位工程师同一条命令、同一个 key 页面和 Claude Code 路由路径。" },
        { title: "客户工程项目", body: "把客户的 Claude Code 会话保留在同一条可审计用量记录里。" },
      ],
      faqs: [
        { question: "Claude Code 使用什么 base URL？", answer: "Claude Code 会配置为 https://router.flatkey.ai，并使用你的 Flatkey API key。" },
        { question: "用户在哪里创建 key？", answer: "运行安装器前，在 https://console.flatkey.ai/keys 创建或复制 API key。" },
        { question: "安装器里应该选哪个选项？", answer: "选择 Claude Code，然后重启终端并运行 claude。" },
        { question: "为什么这能提升用量？", answer: "Claude Code 在真实编码中会重复调用模型。Flatkey 让这些调用更便宜、预付、可见且可控。" },
      ],
    },
    codex: {
      ...CODEX_USE_CASE,
      badge: "通过 Flatkey 使用 Codex CLI · 至少比官方便宜 40%",
      headlineLead: "用 Flatkey 跑 Codex，至少",
      headlineAccent: "便宜 40%",
      intro: "保留 OpenAI 兼容的 Codex CLI 工作流，同时通过 Flatkey 路由，把计量用量成本至少降低 40%，并获得统一预付余额和可见用量。",
      selectInstruction: "安装器询问要配置哪个编码代理时，选择 Codex CLI。",
      directLabel: "官方 Codex 配置",
      flatkeyLabel: "Flatkey 路由的 Codex",
      moreUsageLine: "更多使用 Codex，同时不失去成本控制。",
      useCases: [
        { title: "CLI 编码会话", body: "把 Codex 提示、编辑和后续运行路由到同一个 Flatkey 余额。" },
        { title: "自动修复循环", body: "用 Codex 修 bug、跑测试迭代，同时每次请求都可计量。" },
        { title: "客户接入", body: "给用户一条可复制命令，替代手动 API 和配置说明。" },
        { title: "团队成本控制", body: "通过模型日志、余额记录和集中账单看清 Codex 用量。" },
      ],
      faqs: [
        { question: "Codex 使用什么 endpoint？", answer: "Codex CLI 会配置到 OpenAI 兼容的 https://router.flatkey.ai/v1 endpoint。" },
        { question: "用户在哪里创建 key？", answer: "运行安装器前，在 https://console.flatkey.ai/keys 创建或复制 API key。" },
        { question: "安装器里应该选哪个选项？", answer: "选择 Codex CLI，然后重启终端并运行 codex。" },
        { question: "为什么这能提升用量？", answer: "Codex 在真实终端工作中会重复调用模型。Flatkey 让这些调用更便宜、预付、可见且可控。" },
      ],
    },
  },
  es: {
    "claude-code": {
      ...CLAUDE_CODE_USE_CASE,
      badge: "Claude Code con Flatkey · al menos 40% más barato",
      headlineLead: "Usa Claude Code al menos",
      headlineAccent: "40% más barato",
      intro: "Mantén el flujo oficial de Claude Code que tus clientes quieren, pero enrútalo por Flatkey para reducir el uso medido al menos 40%, con saldo prepago y gasto visible.",
      selectInstruction: "Cuando el instalador pregunte qué agente configurar, elige Claude Code.",
      directLabel: "Configuración oficial de Claude Code",
      flatkeyLabel: "Claude Code enrutado por Flatkey",
      moreUsageLine: "Usa más Claude Code sin perder control del gasto.",
      useCases: [
        { title: "Exploración de repositorios", body: "Claude Code puede analizar, explicar y mapear grandes bases de código mientras el uso llega a Flatkey." },
        { title: "Bucles de refactor", body: "Ejecuta más ciclos de editar, probar y revisar con coste visible y saldo prepago." },
        { title: "Onboarding de equipos", body: "Da a cada ingeniero el mismo comando, página de key y ruta para Claude Code." },
        { title: "Trabajo para clientes", body: "Mantén sesiones de Claude Code de clientes en un historial auditable de uso." },
      ],
      faqs: [
        { question: "¿Qué base URL usa Claude Code?", answer: "Claude Code se configura con https://router.flatkey.ai y tu API key de Flatkey." },
        { question: "¿Dónde se crea la key?", answer: "Crea o copia la API key en https://console.flatkey.ai/keys antes de ejecutar el instalador." },
        { question: "¿Qué opción elegir en el instalador?", answer: "Elige Claude Code, reinicia la terminal y ejecuta claude." },
        { question: "¿Por qué ayuda a aumentar el uso?", answer: "Claude Code hace llamadas repetidas durante trabajo real. Flatkey las hace más baratas, prepagas, visibles y controlables." },
      ],
    },
    codex: {
      ...CODEX_USE_CASE,
      badge: "Codex CLI con Flatkey · al menos 40% más barato",
      headlineLead: "Usa Codex al menos",
      headlineAccent: "40% más barato",
      intro: "Mantén el flujo de Codex CLI compatible con OpenAI, pero enrútalo por Flatkey para reducir el uso medido al menos 40%, con saldo prepago y gasto visible.",
      selectInstruction: "Cuando el instalador pregunte qué agente configurar, elige Codex CLI.",
      directLabel: "Configuración oficial de Codex",
      flatkeyLabel: "Codex enrutado por Flatkey",
      moreUsageLine: "Usa más Codex sin perder control del gasto.",
      useCases: [
        { title: "Sesiones de CLI", body: "Enruta prompts, ediciones y ejecuciones de Codex con un solo saldo Flatkey." },
        { title: "Bucles de reparación", body: "Usa Codex para arreglos y pruebas mientras cada solicitud se mide." },
        { title: "Onboarding de clientes", body: "Da un comando copiable en lugar de instrucciones manuales de API y configuración." },
        { title: "Control de costes", body: "Mantén el uso de Codex visible con logs, saldo y facturación centralizada." },
      ],
      faqs: [
        { question: "¿Qué endpoint usa Codex?", answer: "Codex CLI usa el endpoint compatible con OpenAI https://router.flatkey.ai/v1." },
        { question: "¿Dónde se crea la key?", answer: "Crea o copia la API key en https://console.flatkey.ai/keys antes de ejecutar el instalador." },
        { question: "¿Qué opción elegir en el instalador?", answer: "Elige Codex CLI, reinicia la terminal y ejecuta codex." },
        { question: "¿Por qué ayuda a aumentar el uso?", answer: "Codex hace llamadas repetidas durante trabajo real en terminal. Flatkey las hace más baratas, prepagas, visibles y controlables." },
      ],
    },
  },
  fr: {
    "claude-code": {
      ...CLAUDE_CODE_USE_CASE,
      badge: "Claude Code via Flatkey · au moins 40 % moins cher",
      headlineLead: "Utilisez Claude Code au moins",
      headlineAccent: "40 % moins cher",
      intro: "Gardez le flux Claude Code officiel attendu par vos clients, mais routez-le via Flatkey pour réduire l'usage mesuré d'au moins 40 %, avec solde prépayé et dépense visible.",
      selectInstruction: "Quand l'installateur demande quel agent configurer, choisissez Claude Code.",
      directLabel: "Configuration officielle Claude Code",
      flatkeyLabel: "Claude Code routé par Flatkey",
      moreUsageLine: "Utilisez plus Claude Code sans perdre le contrôle des coûts.",
      useCases: [
        { title: "Exploration de dépôts", body: "Claude Code analyse, explique et cartographie de grands codebases pendant que l'usage arrive dans Flatkey." },
        { title: "Boucles de refactor", body: "Lancez plus de cycles édition-test-revue avec coût visible et solde prépayé." },
        { title: "Onboarding d'équipe", body: "Donnez à chaque ingénieur la même commande, page de clé et route Claude Code." },
        { title: "Travail client", body: "Gardez les sessions Claude Code client dans un historique d'usage auditable." },
      ],
      faqs: [
        { question: "Quelle base URL utilise Claude Code ?", answer: "Claude Code est configuré avec https://router.flatkey.ai et votre clé API Flatkey." },
        { question: "Où créer la clé ?", answer: "Créez ou copiez la clé API sur https://console.flatkey.ai/keys avant de lancer l'installateur." },
        { question: "Quelle option choisir ?", answer: "Choisissez Claude Code, redémarrez le terminal puis lancez claude." },
        { question: "Pourquoi cela augmente l'usage ?", answer: "Claude Code appelle souvent les modèles pendant le vrai travail. Flatkey rend ces appels moins chers, prépayés, visibles et contrôlables." },
      ],
    },
    codex: {
      ...CODEX_USE_CASE,
      badge: "Codex CLI via Flatkey · au moins 40 % moins cher",
      headlineLead: "Utilisez Codex au moins",
      headlineAccent: "40 % moins cher",
      intro: "Gardez le flux Codex CLI compatible OpenAI, mais routez-le via Flatkey pour réduire l'usage mesuré d'au moins 40 %, avec solde prépayé et dépense visible.",
      selectInstruction: "Quand l'installateur demande quel agent configurer, choisissez Codex CLI.",
      directLabel: "Configuration officielle Codex",
      flatkeyLabel: "Codex routé par Flatkey",
      moreUsageLine: "Utilisez plus Codex sans perdre le contrôle des coûts.",
      useCases: [
        { title: "Sessions CLI", body: "Routez prompts, éditions et relances Codex avec un seul solde Flatkey." },
        { title: "Boucles de correction", body: "Utilisez Codex pour bugs et tests tout en mesurant chaque requête." },
        { title: "Onboarding client", body: "Donnez une commande à copier au lieu d'instructions API manuelles." },
        { title: "Contrôle des coûts", body: "Gardez l'usage Codex visible avec logs, solde et facturation centralisée." },
      ],
      faqs: [
        { question: "Quel endpoint utilise Codex ?", answer: "Codex CLI utilise l'endpoint compatible OpenAI https://router.flatkey.ai/v1." },
        { question: "Où créer la clé ?", answer: "Créez ou copiez la clé API sur https://console.flatkey.ai/keys avant de lancer l'installateur." },
        { question: "Quelle option choisir ?", answer: "Choisissez Codex CLI, redémarrez le terminal puis lancez codex." },
        { question: "Pourquoi cela augmente l'usage ?", answer: "Codex appelle souvent les modèles dans le terminal. Flatkey rend ces appels moins chers, prépayés, visibles et contrôlables." },
      ],
    },
  },
  pt: {
    "claude-code": {
      ...CLAUDE_CODE_USE_CASE,
      badge: "Claude Code via Flatkey · pelo menos 40% mais barato",
      headlineLead: "Use Claude Code pelo menos",
      headlineAccent: "40% mais barato",
      intro: "Mantenha o fluxo oficial do Claude Code que os clientes querem, mas roteie via Flatkey para reduzir o uso medido em pelo menos 40%, com saldo pré-pago e gasto visível.",
      selectInstruction: "Quando o instalador perguntar qual agente configurar, escolha Claude Code.",
      directLabel: "Configuração oficial do Claude Code",
      flatkeyLabel: "Claude Code roteado pela Flatkey",
      moreUsageLine: "Use mais Claude Code sem perder controle de custos.",
      useCases: [
        { title: "Exploração de repositório", body: "Claude Code analisa, explica e mapeia codebases grandes enquanto o uso chega à Flatkey." },
        { title: "Loops de refatoração", body: "Execute mais ciclos de editar, testar e revisar com custo visível e saldo pré-pago." },
        { title: "Onboarding de equipe", body: "Dê a cada engenheiro o mesmo comando, página de key e rota do Claude Code." },
        { title: "Trabalho para clientes", body: "Mantenha sessões Claude Code de clientes em um histórico auditável." },
      ],
      faqs: [
        { question: "Qual base URL o Claude Code usa?", answer: "Claude Code é configurado com https://router.flatkey.ai e sua API key Flatkey." },
        { question: "Onde criar a key?", answer: "Crie ou copie a API key em https://console.flatkey.ai/keys antes de executar o instalador." },
        { question: "Qual opção escolher?", answer: "Escolha Claude Code, reinicie o terminal e rode claude." },
        { question: "Por que isso aumenta o uso?", answer: "Claude Code faz chamadas repetidas durante trabalho real. Flatkey torna essas chamadas mais baratas, pré-pagas, visíveis e controláveis." },
      ],
    },
    codex: {
      ...CODEX_USE_CASE,
      badge: "Codex CLI via Flatkey · pelo menos 40% mais barato",
      headlineLead: "Use Codex pelo menos",
      headlineAccent: "40% mais barato",
      intro: "Mantenha o fluxo Codex CLI compatível com OpenAI, mas roteie via Flatkey para reduzir o uso medido em pelo menos 40%, com saldo pré-pago e gasto visível.",
      selectInstruction: "Quando o instalador perguntar qual agente configurar, escolha Codex CLI.",
      directLabel: "Configuração oficial do Codex",
      flatkeyLabel: "Codex roteado pela Flatkey",
      moreUsageLine: "Use mais Codex sem perder controle de custos.",
      useCases: [
        { title: "Sessões CLI", body: "Roteie prompts, edições e execuções Codex com um saldo Flatkey." },
        { title: "Loops de correção", body: "Use Codex para bugs e testes enquanto cada requisição é medida." },
        { title: "Onboarding de clientes", body: "Dê um comando copiável em vez de instruções manuais de API." },
        { title: "Controle de custos", body: "Mantenha uso Codex visível com logs, saldo e cobrança centralizada." },
      ],
      faqs: [
        { question: "Qual endpoint o Codex usa?", answer: "Codex CLI usa o endpoint compatível com OpenAI https://router.flatkey.ai/v1." },
        { question: "Onde criar a key?", answer: "Crie ou copie a API key em https://console.flatkey.ai/keys antes de executar o instalador." },
        { question: "Qual opção escolher?", answer: "Escolha Codex CLI, reinicie o terminal e rode codex." },
        { question: "Por que isso aumenta o uso?", answer: "Codex faz chamadas repetidas no terminal. Flatkey torna essas chamadas mais baratas, pré-pagas, visíveis e controláveis." },
      ],
    },
  },
  ru: {
    "claude-code": {
      ...CLAUDE_CODE_USE_CASE,
      badge: "Claude Code через Flatkey · минимум на 40% дешевле",
      headlineLead: "Используйте Claude Code минимум",
      headlineAccent: "на 40% дешевле",
      intro: "Сохраните официальный workflow Claude Code, но маршрутизируйте его через Flatkey: минимум на 40% ниже стоимость, предоплаченный баланс и видимый расход.",
      selectInstruction: "Когда установщик спросит, какой агент настроить, выберите Claude Code.",
      directLabel: "Официальная настройка Claude Code",
      flatkeyLabel: "Claude Code через Flatkey",
      moreUsageLine: "Используйте больше Claude Code без потери контроля расходов.",
      useCases: [
        { title: "Изучение репозиториев", body: "Claude Code анализирует и объясняет большие codebase, а использование попадает в Flatkey." },
        { title: "Циклы рефакторинга", body: "Запускайте больше циклов edit-test-review с видимой стоимостью и предоплатой." },
        { title: "Онбординг команды", body: "Дайте инженерам одну команду, страницу ключа и маршрут Claude Code." },
        { title: "Работа с клиентами", body: "Держите клиентские сессии Claude Code в аудируемой истории использования." },
      ],
      faqs: [
        { question: "Какой base URL использует Claude Code?", answer: "Claude Code настраивается на https://router.flatkey.ai и ваш API key Flatkey." },
        { question: "Где создать key?", answer: "Создайте или скопируйте API key на https://console.flatkey.ai/keys перед запуском установщика." },
        { question: "Что выбрать в установщике?", answer: "Выберите Claude Code, перезапустите терминал и выполните claude." },
        { question: "Почему это растит usage?", answer: "Claude Code часто вызывает модели в реальной работе. Flatkey делает эти вызовы дешевле, предоплаченными, видимыми и управляемыми." },
      ],
    },
    codex: {
      ...CODEX_USE_CASE,
      badge: "Codex CLI через Flatkey · минимум на 40% дешевле",
      headlineLead: "Используйте Codex минимум",
      headlineAccent: "на 40% дешевле",
      intro: "Сохраните OpenAI-compatible workflow Codex CLI, но маршрутизируйте его через Flatkey: минимум на 40% ниже стоимость, предоплаченный баланс и видимый расход.",
      selectInstruction: "Когда установщик спросит, какой агент настроить, выберите Codex CLI.",
      directLabel: "Официальная настройка Codex",
      flatkeyLabel: "Codex через Flatkey",
      moreUsageLine: "Используйте больше Codex без потери контроля расходов.",
      useCases: [
        { title: "CLI-сессии", body: "Маршрутизируйте prompts, edits и повторные запуски Codex через один баланс Flatkey." },
        { title: "Циклы исправлений", body: "Используйте Codex для bug fixes и тестов, измеряя каждый запрос." },
        { title: "Онбординг клиентов", body: "Дайте одну копируемую команду вместо ручных инструкций API." },
        { title: "Контроль затрат", body: "Держите usage Codex видимым через логи, баланс и централизованный billing." },
      ],
      faqs: [
        { question: "Какой endpoint использует Codex?", answer: "Codex CLI использует OpenAI-compatible endpoint https://router.flatkey.ai/v1." },
        { question: "Где создать key?", answer: "Создайте или скопируйте API key на https://console.flatkey.ai/keys перед запуском установщика." },
        { question: "Что выбрать в установщике?", answer: "Выберите Codex CLI, перезапустите терминал и выполните codex." },
        { question: "Почему это растит usage?", answer: "Codex часто вызывает модели в терминале. Flatkey делает эти вызовы дешевле, предоплаченными, видимыми и управляемыми." },
      ],
    },
  },
  ja: {
    "claude-code": {
      ...CLAUDE_CODE_USE_CASE,
      badge: "Flatkey 経由の Claude Code · 公式より少なくとも 40% 安価",
      headlineLead: "Claude Code を少なくとも",
      headlineAccent: "40% 安く利用",
      intro: "顧客が求める公式 Claude Code のワークフローを保ちながら、Flatkey 経由で従量課金を少なくとも 40% 削減し、プリペイド残高と利用可視化を提供します。",
      selectInstruction: "インストーラーで設定するエージェントを聞かれたら Claude Code を選択します。",
      directLabel: "公式 Claude Code 設定",
      flatkeyLabel: "Flatkey ルーティングの Claude Code",
      moreUsageLine: "コスト管理を失わずに Claude Code をもっと使えます。",
      useCases: [
        { title: "リポジトリ探索", body: "Claude Code が大規模コードベースを解析し、その使用量は Flatkey に記録されます。" },
        { title: "リファクタリングループ", body: "編集、テスト、レビューのサイクルを、可視化されたコストとプリペイド残高で増やせます。" },
        { title: "チーム導入", body: "全エンジニアに同じコマンド、key ページ、Claude Code ルートを提供します。" },
        { title: "顧客案件", body: "顧客の Claude Code セッションを監査可能な利用履歴に集約します。" },
      ],
      faqs: [
        { question: "Claude Code の base URL は？", answer: "Claude Code は https://router.flatkey.ai と Flatkey API key で設定されます。" },
        { question: "key はどこで作成しますか？", answer: "インストーラー実行前に https://console.flatkey.ai/keys で API key を作成またはコピーします。" },
        { question: "インストーラーでは何を選びますか？", answer: "Claude Code を選び、ターミナルを再起動して claude を実行します。" },
        { question: "なぜ利用増につながりますか？", answer: "Claude Code は実作業中に繰り返しモデルを呼びます。Flatkey はそれを安価、プリペイド、可視、制御可能にします。" },
      ],
    },
    codex: {
      ...CODEX_USE_CASE,
      badge: "Flatkey 経由の Codex CLI · 公式より少なくとも 40% 安価",
      headlineLead: "Codex を少なくとも",
      headlineAccent: "40% 安く利用",
      intro: "OpenAI 互換の Codex CLI ワークフローを保ちながら、Flatkey 経由で従量課金を少なくとも 40% 削減し、プリペイド残高と利用可視化を提供します。",
      selectInstruction: "インストーラーで設定するエージェントを聞かれたら Codex CLI を選択します。",
      directLabel: "公式 Codex 設定",
      flatkeyLabel: "Flatkey ルーティングの Codex",
      moreUsageLine: "コスト管理を失わずに Codex をもっと使えます。",
      useCases: [
        { title: "CLI コーディング", body: "Codex のプロンプト、編集、再実行をひとつの Flatkey 残高にルーティングします。" },
        { title: "自動修正ループ", body: "Codex でバグ修正やテスト反復を行い、各リクエストを計測します。" },
        { title: "顧客導入", body: "手動 API 設定の説明ではなく、コピー可能な 1 コマンドを提供します。" },
        { title: "チームコスト管理", body: "ログ、残高、集中請求で Codex 利用を可視化します。" },
      ],
      faqs: [
        { question: "Codex の endpoint は？", answer: "Codex CLI は OpenAI 互換 endpoint https://router.flatkey.ai/v1 を使用します。" },
        { question: "key はどこで作成しますか？", answer: "インストーラー実行前に https://console.flatkey.ai/keys で API key を作成またはコピーします。" },
        { question: "インストーラーでは何を選びますか？", answer: "Codex CLI を選び、ターミナルを再起動して codex を実行します。" },
        { question: "なぜ利用増につながりますか？", answer: "Codex はターミナル作業中に繰り返しモデルを呼びます。Flatkey はそれを安価、プリペイド、可視、制御可能にします。" },
      ],
    },
  },
  vi: {
    "claude-code": {
      ...CLAUDE_CODE_USE_CASE,
      badge: "Claude Code qua Flatkey · rẻ hơn chính thức ít nhất 40%",
      headlineLead: "Dùng Claude Code rẻ hơn ít nhất",
      headlineAccent: "40%",
      intro: "Giữ workflow Claude Code chính thức mà khách hàng muốn, nhưng định tuyến qua Flatkey để giảm phí theo mức dùng ít nhất 40%, với số dư trả trước và chi tiêu rõ ràng.",
      selectInstruction: "Khi trình cài đặt hỏi agent cần cấu hình, chọn Claude Code.",
      directLabel: "Cấu hình Claude Code chính thức",
      flatkeyLabel: "Claude Code định tuyến qua Flatkey",
      moreUsageLine: "Dùng Claude Code nhiều hơn mà vẫn kiểm soát chi phí.",
      useCases: [
        { title: "Khám phá repo", body: "Claude Code quét, giải thích và lập bản đồ codebase lớn trong khi usage vào Flatkey." },
        { title: "Vòng lặp refactor", body: "Chạy nhiều vòng sửa, test, review hơn với chi phí rõ ràng và số dư trả trước." },
        { title: "Onboarding đội ngũ", body: "Cho mọi kỹ sư cùng một lệnh, trang key và đường định tuyến Claude Code." },
        { title: "Dự án khách hàng", body: "Giữ phiên Claude Code của khách trong một lịch sử usage có thể kiểm toán." },
      ],
      faqs: [
        { question: "Claude Code dùng base URL nào?", answer: "Claude Code được cấu hình với https://router.flatkey.ai và API key Flatkey của bạn." },
        { question: "Tạo key ở đâu?", answer: "Tạo hoặc sao chép API key tại https://console.flatkey.ai/keys trước khi chạy trình cài đặt." },
        { question: "Chọn gì trong trình cài đặt?", answer: "Chọn Claude Code, khởi động lại terminal rồi chạy claude." },
        { question: "Vì sao giúp tăng usage?", answer: "Claude Code gọi model lặp lại trong công việc thật. Flatkey làm các lần gọi đó rẻ hơn, trả trước, rõ ràng và kiểm soát được." },
      ],
    },
    codex: {
      ...CODEX_USE_CASE,
      badge: "Codex CLI qua Flatkey · rẻ hơn chính thức ít nhất 40%",
      headlineLead: "Dùng Codex rẻ hơn ít nhất",
      headlineAccent: "40%",
      intro: "Giữ workflow Codex CLI tương thích OpenAI, nhưng định tuyến qua Flatkey để giảm phí theo mức dùng ít nhất 40%, với số dư trả trước và chi tiêu rõ ràng.",
      selectInstruction: "Khi trình cài đặt hỏi agent cần cấu hình, chọn Codex CLI.",
      directLabel: "Cấu hình Codex chính thức",
      flatkeyLabel: "Codex định tuyến qua Flatkey",
      moreUsageLine: "Dùng Codex nhiều hơn mà vẫn kiểm soát chi phí.",
      useCases: [
        { title: "Phiên CLI", body: "Định tuyến prompt, chỉnh sửa và chạy lại Codex qua một số dư Flatkey." },
        { title: "Vòng lặp sửa lỗi", body: "Dùng Codex cho bug fix và test, trong khi mỗi request đều được đo." },
        { title: "Onboarding khách hàng", body: "Đưa một lệnh có thể copy thay vì hướng dẫn API thủ công." },
        { title: "Kiểm soát chi phí", body: "Giữ usage Codex rõ ràng qua logs, số dư và billing tập trung." },
      ],
      faqs: [
        { question: "Codex dùng endpoint nào?", answer: "Codex CLI dùng endpoint tương thích OpenAI https://router.flatkey.ai/v1." },
        { question: "Tạo key ở đâu?", answer: "Tạo hoặc sao chép API key tại https://console.flatkey.ai/keys trước khi chạy trình cài đặt." },
        { question: "Chọn gì trong trình cài đặt?", answer: "Chọn Codex CLI, khởi động lại terminal rồi chạy codex." },
        { question: "Vì sao giúp tăng usage?", answer: "Codex gọi model lặp lại trong terminal thật. Flatkey làm các lần gọi đó rẻ hơn, trả trước, rõ ràng và kiểm soát được." },
      ],
    },
  },
  de: {
    "claude-code": {
      ...CLAUDE_CODE_USE_CASE,
      badge: "Claude Code über Flatkey · mindestens 40% günstiger als offiziell",
      headlineLead: "Nutze Claude Code mindestens",
      headlineAccent: "40% günstiger",
      intro: "Behalte den offiziellen Claude-Code-Workflow, den Kunden wollen, route ihn aber über Flatkey, um gemessene Nutzung mindestens 40% zu senken, mit Prepaid-Guthaben und sichtbaren Ausgaben.",
      selectInstruction: "Wähle Claude Code, wenn der Installer fragt, welcher Coding Agent konfiguriert werden soll.",
      directLabel: "Offizielle Claude-Code-Konfiguration",
      flatkeyLabel: "Über Flatkey geroutetes Claude Code",
      moreUsageLine: "Nutze mehr Claude Code, ohne Kostenkontrolle zu verlieren.",
      useCases: [
        { title: "Repository-Erkundung", body: "Claude Code scannt, erklärt und kartiert große Codebases, während Nutzung in Flatkey läuft." },
        { title: "Refactor-Schleifen", body: "Führe mehr Bearbeitungs-, Test- und Review-Zyklen mit sichtbaren Kosten und Prepaid-Guthaben aus." },
        { title: "Team-Onboarding", body: "Gib jedem Engineer denselben Befehl, dieselbe Key-Seite und denselben Claude-Code-Routingpfad." },
        { title: "Kundenprojekte", body: "Halte Claude-Code-Sitzungen von Kunden in einem auditierbaren Nutzungsverlauf." },
      ],
      faqs: [
        { question: "Welche base URL nutzt Claude Code?", answer: "Claude Code wird mit https://router.flatkey.ai und deinem Flatkey API key konfiguriert." },
        { question: "Wo erstellen Nutzer den key?", answer: "Erstelle oder kopiere den API key unter https://console.flatkey.ai/keys, bevor du den Installer ausführst." },
        { question: "Welche Option im Installer?", answer: "Wähle Claude Code, starte das Terminal neu und führe claude aus." },
        { question: "Warum steigert das die Nutzung?", answer: "Claude Code ruft während echter Coding-Arbeit wiederholt Modelle auf. Flatkey macht diese Aufrufe günstiger, prepaid, sichtbar und kontrollierbar." },
      ],
    },
    codex: {
      ...CODEX_USE_CASE,
      badge: "Codex CLI über Flatkey · mindestens 40% günstiger als offiziell",
      headlineLead: "Nutze Codex mindestens",
      headlineAccent: "40% günstiger",
      intro: "Behalte den OpenAI-kompatiblen Codex-CLI-Workflow, route ihn aber über Flatkey, um gemessene Nutzung mindestens 40% zu senken, mit Prepaid-Guthaben und sichtbaren Ausgaben.",
      selectInstruction: "Wähle Codex CLI, wenn der Installer fragt, welcher Coding Agent konfiguriert werden soll.",
      directLabel: "Offizielle Codex-Konfiguration",
      flatkeyLabel: "Über Flatkey geroutetes Codex",
      moreUsageLine: "Nutze mehr Codex, ohne Kostenkontrolle zu verlieren.",
      useCases: [
        { title: "CLI-Coding-Sitzungen", body: "Route Codex-Prompts, Edits und Folgeläufe über ein Flatkey-Guthaben." },
        { title: "Automatische Fix-Schleifen", body: "Nutze Codex für Bugfixes und Testiteration, während jede Anfrage messbar bleibt." },
        { title: "Kunden-Onboarding", body: "Gib Nutzern einen kopierbaren Befehl statt manueller API- und Konfigurationsanweisungen." },
        { title: "Team-Kostenkontrolle", body: "Halte Codex-Nutzung mit Modelllogs, Guthaben und zentraler Abrechnung sichtbar." },
      ],
      faqs: [
        { question: "Welchen endpoint nutzt Codex?", answer: "Codex CLI wird gegen den OpenAI-kompatiblen endpoint https://router.flatkey.ai/v1 konfiguriert." },
        { question: "Wo erstellen Nutzer den key?", answer: "Erstelle oder kopiere den API key unter https://console.flatkey.ai/keys, bevor du den Installer ausführst." },
        { question: "Welche Option im Installer?", answer: "Wähle Codex CLI, starte das Terminal neu und führe codex aus." },
        { question: "Warum steigert das die Nutzung?", answer: "Codex ruft während echter Terminal-Arbeit wiederholt Modelle auf. Flatkey macht diese Aufrufe günstiger, prepaid, sichtbar und kontrollierbar." },
      ],
    },
  },
};

const pageCopy: Record<Locale, PageCopy> = {
  en: {
    ctaGetKey: "Get a key",
    ctaInstall: "Copy install command",
    metricCheap: "40%+",
    metricCheapLabel: "cheaper than official",
    metricSetup: "30 sec",
    metricSetupLabel: "quick setup",
    metricKey: "1 key",
    metricKeyLabel: "for visible spend",
    usagePill: "built for more usage",
    officialPrice: "Official price",
    officialSpend: "Full-price agent usage and spend that is harder to centralize.",
    flatkeyCheap: "At least 40% cheaper",
    oneKeyBalance: (toolName) => `One key, one balance, visible logs, and enough cost control for customers to use ${toolName} more.`,
    valueProps: [
      { title: "One Flatkey key", body: "Users create a key once at console.flatkey.ai/keys and keep coding without juggling provider credentials." },
      { title: "At least 40% cheaper", body: "Route coding-agent traffic through Flatkey for lower metered usage than the official path." },
      { title: "Usage visible by token", body: "Request logs, model costs, token usage, and balance movement stay visible from one dashboard." },
      { title: "Control without friction", body: "Use groups, quotas, model access, and routing policy while developers keep a normal CLI workflow." },
    ],
    quickStartTitle: "Quick Start — one command, 30 seconds to set up everything",
    quickStartSuffix: "All platform one-liners stay readable in the page HTML for search and AI answer engines.",
    getKeyLink: "Get a key →",
    whyUsage: (toolName) => `Why this drives ${toolName} usage`,
    whyUsageBody: (toolName) => `${toolName} creates repeated model calls during real coding work. Flatkey makes those calls cheaper, prepaid, visible, and controlled.`,
    comparisonTitle: "Official setup vs Flatkey setup",
    comparisonHeaders: ["Need", "Official path", "Flatkey path"],
    comparisonRows: [
      ["Cost", "Official metered usage", "At least 40% cheaper through Flatkey"],
      ["Setup", "Manual provider keys and local config", "One installer and one Flatkey key"],
      ["Billing", "Scattered usage and unclear CLI spend", "Prepaid balance and unified usage logs"],
      ["Controls", "Hard to apply team quotas consistently", "Groups, model access, quotas, and routing policy"],
    ],
    actionCards: (toolName) => [
      { title: "Install", body: `A customer runs one command and selects ${toolName}.` },
      { title: "Consume", body: `Every ${toolName} session routes through Flatkey and records token usage.` },
      { title: "Manage", body: "Teams keep access, balance, logs, and model choices in one console." },
    ],
    faqTitle: "Questions customers ask",
    finalTitle: (toolName) => `Ready to run ${toolName} through Flatkey?`,
    finalBody: (toolName) => `Create a key at console.flatkey.ai/keys, run the one-liner, and start generating measurable ${toolName} usage.`,
  },
  zh: {
    ctaGetKey: "获取 key",
    ctaInstall: "复制安装命令",
    metricCheap: "40%+",
    metricCheapLabel: "比官方更便宜",
    metricSetup: "30 秒",
    metricSetupLabel: "快速配置",
    metricKey: "1 个 key",
    metricKeyLabel: "看清用量",
    usagePill: "为提升用量设计",
    officialPrice: "官方价格",
    officialSpend: "全价代理用量，且支出更难集中管理。",
    flatkeyCheap: "至少便宜 40%",
    oneKeyBalance: (toolName) => `一个 key、一个余额、可见日志和成本控制，让客户更多使用 ${toolName}。`,
    valueProps: [
      { title: "一个 Flatkey key", body: "用户只需在 console.flatkey.ai/keys 创建一次 key，就能继续编码，无需管理多个 provider 凭据。" },
      { title: "至少便宜 40%", body: "通过 Flatkey 路由编码代理流量，比官方路径的计量用量更便宜。" },
      { title: "按 token 看清用量", body: "请求日志、模型成本、token 用量和余额变动都在一个控制台中可见。" },
      { title: "无摩擦控制", body: "使用分组、额度、模型权限和路由策略，同时开发者保持正常 CLI 工作流。" },
    ],
    quickStartTitle: "快速开始 — 一条命令，30 秒完成配置",
    quickStartSuffix: "所有平台的一行命令都会保留在页面 HTML 中，便于搜索和 AI 答案引擎读取。",
    getKeyLink: "获取 key →",
    whyUsage: (toolName) => `为什么能带动 ${toolName} 用量`,
    whyUsageBody: (toolName) => `${toolName} 在真实编码工作中会重复调用模型。Flatkey 让这些调用更便宜、预付、可见且可控。`,
    comparisonTitle: "官方配置 vs Flatkey 配置",
    comparisonHeaders: ["需求", "官方路径", "Flatkey 路径"],
    comparisonRows: [
      ["成本", "官方计量用量", "通过 Flatkey 至少便宜 40%"],
      ["配置", "手动 provider key 和本地配置", "一个安装器和一个 Flatkey key"],
      ["账单", "分散用量和不清晰的 CLI 支出", "预付余额和统一用量日志"],
      ["控制", "难以一致应用团队额度", "分组、模型权限、额度和路由策略"],
    ],
    actionCards: (toolName) => [
      { title: "安装", body: `客户运行一条命令并选择 ${toolName}。` },
      { title: "消耗", body: `每个 ${toolName} 会话都通过 Flatkey 路由并记录 token 用量。` },
      { title: "管理", body: "团队在一个控制台中管理访问、余额、日志和模型选择。" },
    ],
    faqTitle: "客户常问问题",
    finalTitle: (toolName) => `准备通过 Flatkey 运行 ${toolName}？`,
    finalBody: (toolName) => `在 console.flatkey.ai/keys 创建 key，运行一行命令，开始产生可计量的 ${toolName} 用量。`,
  },
  es: {
    ctaGetKey: "Obtener key",
    ctaInstall: "Copiar comando",
    metricCheap: "40%+",
    metricCheapLabel: "más barato que oficial",
    metricSetup: "30 s",
    metricSetupLabel: "configuración rápida",
    metricKey: "1 key",
    metricKeyLabel: "gasto visible",
    usagePill: "hecho para más uso",
    officialPrice: "Precio oficial",
    officialSpend: "Uso de agente a precio completo y gasto más difícil de centralizar.",
    flatkeyCheap: "Al menos 40% más barato",
    oneKeyBalance: (toolName) => `Una key, un saldo, logs visibles y control de costes para usar más ${toolName}.`,
    valueProps: [
      { title: "Una key Flatkey", body: "Los usuarios crean una key en console.flatkey.ai/keys y siguen programando sin credenciales dispersas." },
      { title: "Al menos 40% más barato", body: "Enruta tráfico de agentes por Flatkey para menor coste medido que la ruta oficial." },
      { title: "Uso visible por token", body: "Logs, costes de modelo, tokens y saldo quedan visibles en un panel." },
      { title: "Control sin fricción", body: "Usa grupos, cuotas, acceso a modelos y routing sin cambiar el flujo CLI." },
    ],
    quickStartTitle: "Inicio rápido — un comando, 30 segundos para configurar todo",
    quickStartSuffix: "Los one-liners de cada plataforma permanecen en el HTML para buscadores y motores de respuestas IA.",
    getKeyLink: "Obtener key →",
    whyUsage: (toolName) => `Por qué impulsa el uso de ${toolName}`,
    whyUsageBody: (toolName) => `${toolName} crea llamadas repetidas durante trabajo real. Flatkey las hace más baratas, prepagas, visibles y controlables.`,
    comparisonTitle: "Configuración oficial vs Flatkey",
    comparisonHeaders: ["Necesidad", "Ruta oficial", "Ruta Flatkey"],
    comparisonRows: [
      ["Coste", "Uso medido oficial", "Al menos 40% más barato con Flatkey"],
      ["Configuración", "Keys manuales y config local", "Un instalador y una key Flatkey"],
      ["Facturación", "Uso disperso y gasto CLI poco claro", "Saldo prepago y logs unificados"],
      ["Control", "Cuotas de equipo difíciles de aplicar", "Grupos, modelos, cuotas y routing"],
    ],
    actionCards: (toolName) => [
      { title: "Instalar", body: `El cliente ejecuta un comando y elige ${toolName}.` },
      { title: "Consumir", body: `Cada sesión de ${toolName} pasa por Flatkey y registra tokens.` },
      { title: "Gestionar", body: "El equipo mantiene acceso, saldo, logs y modelos en una consola." },
    ],
    faqTitle: "Preguntas frecuentes",
    finalTitle: (toolName) => `¿Listo para usar ${toolName} con Flatkey?`,
    finalBody: (toolName) => `Crea una key en console.flatkey.ai/keys, ejecuta el one-liner y empieza a generar uso medible de ${toolName}.`,
  },
  fr: {
    ctaGetKey: "Obtenir une clé",
    ctaInstall: "Copier la commande",
    metricCheap: "40 %+",
    metricCheapLabel: "moins cher que l'officiel",
    metricSetup: "30 s",
    metricSetupLabel: "configuration rapide",
    metricKey: "1 clé",
    metricKeyLabel: "dépense visible",
    usagePill: "conçu pour plus d'usage",
    officialPrice: "Prix officiel",
    officialSpend: "Usage agent plein tarif, plus difficile à centraliser.",
    flatkeyCheap: "Au moins 40 % moins cher",
    oneKeyBalance: (toolName) => `Une clé, un solde, des logs visibles et assez de contrôle pour utiliser plus ${toolName}.`,
    valueProps: [
      { title: "Une clé Flatkey", body: "Les utilisateurs créent une clé sur console.flatkey.ai/keys et codent sans jongler avec les identifiants." },
      { title: "Au moins 40 % moins cher", body: "Routez le trafic d'agents via Flatkey pour un coût mesuré inférieur à la voie officielle." },
      { title: "Usage visible par token", body: "Logs, coûts de modèle, tokens et solde restent visibles dans un tableau de bord." },
      { title: "Contrôle sans friction", body: "Groupes, quotas, accès modèles et routage sans changer le flux CLI." },
    ],
    quickStartTitle: "Démarrage rapide — une commande, 30 secondes pour tout configurer",
    quickStartSuffix: "Les one-liners de chaque plateforme restent dans le HTML pour les moteurs de recherche et d'IA.",
    getKeyLink: "Obtenir une clé →",
    whyUsage: (toolName) => `Pourquoi cela stimule l'usage de ${toolName}`,
    whyUsageBody: (toolName) => `${toolName} crée des appels répétés pendant le vrai travail. Flatkey les rend moins chers, prépayés, visibles et contrôlables.`,
    comparisonTitle: "Configuration officielle vs Flatkey",
    comparisonHeaders: ["Besoin", "Voie officielle", "Voie Flatkey"],
    comparisonRows: [
      ["Coût", "Usage mesuré officiel", "Au moins 40 % moins cher via Flatkey"],
      ["Configuration", "Clés manuelles et config locale", "Un installateur et une clé Flatkey"],
      ["Facturation", "Usage dispersé et dépense CLI floue", "Solde prépayé et logs unifiés"],
      ["Contrôle", "Quotas d'équipe difficiles", "Groupes, modèles, quotas et routage"],
    ],
    actionCards: (toolName) => [
      { title: "Installer", body: `Le client lance une commande et choisit ${toolName}.` },
      { title: "Consommer", body: `Chaque session ${toolName} passe par Flatkey et enregistre les tokens.` },
      { title: "Gérer", body: "Les équipes gardent accès, solde, logs et modèles dans une console." },
    ],
    faqTitle: "Questions fréquentes",
    finalTitle: (toolName) => `Prêt à lancer ${toolName} via Flatkey ?`,
    finalBody: (toolName) => `Créez une clé sur console.flatkey.ai/keys, lancez le one-liner et générez un usage mesurable de ${toolName}.`,
  },
  pt: {
    ctaGetKey: "Obter key",
    ctaInstall: "Copiar comando",
    metricCheap: "40%+",
    metricCheapLabel: "mais barato que oficial",
    metricSetup: "30 s",
    metricSetupLabel: "configuração rápida",
    metricKey: "1 key",
    metricKeyLabel: "gasto visível",
    usagePill: "feito para mais uso",
    officialPrice: "Preço oficial",
    officialSpend: "Uso de agente com preço cheio e gasto mais difícil de centralizar.",
    flatkeyCheap: "Pelo menos 40% mais barato",
    oneKeyBalance: (toolName) => `Uma key, um saldo, logs visíveis e controle para usar mais ${toolName}.`,
    valueProps: [
      { title: "Uma key Flatkey", body: "Usuários criam uma key em console.flatkey.ai/keys e continuam codando sem várias credenciais." },
      { title: "Pelo menos 40% mais barato", body: "Roteie tráfego de agentes via Flatkey para uso medido menor que a rota oficial." },
      { title: "Uso visível por token", body: "Logs, custos de modelo, tokens e saldo ficam visíveis em um painel." },
      { title: "Controle sem fricção", body: "Grupos, cotas, acesso a modelos e roteamento sem mudar o fluxo CLI." },
    ],
    quickStartTitle: "Início rápido — um comando, 30 segundos para configurar tudo",
    quickStartSuffix: "Os one-liners de cada plataforma ficam no HTML para busca e motores de resposta IA.",
    getKeyLink: "Obter key →",
    whyUsage: (toolName) => `Por que isso aumenta o uso de ${toolName}`,
    whyUsageBody: (toolName) => `${toolName} cria chamadas repetidas durante trabalho real. Flatkey torna isso mais barato, pré-pago, visível e controlável.`,
    comparisonTitle: "Configuração oficial vs Flatkey",
    comparisonHeaders: ["Necessidade", "Rota oficial", "Rota Flatkey"],
    comparisonRows: [
      ["Custo", "Uso medido oficial", "Pelo menos 40% mais barato via Flatkey"],
      ["Configuração", "Keys manuais e config local", "Um instalador e uma key Flatkey"],
      ["Cobrança", "Uso disperso e gasto CLI pouco claro", "Saldo pré-pago e logs unificados"],
      ["Controle", "Cotas de equipe difíceis", "Grupos, modelos, cotas e roteamento"],
    ],
    actionCards: (toolName) => [
      { title: "Instalar", body: `O cliente roda um comando e escolhe ${toolName}.` },
      { title: "Consumir", body: `Cada sessão ${toolName} passa pela Flatkey e registra tokens.` },
      { title: "Gerenciar", body: "Equipes mantêm acesso, saldo, logs e modelos em um console." },
    ],
    faqTitle: "Perguntas frequentes",
    finalTitle: (toolName) => `Pronto para usar ${toolName} via Flatkey?`,
    finalBody: (toolName) => `Crie uma key em console.flatkey.ai/keys, rode o one-liner e gere uso mensurável de ${toolName}.`,
  },
  ru: {
    ctaGetKey: "Получить key",
    ctaInstall: "Скопировать команду",
    metricCheap: "40%+",
    metricCheapLabel: "дешевле официального",
    metricSetup: "30 сек",
    metricSetupLabel: "быстрая настройка",
    metricKey: "1 key",
    metricKeyLabel: "видимый расход",
    usagePill: "для роста использования",
    officialPrice: "Официальная цена",
    officialSpend: "Full-price использование агента и расходы, которые сложнее централизовать.",
    flatkeyCheap: "Минимум на 40% дешевле",
    oneKeyBalance: (toolName) => `Один key, один баланс, видимые логи и контроль для большего использования ${toolName}.`,
    valueProps: [
      { title: "Один Flatkey key", body: "Пользователи создают key на console.flatkey.ai/keys и продолжают кодить без разных credentials." },
      { title: "Минимум на 40% дешевле", body: "Маршрутизируйте agent traffic через Flatkey с меньшей стоимостью, чем официальный путь." },
      { title: "Usage виден по token", body: "Логи, стоимость моделей, tokens и баланс видны в одном dashboard." },
      { title: "Контроль без трения", body: "Группы, квоты, доступ к моделям и routing без изменения CLI workflow." },
    ],
    quickStartTitle: "Быстрый старт — одна команда, 30 секунд на настройку",
    quickStartSuffix: "One-liner для каждой платформы остается в HTML для поиска и AI answer engines.",
    getKeyLink: "Получить key →",
    whyUsage: (toolName) => `Почему это растит usage ${toolName}`,
    whyUsageBody: (toolName) => `${toolName} создает повторные model calls в реальной работе. Flatkey делает их дешевле, предоплаченными, видимыми и управляемыми.`,
    comparisonTitle: "Официальная настройка vs Flatkey",
    comparisonHeaders: ["Нужно", "Официальный путь", "Путь Flatkey"],
    comparisonRows: [
      ["Стоимость", "Официальное metered usage", "Минимум на 40% дешевле через Flatkey"],
      ["Настройка", "Ручные provider keys и config", "Один installer и один Flatkey key"],
      ["Биллинг", "Разрозненный usage и неясный CLI spend", "Предоплаченный баланс и единые логи"],
      ["Контроль", "Сложно применять team quotas", "Группы, модели, квоты и routing"],
    ],
    actionCards: (toolName) => [
      { title: "Установить", body: `Клиент запускает одну команду и выбирает ${toolName}.` },
      { title: "Использовать", body: `Каждая сессия ${toolName} идет через Flatkey и записывает tokens.` },
      { title: "Управлять", body: "Команды держат доступ, баланс, логи и модели в одной консоли." },
    ],
    faqTitle: "Вопросы клиентов",
    finalTitle: (toolName) => `Готовы запускать ${toolName} через Flatkey?`,
    finalBody: (toolName) => `Создайте key на console.flatkey.ai/keys, запустите one-liner и начните измеримое usage ${toolName}.`,
  },
  ja: {
    ctaGetKey: "key を取得",
    ctaInstall: "コマンドをコピー",
    metricCheap: "40%+",
    metricCheapLabel: "公式より安価",
    metricSetup: "30 秒",
    metricSetupLabel: "クイック設定",
    metricKey: "1 key",
    metricKeyLabel: "利用を可視化",
    usagePill: "利用拡大向け",
    officialPrice: "公式価格",
    officialSpend: "フル価格の agent usage で、支出を集約しにくい状態です。",
    flatkeyCheap: "少なくとも 40% 安価",
    oneKeyBalance: (toolName) => `1 key、1 残高、可視ログ、コスト制御で ${toolName} をもっと使えます。`,
    valueProps: [
      { title: "1 つの Flatkey key", body: "ユーザーは console.flatkey.ai/keys で key を作成し、複数の認証情報なしで開発できます。" },
      { title: "少なくとも 40% 安価", body: "coding-agent traffic を Flatkey 経由にして、公式ルートより低い従量コストにします。" },
      { title: "token 単位で可視化", body: "リクエストログ、モデルコスト、token 使用量、残高が 1 つの dashboard で見えます。" },
      { title: "摩擦のない制御", body: "グループ、クォータ、モデルアクセス、routing policy を CLI workflow のまま適用できます。" },
    ],
    quickStartTitle: "クイックスタート — 1 コマンド、30 秒でセットアップ",
    quickStartSuffix: "各プラットフォームの one-liner は検索と AI answer engines 向けに HTML 内で読めます。",
    getKeyLink: "key を取得 →",
    whyUsage: (toolName) => `${toolName} の利用が伸びる理由`,
    whyUsageBody: (toolName) => `${toolName} は実際の開発中に繰り返しモデルを呼びます。Flatkey はそれを安価、プリペイド、可視、制御可能にします。`,
    comparisonTitle: "公式設定 vs Flatkey 設定",
    comparisonHeaders: ["要件", "公式ルート", "Flatkey ルート"],
    comparisonRows: [
      ["コスト", "公式の従量利用", "Flatkey 経由で少なくとも 40% 安価"],
      ["設定", "手動 provider key とローカル設定", "1 installer と 1 Flatkey key"],
      ["請求", "分散した usage と不明瞭な CLI 支出", "プリペイド残高と統一ログ"],
      ["制御", "team quota の一貫適用が困難", "グループ、モデル、クォータ、routing"],
    ],
    actionCards: (toolName) => [
      { title: "インストール", body: `顧客は 1 コマンドを実行し ${toolName} を選びます。` },
      { title: "利用", body: `各 ${toolName} セッションは Flatkey を経由し token を記録します。` },
      { title: "管理", body: "チームはアクセス、残高、ログ、モデルを 1 つのコンソールで管理します。" },
    ],
    faqTitle: "よくある質問",
    finalTitle: (toolName) => `${toolName} を Flatkey 経由で実行しますか？`,
    finalBody: (toolName) => `console.flatkey.ai/keys で key を作成し、one-liner を実行して ${toolName} の計測可能な usage を始めます。`,
  },
  vi: {
    ctaGetKey: "Lấy key",
    ctaInstall: "Sao chép lệnh",
    metricCheap: "40%+",
    metricCheapLabel: "rẻ hơn chính thức",
    metricSetup: "30 giây",
    metricSetupLabel: "cài nhanh",
    metricKey: "1 key",
    metricKeyLabel: "chi tiêu rõ ràng",
    usagePill: "thiết kế để tăng usage",
    officialPrice: "Giá chính thức",
    officialSpend: "Agent usage giá đầy đủ và khó tập trung chi phí hơn.",
    flatkeyCheap: "Rẻ hơn ít nhất 40%",
    oneKeyBalance: (toolName) => `Một key, một số dư, logs rõ ràng và kiểm soát để dùng ${toolName} nhiều hơn.`,
    valueProps: [
      { title: "Một Flatkey key", body: "Người dùng tạo key tại console.flatkey.ai/keys và tiếp tục code không cần nhiều credential." },
      { title: "Rẻ hơn ít nhất 40%", body: "Định tuyến coding-agent traffic qua Flatkey để phí đo theo usage thấp hơn đường chính thức." },
      { title: "Usage rõ theo token", body: "Request logs, chi phí model, token usage và số dư hiển thị trong một dashboard." },
      { title: "Kiểm soát không ma sát", body: "Dùng groups, quotas, model access và routing policy trong khi developer giữ CLI workflow bình thường." },
    ],
    quickStartTitle: "Bắt đầu nhanh — một lệnh, 30 giây để cài mọi thứ",
    quickStartSuffix: "One-liner của mọi nền tảng vẫn có trong HTML để search và AI answer engines đọc được.",
    getKeyLink: "Lấy key →",
    whyUsage: (toolName) => `Vì sao tăng usage ${toolName}`,
    whyUsageBody: (toolName) => `${toolName} tạo nhiều model calls trong công việc code thật. Flatkey làm chúng rẻ hơn, trả trước, rõ ràng và kiểm soát được.`,
    comparisonTitle: "Cài chính thức vs cài Flatkey",
    comparisonHeaders: ["Nhu cầu", "Đường chính thức", "Đường Flatkey"],
    comparisonRows: [
      ["Chi phí", "Official metered usage", "Rẻ hơn ít nhất 40% qua Flatkey"],
      ["Cài đặt", "Provider keys và config thủ công", "Một installer và một Flatkey key"],
      ["Billing", "Usage rời rạc và chi CLI khó thấy", "Số dư trả trước và logs thống nhất"],
      ["Kiểm soát", "Khó áp team quotas nhất quán", "Groups, models, quotas và routing"],
    ],
    actionCards: (toolName) => [
      { title: "Cài đặt", body: `Khách chạy một lệnh và chọn ${toolName}.` },
      { title: "Sử dụng", body: `Mỗi phiên ${toolName} đi qua Flatkey và ghi token usage.` },
      { title: "Quản lý", body: "Đội ngũ giữ access, balance, logs và model choices trong một console." },
    ],
    faqTitle: "Câu hỏi khách hàng hay hỏi",
    finalTitle: (toolName) => `Sẵn sàng chạy ${toolName} qua Flatkey?`,
    finalBody: (toolName) => `Tạo key tại console.flatkey.ai/keys, chạy one-liner và bắt đầu tạo usage đo được cho ${toolName}.`,
  },
  de: {
    ctaGetKey: "Key holen",
    ctaInstall: "Installationsbefehl kopieren",
    metricCheap: "40%+",
    metricCheapLabel: "günstiger als offiziell",
    metricSetup: "30 Sek.",
    metricSetupLabel: "schnelle Einrichtung",
    metricKey: "1 key",
    metricKeyLabel: "für sichtbare Ausgaben",
    usagePill: "für mehr Nutzung gebaut",
    officialPrice: "Offizieller Preis",
    officialSpend: "Agent-Nutzung zum vollen Preis und Ausgaben, die schwerer zentral zu erfassen sind.",
    flatkeyCheap: "Mindestens 40% günstiger",
    oneKeyBalance: (toolName) => `Ein key, ein Guthaben, sichtbare Logs und genug Kostenkontrolle, damit Kunden ${toolName} mehr nutzen.`,
    valueProps: [
      { title: "Ein Flatkey key", body: "Nutzer erstellen einmal einen key unter console.flatkey.ai/keys und coden weiter, ohne Provider-Credentials zu jonglieren." },
      { title: "Mindestens 40% günstiger", body: "Route Coding-Agent-Traffic über Flatkey für niedrigere gemessene Nutzung als auf dem offiziellen Weg." },
      { title: "Nutzung nach token sichtbar", body: "Request-Logs, Modellkosten, token-Nutzung und Guthabenbewegungen bleiben in einem Dashboard sichtbar." },
      { title: "Kontrolle ohne Reibung", body: "Nutze Gruppen, Quotas, Modellzugriff und Routing-Policy, während Entwickler einen normalen CLI-Workflow behalten." },
    ],
    quickStartTitle: "Schnellstart - ein Befehl, 30 Sekunden bis alles eingerichtet ist",
    quickStartSuffix: "Alle Plattform-one-liner bleiben im Seiten-HTML lesbar für Suche und AI answer engines.",
    getKeyLink: "Key holen →",
    whyUsage: (toolName) => `Warum das ${toolName}-Nutzung steigert`,
    whyUsageBody: (toolName) => `${toolName} erzeugt wiederholte Modellaufrufe während echter Coding-Arbeit. Flatkey macht diese Aufrufe günstiger, prepaid, sichtbar und kontrollierbar.`,
    comparisonTitle: "Offizielle Einrichtung vs Flatkey-Einrichtung",
    comparisonHeaders: ["Bedarf", "Offizieller Weg", "Flatkey-Weg"],
    comparisonRows: [
      ["Kosten", "Offizielle gemessene Nutzung", "Mindestens 40% günstiger über Flatkey"],
      ["Einrichtung", "Manuelle Provider-Keys und lokale Konfiguration", "Ein Installer und ein Flatkey key"],
      ["Abrechnung", "Verstreute Nutzung und unklare CLI-Ausgaben", "Prepaid-Guthaben und einheitliche Nutzungslogs"],
      ["Kontrolle", "Team-Quotas schwer konsistent anzuwenden", "Gruppen, Modellzugriff, Quotas und Routing-Policy"],
    ],
    actionCards: (toolName) => [
      { title: "Installieren", body: `Ein Kunde führt einen Befehl aus und wählt ${toolName}.` },
      { title: "Nutzen", body: `Jede ${toolName}-Sitzung läuft über Flatkey und zeichnet token-Nutzung auf.` },
      { title: "Verwalten", body: "Teams halten Zugriff, Guthaben, Logs und Modellauswahl in einer Konsole." },
    ],
    faqTitle: "Fragen von Kunden",
    finalTitle: (toolName) => `Bereit, ${toolName} über Flatkey auszuführen?`,
    finalBody: (toolName) => `Erstelle einen key unter console.flatkey.ai/keys, führe den one-liner aus und starte messbare ${toolName}-Nutzung.`,
  },
};

const imageBuddyPageCopy: Record<Locale, Partial<PageCopy>> = {
  en: {
    usagePill: "ready for image workflows",
    oneKeyBalance: () => "One Flatkey key, one balance, visible image usage logs, and a prompt library built for commercial output.",
    valueProps: [
      { title: "One Flatkey key", body: "Users create one key at console.flatkey.ai/keys, run image-buddy onboard, and generate images from the CLI." },
      { title: "Around 40% cheaper", body: "Route image generation through Flatkey to lower metered generation cost." },
      { title: "GPT-image-2 + Nano Banana Pro", body: "Generate through GPT-image-2 or Nano Banana Pro while Image Buddy handles prompts, templates, and CLI setup." },
      { title: "CLI workflow", body: "Users install Image Buddy once, save a Flatkey key, then generate images from a short prompt." },
    ],
    quickStartTitle: "CLI quickstart in minutes",
    quickStartModelNote: "Choose GPT-image-2 or Nano Banana Pro from your Flatkey model routing settings.",
    quickStartGithubLabel: "View prompt examples on GitHub",
    whyUsage: () => "Why this grows image usage",
    whyUsageBody: () => "Flatkey lowers generation cost while Image Buddy removes prompt friction with templates, hints, and a local demo gallery.",
    comparisonTitle: "Raw image generation vs Image Buddy",
    comparisonRows: [
      ["Cost", "Direct image routes", "Around 40% cheaper through Flatkey"],
      ["Setup", "Manual prompts and API key handling", "image-buddy onboard plus saved key"],
      ["Prompting", "Blank prompt box and repeated tuning", "Commercial templates and short hints"],
      ["Adoption", "Users need to understand API details", "Three CLI commands hide the plumbing"],
    ],
    actionCards: () => [
      { title: "Onboard", body: "Run image-buddy onboard once to save a Flatkey API key." },
      { title: "Generate", body: "Use a plain prompt or a template hint like image-buddy generate product-shot \"ceramic coffee mug for a summer ecommerce campaign\"." },
      { title: "Demo", body: "Open image-buddy web to browse examples and generate with Flatkey." },
    ],
    finalTitle: () => "Ready to generate images with Flatkey?",
    finalBody: () => "Create a key, run onboard, then generate from a prompt.",
  },
  zh: {
    usagePill: "为生图工作流设计",
    oneKeyBalance: () => "一个 Flatkey key、一个余额、可见的生图日志，以及面向商业输出的提示词库。",
    valueProps: [
      { title: "一个 Flatkey key", body: "用户在 console.flatkey.ai/keys 创建 key，运行 image-buddy onboard 后即可用 CLI 生图。" },
      { title: "约便宜 40%", body: "通过 Flatkey 路由生图，降低计量生成成本。" },
      { title: "GPT-image-2 + Nano Banana Pro", body: "通过 GPT-image-2 或 Nano Banana Pro 生成，Image Buddy 负责提示词、模板和 CLI 配置。" },
      { title: "CLI 工作流", body: "用户安装一次 Image Buddy，保存 Flatkey key，然后用一句 prompt 生成图片。" },
    ],
    quickStartTitle: "CLI 快速开始，几分钟可用",
    quickStartModelNote: "可在 Flatkey 模型路由设置中选择 GPT-image-2 或 Nano Banana Pro。",
    quickStartGithubLabel: "在 GitHub 查看提示词示例",
    whyUsage: () => "为什么这能提升生图用量",
    whyUsageBody: () => "Flatkey 降低生成成本，Image Buddy 用模板、hint 和本地 demo gallery 降低提示词门槛。",
    comparisonTitle: "裸生图 vs Image Buddy",
    comparisonRows: [
      ["成本", "直连生图路线", "通过 Flatkey 约便宜 40%"],
      ["配置", "手动处理 prompt 和 API key", "image-buddy onboard 保存 key"],
      ["提示词", "空白 prompt 反复调", "商业模板和短 hint"],
      ["采用", "用户要理解 API 细节", "三条 CLI 命令隐藏复杂度"],
    ],
    actionCards: () => [
      { title: "Onboard", body: "运行一次 image-buddy onboard 保存 Flatkey API key。" },
      { title: "生成", body: "用一句话或模板 hint，例如 image-buddy generate product-shot \"ceramic coffee mug for a summer ecommerce campaign\"。" },
      { title: "Demo", body: "打开 image-buddy web 浏览示例，并用 Flatkey 生成图片。" },
    ],
    finalTitle: () => "准备好用 Flatkey 生成图片了吗？",
    finalBody: () => "创建 key，运行 onboard，然后用 prompt 生成图片。",
  },
  es: {
    usagePill: "listo para flujos de imagen",
    oneKeyBalance: () => "Una key de Flatkey, un saldo, logs visibles de imágenes y una biblioteca de prompts comerciales.",
    valueProps: [
      { title: "Una key de Flatkey", body: "Crea una key, ejecuta image-buddy onboard y genera imágenes desde la CLI." },
      { title: "Cerca de 40% más barato", body: "Enruta la generación de imágenes por Flatkey para reducir el coste medido." },
      { title: "GPT-image-2 + Nano Banana Pro", body: "Genera con GPT-image-2 o Nano Banana Pro mientras Image Buddy gestiona prompts, plantillas y CLI." },
      { title: "Flujo CLI", body: "El usuario instala Image Buddy una vez, guarda una key de Flatkey y genera imágenes desde un prompt corto." },
    ],
    quickStartTitle: "Inicio rápido de CLI en minutos",
    quickStartModelNote: "Elige GPT-image-2 o Nano Banana Pro desde la configuración de enrutamiento de modelos de Flatkey.",
    quickStartGithubLabel: "Ver ejemplos de prompts en GitHub",
    whyUsage: () => "Por qué aumenta el uso de imágenes",
    whyUsageBody: () => "Flatkey reduce el coste e Image Buddy elimina fricción con plantillas, hints y demo gallery local.",
    comparisonTitle: "Generación directa vs Image Buddy",
    comparisonRows: [["Coste", "Rutas directas", "Cerca de 40% más barato con Flatkey"], ["Configuración", "Prompts y key manuales", "image-buddy onboard"], ["Prompting", "Caja vacía y ajustes repetidos", "Plantillas comerciales y hints"], ["Adopción", "El usuario entiende detalles API", "Skill y CLI ocultan la complejidad"]],
    actionCards: () => [{ title: "Onboard", body: "Guarda la key con image-buddy onboard." }, { title: "Generar", body: "Usa un prompt o template hint." }, { title: "Demo", body: "Abre image-buddy web para probar con Flatkey." }],
    finalTitle: () => "¿Listo para generar imágenes con Flatkey?",
    finalBody: () => "Crea una key, ejecuta onboard y genera desde un prompt.",
  },
  fr: {
    usagePill: "prêt pour les workflows image",
    oneKeyBalance: () => "Une clé Flatkey, un solde, des logs d'images visibles et une bibliothèque de prompts commerciaux.",
    valueProps: [
      { title: "Une clé Flatkey", body: "Créez une clé, lancez image-buddy onboard, puis générez depuis le CLI." },
      { title: "Environ 40% moins cher", body: "Routez la génération d'images via Flatkey pour réduire le coût mesuré." },
      { title: "GPT-image-2 + Nano Banana Pro", body: "Générez via GPT-image-2 ou Nano Banana Pro pendant qu'Image Buddy gère prompts, templates et CLI." },
      { title: "Workflow CLI", body: "L'utilisateur installe Image Buddy une fois, enregistre une clé Flatkey, puis génère depuis un court prompt." },
    ],
    quickStartTitle: "Démarrage CLI en quelques minutes",
    quickStartModelNote: "Choisissez GPT-image-2 ou Nano Banana Pro dans les paramètres de routage des modèles Flatkey.",
    quickStartGithubLabel: "Voir les exemples de prompts sur GitHub",
    whyUsage: () => "Pourquoi cela augmente l'usage image",
    whyUsageBody: () => "Flatkey réduit le coût et Image Buddy enlève la friction avec templates, hints et demo gallery locale.",
    comparisonTitle: "Génération brute vs Image Buddy",
    comparisonRows: [["Coût", "Routes directes", "Environ 40% moins cher via Flatkey"], ["Configuration", "Prompts et clé manuels", "image-buddy onboard"], ["Prompting", "Page blanche et réglages répétés", "Templates commerciaux et hints"], ["Adoption", "L'utilisateur comprend les détails API", "Skill et CLI cachent la complexité"]],
    actionCards: () => [{ title: "Onboard", body: "Enregistrez la clé avec image-buddy onboard." }, { title: "Générer", body: "Utilisez un prompt ou un template hint." }, { title: "Démo", body: "Ouvrez image-buddy web pour tester avec Flatkey." }],
    finalTitle: () => "Prêt à générer des images avec Flatkey ?",
    finalBody: () => "Créez une clé, lancez onboard, puis générez depuis un prompt.",
  },
  pt: {
    usagePill: "pronto para fluxos de imagem",
    oneKeyBalance: () => "Uma key Flatkey, um saldo, logs visíveis de imagem e uma biblioteca de prompts comerciais.",
    valueProps: [
      { title: "Uma key Flatkey", body: "Crie uma key, rode image-buddy onboard e gere imagens pela CLI." },
      { title: "Cerca de 40% mais barato", body: "Use Flatkey para reduzir o custo medido de geração de imagens." },
      { title: "GPT-image-2 + Nano Banana Pro", body: "Gere com GPT-image-2 ou Nano Banana Pro enquanto o Image Buddy cuida de prompts, templates e CLI." },
      { title: "Fluxo CLI", body: "O usuário instala o Image Buddy uma vez, salva uma key Flatkey e gera imagens a partir de um prompt curto." },
    ],
    quickStartTitle: "Início rápido da CLI em minutos",
    quickStartModelNote: "Escolha GPT-image-2 ou Nano Banana Pro nas configurações de roteamento de modelos da Flatkey.",
    quickStartGithubLabel: "Ver exemplos de prompts no GitHub",
    whyUsage: () => "Por que isso aumenta o uso de imagens",
    whyUsageBody: () => "Flatkey reduz custo e Image Buddy remove fricção com templates, hints e demo gallery local.",
    comparisonTitle: "Geração direta vs Image Buddy",
    comparisonRows: [["Custo", "Rotas diretas", "Cerca de 40% mais barato via Flatkey"], ["Configuração", "Prompts e key manuais", "image-buddy onboard"], ["Prompting", "Tela em branco e ajustes repetidos", "Templates comerciais e hints"], ["Adoção", "Usuário entende detalhes de API", "Skill e CLI escondem a complexidade"]],
    actionCards: () => [{ title: "Onboard", body: "Salve a key com image-buddy onboard." }, { title: "Gerar", body: "Use um prompt ou template hint." }, { title: "Demo", body: "Abra image-buddy web para testar com Flatkey." }],
    finalTitle: () => "Pronto para gerar imagens com Flatkey?",
    finalBody: () => "Crie uma key, rode onboard e gere a partir de um prompt.",
  },
  ru: {
    usagePill: "готово для image-workflow",
    oneKeyBalance: () => "Один Flatkey key, один баланс, видимые логи генерации и библиотека коммерческих промптов.",
    valueProps: [
      { title: "Один Flatkey key", body: "Создайте key, выполните image-buddy onboard и генерируйте изображения из CLI." },
      { title: "Примерно на 40% дешевле", body: "Генерация через Flatkey снижает измеряемую стоимость изображений." },
      { title: "GPT-image-2 + Nano Banana Pro", body: "Генерируйте через GPT-image-2 или Nano Banana Pro, а Image Buddy отвечает за prompts, templates и CLI." },
      { title: "CLI workflow", body: "Пользователь один раз устанавливает Image Buddy, сохраняет Flatkey key и генерирует изображения из короткого prompt." },
    ],
    quickStartTitle: "Быстрый старт CLI за минуты",
    quickStartModelNote: "Выберите GPT-image-2 или Nano Banana Pro в настройках маршрутизации моделей Flatkey.",
    quickStartGithubLabel: "Смотреть примеры prompts на GitHub",
    whyUsage: () => "Почему это растит image usage",
    whyUsageBody: () => "Flatkey снижает стоимость, Image Buddy убирает трение через шаблоны, hints и локальную демо-галерею.",
    comparisonTitle: "Прямая генерация vs Image Buddy",
    comparisonRows: [["Стоимость", "Прямые маршруты", "Примерно на 40% дешевле через Flatkey"], ["Настройка", "Ручные промпты и key", "image-buddy onboard"], ["Prompting", "Пустое поле и повторная настройка", "Коммерческие шаблоны и hints"], ["Внедрение", "Пользователь знает детали API", "Skill и CLI скрывают сложность"]],
    actionCards: () => [{ title: "Onboard", body: "Сохраните key через image-buddy onboard." }, { title: "Генерация", body: "Используйте prompt или template hint." }, { title: "Демо", body: "Откройте image-buddy web и генерируйте через Flatkey." }],
    finalTitle: () => "Готовы генерировать изображения через Flatkey?",
    finalBody: () => "Создайте key, запустите onboard, затем сгенерируйте из prompt.",
  },
  ja: {
    usagePill: "画像ワークフロー向け",
    oneKeyBalance: () => "1 つの Flatkey key、1 つの残高、可視化された画像ログ、商用 prompt ライブラリ。",
    valueProps: [
      { title: "1 つの Flatkey key", body: "key を作成し、image-buddy onboard 後に CLI から画像生成できます。" },
      { title: "約 40% 安い", body: "Flatkey 経由で画像生成コストを下げます。" },
      { title: "GPT-image-2 + Nano Banana Pro", body: "GPT-image-2 または Nano Banana Pro で生成し、Image Buddy が prompt、template、CLI 設定を処理します。" },
      { title: "CLI ワークフロー", body: "Image Buddy を一度インストールし、Flatkey key を保存して、短い prompt から画像生成できます。" },
    ],
    quickStartTitle: "CLI クイックスタートを数分で",
    quickStartModelNote: "Flatkey のモデルルーティング設定で GPT-image-2 または Nano Banana Pro を選択できます。",
    quickStartGithubLabel: "GitHub で prompt 例を見る",
    whyUsage: () => "画像利用が増える理由",
    whyUsageBody: () => "Flatkey がコストを下げ、Image Buddy が templates、hints、local demo gallery で摩擦を減らします。",
    comparisonTitle: "直接生成 vs Image Buddy",
    comparisonRows: [["コスト", "直接ルート", "Flatkey 経由で約 40% 安い"], ["設定", "手動 prompts と key", "image-buddy onboard"], ["Prompting", "空欄から調整", "商用テンプレートと hints"], ["導入", "API details の理解が必要", "Skill と CLI が複雑さを隠す"]],
    actionCards: () => [{ title: "Onboard", body: "image-buddy onboard で key を保存。" }, { title: "生成", body: "prompt または template hint を使用。" }, { title: "デモ", body: "image-buddy web で Flatkey 生成を試す。" }],
    finalTitle: () => "Flatkey で画像生成を始めますか？",
    finalBody: () => "key を作成し、onboard を実行して、prompt から生成してください。",
  },
  vi: {
    usagePill: "sẵn cho workflow tạo ảnh",
    oneKeyBalance: () => "Một Flatkey key, một số dư, log tạo ảnh rõ ràng và thư viện prompt thương mại.",
    valueProps: [
      { title: "Một Flatkey key", body: "Tạo key, chạy image-buddy onboard rồi tạo ảnh bằng CLI." },
      { title: "Rẻ hơn khoảng 40%", body: "Dùng Flatkey để giảm chi phí tạo ảnh theo usage." },
      { title: "GPT-image-2 + Nano Banana Pro", body: "Tạo ảnh qua GPT-image-2 hoặc Nano Banana Pro, còn Image Buddy xử lý prompt, template và CLI." },
      { title: "Workflow CLI", body: "Người dùng cài Image Buddy một lần, lưu Flatkey key rồi tạo ảnh từ prompt ngắn." },
    ],
    quickStartTitle: "Bắt đầu nhanh với CLI trong vài phút",
    quickStartModelNote: "Chọn GPT-image-2 hoặc Nano Banana Pro trong cài đặt định tuyến model của Flatkey.",
    quickStartGithubLabel: "Xem ví dụ prompt trên GitHub",
    whyUsage: () => "Vì sao tăng usage tạo ảnh",
    whyUsageBody: () => "Flatkey giảm chi phí, Image Buddy giảm ma sát bằng templates, hints và local demo gallery.",
    comparisonTitle: "Tạo ảnh trực tiếp vs Image Buddy",
    comparisonRows: [["Chi phí", "Route trực tiếp", "Rẻ hơn khoảng 40% qua Flatkey"], ["Cài đặt", "Prompt và key thủ công", "image-buddy onboard"], ["Prompting", "Ô trống và chỉnh nhiều lần", "Template thương mại và hints"], ["Áp dụng", "Người dùng hiểu chi tiết API", "Skill và CLI che phần phức tạp"]],
    actionCards: () => [{ title: "Onboard", body: "Lưu key bằng image-buddy onboard." }, { title: "Tạo ảnh", body: "Dùng prompt hoặc template hint." }, { title: "Demo", body: "Mở image-buddy web để thử Flatkey." }],
    finalTitle: () => "Sẵn sàng tạo ảnh với Flatkey?",
    finalBody: () => "Tạo key, chạy onboard, rồi tạo ảnh từ prompt.",
  },
  de: {
    usagePill: "bereit für Bild-Workflows",
    oneKeyBalance: () => "Ein Flatkey key, ein Guthaben, sichtbare Bild-Logs und eine kommerzielle Prompt-Bibliothek.",
    valueProps: [
      { title: "Ein Flatkey key", body: "Key erstellen, image-buddy onboard ausführen und Bilder per CLI generieren." },
      { title: "Etwa 40% günstiger", body: "Bildgenerierung über Flatkey senkt gemessene Kosten." },
      { title: "GPT-image-2 + Nano Banana Pro", body: "Generiere über GPT-image-2 oder Nano Banana Pro, während Image Buddy Prompts, Templates und CLI übernimmt." },
      { title: "CLI-Workflow", body: "Nutzer installieren Image Buddy einmal, speichern einen Flatkey key und generieren Bilder aus einem kurzen Prompt." },
    ],
    quickStartTitle: "CLI-Schnellstart in Minuten",
    quickStartModelNote: "Wähle GPT-image-2 oder Nano Banana Pro in den Flatkey-Modellrouting-Einstellungen.",
    quickStartGithubLabel: "Prompt-Beispiele auf GitHub ansehen",
    whyUsage: () => "Warum das Bildnutzung steigert",
    whyUsageBody: () => "Flatkey senkt Kosten, Image Buddy reduziert Reibung durch Templates, Hints und lokale Demo Gallery.",
    comparisonTitle: "Direkte Generierung vs Image Buddy",
    comparisonRows: [["Kosten", "Direkte Routen", "Etwa 40% günstiger über Flatkey"], ["Einrichtung", "Manuelle Prompts und key", "image-buddy onboard"], ["Prompting", "Leeres Feld und wiederholtes Tunen", "Kommerzielle Templates und Hints"], ["Einführung", "Nutzer verstehen API-Details", "Drei CLI-Befehle verstecken Komplexität"]],
    actionCards: () => [{ title: "Onboard", body: "Key mit image-buddy onboard speichern." }, { title: "Generieren", body: "Prompt oder Template-Hint nutzen." }, { title: "Demo", body: "image-buddy web öffnen und mit Flatkey testen." }],
    finalTitle: () => "Bereit, Bilder mit Flatkey zu generieren?",
    finalBody: () => "Key erstellen, onboard ausführen und aus einem Prompt generieren.",
  },
};

export function getUseCaseConfig(pathname: string, locale: Locale): UseCaseConfig {
  const slug: UseCaseSlug = pathname.endsWith("/image-buddy") ? "image-buddy" : pathname.endsWith("/codex") ? "codex" : "claude-code";
  if (slug === "image-buddy") return localizedImageBuddyUseCases[locale] ?? localizedImageBuddyUseCases.en;
  return localizedUseCases[locale]?.[slug] ?? localizedUseCases.en[slug] ?? CLAUDE_CODE_USE_CASE;
}

const valueIcons = [KeyRound, CircleDollarSign, LineChart, ShieldCheck] as const;
const actionIcons = [ClipboardCheck, Gauge, UsersRound] as const;
export const IMAGE_BUDDY_QUICKSTART_STEPS = [
  { label: "Step 1", title: "Install", command: "npm i -g @flatkey-ai/image-buddy" },
  { label: "Step 2", title: "Initialize", command: "npx @flatkey-ai/image-buddy onboard" },
  { label: "Step 3", title: "Generate", command: 'npx @flatkey-ai/image-buddy generate --prompt "premium product hero image for an AI image API CLI"' },
] as const;

const imageBuddyInstallCopy: Record<Locale, { cliTitle: string }> = {
  en: { cliTitle: "CLI quickstart" },
  zh: { cliTitle: "CLI 快速开始" },
  es: { cliTitle: "Inicio rápido de CLI" },
  fr: { cliTitle: "Démarrage CLI" },
  pt: { cliTitle: "Início rápido da CLI" },
  ru: { cliTitle: "Быстрый старт CLI" },
  ja: { cliTitle: "CLI クイックスタート" },
  vi: { cliTitle: "Bắt đầu nhanh với CLI" },
  de: { cliTitle: "CLI-Schnellstart" },
};

const imageBuddyQuickstartStepCopy: Record<Locale, Array<{ label: string; title: string }>> = {
  en: [
    { label: "Step 1", title: "Install" },
    { label: "Step 2", title: "Initialize" },
    { label: "Step 3", title: "Generate" },
  ],
  zh: [
    { label: "第 1 步", title: "安装" },
    { label: "第 2 步", title: "初始化" },
    { label: "第 3 步", title: "生成" },
  ],
  es: [
    { label: "Paso 1", title: "Instalar" },
    { label: "Paso 2", title: "Inicializar" },
    { label: "Paso 3", title: "Generar" },
  ],
  fr: [
    { label: "Étape 1", title: "Installer" },
    { label: "Étape 2", title: "Initialiser" },
    { label: "Étape 3", title: "Générer" },
  ],
  pt: [
    { label: "Etapa 1", title: "Instalar" },
    { label: "Etapa 2", title: "Inicializar" },
    { label: "Etapa 3", title: "Gerar" },
  ],
  ru: [
    { label: "Шаг 1", title: "Установить" },
    { label: "Шаг 2", title: "Инициализировать" },
    { label: "Шаг 3", title: "Сгенерировать" },
  ],
  ja: [
    { label: "ステップ 1", title: "インストール" },
    { label: "ステップ 2", title: "初期化" },
    { label: "ステップ 3", title: "生成" },
  ],
  vi: [
    { label: "Bước 1", title: "Cài đặt" },
    { label: "Bước 2", title: "Khởi tạo" },
    { label: "Bước 3", title: "Tạo ảnh" },
  ],
  de: [
    { label: "Schritt 1", title: "Installieren" },
    { label: "Schritt 2", title: "Initialisieren" },
    { label: "Schritt 3", title: "Generieren" },
  ],
};

const imageBuddyDemoCopy: Record<Locale, {
  eyebrow: string;
  title: string;
  subtitle: string;
  images: Array<{ src: string; title: string; prompt: string; alt: string; wide?: boolean }>;
}> = {
  en: {
    eyebrow: "Generated with Image Buddy",
    title: "Real ecommerce image demos",
    subtitle: "Prompt templates turn short commercial hints into ready-to-use product visuals.",
    images: [
      {
        src: "/use-case/image-buddy/premium-product-hero.jpg",
        title: "Premium product hero",
        prompt: "ceramic coffee mug for a summer ecommerce campaign",
        alt: "Generated hero image of a ceramic coffee mug near a sunny beach",
        wide: true,
      },
      {
        src: "/use-case/image-buddy/marketplace-main-image.jpg",
        title: "Marketplace main image",
        prompt: "insulated stainless steel water bottle for Amazon listing",
        alt: "Generated marketplace product image of a stainless steel water bottle on white background",
      },
      {
        src: "/use-case/image-buddy/ugc-ad-still.jpg",
        title: "UGC ad still",
        prompt: "organic skincare serum bottle in bright bathroom",
        alt: "Generated UGC style image of a hand holding amber skincare serum in a bright bathroom",
      },
    ],
  },
  zh: {
    eyebrow: "由 Image Buddy 生成",
    title: "真实电商图片 demo",
    subtitle: "提示词模板把简短商业需求变成可直接使用的产品视觉。",
    images: [
      {
        src: "/use-case/image-buddy/premium-product-hero.jpg",
        title: "高端产品主视觉",
        prompt: "夏季电商活动的陶瓷咖啡杯",
        alt: "生成的海边阳光陶瓷咖啡杯主视觉",
        wide: true,
      },
      {
        src: "/use-case/image-buddy/marketplace-main-image.jpg",
        title: "Marketplace 主图",
        prompt: "Amazon listing 的不锈钢保温水瓶",
        alt: "生成的白底不锈钢水瓶电商主图",
      },
      {
        src: "/use-case/image-buddy/ugc-ad-still.jpg",
        title: "UGC 广告图",
        prompt: "明亮浴室里的有机护肤精华瓶",
        alt: "生成的手持琥珀色护肤精华瓶 UGC 风格图片",
      },
    ],
  },
  es: {
    eyebrow: "Generado con Image Buddy",
    title: "Demos reales para ecommerce",
    subtitle: "Las plantillas convierten hints comerciales cortos en visuales de producto listos.",
    images: [
      { src: "/use-case/image-buddy/premium-product-hero.jpg", title: "Hero de producto premium", prompt: "taza cerámica para campaña ecommerce de verano", alt: "Hero generado de una taza cerámica junto a una playa soleada", wide: true },
      { src: "/use-case/image-buddy/marketplace-main-image.jpg", title: "Imagen principal marketplace", prompt: "botella de acero inoxidable para Amazon listing", alt: "Imagen generada de botella de acero inoxidable sobre fondo blanco" },
      { src: "/use-case/image-buddy/ugc-ad-still.jpg", title: "Still de anuncio UGC", prompt: "serum orgánico en baño luminoso", alt: "Imagen UGC generada de una mano con serum ámbar en un baño luminoso" },
    ],
  },
  fr: {
    eyebrow: "Généré avec Image Buddy",
    title: "Démos ecommerce réelles",
    subtitle: "Les templates transforment de courts briefs commerciaux en visuels produit prêts à l'emploi.",
    images: [
      { src: "/use-case/image-buddy/premium-product-hero.jpg", title: "Hero produit premium", prompt: "mug en céramique pour campagne ecommerce estivale", alt: "Hero généré d'un mug en céramique près d'une plage ensoleillée", wide: true },
      { src: "/use-case/image-buddy/marketplace-main-image.jpg", title: "Image principale marketplace", prompt: "gourde inox pour listing Amazon", alt: "Image générée d'une gourde inox sur fond blanc" },
      { src: "/use-case/image-buddy/ugc-ad-still.jpg", title: "Visuel publicitaire UGC", prompt: "sérum skincare bio dans une salle de bain lumineuse", alt: "Image UGC générée d'une main tenant un sérum ambré dans une salle de bain lumineuse" },
    ],
  },
  pt: {
    eyebrow: "Gerado com Image Buddy",
    title: "Demos reais de ecommerce",
    subtitle: "Templates transformam hints comerciais curtos em visuais de produto prontos.",
    images: [
      { src: "/use-case/image-buddy/premium-product-hero.jpg", title: "Hero premium de produto", prompt: "caneca cerâmica para campanha ecommerce de verão", alt: "Hero gerado de uma caneca cerâmica perto de uma praia ensolarada", wide: true },
      { src: "/use-case/image-buddy/marketplace-main-image.jpg", title: "Imagem principal marketplace", prompt: "garrafa inox para listing Amazon", alt: "Imagem gerada de garrafa inox em fundo branco" },
      { src: "/use-case/image-buddy/ugc-ad-still.jpg", title: "Still de anúncio UGC", prompt: "sérum orgânico em banheiro claro", alt: "Imagem UGC gerada de uma mão segurando sérum âmbar em banheiro claro" },
    ],
  },
  ru: {
    eyebrow: "Сгенерировано через Image Buddy",
    title: "Реальные ecommerce demo",
    subtitle: "Шаблоны превращают короткие коммерческие hints в готовые продуктовые визуалы.",
    images: [
      { src: "/use-case/image-buddy/premium-product-hero.jpg", title: "Премиальный product hero", prompt: "керамическая кружка для летней ecommerce-кампании", alt: "Сгенерированный hero-визуал керамической кружки у солнечного пляжа", wide: true },
      { src: "/use-case/image-buddy/marketplace-main-image.jpg", title: "Главное изображение marketplace", prompt: "бутылка из нержавеющей стали для Amazon listing", alt: "Сгенерированное изображение стальной бутылки на белом фоне" },
      { src: "/use-case/image-buddy/ugc-ad-still.jpg", title: "UGC ad still", prompt: "органическая skincare-сыворотка в светлой ванной", alt: "Сгенерированное UGC-изображение руки с янтарной сывороткой в светлой ванной" },
    ],
  },
  ja: {
    eyebrow: "Image Buddy で生成",
    title: "実用的な EC 画像 demo",
    subtitle: "テンプレートが短い商用 hint を、そのまま使える商品ビジュアルに変換します。",
    images: [
      { src: "/use-case/image-buddy/premium-product-hero.jpg", title: "プレミアム商品 hero", prompt: "夏の EC キャンペーン向け陶器マグ", alt: "晴れた海辺の陶器マグを生成した hero 画像", wide: true },
      { src: "/use-case/image-buddy/marketplace-main-image.jpg", title: "Marketplace メイン画像", prompt: "Amazon listing 向けステンレスボトル", alt: "白背景のステンレスボトルを生成した商品画像" },
      { src: "/use-case/image-buddy/ugc-ad-still.jpg", title: "UGC 広告画像", prompt: "明るい浴室のオーガニック美容液", alt: "明るい浴室で琥珀色の美容液を持つ手の UGC 風生成画像" },
    ],
  },
  vi: {
    eyebrow: "Tạo bằng Image Buddy",
    title: "Demo ảnh ecommerce thực tế",
    subtitle: "Template biến hint thương mại ngắn thành ảnh sản phẩm dùng được ngay.",
    images: [
      { src: "/use-case/image-buddy/premium-product-hero.jpg", title: "Hero sản phẩm premium", prompt: "ly gốm cho chiến dịch ecommerce mùa hè", alt: "Ảnh hero được tạo của ly gốm cạnh bãi biển nắng", wide: true },
      { src: "/use-case/image-buddy/marketplace-main-image.jpg", title: "Ảnh chính marketplace", prompt: "bình nước inox cho Amazon listing", alt: "Ảnh sản phẩm bình nước inox nền trắng được tạo" },
      { src: "/use-case/image-buddy/ugc-ad-still.jpg", title: "Ảnh quảng cáo UGC", prompt: "serum skincare hữu cơ trong phòng tắm sáng", alt: "Ảnh UGC được tạo của tay cầm serum màu hổ phách trong phòng tắm sáng" },
    ],
  },
  de: {
    eyebrow: "Mit Image Buddy generiert",
    title: "Echte Ecommerce-Demos",
    subtitle: "Templates verwandeln kurze kommerzielle Hints in sofort nutzbare Produktvisuals.",
    images: [
      { src: "/use-case/image-buddy/premium-product-hero.jpg", title: "Premium Product Hero", prompt: "Keramikbecher für eine Sommer-Ecommerce-Kampagne", alt: "Generiertes Hero-Bild eines Keramikbechers an einem sonnigen Strand", wide: true },
      { src: "/use-case/image-buddy/marketplace-main-image.jpg", title: "Marketplace-Hauptbild", prompt: "Edelstahlflasche für Amazon Listing", alt: "Generiertes Produktbild einer Edelstahlflasche auf weißem Hintergrund" },
      { src: "/use-case/image-buddy/ugc-ad-still.jpg", title: "UGC-Ad-Still", prompt: "organisches Skincare-Serum in hellem Bad", alt: "Generiertes UGC-Bild einer Hand mit bernsteinfarbenem Serum in hellem Bad" },
    ],
  },
};

function ImageBuddyDemoGallery({ locale }: { locale: Locale }) {
  const demoCopy = imageBuddyDemoCopy[locale] ?? imageBuddyDemoCopy.en;
  return (
    <div className="lg:pl-4">
      <div className="mb-4">
        <div className="text-[11px] font-semibold tracking-wide text-violet-700 uppercase dark:text-violet-200">{demoCopy.eyebrow}</div>
        <h2 className="mt-1 text-xl font-extrabold tracking-tight">{demoCopy.title}</h2>
        <p className="text-muted-foreground mt-1 text-sm leading-6">{demoCopy.subtitle}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {demoCopy.images.map((item) => (
          <figure
            key={item.src}
            className={item.wide ? "col-span-2 overflow-hidden rounded-2xl border border-violet-500/14 bg-white dark:bg-white/[0.04]" : "overflow-hidden rounded-2xl border border-violet-500/14 bg-white dark:bg-white/[0.04]"}
          >
            <div className={item.wide ? "relative aspect-[16/9]" : "relative aspect-square"}>
              <Image src={item.src} alt={item.alt} fill sizes={item.wide ? "(min-width: 1024px) 520px, 100vw" : "(min-width: 1024px) 250px, 50vw"} className="object-cover" priority={item.wide} />
            </div>
            <figcaption className="p-3">
              <div className="text-sm font-bold">{item.title}</div>
              <div className="text-muted-foreground mt-1 line-clamp-2 font-mono text-[11px] leading-4">{item.prompt}</div>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

function ImageBuddyInstallPanel({ locale }: { locale: Locale }) {
  const panelCopy = imageBuddyInstallCopy[locale] ?? imageBuddyInstallCopy.en;
  const stepCopy = imageBuddyQuickstartStepCopy[locale] ?? imageBuddyQuickstartStepCopy.en;
  return (
    <div className="w-full">
      <div className="rounded-2xl border border-violet-500/16 bg-white/78 p-4 shadow-[0_24px_80px_-58px_rgba(91,33,182,0.72)] dark:border-violet-300/14 dark:bg-white/[0.04]">
        <div className="mb-3 text-sm font-bold">{panelCopy.cliTitle}</div>
        <div className="grid gap-3 lg:grid-cols-3">
          {IMAGE_BUDDY_QUICKSTART_STEPS.map((step, index) => {
            const localizedStep = stepCopy[index] ?? step;
            return (
              <div key={step.command} className="rounded-xl border border-violet-500/14 bg-white/86 p-3 shadow-inner shadow-violet-500/5 dark:border-violet-300/14 dark:bg-white/[0.06]">
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[11px] font-bold text-violet-700 dark:text-violet-200">{localizedStep.label}</span>
                  <span className="text-sm font-bold">{localizedStep.title}</span>
                </div>
                <code className="block overflow-x-auto rounded-lg border border-violet-500/10 bg-violet-500/[0.045] px-3 py-2 font-mono text-[12px] leading-5 text-zinc-800 dark:border-violet-300/12 dark:bg-white/[0.06] dark:text-zinc-100">
                  {step.command}
                </code>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function CodingAgentUseCasePage(props: Props) {
  const { locale } = props;
  const config = getUseCaseConfig(props.config.pathname, locale);
  const baseCopy = pageCopy[locale] ?? pageCopy.en;
  const copy = config.installMode === "image-buddy" ? { ...baseCopy, ...imageBuddyPageCopy[locale] } : baseCopy;
  const ctaUrl = config.installMode === "image-buddy" ? consoleUrl("/sign-up", "redirect=/keys") : signUpUrl;

  return (
    <SiteShell locale={locale} pathname={config.pathname}>
      <div className="relative overflow-x-hidden bg-[linear-gradient(180deg,#f4f0ff_0%,#fbfaff_28%,#ffffff_62%,#f4f1ff_100%)] dark:bg-[linear-gradient(180deg,#050712_0%,#080b18_40%,#070712_72%,#03040b_100%)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(124,58,237,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(124,58,237,0.1)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_64%_52%_at_50%_20%,black_18%,transparent_100%)] opacity-50 dark:opacity-35"
        />
        <div className="relative z-10 mx-auto max-w-6xl px-6 pt-20 pb-20 md:pt-28">
          <section className="grid gap-8 lg:grid-cols-[1.06fr_0.94fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/22 bg-violet-500/10 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-violet-700 uppercase dark:border-violet-300/20 dark:bg-violet-300/10 dark:text-violet-200">
                <Sparkles className="size-3.5" />
                {config.badge}
              </div>
              <h1 className="mt-5 text-[clamp(2rem,5vw,4.4rem)] leading-[1.02] font-bold tracking-tight">
                {config.headlineLead}{" "}
                <span className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-indigo-500 bg-clip-text text-transparent dark:from-violet-200 dark:via-fuchsia-300 dark:to-indigo-300">
                  {config.headlineAccent}
                </span>
              </h1>
              <p className="text-muted-foreground mt-5 max-w-2xl text-base leading-7 md:text-lg">
                {config.intro}{" "}
                <a className="font-semibold text-violet-700 underline underline-offset-4 dark:text-violet-200" href={CLAUDE_CODE_KEY_URL}>
                  console.flatkey.ai/keys
                </a>
                <span> → {config.toolName} </span>
                <code className="rounded bg-violet-500/10 px-1.5 py-0.5 font-mono text-[0.85em]">{config.endpointText}</code>.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a className="flatkey-cta-primary" href={ctaUrl}>
                  {copy.ctaGetKey} <ArrowRight className="size-4" />
                </a>
                <a className="flatkey-cta-secondary" href="#install">
                  {copy.ctaInstall}
                </a>
              </div>
              <div className="mt-6 grid max-w-2xl grid-cols-3 gap-3">
                {[
                  [copy.metricCheap, copy.metricCheapLabel],
                  [copy.metricSetup, copy.metricSetupLabel],
                  [copy.metricKey, copy.metricKeyLabel],
                ].map(([metric, label]) => (
                  <div key={metric} className="rounded-2xl border border-violet-500/12 bg-white/62 p-3 dark:bg-white/[0.04]">
                    <div className="text-xl font-extrabold text-violet-700 dark:text-violet-200">{metric}</div>
                    <div className="text-muted-foreground mt-1 text-[11px] font-medium">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {config.installMode === "image-buddy" ? <ImageBuddyDemoGallery locale={locale} /> : <div className="rounded-3xl border border-violet-500/16 bg-white/78 p-5 shadow-[0_30px_100px_-62px_rgba(91,33,182,0.9)] backdrop-blur-sm dark:border-violet-300/14 dark:bg-white/[0.04]">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <BadgeDollarSign className="size-4 text-violet-600 dark:text-violet-300" />
                  {config.toolName}, {copy.metricCheap} {copy.metricCheapLabel}
                </div>
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                  {copy.usagePill}
                </span>
              </div>
              <div className="grid gap-3">
                <div className="rounded-2xl border border-red-500/12 bg-red-500/[0.045] p-4">
                  <div className="text-muted-foreground mb-2 text-xs font-semibold uppercase">{config.directLabel}</div>
                  <div className="text-2xl font-extrabold text-red-500/70 line-through">{copy.officialPrice}</div>
                  <p className="text-muted-foreground mt-2 text-sm leading-6">{copy.officialSpend}</p>
                </div>
                <div className="rounded-2xl border border-emerald-500/18 bg-emerald-500/[0.07] p-4">
                  <div className="text-muted-foreground mb-2 text-xs font-semibold uppercase">{config.flatkeyLabel}</div>
                  <div className="text-2xl font-extrabold text-emerald-600">{copy.flatkeyCheap}</div>
                  <p className="text-muted-foreground mt-2 text-sm leading-6">{copy.oneKeyBalance(config.toolName)}</p>
                </div>
              </div>
              <div className="mt-4 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-3 text-sm font-extrabold text-white">
                {config.moreUsageLine}
              </div>
            </div>}
          </section>

          <section className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {copy.valueProps.map((item, index) => {
              const Icon = valueIcons[index] ?? KeyRound;
              return (
              <div key={item.title} className="rounded-2xl border border-violet-500/16 bg-white/74 p-5 dark:border-violet-300/14 dark:bg-white/[0.04]">
                <Icon className="mb-4 size-5 text-violet-600 dark:text-violet-300" />
                <h2 className="font-bold">{item.title}</h2>
                <p className="text-muted-foreground mt-2 text-sm leading-6">{item.body}</p>
              </div>
              );
            })}
          </section>

          <section id="install" className="mt-12">
            <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{copy.quickStartTitle}</h2>
                <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
                  {config.selectInstruction} {copy.quickStartSuffix}
                </p>
                {(copy.quickStartModelNote || copy.quickStartGithubLabel) && (
                  <div className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium">
                    {copy.quickStartModelNote && <span>{copy.quickStartModelNote}</span>}
                    {copy.quickStartGithubLabel && (
                      <a
                        className="inline-flex items-center gap-1.5 font-bold text-violet-700 hover:text-violet-500 dark:text-violet-200"
                        href={IMAGE_BUDDY_GITHUB_URL}
                        rel="nofollow noopener noreferrer"
                        target="_blank"
                      >
                        <svg aria-hidden="true" className="size-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-1.04-.01-1.89-2.78.62-3.37-1.22-3.37-1.22-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.36 9.36 0 0 1 12 6.99c.85 0 1.7.12 2.5.34 1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.8 0 .27.18.59.69.49A10.08 10.08 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z" />
                        </svg>
                        {copy.quickStartGithubLabel}
                      </a>
                    )}
                  </div>
                )}
              </div>
              <a className="flatkey-cta-primary shrink-0 self-start md:self-auto" href={ctaUrl}>
                {copy.ctaGetKey} <ArrowRight className="size-4" />
              </a>
            </div>
            {config.installMode === "image-buddy" ? <ImageBuddyInstallPanel locale={locale} /> : <ClaudeCodeInstallTabs locale={locale} />}
          </section>

          <section className="mt-12 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-2xl border border-violet-500/16 bg-white/76 p-6 dark:border-violet-300/14 dark:bg-white/[0.04]">
              <div className="flex items-center gap-2 text-sm font-bold">
                <BadgeDollarSign className="size-4 text-violet-600 dark:text-violet-300" />
                {copy.whyUsage(config.toolName)}
              </div>
              <p className="text-muted-foreground mt-3 text-sm leading-6">
                {copy.whyUsageBody(config.toolName)}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {config.useCases.map((item) => (
                <div key={item.title} className="flex items-start gap-3 rounded-2xl border border-violet-500/16 bg-white/76 p-4 dark:border-violet-300/14 dark:bg-white/[0.04]">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  <span>
                    <b className="block text-sm">{item.title}</b>
                    <span className="text-muted-foreground mt-1 block text-sm leading-6">{item.body}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-12 rounded-2xl border border-violet-500/16 bg-white/76 p-6 dark:border-violet-300/14 dark:bg-white/[0.04]">
            <div className="mb-5 flex items-center gap-2">
              <Route className="size-5 text-violet-600 dark:text-violet-300" />
              <h2 className="text-2xl font-bold tracking-tight">{copy.comparisonTitle}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="text-muted-foreground border-b border-violet-500/12 text-xs uppercase">
                  <tr>
                    <th className="py-3 pr-4">{copy.comparisonHeaders[0]}</th>
                    <th className="py-3 pr-4">{copy.comparisonHeaders[1]}</th>
                    <th className="py-3">{copy.comparisonHeaders[2]}</th>
                  </tr>
                </thead>
                <tbody>
                  {copy.comparisonRows.map(([need, direct, flatkey]) => (
                    <tr key={need} className="border-b border-violet-500/10 last:border-0">
                      <td className="py-4 pr-4 font-semibold">{need}</td>
                      <td className="text-muted-foreground py-4 pr-4">{direct}</td>
                      <td className="py-4 font-medium text-emerald-700 dark:text-emerald-300">{flatkey}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-12 grid gap-4 lg:grid-cols-3">
            {copy.actionCards(config.toolName).map((item, index) => {
              const Icon = actionIcons[index] ?? ClipboardCheck;
              return (
              <div key={item.title} className="rounded-2xl border border-violet-500/16 bg-white/76 p-5 dark:border-violet-300/14 dark:bg-white/[0.04]">
                <Icon className="mb-4 size-5 text-violet-600 dark:text-violet-300" />
                <h2 className="font-bold">{item.title}</h2>
                <p className="text-muted-foreground mt-2 text-sm leading-6">{item.body}</p>
              </div>
              );
            })}
          </section>

          <section className="mt-12">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{copy.faqTitle}</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {config.faqs.map((faq) => (
                <div key={faq.question} className="rounded-2xl border border-violet-500/16 bg-white/76 p-5 dark:border-violet-300/14 dark:bg-white/[0.04]">
                  <h3 className="font-bold">{faq.question}</h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-6">{faq.answer}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-12 rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-600 to-fuchsia-600 p-6 text-white shadow-[0_28px_90px_-58px_rgba(91,33,182,0.9)] md:p-8">
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight md:text-3xl">{copy.finalTitle(config.toolName)}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/82">
                  {copy.finalBody(config.toolName)}
                </p>
              </div>
              <a className="flatkey-cta-inverse shrink-0" href={ctaUrl}>
                {copy.ctaGetKey} <ArrowRight className="size-4" />
              </a>
            </div>
          </section>
        </div>
      </div>
    </SiteShell>
  );
}
