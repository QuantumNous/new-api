import { type Locale, withIdFallback } from "./locales";

export type PromptArtifact =
  | {
      kind: "image";
      alt: string;
      url: string;
    }
  | {
      kind: "video";
      alt: string;
      poster: string;
      url: string;
    }
  | {
      kind: "text";
      title: string;
      body: string;
    }
  | {
      kind: "code";
      language: string;
      code: string;
    }
  | {
      kind: "storyboard";
      frames: string[];
    };

export type PromptSource = {
  label: string;
  platform: "GitHub" | "Social" | "Official docs" | "Flatkey generated" | "Local migration" | "External";
  url: string;
  capturedAt: string;
};

export type PromptItem = {
  artifact: PromptArtifact;
  category: "image" | "video" | "audio" | "text" | "agent";
  model: string;
  output: {
    label: Record<Locale, string>;
    ratio: "1:1" | "3:2" | "4:3" | "9:16" | "16:9" | "3x3";
  };
  prompt: string;
  slug: string;
  source: PromptSource;
  summary: Record<Locale, string>;
  tags: string[];
  title: Record<Locale, string>;
  updatedAt: string;
};

export type PromptLibraryCopy = {
  artifactLabel: string;
  categories: Record<PromptItem["category"], string>;
  copyPrompt: string;
  detailBack: string;
  detailCta: string;
  detailSource: string;
  detailUseWith: string;
  empty: string;
  heroBadge: string;
  heroBody: string;
  heroTitle: string;
  latestLabel: string;
  metaDescription: string;
  metaTitle: string;
  promptLabel: string;
  sourceLabel: string;
  updateNote: string;
};

const today = new Date().toISOString().slice(0, 10);
const flatkeyGithubBase = "https://github.com/flatkey-ai";
const solveaSourceUrl = "https://mkt-video-proxy-528088078482.us-central1.run.app/characters";

function promptText(en: string, zh: string): Record<Locale, string> {
  return withIdFallback({
    en,
    zh,
    es: en,
    fr: en,
    pt: en,
    ru: en,
    ja: en,
    vi: en,
    de: en,
  });
}

function outputLabel(en: string, zh: string, ratio: PromptItem["output"]["ratio"]): PromptItem["output"] {
  return {
    label: promptText(en, zh),
    ratio,
  };
}

const categoriesEn: PromptLibraryCopy["categories"] = {
  image: "Image",
  video: "Video",
  audio: "Audio",
  text: "Text",
  agent: "Agent",
};

function solveaOwnedSource(): PromptSource {
  return {
    capturedAt: today,
    label: "Owned production asset",
    platform: "Local migration",
    url: solveaSourceUrl,
  };
}

function solveaImagePromptItem(props: {
  alt: string;
  outputEn: string;
  outputRatio: PromptItem["output"]["ratio"];
  outputZh: string;
  prompt: string;
  slug: string;
  summaryEn: string;
  summaryZh: string;
  tags: string[];
  titleEn: string;
  titleZh: string;
  url: string;
}): PromptItem {
  return {
    artifact: {
      alt: props.alt,
      kind: "image",
      url: props.url,
    },
    category: "image",
    model: "gpt-image-2",
    output: outputLabel(props.outputEn, props.outputZh, props.outputRatio),
    prompt: props.prompt,
    slug: props.slug,
    source: solveaOwnedSource(),
    summary: promptText(props.summaryEn, props.summaryZh),
    tags: ["solvea", ...props.tags, "image"],
    title: promptText(props.titleEn, props.titleZh),
    updatedAt: today,
  };
}

function awesomeImagesSource(path = "README.md"): PromptSource {
  return {
    capturedAt: today,
    label: "flatkey-ai/awesome-images",
    platform: "GitHub",
    url: `${flatkeyGithubBase}/awesome-images/blob/main/${path}`,
  };
}

function githubImagePromptItem(props: {
  alt: string;
  outputEn: string;
  outputRatio: PromptItem["output"]["ratio"];
  outputZh: string;
  prompt: string;
  slug: string;
  summaryEn: string;
  summaryZh: string;
  tags: string[];
  titleEn: string;
  titleZh: string;
  url: string;
}): PromptItem {
  return {
    artifact: {
      alt: props.alt,
      kind: "image",
      url: props.url,
    },
    category: "image",
    model: "gpt-image-2",
    output: outputLabel(props.outputEn, props.outputZh, props.outputRatio),
    prompt: props.prompt,
    slug: props.slug,
    source: awesomeImagesSource("src/prompts.js"),
    summary: promptText(props.summaryEn, props.summaryZh),
    tags: ["github", "awesome-images", ...props.tags, "image"],
    title: promptText(props.titleEn, props.titleZh),
    updatedAt: today,
  };
}

export const promptLibraryCopy: Record<Locale, PromptLibraryCopy> = withIdFallback({
  en: {
    artifactLabel: "Produced artifact",
    categories: categoriesEn,
    copyPrompt: "Copy prompt",
    detailBack: "Back to prompts",
    detailCta: "Run with Flatkey",
    detailSource: "Source and provenance",
    detailUseWith: "Use with",
    empty: "No prompts matched this source.",
    heroBadge: "Daily sourced prompt library",
    heroBody:
      "Prompts are stored in Flatkey's prompt database after source review. Every entry includes a source link and a produced artifact.",
    heroTitle: "Prompts that already shipped an output.",
    latestLabel: "Latest source signals",
    metaDescription:
      "A daily refreshed prompt library for Flatkey users. Browse image, video, audio, text and agent prompts with source provenance and produced artifacts.",
    metaTitle: "Flatkey Prompts — daily sourced AI prompt library",
    promptLabel: "Prompt",
    sourceLabel: "Source",
    updateNote: "GitHub and public source feeds refresh daily; local production assets are migrated as verified pairs.",
  },
  zh: {
    artifactLabel: "对应产物",
    categories: { image: "图像", video: "视频", audio: "音频", text: "文本", agent: "Agent" },
    copyPrompt: "复制提示词",
    detailBack: "返回提示词库",
    detailCta: "用 Flatkey 运行",
    detailSource: "来源与出处",
    detailUseWith: "适用模型",
    empty: "没有匹配这个来源的提示词。",
    heroBadge: "每日抓取的提示词库",
    heroBody:
      "提示词经过来源校验后存入 Flatkey 数据库。每条都标明来处，并展示对应产物。",
    heroTitle: "不只给提示词，也给已经产出的结果。",
    latestLabel: "最新来源信号",
    metaDescription:
      "Flatkey 用户可用的每日更新提示词库，覆盖图像、视频、音频、文本和 Agent 提示词，每条都有来源和产物。",
    metaTitle: "Flatkey Prompts — 每日更新 AI 提示词库",
    promptLabel: "提示词",
    sourceLabel: "来源",
    updateNote: "GitHub 和公开来源每日刷新；本地生产素材按已验证配对迁移。",
  },
  es: {
    artifactLabel: "Resultado producido",
    categories: { image: "Imagen", video: "Video", audio: "Audio", text: "Texto", agent: "Agente" },
    copyPrompt: "Copiar prompt",
    detailBack: "Volver a prompts",
    detailCta: "Ejecutar con Flatkey",
    detailSource: "Fuente y procedencia",
    detailUseWith: "Usar con",
    empty: "No hay prompts para esta fuente.",
    heroBadge: "Biblioteca diaria de prompts",
    heroBody:
      "Recolectamos primero proyectos de Flatkey en GitHub y después fuentes públicas de prompt engineering. Cada entrada incluye fuente y resultado.",
    heroTitle: "Prompts que ya tienen un resultado.",
    latestLabel: "Señales recientes",
    metaDescription:
      "Biblioteca diaria de prompts para usuarios de Flatkey, con fuentes y resultados para imagen, video, audio, texto y agentes.",
    metaTitle: "Flatkey Prompts — biblioteca diaria de prompts IA",
    promptLabel: "Prompt",
    sourceLabel: "Fuente",
    updateNote: "Se actualiza cada 24 horas desde GitHub y fuentes públicas.",
  },
  fr: {
    artifactLabel: "Résultat produit",
    categories: { image: "Image", video: "Vidéo", audio: "Audio", text: "Texte", agent: "Agent" },
    copyPrompt: "Copier le prompt",
    detailBack: "Retour aux prompts",
    detailCta: "Lancer avec Flatkey",
    detailSource: "Source et provenance",
    detailUseWith: "Utiliser avec",
    empty: "Aucun prompt pour cette source.",
    heroBadge: "Bibliothèque de prompts quotidienne",
    heroBody:
      "Nous collectons d'abord les projets Flatkey sur GitHub, puis des sources publiques de prompt engineering. Chaque entrée affiche sa source et son résultat.",
    heroTitle: "Des prompts avec leur résultat produit.",
    latestLabel: "Sources récentes",
    metaDescription:
      "Bibliothèque de prompts actualisée chaque jour pour Flatkey, avec provenance et résultats pour image, vidéo, audio, texte et agents.",
    metaTitle: "Flatkey Prompts — bibliothèque quotidienne de prompts IA",
    promptLabel: "Prompt",
    sourceLabel: "Source",
    updateNote: "Actualisé toutes les 24 heures depuis GitHub et des sources publiques.",
  },
  pt: {
    artifactLabel: "Resultado produzido",
    categories: { image: "Imagem", video: "Vídeo", audio: "Áudio", text: "Texto", agent: "Agente" },
    copyPrompt: "Copiar prompt",
    detailBack: "Voltar aos prompts",
    detailCta: "Executar com Flatkey",
    detailSource: "Fonte e procedência",
    detailUseWith: "Usar com",
    empty: "Nenhum prompt corresponde a esta fonte.",
    heroBadge: "Biblioteca diária de prompts",
    heroBody:
      "Coletamos primeiro projetos Flatkey no GitHub e depois fontes públicas de engenharia de prompts. Cada item inclui fonte e resultado.",
    heroTitle: "Prompts que já têm resultado.",
    latestLabel: "Sinais recentes",
    metaDescription:
      "Biblioteca diária de prompts para usuários Flatkey, com fontes e resultados para imagem, vídeo, áudio, texto e agentes.",
    metaTitle: "Flatkey Prompts — biblioteca diária de prompts de IA",
    promptLabel: "Prompt",
    sourceLabel: "Fonte",
    updateNote: "Atualizado a cada 24 horas via GitHub e fontes públicas.",
  },
  ru: {
    artifactLabel: "Готовый результат",
    categories: { image: "Изображение", video: "Видео", audio: "Аудио", text: "Текст", agent: "Агент" },
    copyPrompt: "Скопировать prompt",
    detailBack: "Назад к prompts",
    detailCta: "Запустить через Flatkey",
    detailSource: "Источник",
    detailUseWith: "Использовать с",
    empty: "Для этого источника prompt не найден.",
    heroBadge: "Ежедневная библиотека prompts",
    heroBody:
      "Сначала собираем материалы из проектов Flatkey на GitHub, затем из публичных источников prompt engineering. У каждой записи есть источник и результат.",
    heroTitle: "Prompts с уже готовым результатом.",
    latestLabel: "Последние источники",
    metaDescription:
      "Ежедневно обновляемая библиотека prompts для Flatkey: изображения, видео, аудио, текст и агенты с источниками и результатами.",
    metaTitle: "Flatkey Prompts — ежедневная библиотека AI prompts",
    promptLabel: "Prompt",
    sourceLabel: "Источник",
    updateNote: "Обновляется каждые 24 часа из GitHub и публичных источников.",
  },
  ja: {
    artifactLabel: "生成済み成果物",
    categories: { image: "画像", video: "動画", audio: "音声", text: "テキスト", agent: "Agent" },
    copyPrompt: "プロンプトをコピー",
    detailBack: "プロンプト一覧へ戻る",
    detailCta: "Flatkey で実行",
    detailSource: "出典",
    detailUseWith: "利用モデル",
    empty: "このソースに一致するプロンプトはありません。",
    heroBadge: "毎日更新のプロンプト集",
    heroBody:
      "Flatkey の GitHub プロジェクトを優先して収集し、公開プロンプトエンジニアリング情報も追加します。各項目に出典と成果物を表示します。",
    heroTitle: "成果物まで確認できるプロンプト。",
    latestLabel: "最新ソース",
    metaDescription:
      "Flatkey ユーザー向けの毎日更新プロンプト集。画像、動画、音声、テキスト、Agent の出典と成果物を掲載。",
    metaTitle: "Flatkey Prompts — 毎日更新 AI プロンプト集",
    promptLabel: "プロンプト",
    sourceLabel: "出典",
    updateNote: "GitHub と公開ソースから 24 時間ごとに更新します。",
  },
  vi: {
    artifactLabel: "Sản phẩm đầu ra",
    categories: { image: "Hình ảnh", video: "Video", audio: "Âm thanh", text: "Văn bản", agent: "Agent" },
    copyPrompt: "Sao chép prompt",
    detailBack: "Quay lại prompts",
    detailCta: "Chạy với Flatkey",
    detailSource: "Nguồn",
    detailUseWith: "Dùng với",
    empty: "Không có prompt nào khớp nguồn này.",
    heroBadge: "Thư viện prompt cập nhật hằng ngày",
    heroBody:
      "Chúng tôi lấy trước từ các dự án Flatkey trên GitHub, rồi bổ sung nguồn prompt engineering công khai. Mỗi mục có nguồn và sản phẩm đầu ra.",
    heroTitle: "Prompt có sẵn kết quả đầu ra.",
    latestLabel: "Nguồn mới nhất",
    metaDescription:
      "Thư viện prompt cập nhật hằng ngày cho Flatkey, có nguồn và kết quả cho hình ảnh, video, âm thanh, văn bản và agent.",
    metaTitle: "Flatkey Prompts — thư viện prompt AI hằng ngày",
    promptLabel: "Prompt",
    sourceLabel: "Nguồn",
    updateNote: "Làm mới mỗi 24 giờ từ GitHub và nguồn công khai.",
  },
  de: {
    artifactLabel: "Erzeugtes Ergebnis",
    categories: { image: "Bild", video: "Video", audio: "Audio", text: "Text", agent: "Agent" },
    copyPrompt: "Prompt kopieren",
    detailBack: "Zurück zu Prompts",
    detailCta: "Mit Flatkey ausführen",
    detailSource: "Quelle",
    detailUseWith: "Verwenden mit",
    empty: "Keine Prompts für diese Quelle.",
    heroBadge: "Täglich aktualisierte Prompt-Bibliothek",
    heroBody:
      "Wir sammeln zuerst aus Flatkey-GitHub-Projekten und ergänzen öffentliche Prompt-Engineering-Quellen. Jeder Eintrag zeigt Quelle und Ergebnis.",
    heroTitle: "Prompts mit fertigem Ergebnis.",
    latestLabel: "Aktuelle Quellen",
    metaDescription:
      "Täglich aktualisierte Prompt-Bibliothek für Flatkey mit Quellen und Ergebnissen für Bild, Video, Audio, Text und Agenten.",
    metaTitle: "Flatkey Prompts — tägliche KI-Prompt-Bibliothek",
    promptLabel: "Prompt",
    sourceLabel: "Quelle",
    updateNote: "Alle 24 Stunden aus GitHub und öffentlichen Quellen aktualisiert.",
  },
});

export const staticPromptItems: PromptItem[] = [
  {
    artifact: {
      alt: "D-17 delivery robot identity sheet",
      kind: "image",
      url: "/assets/prompts/solvea/d17_delivery_robot.png",
    },
    category: "image",
    model: "gpt-image-2",
    output: outputLabel("4:3 character sheet", "4:3 角色设定图", "4:3"),
    prompt:
      "Original warm-core wasteland 3D animated micro-film character concept art. Create the main protagonist: D-17, an old delivery robot with a compact rounded box-shaped body, chest delivery compartment, two small articulated arms, large expressive LED eyes, short wheel-feet hybrid base, one antenna, scuffed cream and faded orange paint. Full-body front three-quarter character concept on a neutral dusty background, no weapons, no readable text.",
    slug: "solvea-d17-delivery-robot",
    source: {
      capturedAt: today,
      label: "Owned production asset",
      platform: "Local migration",
      url: solveaSourceUrl,
    },
    summary: promptText(
      "Migrated from owned production assets with the character prompt and generated image already paired.",
      "从自有生产素材迁移，角色提示词和生成图片已经明确对应。",
    ),
    tags: ["solvea", "character", "image"],
    title: promptText("D-17 delivery robot identity sheet", "D-17 / 小递角色身份图"),
    updatedAt: today,
  },
  {
    artifact: {
      alt: "Package 0001 Hope Heart prop",
      kind: "image",
      url: "/assets/prompts/solvea/package_0001_hope_heart.png",
    },
    category: "image",
    model: "gpt-image-2",
    output: outputLabel("4:3 prop concept", "4:3 道具概念图", "4:3"),
    prompt:
      "Create the core prop: Package 0001, a small metal delivery parcel that becomes the Hope Heart. Rectangular case with rounded corners, worn white-gray shell, faded orange sealing band, small electronic lock with warm golden glow, scratches, dust, taped edges, blank label area. Three-quarter prop concept plus a small open-compartment inset showing warm golden light, no typography.",
    slug: "solvea-package-0001-hope-heart",
    source: {
      capturedAt: today,
      label: "Owned production asset",
      platform: "Local migration",
      url: solveaSourceUrl,
    },
    summary: promptText(
      "A verified owned prop prompt paired with the generated Package 0001 image.",
      "已验证的自有道具提示词，并配有 Package 0001 生成图。",
    ),
    tags: ["solvea", "prop", "image"],
    title: promptText("Package 0001 Hope Heart prop", "包裹0001 / 希望之心道具图"),
    updatedAt: today,
  },
  {
    artifact: {
      alt: "Mia child owner character",
      kind: "image",
      url: "/assets/prompts/solvea/mia_child_owner.png",
    },
    category: "image",
    model: "gpt-image-2",
    output: outputLabel("4:3 character sheet", "4:3 角色设定图", "4:3"),
    prompt:
      "Create Mia, the first owner, a young foreign girl around 8 years old with a warm expressive face, freckles, and short brown curly hair. She wears a yellow raincoat, small backpack, red star sticker in her hand, worn sneakers, hopeful but scared expression. Full-body front three-quarter character concept, simple ruined apartment hallway hint, warm-core wasteland 3D animated micro-film style, no readable text.",
    slug: "solvea-mia-child-owner",
    source: {
      capturedAt: today,
      label: "Owned production asset",
      platform: "Local migration",
      url: solveaSourceUrl,
    },
    summary: promptText(
      "An owned character prompt with its finished Mia concept image attached.",
      "自有角色提示词，已附上 Mia 的完成概念图。",
    ),
    tags: ["solvea", "character", "image"],
    title: promptText("Mia child owner character", "Mia / 米娅儿童角色图"),
    updatedAt: today,
  },
  {
    artifact: {
      alt: "Episode 01 delivery center scene bible",
      kind: "image",
      url: "/assets/prompts/solvea/scene_bible_ep01_delivery_center_3x3.png",
    },
    category: "image",
    model: "gpt-image-2",
    output: outputLabel("3x3 scene board", "3x3 场景板", "3x3"),
    prompt:
      "Create a 3x3 scene bible sheet for the abandoned delivery center in Episode 01. Panels: blacked-out sorting hall, stopped conveyor belts, dormant delivery robots, package storage racks, task chute with warm lock light, narrow maintenance tunnel, dented rolling shutter with cold green leak, half-stuck fire side door, exterior threshold with dust light. Stylized 3D animation environment, no readable signs.",
    slug: "solvea-ep01-delivery-center-scene-bible",
    source: {
      capturedAt: today,
      label: "Owned production asset",
      platform: "Local migration",
      url: solveaSourceUrl,
    },
    summary: promptText(
      "A production scene-bible prompt paired with the generated 3x3 delivery center board.",
      "生产用场景圣经提示词，配有配送中心 3x3 生成板。",
    ),
    tags: ["solvea", "scene-bible", "image"],
    title: promptText("Episode 01 delivery center scene bible", "EP01 配送中心场景圣经"),
    updatedAt: today,
  },
  {
    artifact: {
      alt: "Episode 01 delivery center motion storyboard",
      kind: "image",
      url: "/assets/prompts/solvea/storyboard_ep01_delivery_center_motion_3x3.png",
    },
    category: "image",
    model: "gpt-image-2",
    output: outputLabel("3x3 motion storyboard", "3x3 镜头分镜板", "3x3"),
    prompt:
      "Create a 3x3 action storyboard bible sheet for Episode 01, matching D-17, Package 0001, and the delivery center style. Panel order: warehouse power dies; D-17 LED eyes wake; package pops halfway from chute; D-17 catches package; chest compartment locks; conveyor belts restart; rolling shutter dents from outside; D-17 squeezes through fire door; ruined city exterior reveal. Use one D-17 only, no text labels.",
    slug: "solvea-ep01-delivery-center-storyboard",
    source: {
      capturedAt: today,
      label: "Owned production asset",
      platform: "Local migration",
      url: solveaSourceUrl,
    },
    summary: promptText(
      "An owned storyboard prompt paired with the completed Episode 01 motion board.",
      "自有分镜提示词，已附 EP01 镜头走势成图。",
    ),
    tags: ["solvea", "storyboard", "image"],
    title: promptText("Episode 01 delivery center motion storyboard", "EP01 配送中心镜头走势图"),
    updatedAt: today,
  },
  {
    artifact: {
      alt: "Commercial image prompt result from the Flatkey Image Buddy gallery",
      kind: "image",
      url: "/assets/cli/campaign-hero.png",
    },
    category: "image",
    model: "gpt-image-2",
    output: outputLabel("16:9 hero visual", "16:9 首图视觉", "16:9"),
    prompt:
      "Create a premium product hero image for {{product_name}}. Show the product as the first-viewport signal, clean SaaS lighting, high-detail commercial realism, one clear benefit visible in the scene, no crowded typography.",
    slug: "premium-product-hero-image",
    source: {
      capturedAt: today,
      label: "flatkey-ai/awesome-images",
      platform: "GitHub",
      url: `${flatkeyGithubBase}/awesome-images`,
    },
    summary: withIdFallback({
      en: "A commercial product hero prompt adapted from Flatkey Image Buddy templates, with a real gallery output attached.",
      zh: "来自 Flatkey Image Buddy 模板的商业产品首图提示词，并附带真实图库产物。",
      es: "Prompt comercial para hero de producto adaptado de Image Buddy, con resultado de galería.",
      fr: "Prompt de visuel produit issu d'Image Buddy, avec résultat de galerie.",
      pt: "Prompt comercial de hero de produto adaptado do Image Buddy, com resultado de galeria.",
      ru: "Коммерческий prompt для hero-изображения продукта из Image Buddy, с готовым результатом.",
      ja: "Image Buddy テンプレート由来の商品ヒーロー画像プロンプト。ギャラリー成果物付き。",
      vi: "Prompt ảnh hero sản phẩm từ Image Buddy, có sản phẩm gallery đi kèm.",
      de: "Kommerzieller Produkt-Hero-Prompt aus Image Buddy mit Galerie-Ergebnis.",
    }),
    tags: ["commerce", "image", "hero"],
    title: withIdFallback({
      en: "Premium product hero visual",
      zh: "高级产品首图",
      es: "Hero visual de producto premium",
      fr: "Visuel produit premium",
      pt: "Hero visual premium de produto",
      ru: "Премиальный product hero",
      ja: "プレミアム商品ヒーロー画像",
      vi: "Ảnh hero sản phẩm cao cấp",
      de: "Premium-Produkt-Hero",
    }),
    updatedAt: today,
  },
  solveaImagePromptItem({
    alt: "D-17 four-view model sheet",
    outputEn: "4-view model sheet",
    outputRatio: "4:3",
    outputZh: "四视图角色设定",
    prompt:
      "Create a clean four-view model sheet for D-17, the old delivery robot protagonist. Show front, side, rear, and three-quarter views with consistent rounded box body, chest delivery compartment, short wheel-feet base, one antenna, cream and faded orange worn paint, expressive LED eyes, warm-core wasteland 3D animated style, neutral background, no labels or readable text.",
    slug: "solvea-d17-four-view-model-sheet",
    summaryEn: "Owned D-17 consistency prompt paired with a finished four-view model sheet.",
    summaryZh: "自有 D-17 一致性提示词，配有完成的四视图角色设定图。",
    tags: ["character", "model-sheet"],
    titleEn: "D-17 four-view model sheet",
    titleZh: "D-17 四视图角色设定",
    url: "/assets/prompts/solvea/d17_model_sheet_4view.png",
  }),
  solveaImagePromptItem({
    alt: "Lev wasteland driver character sheet",
    outputEn: "4:3 character sheet",
    outputRatio: "4:3",
    outputZh: "4:3 角色设定图",
    prompt:
      "Create Lev, a lean wasteland driver in his late 30s with sunburned skin, tired eyes, patched mechanic jacket, faded scarf, fingerless gloves, utility belt, dusty boots, and a guarded but kind expression. Full-body front three-quarter character concept, warm-core wasteland 3D animated micro-film style, neutral dusty background, no readable text.",
    slug: "solvea-lev-wasteland-driver",
    summaryEn: "Owned supporting-character prompt with Lev's completed production concept image.",
    summaryZh: "自有配角提示词，已配 Lev 的生产概念图。",
    tags: ["character"],
    titleEn: "Lev wasteland driver character",
    titleZh: "Lev / 荒原司机角色图",
    url: "/assets/prompts/solvea/lev_wasteland_driver.png",
  }),
  solveaImagePromptItem({
    alt: "Vera wasteland doctor character sheet",
    outputEn: "4:3 character sheet",
    outputRatio: "4:3",
    outputZh: "4:3 角色设定图",
    prompt:
      "Create Vera, a calm wasteland doctor in her 40s with practical short hair, weathered medical coat layered over travel clothes, canvas satchel, patched sleeves, gentle determined eyes, and small improvised medical tools. Full-body front three-quarter character concept, warm-core wasteland 3D animated style, neutral dusty background, no readable text.",
    slug: "solvea-vera-wasteland-doctor",
    summaryEn: "Owned character prompt paired with Vera's finished concept sheet.",
    summaryZh: "自有角色提示词，配有 Vera 的完成概念图。",
    tags: ["character"],
    titleEn: "Vera wasteland doctor character",
    titleZh: "Vera / 荒原医生角色图",
    url: "/assets/prompts/solvea/vera_wasteland_doctor.png",
  }),
  solveaImagePromptItem({
    alt: "Cole retired soldier character sheet",
    outputEn: "4:3 character sheet",
    outputRatio: "4:3",
    outputZh: "4:3 角色设定图",
    prompt:
      "Create Cole, a retired soldier survivor with broad shoulders, gray stubble, patched field coat, old protective vest, worn cargo pants, calm protective stance, and a softened expression that suggests guilt and responsibility. Full-body front three-quarter character concept, warm-core wasteland 3D animated micro-film style, no weapons, neutral background, no readable text.",
    slug: "solvea-cole-retired-soldier",
    summaryEn: "Owned supporting-character prompt with Cole's finished visual artifact.",
    summaryZh: "自有配角提示词，配有 Cole 的完成视觉产物。",
    tags: ["character"],
    titleEn: "Cole retired soldier character",
    titleZh: "Cole / 退役士兵角色图",
    url: "/assets/prompts/solvea/cole_retired_soldier.png",
  }),
  solveaImagePromptItem({
    alt: "Milo greenhouse keeper character sheet",
    outputEn: "4:3 character sheet",
    outputRatio: "4:3",
    outputZh: "4:3 角色设定图",
    prompt:
      "Create Milo, a greenhouse keeper teenager with curly hair, oversized patched sweater, apron pockets filled with seed packets and small tools, round glasses, muddy sneakers, and an anxious hopeful smile. Full-body front three-quarter character concept, warm-core wasteland 3D animated style, soft plant-life color accents, neutral background, no readable text.",
    slug: "solvea-milo-greenhouse-keeper",
    summaryEn: "Owned character prompt paired with Milo's generated concept image.",
    summaryZh: "自有角色提示词，配有 Milo 的生成概念图。",
    tags: ["character"],
    titleEn: "Milo greenhouse keeper character",
    titleZh: "Milo / 温室守护者角色图",
    url: "/assets/prompts/solvea/milo_greenhouse_keeper.png",
  }),
  solveaImagePromptItem({
    alt: "Lin Cher researcher character sheet",
    outputEn: "4:3 character sheet",
    outputRatio: "4:3",
    outputZh: "4:3 角色设定图",
    prompt:
      "Create Lin Cher, a thoughtful researcher with tidy dark hair, practical lab coat under a travel cloak, cracked tablet device, field notebook, careful posture, and a conflicted expression. Full-body front three-quarter character concept, warm-core wasteland 3D animated micro-film style, subtle science-survivor details, neutral background, no readable text.",
    slug: "solvea-lin-cher-researcher",
    summaryEn: "Owned researcher prompt paired with Lin Cher's finished character image.",
    summaryZh: "自有研究员提示词，配有 Lin Cher 的完成角色图。",
    tags: ["character"],
    titleEn: "Lin Cher researcher character",
    titleZh: "Lin Cher / 研究员角色图",
    url: "/assets/prompts/solvea/lin_cher_researcher.png",
  }),
  solveaImagePromptItem({
    alt: "Standard infected silhouette sheet",
    outputEn: "4:3 creature sheet",
    outputRatio: "4:3",
    outputZh: "4:3 生物设定图",
    prompt:
      "Create a standard infected silhouette design for a family-friendly wasteland animated micro-film. Thin unstable body shape, torn everyday clothes, awkward off-balance posture, slightly glowing eyes, readable as threatening from shape language but not graphic or gory. Full-body front three-quarter creature concept, neutral dusty background, no text.",
    slug: "solvea-standard-infected-silhouette",
    summaryEn: "Owned non-graphic creature prompt paired with a finished infected silhouette sheet.",
    summaryZh: "自有非血腥生物提示词，配有感染者剪影设定图。",
    tags: ["creature"],
    titleEn: "Standard infected silhouette",
    titleZh: "标准感染者剪影设定",
    url: "/assets/prompts/solvea/standard_infected_silhouette.png",
  }),
  solveaImagePromptItem({
    alt: "School side gate hallway scene bible",
    outputEn: "3x3 scene board",
    outputRatio: "3x3",
    outputZh: "3x3 场景板",
    prompt:
      "Create a 3x3 scene bible sheet for Episode 01 school side gate and hallway. Panels include bent side gate, quiet entrance path, abandoned hallway, classroom doorway, raincoat hook detail, dusty floor footprints, broken window light, storage corner, and emergency exit view. Warm-core wasteland 3D animation environment, no readable signs.",
    slug: "solvea-ep01-school-side-gate-hallway",
    summaryEn: "Owned school-route scene prompt paired with a generated 3x3 environment board.",
    summaryZh: "自有学校路线场景提示词，配有生成的 3x3 环境板。",
    tags: ["scene-bible"],
    titleEn: "EP01 school side gate hallway scene bible",
    titleZh: "EP01 学校侧门走廊场景圣经",
    url: "/assets/prompts/solvea/scene_bible_ep01_school_side_gate_hallway_3x3.png",
  }),
  solveaImagePromptItem({
    alt: "Wasteland city scene bible",
    outputEn: "3x3 scene board",
    outputRatio: "3x3",
    outputZh: "3x3 场景板",
    prompt:
      "Create a 3x3 scene bible sheet for Episode 02 wasteland city route. Panels include cracked avenue, leaning streetlights, collapsed storefront, overgrown median, delivery drone wreck, dusty underpass, rooftop water tank, distant greenhouse glow, and sunset skyline. Stylized warm-core 3D animated environment, no readable text.",
    slug: "solvea-ep02-wasteland-city-scene-bible",
    summaryEn: "Owned Episode 02 city-route prompt with a completed 3x3 scene board.",
    summaryZh: "自有 EP02 城市路线提示词，配有完成的 3x3 场景板。",
    tags: ["scene-bible"],
    titleEn: "EP02 wasteland city scene bible",
    titleZh: "EP02 荒原城市场景圣经",
    url: "/assets/prompts/solvea/scene_bible_ep02_wasteland_city_3x3.png",
  }),
  solveaImagePromptItem({
    alt: "Residential alley scene bible",
    outputEn: "3x3 scene board",
    outputRatio: "3x3",
    outputZh: "3x3 场景板",
    prompt:
      "Create a 3x3 scene bible sheet for Episode 03 residential alley choice. Panels include narrow alley entrance, stacked balconies, hanging cables, improvised barricade, hidden clinic door, water puddle reflection, rooftop escape ladder, warm window light, and alley exit into open dust. Warm-core wasteland 3D animated style, no readable text.",
    slug: "solvea-ep03-residential-alley-scene-bible",
    summaryEn: "Owned Episode 03 alley prompt paired with the completed residential scene board.",
    summaryZh: "自有 EP03 巷道提示词，配有完成的居民巷场景板。",
    tags: ["scene-bible"],
    titleEn: "EP03 residential alley scene bible",
    titleZh: "EP03 居民巷场景圣经",
    url: "/assets/prompts/solvea/scene_bible_ep03_residential_alley_3x3.png",
  }),
  solveaImagePromptItem({
    alt: "Episode 02 city route motion storyboard",
    outputEn: "3x3 motion storyboard",
    outputRatio: "3x3",
    outputZh: "3x3 镜头分镜板",
    prompt:
      "Create a 3x3 action storyboard for Episode 02 city route. Panel order: D-17 exits ruined avenue; package lock glows; wheel base slips on dust; Lev's vehicle appears; city silhouettes move in distance; shortcut through underpass; package almost falls; D-17 chooses safer route; greenhouse glow appears ahead. Keep D-17 consistent, no text labels.",
    slug: "solvea-ep02-city-route-storyboard",
    summaryEn: "Owned Episode 02 motion prompt paired with a finished 3x3 storyboard.",
    summaryZh: "自有 EP02 镜头提示词，配有完成的 3x3 分镜板。",
    tags: ["storyboard"],
    titleEn: "EP02 city route motion storyboard",
    titleZh: "EP02 城市路线镜头走势图",
    url: "/assets/prompts/solvea/storyboard_ep02_city_route_motion_3x3.png",
  }),
  solveaImagePromptItem({
    alt: "Episode 03 alley choice motion storyboard",
    outputEn: "3x3 motion storyboard",
    outputRatio: "3x3",
    outputZh: "3x3 镜头分镜板",
    prompt:
      "Create a 3x3 action storyboard for Episode 03 alley choice. Panel order: D-17 enters narrow alley; Mia hears the package chime; Vera blocks an unsafe route; infected silhouettes pass by; D-17 hides behind crates; package glow reveals a side door; Cole holds the barricade; D-17 squeezes through; warm safe room reveal. No readable text labels.",
    slug: "solvea-ep03-alley-choice-storyboard",
    summaryEn: "Owned Episode 03 action prompt with a completed alley-choice storyboard.",
    summaryZh: "自有 EP03 动作提示词，配有完成的巷道选择分镜板。",
    tags: ["storyboard"],
    titleEn: "EP03 alley choice motion storyboard",
    titleZh: "EP03 巷道选择镜头走势图",
    url: "/assets/prompts/solvea/storyboard_ep03_alley_choice_motion_3x3.png",
  }),
  solveaImagePromptItem({
    alt: "Heart of Hope vertical cover",
    outputEn: "9:16 cover art",
    outputRatio: "9:16",
    outputZh: "9:16 竖版封面",
    prompt:
      "Create a vertical 9:16 cover image for an original warm-core wasteland animated short called Heart of Hope. D-17 stands in the foreground holding Package 0001 with warm golden glow; ruined city behind, Mia silhouette nearby, hopeful sunrise dust light, cinematic poster composition, no readable text or title typography.",
    slug: "solvea-heart-of-hope-vertical-cover",
    summaryEn: "Owned cover prompt paired with a finished vertical key-art image.",
    summaryZh: "自有封面提示词，配有完成的竖版主视觉图。",
    tags: ["cover", "poster"],
    titleEn: "Heart of Hope vertical cover",
    titleZh: "希望之心竖版封面",
    url: "/assets/prompts/solvea/heart-of-hope-cover-vertical-v5-h3.png",
  }),
  solveaImagePromptItem({
    alt: "Comedic infected 3x3 creature variation sheet",
    outputEn: "3x3 creature board",
    outputRatio: "3x3",
    outputZh: "3x3 生物变化板",
    prompt:
      "Create a 3x3 creature variation sheet for family-friendly comedic infected characters in Heart of Hope. Nine awkward silhouettes with different broken clothing shapes, clumsy body language, mild glowing eyes, expressive non-gory designs, warm-core 3D animated style, dusty neutral background, no horror gore, no text labels.",
    slug: "solvea-comedic-infected-variation-board",
    summaryEn: "Owned creature-variation prompt paired with a completed 3x3 infected board.",
    summaryZh: "自有生物变化提示词，配有完成的 3x3 感染者变化板。",
    tags: ["creature", "variation"],
    titleEn: "Comedic infected variation board",
    titleZh: "喜剧感染者变化板",
    url: "/assets/prompts/solvea/heart-of-hope-comedic-zombie-3x3.png",
  }),
  githubImagePromptItem({
    alt: "Marketplace skincare ecommerce main image",
    outputEn: "1:1 ecommerce main image",
    outputRatio: "1:1",
    outputZh: "1:1 电商主图",
    prompt:
      "生成 {{产品}} 的电商平台主图，纯白背景，正面 3/4 角度，产品占画面 82%-88%。准确表现 {{材质}} 材质、边缘结构和真实比例。若包含 {{关键配件}}，将配件整齐放在产品右下角，主产品仍是绝对视觉中心。光线均匀，软阴影极淡，高清商业摄影，无场景道具、无人物、无文字、无边框、无水印。输出 1:1 方图，适合 Amazon / Shopify / TikTok Shop 列表页。",
    slug: "awesome-images-marketplace-main-image",
    summaryEn: "GitHub Image Buddy ecommerce template paired with its skincare main-image demo output.",
    summaryZh: "GitHub Image Buddy 电商主图模板，配有护肤品主图 demo 产物。",
    tags: ["ecommerce", "product"],
    titleEn: "Marketplace ecommerce main image",
    titleZh: "电商平台白底主图",
    url: "/assets/prompts/awesome-images/ecommerce-skincare.png",
  }),
  githubImagePromptItem({
    alt: "UGC coffee ad cover frame",
    outputEn: "9:16 UGC ad frame",
    outputRatio: "9:16",
    outputZh: "9:16 UGC 广告首帧",
    prompt:
      "生成一张 9:16 竖版 UGC 广告封面帧。画面中 {{目标人群}} 在 {{场景}} 中自然使用 {{产品}}，表情显示刚解决 {{痛点}} 后的轻松感。构图像手机实拍但画质专业，手部动作真实，产品清晰可见，环境有生活细节。顶部留出 18% 安全文案区域，不直接生成文字。色彩明亮但不过度滤镜，真实皮肤质感，轻微景深，适合 TikTok / Reels 首帧。禁止塑料感、过度磨皮、乱码文字和多余品牌 logo。",
    slug: "awesome-images-ugc-ad-still",
    summaryEn: "GitHub UGC ad cover-frame prompt paired with the coffee ad still artifact.",
    summaryZh: "GitHub UGC 广告封面帧提示词，配有咖啡广告首帧产物。",
    tags: ["ugc", "ads"],
    titleEn: "UGC ad cover frame",
    titleZh: "UGC 广告封面帧",
    url: "/assets/prompts/awesome-images/ugc-coffee-ad.png",
  }),
  githubImagePromptItem({
    alt: "Liquid glass bento infographic",
    outputEn: "16:9 bento infographic",
    outputRatio: "16:9",
    outputZh: "16:9 Bento 信息图",
    prompt:
      "创建 {{主题}} 的 16:9 横版 Bento 信息图，语言使用 {{语言}}。整体风格为高级液态玻璃界面，背景使用 {{主色}} 的柔和抽象纹理并强模糊，前景 8 个模块采用半透明玻璃卡片、细边框和真实阴影。M1 展示主题主视觉，M2 核心优势 4 点，M3 使用步骤 4 步，M4 展示 {{数据点}} 等关键数据，M5 适合人群，M6 注意事项，M7 速查信息，M8 冷知识。文本必须清晰、排版规整、不要乱码。图标统一线性风格，留白充足，适合网页文章封面和产品教育页。",
    slug: "awesome-images-liquid-bento-infographic",
    summaryEn: "GitHub bento infographic template paired with a generated liquid-glass demo.",
    summaryZh: "GitHub Bento 信息图模板，配有液态玻璃 demo 产物。",
    tags: ["infographic", "bento"],
    titleEn: "Liquid glass bento infographic",
    titleZh: "液态玻璃 Bento 信息图",
    url: "/assets/prompts/awesome-images/liquid-bento.png",
  }),
  githubImagePromptItem({
    alt: "Consistent cyber portrait avatar",
    outputEn: "1:1 avatar",
    outputRatio: "1:1",
    outputZh: "1:1 头像",
    prompt:
      "为 {{角色}} 生成 1:1 高级头像。角色职业是 {{职业}}，视觉风格为 {{风格}}。面部自然、眼神清晰、肩颈比例真实，背景加入少量 {{背景元素}} 作为身份线索。构图为胸像，头部居中，背景不过度复杂。灯光柔和，有清晰轮廓光，适合作为产品社区、客服、创作者账号头像。输出高分辨率，避免夸张表情、畸形五官、文字、水印和多余装饰。",
    slug: "awesome-images-consistent-avatar",
    summaryEn: "GitHub avatar template paired with a finished cyber portrait demo image.",
    summaryZh: "GitHub 头像模板，配有完成的 cyber portrait demo 图。",
    tags: ["avatar", "portrait"],
    titleEn: "Consistent avatar portrait",
    titleZh: "统一风格头像",
    url: "/assets/prompts/awesome-images/cyber-portrait.png",
  }),
  githubImagePromptItem({
    alt: "Fitness app store screenshot poster",
    outputEn: "9:16 app screenshot poster",
    outputRatio: "9:16",
    outputZh: "9:16 App 截图海报",
    prompt:
      "为 {{App 名称}} 生成 9:16 App Store 截图海报。核心功能是 {{核心功能}}，界面类型是 {{界面类型}}。画面放置一台真实手机，屏幕展示清晰可信的产品 UI：顶部导航、关键数据区域、主操作按钮和列表/卡片内容。背景使用 {{品牌色}} 的干净渐变和轻量产品符号，手机周围保留标题与卖点文案空间，但不要直接生成长段文字。UI 必须像真实产品，不要乱码、不要不可读的小字、不要浮夸 3D 卡片。",
    slug: "awesome-images-app-store-screenshot",
    summaryEn: "GitHub mobile app screenshot template paired with a finished fitness app demo.",
    summaryZh: "GitHub 移动应用截图模板，配有健身 App demo 产物。",
    tags: ["app", "ui"],
    titleEn: "App Store screenshot poster",
    titleZh: "App Store 截图海报",
    url: "/assets/prompts/awesome-images/fitness-app.png",
  }),
  githubImagePromptItem({
    alt: "AI agent event poster key visual",
    outputEn: "3:4 event poster",
    outputRatio: "4:3",
    outputZh: "活动主视觉",
    prompt:
      "为 {{活动主题}} 生成 3:4 活动海报主视觉。目标用户是 {{目标用户}}，核心视觉隐喻是 {{视觉隐喻}}。整体氛围为 {{氛围}}，画面有明确主物体、前景层次和背景空间。顶部保留标题区，中部放主视觉，底部保留时间/嘉宾/报名信息区，但不要直接生成具体文字。风格现代、商业、可用于公众号封面和线下易拉宝。光影有戏剧性但不脏，禁止乱码文字、水印、二维码。",
    slug: "awesome-images-event-poster-key-visual",
    summaryEn: "GitHub event-poster prompt paired with the AI agent poster demo artifact.",
    summaryZh: "GitHub 活动海报提示词，配有 AI Agent 海报 demo 产物。",
    tags: ["poster", "event"],
    titleEn: "Event poster key visual",
    titleZh: "活动海报主 KV",
    url: "/assets/prompts/awesome-images/ai-agent-poster.png",
  }),
  githubImagePromptItem({
    alt: "Crystal game prop concept sheet",
    outputEn: "4:3 game prop sheet",
    outputRatio: "4:3",
    outputZh: "4:3 游戏道具设定",
    prompt:
      "生成 {{道具类型}} 的游戏道具设定图，世界观是 {{世界观}}，材质以 {{材质}} 为主，稀有度表现为 {{稀有度}}。画面包含 6 个变体，排列在干净设定稿画布上，每个道具角度一致、轮廓清晰、可被单独裁切。底部可有极短标签区但不要生成不可读小字。风格统一，光源一致，细节适合 3D 建模或 2D sprite 后续制作。禁止重复粘连、透视混乱、背景过重和水印。",
    slug: "awesome-images-game-prop-sheet",
    summaryEn: "GitHub game prop template paired with a crystal prop concept output.",
    summaryZh: "GitHub 游戏道具模板，配有水晶道具概念图产物。",
    tags: ["game", "prop"],
    titleEn: "Game prop concept sheet",
    titleZh: "游戏道具设定图",
    url: "/assets/prompts/awesome-images/game-prop-crystal.png",
  }),
  githubImagePromptItem({
    alt: "Streetwear fashion lookbook collage",
    outputEn: "4:5 fashion lookbook",
    outputRatio: "4:3",
    outputZh: "服装 Lookbook",
    prompt:
      "生成 {{服装单品}} 的 4:5 高级 Lookbook 拼贴海报。模特气质为 {{模特气质}}，场景是 {{场景}}，品牌灵感接近 {{品牌灵感}}。同一位模特出现 3 个姿势：全身、半身、细节特写，层叠排版但不拥挤。服装材质、版型、褶皱、配饰清晰可见，背景有编辑杂志感。预留少量文案空间但不要生成具体文字。禁止畸形手指、错误肢体、乱码和多余 logo。",
    slug: "awesome-images-fashion-lookbook",
    summaryEn: "GitHub fashion lookbook template paired with a streetwear collage demo.",
    summaryZh: "GitHub 服装 Lookbook 模板，配有街头服饰拼贴 demo。",
    tags: ["fashion", "ecommerce"],
    titleEn: "Fashion lookbook collage",
    titleZh: "服装 Lookbook 拼贴",
    url: "/assets/prompts/awesome-images/streetwear-lookbook.png",
  }),
  githubImagePromptItem({
    alt: "SaaS hero phone product visual",
    outputEn: "16:9 SaaS hero visual",
    outputRatio: "16:9",
    outputZh: "16:9 SaaS 首图",
    prompt:
      "为 {{产品名称}} 生成一张高端商业广告主视觉。品牌调性是 {{品牌调性}}，核心卖点是 {{核心卖点}}。画面中央展示产品本体，保持真实比例和清晰边缘，表面材质可被放大检查。背景使用 {{主色}} 作为主视觉线索，加入与卖点相关的轻量场景元素，但不要遮挡产品。构图采用 16:9 横版，产品占画面 42%，右侧保留干净留白给营销文案。灯光为大型柔光箱加一束轮廓光，细节锐利，高端电商摄影，真实阴影，8k，禁止水印、乱码文字、虚假 logo。",
    slug: "awesome-images-saas-hero-phone",
    summaryEn: "GitHub premium product hero template paired with a SaaS phone hero demo.",
    summaryZh: "GitHub 高端产品主视觉模板，配有 SaaS 手机首图 demo。",
    tags: ["product", "hero"],
    titleEn: "SaaS product hero phone",
    titleZh: "SaaS 产品手机首图",
    url: "/assets/prompts/awesome-images/saas-hero-phone.png",
  }),
  githubImagePromptItem({
    alt: "Sports shoe ecommerce product image",
    outputEn: "1:1 ecommerce product image",
    outputRatio: "1:1",
    outputZh: "1:1 电商产品图",
    prompt:
      "生成 {{产品}} 的电商平台主图，纯白背景，正面 3/4 角度，产品占画面 82%-88%。准确表现 {{材质}} 材质、边缘结构和真实比例。若包含 {{关键配件}}，将配件整齐放在产品右下角，主产品仍是绝对视觉中心。光线均匀，软阴影极淡，高清商业摄影，无场景道具、无人物、无文字、无边框、无水印。输出 1:1 方图，适合 Amazon / Shopify / TikTok Shop 列表页。",
    slug: "awesome-images-sports-shoe-product",
    summaryEn: "GitHub ecommerce template reused with a finished sports shoe product artifact.",
    summaryZh: "GitHub 电商主图模板复用，配有运动鞋产品图产物。",
    tags: ["ecommerce", "product"],
    titleEn: "Sports shoe ecommerce image",
    titleZh: "运动鞋电商产品图",
    url: "/assets/prompts/awesome-images/sports-shoe.png",
  }),
  {
    artifact: {
      alt: "9:16 UGC ad clip produced by Flatkey CLI",
      kind: "video",
      poster: "/assets/cli/ugc-ad-clips.png",
      url: "/assets/cli/ugc-ad-clips.mp4",
    },
    category: "video",
    model: "seedance-2.0",
    output: outputLabel("9:16 short video", "9:16 竖屏短片", "9:16"),
    prompt:
      "Create a 9:16 UGC-style paid social video for a compact consumer product. Start with a handheld first-person product pickup, cut to a close product use moment, then a clean benefit reveal. Natural indoor daylight, casual creator framing, no readable text, no logos, edit-ready pacing.",
    slug: "ugc-paid-social-product-clip",
    source: {
      capturedAt: today,
      label: "flatkey-ai/flatkey-cli",
      platform: "GitHub",
      url: `${flatkeyGithubBase}/flatkey-cli`,
    },
    summary: withIdFallback({
      en: "A CLI-ready UGC video prompt paired with an existing rendered social ad clip.",
      zh: "可直接用于 CLI 的 UGC 视频提示词，并配有现成社交广告短片产物。",
      es: "Prompt UGC para CLI con clip social ya renderizado.",
      fr: "Prompt UGC prêt pour le CLI avec clip social rendu.",
      pt: "Prompt UGC para CLI com clipe social já renderizado.",
      ru: "UGC video prompt для CLI с готовым рекламным клипом.",
      ja: "CLI 向け UGC 動画プロンプト。生成済み広告クリップ付き。",
      vi: "Prompt video UGC cho CLI, kèm clip social đã render.",
      de: "CLI-tauglicher UGC-Video-Prompt mit fertigem Social-Ad-Clip.",
    }),
    tags: ["video", "ugc", "ads"],
    title: withIdFallback({
      en: "9:16 UGC product ad clip",
      zh: "9:16 UGC 产品广告短片",
      es: "Clip UGC 9:16 de producto",
      fr: "Clip UGC produit 9:16",
      pt: "Clipe UGC 9:16 de produto",
      ru: "UGC product ad 9:16",
      ja: "9:16 UGC 商品広告クリップ",
      vi: "Clip quảng cáo sản phẩm UGC 9:16",
      de: "9:16 UGC Produktclip",
    }),
    updatedAt: today,
  },
  {
    artifact: {
      alt: "Localized market variant video produced by Flatkey CLI",
      kind: "video",
      poster: "/assets/cli/localized-variants.png",
      url: "/assets/cli/localized-variants.mp4",
    },
    category: "video",
    model: "seedance-2.0",
    output: outputLabel("9:16 localized video", "9:16 本地化短片", "9:16"),
    prompt:
      "Create a short localized market variant video for a product launch. Use bright everyday lifestyle framing, culturally neutral props, a clear product-in-use moment, warm natural light, and space for localized captions added later. Keep the product consistent, no readable text, no brand logos.",
    slug: "localized-market-product-variant-video",
    source: {
      capturedAt: today,
      label: "flatkey-ai/flatkey-cli",
      platform: "GitHub",
      url: `${flatkeyGithubBase}/flatkey-cli`,
    },
    summary: withIdFallback({
      en: "A localization-focused video prompt paired with an existing variant clip artifact.",
      zh: "面向市场本地化的视频提示词，并配有现成变体短片产物。",
      es: "Prompt de video localizado con clip de variante existente.",
      fr: "Prompt vidéo de localisation avec clip variant existant.",
      pt: "Prompt de vídeo localizado com clipe variante existente.",
      ru: "Prompt для localized video с готовым вариантом клипа.",
      ja: "市場別ローカライズ動画プロンプト。生成済みクリップ付き。",
      vi: "Prompt video bản địa hóa, kèm clip biến thể có sẵn.",
      de: "Lokalisierungs-Video-Prompt mit vorhandenem Variant-Clip.",
    }),
    tags: ["video", "localization", "launch"],
    title: withIdFallback({
      en: "Localized product launch variant",
      zh: "产品发布本地化视频变体",
      es: "Variante localizada de lanzamiento",
      fr: "Variante localisée de lancement",
      pt: "Variante localizada de lançamento",
      ru: "Localized launch variant",
      ja: "ローカライズ版ローンチ動画",
      vi: "Biến thể video ra mắt bản địa hóa",
      de: "Lokalisierte Launch-Variante",
    }),
    updatedAt: today,
  },
  {
    artifact: {
      alt: "Cinematic product reveal video produced by Flatkey CLI",
      kind: "video",
      poster: "/assets/cli/product-reveal.png",
      url: "/assets/cli/product-reveal.mp4",
    },
    category: "video",
    model: "seedance-2.0",
    output: outputLabel("16:9 production storyboard", "16:9 成片分镜", "16:9"),
    prompt:
      "8 second cinematic product reveal, glossy black background, controlled reflections, slow camera push-in, product remains sharp and centered, no floating text, one continuous shot.",
    slug: "cinematic-product-reveal-video",
    source: {
      capturedAt: today,
      label: "flatkey-ai/flatkey-cli",
      platform: "GitHub",
      url: `${flatkeyGithubBase}/flatkey-cli`,
    },
    summary: withIdFallback({
      en: "A repeatable video prompt from Flatkey CLI usage patterns, rendered here as a production storyboard artifact.",
      zh: "来自 Flatkey CLI 用法的视频提示词，这里生成了可执行的成片分镜产物。",
      es: "Prompt de video basado en Flatkey CLI, con storyboard como resultado.",
      fr: "Prompt vidéo inspiré du CLI Flatkey, avec storyboard de production.",
      pt: "Prompt de vídeo do fluxo Flatkey CLI, com storyboard de produção.",
      ru: "Видео prompt из Flatkey CLI, с раскадровкой как результатом.",
      ja: "Flatkey CLI の動画生成例をもとにしたプロンプト。成果物は制作分镜。",
      vi: "Prompt video từ Flatkey CLI, có storyboard sản xuất đi kèm.",
      de: "Video-Prompt aus Flatkey-CLI-Mustern mit Storyboard-Ergebnis.",
    }),
    tags: ["video", "seedance", "product"],
    title: withIdFallback({
      en: "Cinematic product reveal",
      zh: "电影感产品揭幕视频",
      es: "Revelación cinematográfica de producto",
      fr: "Révélation produit cinématique",
      pt: "Reveal cinematográfico de produto",
      ru: "Кинематографичный product reveal",
      ja: "映画風プロダクトリビール",
      vi: "Video reveal sản phẩm điện ảnh",
      de: "Cinematic Product Reveal",
    }),
    updatedAt: today,
  },
  {
    artifact: {
      alt: "Seedance 2.5 image-to-video sample clip",
      kind: "video",
      poster: "/assets/video/v1.1.jpg",
      url: "/assets/video/v1.1.mp4",
    },
    category: "video",
    model: "seedance-2.5",
    output: outputLabel("16:9 image-to-video clip", "16:9 图生视频短片", "16:9"),
    prompt:
      "Create a polished image-to-video product scene from a provided still. Keep the product identity locked, use a slow camera push with subtle parallax, controlled reflections, and clean commercial lighting. Avoid text, logos, flicker, identity drift, and unnecessary camera shake.",
    slug: "flatkey-image-to-video-product-scene",
    source: solveaOwnedSource(),
    summary: promptText(
      "Owned video sample paired with a rendered image-to-video product clip.",
      "自有视频样例，配有已经渲染完成的图生视频产品短片。",
    ),
    tags: ["video", "i2v", "product"],
    title: promptText("Image-to-video product scene", "图生视频产品场景"),
    updatedAt: today,
  },
  {
    artifact: {
      alt: "Character motion video sample clip",
      kind: "video",
      poster: "/assets/video/v1.2.jpg",
      url: "/assets/video/v1.2.mp4",
    },
    category: "video",
    model: "seedance-2.5",
    output: outputLabel("9:16 character motion clip", "9:16 角色动作短片", "9:16"),
    prompt:
      "Create a short character motion clip from a reference image. Preserve face, outfit, silhouette, and color palette. Add a simple natural gesture, soft environmental movement, stable camera, and warm practical light. No readable text, no extra characters, no identity morphing.",
    slug: "flatkey-character-reference-motion-clip",
    source: solveaOwnedSource(),
    summary: promptText(
      "Owned character-motion prompt paired with a finished reference-to-video clip.",
      "自有角色动作提示词，配有完成的参考图转视频短片。",
    ),
    tags: ["video", "character", "i2v"],
    title: promptText("Character reference motion clip", "角色参考动作短片"),
    updatedAt: today,
  },
  {
    artifact: {
      alt: "Text-to-video cinematic test clip",
      kind: "video",
      poster: "/assets/video/v1.3.jpg",
      url: "/assets/video/v1.3.mp4",
    },
    category: "video",
    model: "veo-3.1-fast-generate-preview",
    output: outputLabel("16:9 text-to-video clip", "16:9 文生视频短片", "16:9"),
    prompt:
      "Generate a clean cinematic product reveal from text only. One continuous shot, product centered, slow dolly-in, soft rim light, realistic reflections, shallow depth of field, edit-ready pacing. Avoid floating captions, watermarks, extra logos, and sudden scene changes.",
    slug: "flatkey-text-to-video-cinematic-test",
    source: solveaOwnedSource(),
    summary: promptText(
      "Owned text-to-video sample with a completed cinematic test clip.",
      "自有文生视频样例，配有完成的电影感测试短片。",
    ),
    tags: ["video", "t2v", "product"],
    title: promptText("Text-to-video cinematic test", "文生视频电影感测试"),
    updatedAt: today,
  },
  {
    artifact: {
      body:
        "Headline set:\n1. One key for every model your product ships.\n2. Stop rebuilding provider billing twice.\n3. Route, price, and observe AI calls in one place.\n4. Give agents tools without handing them every vendor key.\n5. Launch model features with a ledger already attached.",
      kind: "text",
      title: "Generated launch headlines",
    },
    category: "text",
    model: "gpt-5",
    output: outputLabel("Text output", "文本产物", "1:1"),
    prompt:
      "Write 5 sharp launch headlines for a developer tool that unifies AI model routing, tool calls, billing, and observability. Keep each under 14 words, avoid hype, and make the buyer value concrete.",
    slug: "developer-tool-launch-headlines",
    source: {
      capturedAt: today,
      label: "flatkey-ai/how-to-use-flatkey",
      platform: "GitHub",
      url: `${flatkeyGithubBase}/how-to-use-flatkey`,
    },
    summary: withIdFallback({
      en: "A text-generation prompt shaped for OpenAI-compatible Flatkey samples, with finished headline output.",
      zh: "面向 Flatkey OpenAI 兼容示例的文本生成提示词，并附带已生成标题产物。",
      es: "Prompt de texto para ejemplos Flatkey compatibles con OpenAI, con titulares terminados.",
      fr: "Prompt texte pour exemples Flatkey compatibles OpenAI, avec titres produits.",
      pt: "Prompt de texto para exemplos Flatkey compatíveis com OpenAI, com títulos prontos.",
      ru: "Текстовый prompt для OpenAI-совместимых примеров Flatkey, с готовыми заголовками.",
      ja: "OpenAI 互換 Flatkey サンプル向けのテキスト生成プロンプト。生成済み見出し付き。",
      vi: "Prompt tạo văn bản cho mẫu Flatkey tương thích OpenAI, có headline hoàn chỉnh.",
      de: "Text-Prompt für OpenAI-kompatible Flatkey-Beispiele mit fertigen Headlines.",
    }),
    tags: ["copywriting", "developer", "launch"],
    title: withIdFallback({
      en: "Developer tool launch headlines",
      zh: "开发者工具发布标题",
      es: "Titulares de lanzamiento para herramienta dev",
      fr: "Titres de lancement pour outil dev",
      pt: "Headlines de lançamento para ferramenta dev",
      ru: "Заголовки запуска dev tool",
      ja: "開発者ツールのローンチ見出し",
      vi: "Headline ra mắt công cụ developer",
      de: "Launch-Headlines für Developer-Tool",
    }),
    updatedAt: today,
  },
  {
    artifact: {
      code: `flatkey video generate \\
  --model seedance-2.0 \\
  --prompt "8 second cinematic product reveal, glossy black background" \\
  --ratio 16:9 \\
  --resolution 720p \\
  --dry-run \\
  --json`,
      kind: "code",
      language: "bash",
    },
    category: "agent",
    model: "gpt-5",
    output: outputLabel("CLI command", "CLI 命令", "1:1"),
    prompt:
      "Before spending credits, inspect the request shape for a media generation job. Use JSON output, keep the prompt unchanged, and return model, ratio, resolution, estimated route, and the final command to run.",
    slug: "agent-dry-run-before-spend",
    source: {
      capturedAt: today,
      label: "flatkey-ai/flatkey-cli agent protocol",
      platform: "GitHub",
      url: `${flatkeyGithubBase}/flatkey-cli`,
    },
    summary: withIdFallback({
      en: "An agent prompt for checking Flatkey CLI request shape before spending credits, with the command artifact included.",
      zh: "让 Agent 在消耗余额前检查 Flatkey CLI 请求形状的提示词，并附带命令产物。",
      es: "Prompt de agente para revisar una petición Flatkey CLI antes de gastar créditos.",
      fr: "Prompt agent pour inspecter une requête Flatkey CLI avant dépense.",
      pt: "Prompt de agente para validar uma chamada Flatkey CLI antes de gastar créditos.",
      ru: "Agent prompt для проверки запроса Flatkey CLI перед списанием кредитов.",
      ja: "クレジット消費前に Flatkey CLI リクエストを確認する Agent プロンプト。",
      vi: "Prompt agent kiểm tra request Flatkey CLI trước khi tiêu credit.",
      de: "Agent-Prompt zur Prüfung eines Flatkey-CLI-Requests vor Kosten.",
    }),
    tags: ["agent", "cli", "cost-control"],
    title: withIdFallback({
      en: "Agent dry run before spend",
      zh: "Agent 消费前 dry run",
      es: "Dry run de agente antes de gastar",
      fr: "Dry run agent avant dépense",
      pt: "Dry run de agente antes do gasto",
      ru: "Agent dry run перед расходом",
      ja: "消費前の Agent dry run",
      vi: "Agent dry run trước khi tiêu phí",
      de: "Agent Dry Run vor Kosten",
    }),
    updatedAt: today,
  },
];

function hasArtifact(item: PromptItem): boolean {
  if (item.artifact.kind === "image") return Boolean(item.artifact.url);
  if (item.artifact.kind === "video") return Boolean(item.artifact.url);
  if (item.artifact.kind === "text") return Boolean(item.artifact.body);
  if (item.artifact.kind === "code") return Boolean(item.artifact.code);
  if (item.artifact.kind === "storyboard") return item.artifact.frames.length > 0;
  return false;
}

export function getCliMediaPromptItems(category?: "image" | "video"): PromptItem[] {
  const bySlug = new Map<string, PromptItem>();

  for (const item of staticPromptItems.filter(hasArtifact)) {
    if (category && item.category !== category) continue;
    bySlug.set(item.slug, item);
  }

  return Array.from(bySlug.values()).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export function getCliMediaPromptItem(category: "image" | "video", slug: string): PromptItem | undefined {
  return getCliMediaPromptItems(category).find((item) => item.slug === slug);
}
