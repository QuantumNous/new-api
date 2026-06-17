import type { Locale } from "./locales";

export type ModelPriceRow = {
  label: string;
  flatkey: string;
  official?: string;
  value?: string;
};

export type ModelConfig = {
  slug: string;
  displayName: string;
  modelId: string;
  officialName: string;
  officialPrice: string;
  flatkeyPrice: string;
  estFlatkey: string;
  estOfficial: string;
  examplePrompt: string;
  priceUnit: ModelLandingKey;
  rows: ModelPriceRow[];
};

const COVERAGE = "GPT · Gemini · Claude · DeepSeek · Seedance";

export const CLAUDE_CONFIG: ModelConfig = {
  slug: "claude-api",
  displayName: "Claude Opus 4",
  modelId: "claude-opus-4",
  officialName: "Anthropic",
  officialPrice: "$15.00",
  flatkeyPrice: "$7.50",
  estFlatkey: "$0.004",
  estOfficial: "$0.008",
  examplePrompt:
    "You are a senior backend engineer. In 3 sentences, explain why developers should use an LLM gateway instead of calling each official API directly.",
  priceUnit: "/ million output tokens",
  rows: [
    { label: "Opus 4 output", flatkey: "$7.5", official: "$15" },
    { label: "Sonnet 4 output", flatkey: "$7.5", official: "$15" },
    { label: "Haiku output", flatkey: "$2.0", official: "$4" },
    { label: "Cache reads", flatkey: "", value: "50% off" },
    { label: "Coverage", flatkey: "", value: COVERAGE },
  ],
};

export const GPT_CONFIG: ModelConfig = {
  slug: "gpt-api",
  displayName: "GPT-5",
  modelId: "gpt-5",
  officialName: "OpenAI",
  officialPrice: "$10.00",
  flatkeyPrice: "$5.50",
  estFlatkey: "$0.003",
  estOfficial: "$0.006",
  examplePrompt:
    "You are a senior backend engineer. In 3 sentences, explain why developers should use an LLM gateway instead of calling each official API directly.",
  priceUnit: "/ million output tokens",
  rows: [
    { label: "GPT-5 output", flatkey: "$5.5", official: "$10" },
    { label: "GPT-5 mini output", flatkey: "$1.1", official: "$2" },
    { label: "GPT-5 input", flatkey: "$0.7", official: "$1.25" },
    { label: "Cache reads", flatkey: "", value: "50% off" },
    { label: "Coverage", flatkey: "", value: COVERAGE },
  ],
};

export const SEEDANCE_CONFIG: ModelConfig = {
  slug: "seedance-api",
  displayName: "Seedance 2.0",
  modelId: "seedance-2-0",
  officialName: "fal.ai",
  officialPrice: "$0.07",
  flatkeyPrice: "$0.035",
  estFlatkey: "$0.18",
  estOfficial: "$0.35",
  examplePrompt:
    "A cinematic drone shot flying over a neon-lit Tokyo street at night, rain reflections, 5 seconds.",
  priceUnit: "/ second",
  rows: [
    { label: "Seedance video / sec", flatkey: "$0.035", official: "$0.07" },
    { label: "Image-to-video / sec", flatkey: "$0.04", official: "$0.08" },
    { label: "1080p / sec", flatkey: "$0.05", official: "$0.10" },
    { label: "Coverage", flatkey: "", value: "Seedance · Kling · Veo · Sora · GPT · Claude" },
  ],
};

export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  [CLAUDE_CONFIG.slug]: CLAUDE_CONFIG,
  [GPT_CONFIG.slug]: GPT_CONFIG,
  [SEEDANCE_CONFIG.slug]: SEEDANCE_CONFIG,
};

export type ModelLandingKey =
  | "↓ Save 50% — double your token budget"
  | "▶ Sign in to run"
  | "(flatkey · official ≈ {{price}})"
  | "{{model}} · OpenAI-compatible · one key, all models"
  | "{{official}} official"
  | "* Illustrative pricing — see flatkey pricing page"
  | "/ million output tokens"
  | "/ second"
  | "# Your existing OpenAI code:"
  | "30–50% cheaper"
  | "50% bonus"
  | "Est. this run"
  | "First top-up"
  | "flatkey · same model, same quality"
  | "Google / GitHub one-click · no credit card to start"
  | "migrate.py — change one line"
  | "Pay to unlock · credited instantly · not a free-signup giveaway"
  | "Playground (edit before sign-up)"
  | "Pricing vs official"
  | "Same {{official}} upstream, same quality — flatkey costs half. Change one line of base_url and your existing OpenAI SDK just works. Try it below, sign in when you are ready."
  | "Sign in to claim →"
  | "Starter / individual"
  | "Team / high-volume"
  | "The same {{model}},"
  | "Top up $1000 get $500"
  | "Top up $200 get $100"
  | "Opus 4 output"
  | "Sonnet 4 output"
  | "Haiku output"
  | "GPT-5 output"
  | "GPT-5 mini output"
  | "GPT-5 input"
  | "Seedance video / sec"
  | "Image-to-video / sec"
  | "1080p / sec"
  | "Cache reads"
  | "Coverage"
  | "50% off";

const en: Record<ModelLandingKey, string> = {
  "↓ Save 50% — double your token budget": "↓ Save 50% — double your token budget",
  "▶ Sign in to run": "▶ Sign in to run",
  "(flatkey · official ≈ {{price}})": "(flatkey · official ≈ {{price}})",
  "{{model}} · OpenAI-compatible · one key, all models": "{{model}} · OpenAI-compatible · one key, all models",
  "{{official}} official": "{{official}} official",
  "* Illustrative pricing — see flatkey pricing page": "* Illustrative pricing — see flatkey pricing page",
  "/ million output tokens": "/ million output tokens",
  "/ second": "/ second",
  "# Your existing OpenAI code:": "# Your existing OpenAI code:",
  "30–50% cheaper": "30–50% cheaper",
  "50% bonus": "50% bonus",
  "Est. this run": "Est. this run",
  "First top-up": "First top-up",
  "flatkey · same model, same quality": "flatkey · same model, same quality",
  "Google / GitHub one-click · no credit card to start": "Google / GitHub one-click · no credit card to start",
  "migrate.py — change one line": "migrate.py — change one line",
  "Pay to unlock · credited instantly · not a free-signup giveaway": "Pay to unlock · credited instantly · not a free-signup giveaway",
  "Playground (edit before sign-up)": "Playground (edit before sign-up)",
  "Pricing vs official": "Pricing vs official",
  "Same {{official}} upstream, same quality — flatkey costs half. Change one line of base_url and your existing OpenAI SDK just works. Try it below, sign in when you are ready.":
    "Same {{official}} upstream, same quality — flatkey costs half. Change one line of base_url and your existing OpenAI SDK just works. Try it below, sign in when you are ready.",
  "Sign in to claim →": "Sign in to claim →",
  "Starter / individual": "Starter / individual",
  "Team / high-volume": "Team / high-volume",
  "The same {{model}},": "The same {{model}},",
  "Top up $1000 get $500": "Top up $1000 get $500",
  "Top up $200 get $100": "Top up $200 get $100",
  "Opus 4 output": "Opus 4 output",
  "Sonnet 4 output": "Sonnet 4 output",
  "Haiku output": "Haiku output",
  "GPT-5 output": "GPT-5 output",
  "GPT-5 mini output": "GPT-5 mini output",
  "GPT-5 input": "GPT-5 input",
  "Seedance video / sec": "Seedance video / sec",
  "Image-to-video / sec": "Image-to-video / sec",
  "1080p / sec": "1080p / sec",
  "Cache reads": "Cache reads",
  Coverage: "Coverage",
  "50% off": "50% off",
};

const translations: Record<Locale, Record<ModelLandingKey, string>> = {
  en,
  zh: {
    "↓ Save 50% — double your token budget": "↓ 立省 50% — token 预算翻倍",
    "▶ Sign in to run": "▶ 登录即可运行",
    "(flatkey · official ≈ {{price}})": "(flatkey · 官方 ≈ {{price}})",
    "{{model}} · OpenAI-compatible · one key, all models": "{{model}} · 兼容 OpenAI · 一个密钥，全部模型",
    "{{official}} official": "{{official}} 官方",
    "* Illustrative pricing — see flatkey pricing page": "* 示例价格 — 详见 flatkey 定价页",
    "/ million output tokens": "/ 百万输出 token",
    "/ second": "/ 秒",
    "# Your existing OpenAI code:": "# 你现有的 OpenAI 代码：",
    "30–50% cheaper": "便宜 30–50%",
    "50% bonus": "赠送 50%",
    "Est. this run": "本次预估",
    "First top-up": "首次充值",
    "flatkey · same model, same quality": "flatkey · 同款模型，同等质量",
    "Google / GitHub one-click · no credit card to start": "Google / GitHub 一键登录 · 无需信用卡即可开始",
    "migrate.py — change one line": "migrate.py — 改一行即可",
    "Pay to unlock · credited instantly · not a free-signup giveaway": "付费解锁 · 即时到账 · 不是免费注册赠送",
    "Playground (edit before sign-up)": "Playground（注册前可编辑）",
    "Pricing vs official": "与官方价格对比",
    "Same {{official}} upstream, same quality — flatkey costs half. Change one line of base_url and your existing OpenAI SDK just works. Try it below, sign in when you are ready.":
      "同样的 {{official}} 上游，同等质量，flatkey 成本减半。只需修改一行 base_url，现有 OpenAI SDK 即可继续使用。可先在下方试用，准备好后再登录。",
    "Sign in to claim →": "登录领取 →",
    "Starter / individual": "入门 / 个人",
    "Team / high-volume": "团队 / 大用量",
    "The same {{model}},": "同样的 {{model}}，",
    "Top up $1000 get $500": "充 $1000 送 $500",
    "Top up $200 get $100": "充 $200 送 $100",
    "Opus 4 output": "Opus 4 输出",
    "Sonnet 4 output": "Sonnet 4 输出",
    "Haiku output": "Haiku 输出",
    "GPT-5 output": "GPT-5 输出",
    "GPT-5 mini output": "GPT-5 mini 输出",
    "GPT-5 input": "GPT-5 输入",
    "Seedance video / sec": "Seedance 视频/秒",
    "Image-to-video / sec": "图生视频/秒",
    "1080p / sec": "1080p/秒",
    "Cache reads": "缓存读取",
    Coverage: "覆盖范围",
    "50% off": "5 折",
  },
  es: {
    "↓ Save 50% — double your token budget": "↓ Ahorra 50% — duplica tu presupuesto de tokens",
    "▶ Sign in to run": "▶ Inicia sesión para ejecutar",
    "(flatkey · official ≈ {{price}})": "(flatkey · oficial ≈ {{price}})",
    "{{model}} · OpenAI-compatible · one key, all models": "{{model}} · compatible con OpenAI · una clave, todos los modelos",
    "{{official}} official": "{{official}} oficial",
    "* Illustrative pricing — see flatkey pricing page": "* Precios ilustrativos — consulta la página de precios de flatkey",
    "/ million output tokens": "/ millón de tokens de salida",
    "/ second": "/ segundo",
    "# Your existing OpenAI code:": "# Tu código OpenAI actual:",
    "30–50% cheaper": "30–50% más barato",
    "50% bonus": "50% de bonificación",
    "Est. this run": "Est. esta ejecución",
    "First top-up": "Primera recarga",
    "flatkey · same model, same quality": "flatkey · mismo modelo, misma calidad",
    "Google / GitHub one-click · no credit card to start": "Google / GitHub con un clic · sin tarjeta para empezar",
    "migrate.py — change one line": "migrate.py — cambia una línea",
    "Pay to unlock · credited instantly · not a free-signup giveaway": "Paga para desbloquear · crédito instantáneo · no es un regalo gratuito por registrarte",
    "Playground (edit before sign-up)": "Playground (edita antes de registrarte)",
    "Pricing vs official": "Precios vs oficial",
    "Same {{official}} upstream, same quality — flatkey costs half. Change one line of base_url and your existing OpenAI SDK just works. Try it below, sign in when you are ready.":
      "El mismo upstream de {{official}}, la misma calidad: flatkey cuesta la mitad. Cambia una línea de base_url y tu SDK de OpenAI actual funcionará. Pruébalo abajo e inicia sesión cuando estés listo.",
    "Sign in to claim →": "Inicia sesión para reclamar →",
    "Starter / individual": "Inicial / individual",
    "Team / high-volume": "Equipo / alto volumen",
    "The same {{model}},": "El mismo {{model}},",
    "Top up $1000 get $500": "Recarga $1000 y obtén $500",
    "Top up $200 get $100": "Recarga $200 y obtén $100",
    "Opus 4 output": "Salida de Opus 4",
    "Sonnet 4 output": "Salida de Sonnet 4",
    "Haiku output": "Salida de Haiku",
    "GPT-5 output": "Salida de GPT-5",
    "GPT-5 mini output": "Salida de GPT-5 mini",
    "GPT-5 input": "Entrada de GPT-5",
    "Seedance video / sec": "Vídeo Seedance/seg",
    "Image-to-video / sec": "Imagen a vídeo/seg",
    "1080p / sec": "1080p/seg",
    "Cache reads": "Lecturas de caché",
    Coverage: "Cobertura",
    "50% off": "50% de descuento",
  },
  fr: {
    "↓ Save 50% — double your token budget": "↓ Économisez 50% — doublez votre budget de tokens",
    "▶ Sign in to run": "▶ Connectez-vous pour exécuter",
    "(flatkey · official ≈ {{price}})": "(flatkey · officiel ≈ {{price}})",
    "{{model}} · OpenAI-compatible · one key, all models": "{{model}} · compatible OpenAI · une clé, tous les modèles",
    "{{official}} official": "{{official}} officiel",
    "* Illustrative pricing — see flatkey pricing page": "* Tarifs indicatifs — voir la page tarifs de flatkey",
    "/ million output tokens": "/ million de tokens de sortie",
    "/ second": "/ seconde",
    "# Your existing OpenAI code:": "# Votre code OpenAI actuel :",
    "30–50% cheaper": "30–50% moins cher",
    "50% bonus": "50% de bonus",
    "Est. this run": "Est. pour cette exécution",
    "First top-up": "Première recharge",
    "flatkey · same model, same quality": "flatkey · même modèle, même qualité",
    "Google / GitHub one-click · no credit card to start": "Google / GitHub en un clic · sans carte bancaire pour commencer",
    "migrate.py — change one line": "migrate.py — changez une ligne",
    "Pay to unlock · credited instantly · not a free-signup giveaway": "Payez pour débloquer · crédité instantanément · pas un cadeau gratuit à l'inscription",
    "Playground (edit before sign-up)": "Playground (modifiez avant l'inscription)",
    "Pricing vs official": "Tarifs vs officiel",
    "Same {{official}} upstream, same quality — flatkey costs half. Change one line of base_url and your existing OpenAI SDK just works. Try it below, sign in when you are ready.":
      "Même upstream {{official}}, même qualité : flatkey coûte moitié moins. Modifiez une ligne de base_url et votre SDK OpenAI actuel fonctionne. Essayez ci-dessous, puis connectez-vous quand vous êtes prêt.",
    "Sign in to claim →": "Connectez-vous pour réclamer →",
    "Starter / individual": "Débutant / individuel",
    "Team / high-volume": "Équipe / gros volume",
    "The same {{model}},": "Le même {{model}},",
    "Top up $1000 get $500": "Rechargez $1000, obtenez $500",
    "Top up $200 get $100": "Rechargez $200, obtenez $100",
    "Opus 4 output": "Sortie Opus 4",
    "Sonnet 4 output": "Sortie Sonnet 4",
    "Haiku output": "Sortie Haiku",
    "GPT-5 output": "Sortie GPT-5",
    "GPT-5 mini output": "Sortie GPT-5 mini",
    "GPT-5 input": "Entrée GPT-5",
    "Seedance video / sec": "Vidéo Seedance/s",
    "Image-to-video / sec": "Image vers vidéo/s",
    "1080p / sec": "1080p/s",
    "Cache reads": "Lectures de cache",
    Coverage: "Couverture",
    "50% off": "50% de réduction",
  },
  pt: {
    "↓ Save 50% — double your token budget": "↓ Economize 50% — dobre seu orçamento de tokens",
    "▶ Sign in to run": "▶ Entrar para executar",
    "(flatkey · official ≈ {{price}})": "(flatkey · oficial ≈ {{price}})",
    "{{model}} · OpenAI-compatible · one key, all models": "{{model}} · compatível com OpenAI · uma chave, todos os modelos",
    "{{official}} official": "{{official}} oficial",
    "* Illustrative pricing — see flatkey pricing page": "* Preços ilustrativos — veja a página de preços do flatkey",
    "/ million output tokens": "/ milhão de tokens de saída",
    "/ second": "/ segundo",
    "# Your existing OpenAI code:": "# Seu código OpenAI atual:",
    "30–50% cheaper": "30–50% mais barato",
    "50% bonus": "50% de bônus",
    "Est. this run": "Est. desta execução",
    "First top-up": "Primeira recarga",
    "flatkey · same model, same quality": "flatkey · mesmo modelo, mesma qualidade",
    "Google / GitHub one-click · no credit card to start": "Google / GitHub com um clique · sem cartão de crédito para começar",
    "migrate.py — change one line": "migrate.py — mude uma linha",
    "Pay to unlock · credited instantly · not a free-signup giveaway": "Pague para desbloquear · crédito instantâneo · não é brinde gratuito de cadastro",
    "Playground (edit before sign-up)": "Playground (edite antes de cadastrar)",
    "Pricing vs official": "Preços vs oficial",
    "Same {{official}} upstream, same quality — flatkey costs half. Change one line of base_url and your existing OpenAI SDK just works. Try it below, sign in when you are ready.":
      "Mesmo upstream {{official}}, mesma qualidade — flatkey custa metade. Altere uma linha de base_url e seu SDK OpenAI atual funciona. Teste abaixo e entre quando estiver pronto.",
    "Sign in to claim →": "Entrar para resgatar →",
    "Starter / individual": "Inicial / individual",
    "Team / high-volume": "Equipe / alto volume",
    "The same {{model}},": "O mesmo {{model}},",
    "Top up $1000 get $500": "Recarregue $1000 ganhe $500",
    "Top up $200 get $100": "Recarregue $200 ganhe $100",
    "Opus 4 output": "Saída do Opus 4",
    "Sonnet 4 output": "Saída do Sonnet 4",
    "Haiku output": "Saída do Haiku",
    "GPT-5 output": "Saída do GPT-5",
    "GPT-5 mini output": "Saída do GPT-5 mini",
    "GPT-5 input": "Entrada do GPT-5",
    "Seedance video / sec": "Vídeo Seedance/seg",
    "Image-to-video / sec": "Imagem-para-vídeo/seg",
    "1080p / sec": "1080p/seg",
    "Cache reads": "Leituras de cache",
    Coverage: "Cobertura",
    "50% off": "50% de desconto",
  },
  ru: {
    "↓ Save 50% — double your token budget": "↓ Экономьте 50% — удвойте бюджет токенов",
    "▶ Sign in to run": "▶ Войдите, чтобы запустить",
    "(flatkey · official ≈ {{price}})": "(flatkey · официальный ≈ {{price}})",
    "{{model}} · OpenAI-compatible · one key, all models": "{{model}} · совместим с OpenAI · один ключ, все модели",
    "{{official}} official": "{{official}} официальный",
    "* Illustrative pricing — see flatkey pricing page": "* Ориентировочные цены — см. страницу тарифов flatkey",
    "/ million output tokens": "/ млн выходных токенов",
    "/ second": "/ секунду",
    "# Your existing OpenAI code:": "# Ваш текущий код OpenAI:",
    "30–50% cheaper": "на 30–50% дешевле",
    "50% bonus": "бонус 50%",
    "Est. this run": "Оценка за этот запуск",
    "First top-up": "Первое пополнение",
    "flatkey · same model, same quality": "flatkey · та же модель, то же качество",
    "Google / GitHub one-click · no credit card to start": "Google / GitHub в один клик · без карты для старта",
    "migrate.py — change one line": "migrate.py — измените одну строку",
    "Pay to unlock · credited instantly · not a free-signup giveaway": "Оплатите, чтобы разблокировать · зачисляется мгновенно · это не бесплатный бонус за регистрацию",
    "Playground (edit before sign-up)": "Playground (правьте до регистрации)",
    "Pricing vs official": "Цены против официальных",
    "Same {{official}} upstream, same quality — flatkey costs half. Change one line of base_url and your existing OpenAI SDK just works. Try it below, sign in when you are ready.":
      "Тот же upstream {{official}}, то же качество — flatkey стоит вдвое дешевле. Измените одну строку base_url, и ваш текущий OpenAI SDK продолжит работать. Попробуйте ниже и войдите, когда будете готовы.",
    "Sign in to claim →": "Войдите, чтобы получить →",
    "Starter / individual": "Начальный / индивидуальный",
    "Team / high-volume": "Команда / большой объём",
    "The same {{model}},": "Та же {{model}},",
    "Top up $1000 get $500": "Пополните $1000 получите $500",
    "Top up $200 get $100": "Пополните $200 получите $100",
    "Opus 4 output": "Вывод Opus 4",
    "Sonnet 4 output": "Вывод Sonnet 4",
    "Haiku output": "Вывод Haiku",
    "GPT-5 output": "Вывод GPT-5",
    "GPT-5 mini output": "Вывод GPT-5 mini",
    "GPT-5 input": "Ввод GPT-5",
    "Seedance video / sec": "Видео Seedance/сек",
    "Image-to-video / sec": "Изображение в видео/сек",
    "1080p / sec": "1080p/сек",
    "Cache reads": "Чтения из кэша",
    Coverage: "Покрытие",
    "50% off": "скидка 50%",
  },
  ja: {
    "↓ Save 50% — double your token budget": "↓ 50% 節約 — トークン予算が倍に",
    "▶ Sign in to run": "▶ サインインして実行",
    "(flatkey · official ≈ {{price}})": "(flatkey · 公式 ≈ {{price}})",
    "{{model}} · OpenAI-compatible · one key, all models": "{{model}} · OpenAI 互換 · 1つのキーで全モデル",
    "{{official}} official": "{{official}} 公式",
    "* Illustrative pricing — see flatkey pricing page": "* 参考価格 — flatkey の料金ページをご覧ください",
    "/ million output tokens": "/ 出力トークン100万あたり",
    "/ second": "/ 秒",
    "# Your existing OpenAI code:": "# 既存の OpenAI コード:",
    "30–50% cheaper": "30〜50% 安い",
    "50% bonus": "50% ボーナス",
    "Est. this run": "今回の概算",
    "First top-up": "初回チャージ",
    "flatkey · same model, same quality": "flatkey · 同じモデル、同じ品質",
    "Google / GitHub one-click · no credit card to start": "Google / GitHub ワンクリック · クレジットカード不要で開始",
    "migrate.py — change one line": "migrate.py — 1行変更するだけ",
    "Pay to unlock · credited instantly · not a free-signup giveaway": "支払いで解放 · 即時反映 · 無料登録特典ではありません",
    "Playground (edit before sign-up)": "プレイグラウンド（登録前に編集可）",
    "Pricing vs official": "公式との価格比較",
    "Same {{official}} upstream, same quality — flatkey costs half. Change one line of base_url and your existing OpenAI SDK just works. Try it below, sign in when you are ready.":
      "同じ {{official}} upstream、同じ品質で、flatkey は半額です。base_url を1行変えるだけで既存の OpenAI SDK がそのまま動きます。下で試して、準備ができたらサインインしてください。",
    "Sign in to claim →": "サインインして受け取る →",
    "Starter / individual": "スターター / 個人",
    "Team / high-volume": "チーム / 大量利用",
    "The same {{model}},": "同じ {{model}}、",
    "Top up $1000 get $500": "$1000 チャージで $500 進呈",
    "Top up $200 get $100": "$200 チャージで $100 進呈",
    "Opus 4 output": "Opus 4 出力",
    "Sonnet 4 output": "Sonnet 4 出力",
    "Haiku output": "Haiku 出力",
    "GPT-5 output": "GPT-5 出力",
    "GPT-5 mini output": "GPT-5 mini 出力",
    "GPT-5 input": "GPT-5 入力",
    "Seedance video / sec": "Seedance 動画/秒",
    "Image-to-video / sec": "画像から動画/秒",
    "1080p / sec": "1080p/秒",
    "Cache reads": "キャッシュ読み取り",
    Coverage: "対応モデル",
    "50% off": "50% オフ",
  },
  vi: {
    "↓ Save 50% — double your token budget": "↓ Tiết kiệm 50% — nhân đôi ngân sách token",
    "▶ Sign in to run": "▶ Đăng nhập để chạy",
    "(flatkey · official ≈ {{price}})": "(flatkey · chính thức ≈ {{price}})",
    "{{model}} · OpenAI-compatible · one key, all models": "{{model}} · tương thích OpenAI · một khóa, mọi mô hình",
    "{{official}} official": "{{official}} chính thức",
    "* Illustrative pricing — see flatkey pricing page": "* Giá minh họa — xem trang giá của flatkey",
    "/ million output tokens": "/ triệu token đầu ra",
    "/ second": "/ giây",
    "# Your existing OpenAI code:": "# Mã OpenAI hiện có của bạn:",
    "30–50% cheaper": "rẻ hơn 30–50%",
    "50% bonus": "thưởng 50%",
    "Est. this run": "Ước tính lần chạy này",
    "First top-up": "Nạp lần đầu",
    "flatkey · same model, same quality": "flatkey · cùng mô hình, cùng chất lượng",
    "Google / GitHub one-click · no credit card to start": "Google / GitHub một chạm · không cần thẻ tín dụng để bắt đầu",
    "migrate.py — change one line": "migrate.py — đổi một dòng",
    "Pay to unlock · credited instantly · not a free-signup giveaway": "Thanh toán để mở khóa · ghi có tức thì · không phải quà tặng đăng ký miễn phí",
    "Playground (edit before sign-up)": "Playground (chỉnh sửa trước khi đăng ký)",
    "Pricing vs official": "Giá so với chính thức",
    "Same {{official}} upstream, same quality — flatkey costs half. Change one line of base_url and your existing OpenAI SDK just works. Try it below, sign in when you are ready.":
      "Cùng upstream {{official}}, cùng chất lượng — flatkey chỉ tốn một nửa. Đổi một dòng base_url và SDK OpenAI hiện có của bạn sẽ hoạt động. Thử bên dưới, rồi đăng nhập khi bạn sẵn sàng.",
    "Sign in to claim →": "Đăng nhập để nhận →",
    "Starter / individual": "Khởi đầu / cá nhân",
    "Team / high-volume": "Nhóm / khối lượng lớn",
    "The same {{model}},": "Cùng {{model}},",
    "Top up $1000 get $500": "Nạp $1000 nhận $500",
    "Top up $200 get $100": "Nạp $200 nhận $100",
    "Opus 4 output": "Đầu ra Opus 4",
    "Sonnet 4 output": "Đầu ra Sonnet 4",
    "Haiku output": "Đầu ra Haiku",
    "GPT-5 output": "Đầu ra GPT-5",
    "GPT-5 mini output": "Đầu ra GPT-5 mini",
    "GPT-5 input": "Đầu vào GPT-5",
    "Seedance video / sec": "Video Seedance/giây",
    "Image-to-video / sec": "Ảnh thành video/giây",
    "1080p / sec": "1080p/giây",
    "Cache reads": "Đọc bộ nhớ đệm",
    Coverage: "Phạm vi hỗ trợ",
    "50% off": "giảm 50%",
  },
  de: {
    "↓ Save 50% — double your token budget": "↓ 50% sparen — dein Token-Budget verdoppeln",
    "▶ Sign in to run": "▶ Zum Ausführen anmelden",
    "(flatkey · official ≈ {{price}})": "(flatkey · offiziell ≈ {{price}})",
    "{{model}} · OpenAI-compatible · one key, all models": "{{model}} · OpenAI-kompatibel · ein Schlüssel, alle Modelle",
    "{{official}} official": "{{official}} offiziell",
    "* Illustrative pricing — see flatkey pricing page": "* Beispielpreise — siehe flatkey-Preisseite",
    "/ million output tokens": "/ Million Output-Tokens",
    "# Your existing OpenAI code:": "# Dein vorhandener OpenAI-Code:",
    "30–50% cheaper": "30–50% günstiger",
    "50% bonus": "50% Bonus",
    "Est. this run": "Schätzung für diesen Lauf",
    "First top-up": "Erste Aufladung",
    "flatkey · same model, same quality": "flatkey · gleiches Modell, gleiche Qualität",
    "Google / GitHub one-click · no credit card to start": "Google / GitHub mit einem Klick · keine Kreditkarte nötig zum Start",
    "migrate.py — change one line": "migrate.py — eine Zeile ändern",
    "Pay to unlock · credited instantly · not a free-signup giveaway": "Zum Freischalten bezahlen · sofort gutgeschrieben · kein kostenloses Anmeldegeschenk",
    "Playground (edit before sign-up)": "Playground (vor der Anmeldung bearbeiten)",
    "Pricing vs official": "Preise im Vergleich zum offiziellen Anbieter",
    "Same {{official}} upstream, same quality — flatkey costs half. Change one line of base_url and your existing OpenAI SDK just works. Try it below, sign in when you are ready.":
      "Gleiches {{official}}-Upstream, gleiche Qualität — flatkey kostet die Hälfte. Ändere eine Zeile base_url und dein vorhandenes OpenAI-SDK läuft einfach weiter. Probiere es unten aus und melde dich an, wenn du bereit bist.",
    "Sign in to claim →": "Zum Einlösen anmelden →",
    "Starter / individual": "Starter / Einzelperson",
    "Team / high-volume": "Team / hohes Volumen",
    "The same {{model}},": "Das gleiche {{model}},",
    "Top up $1000 get $500": "$1000 aufladen, $500 erhalten",
    "Top up $200 get $100": "$200 aufladen, $100 erhalten",
    "Opus 4 output": "Opus 4 Output",
    "Sonnet 4 output": "Sonnet 4 Output",
    "Haiku output": "Haiku Output",
    "GPT-5 output": "GPT-5 Output",
    "GPT-5 mini output": "GPT-5 mini Output",
    "GPT-5 input": "GPT-5 Input",
    "Cache reads": "Cache-Lesevorgänge",
    Coverage: "Abdeckung",
    "50% off": "50% Rabatt",
  },
};

export function modelLandingCopy(locale: Locale, key: ModelLandingKey, vars: Record<string, string> = {}) {
  let value = translations[locale][key] ?? translations.en[key] ?? key;
  for (const [name, replacement] of Object.entries(vars)) {
    value = value.replaceAll(`{{${name}}}`, replacement);
  }
  return value;
}
