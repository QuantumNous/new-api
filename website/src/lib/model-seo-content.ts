// Programmatic SEO copy for the generic public model page. Every string is a
// pure function of the model's live pricing so each of the ~500 pages carries
// unique content and avoids thin/duplicate-page penalties. Tone: price-
// comparison led, with sign-up as the conversion goal. Fully localized across
// all 9 site locales; brand/technical tokens (flatkey.ai, OpenAI, GPT, Claude,
// base_url, API) stay literal.

import type { Locale } from "@/lib/locales";

export type ModelSeoInput = {
  modelName: string;
  vendorName: string;
  kind: "chat" | "image";
  // Token-billed → per-1M-token units; otherwise per-request (image/request
  // models are not billed per token, so the copy must not say "tokens").
  isTokenBilled: boolean;
  savingsPct: number;
  inputList: string;
  inputDiscounted: string;
  outputDiscounted: string;
  routerBaseUrl: string;
  comparison: Array<{ modelName: string; inputPrice: string }>;
};

export type ModelSeoUi = {
  ctaSignUp: string;
  saveVsOfficial: string;
  specs: string;
  provider: string;
  modality: string;
  access: string;
  endpoints: string;
  howToTitle: string;
  compareTitle: string;
  colModel: string;
  colInputPrice: string;
  faqTitle: string;
  relatedTitle: string;
  ctaTitle: string;
  ctaSubtitle: string;
};

type SeoStrings = {
  ui: ModelSeoUi;
  coverage: string;
  modalityChat: string;
  modalityImage: string;
  // Price unit phrases placed at the {inputUnit}/{outputUnit} slots. Token
  // models use unitInput/unitOutput; request/image models use unitRequest.
  unitInput: string;
  unitOutput: string;
  unitRequest: string;
  intro: string;
  savingsFull: string; // intro, em-dash wrapped
  savingsShort: string; // faq #1, comma wrapped
  cheaper: string; // faq #3, parenthesis wrapped
  howTo: Array<{ title: string; body: string }>;
  faq: Array<{ q: string; a: string }>;
};

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""));
}

function baseVars(v: ModelSeoInput): Record<string, string | number> {
  return {
    model: v.modelName,
    vendor: v.vendorName,
    inputList: v.inputList,
    inputDiscounted: v.inputDiscounted,
    outputDiscounted: v.outputDiscounted,
    savingsPct: v.savingsPct,
    router: v.routerBaseUrl,
  };
}

function strings(locale: Locale): SeoStrings {
  return STR[locale] ?? STR.en;
}

export function modelSeoUi(locale: Locale): ModelSeoUi {
  return strings(locale).ui;
}

// Price-unit phrases for the current model's billing type.
function unitVars(v: ModelSeoInput, s: SeoStrings): { inputUnit: string; outputUnit: string } {
  return v.isTokenBilled
    ? { inputUnit: s.unitInput, outputUnit: s.unitOutput }
    : { inputUnit: s.unitRequest, outputUnit: s.unitRequest };
}

export function buildModelIntro(v: ModelSeoInput, locale: Locale): string {
  const s = strings(locale);
  const vars = baseVars(v);
  const modality = v.kind === "image" ? s.modalityImage : s.modalityChat;
  const savings = v.savingsPct > 0 ? ` — ${fill(s.savingsFull, vars)}` : "";
  return fill(s.intro, { ...vars, ...unitVars(v, s), modality, coverage: s.coverage, savings });
}

export function buildModelHowTo(v: ModelSeoInput, locale: Locale): Array<{ title: string; body: string }> {
  const s = strings(locale);
  const vars = baseVars(v);
  return s.howTo.map((step) => ({ title: fill(step.title, vars), body: fill(step.body, vars) }));
}

export function buildModelFaq(v: ModelSeoInput, locale: Locale): Array<{ q: string; a: string }> {
  const s = strings(locale);
  const vars = baseVars(v);
  const savingsShort = v.savingsPct > 0 ? `, ${fill(s.savingsShort, vars)}` : "";
  const cheaper = v.savingsPct > 0 ? ` (${fill(s.cheaper, vars)})` : "";
  return s.faq.map((item) => ({
    q: fill(item.q, vars),
    a: fill(item.a, { ...vars, ...unitVars(v, s), coverage: s.coverage, savingsShort, cheaper }),
  }));
}

const STR: Record<Locale, SeoStrings> = {
  en: {
    ui: {
      ctaSignUp: "Get your API key",
      saveVsOfficial: "Save ~{pct}% vs official pricing",
      specs: "Specifications",
      provider: "Provider",
      modality: "Modality",
      access: "Access",
      endpoints: "Endpoints",
      howToTitle: "How to use the {model} API",
      compareTitle: "{model} vs similar models",
      colModel: "Model",
      colInputPrice: "Input / 1M",
      faqTitle: "Frequently asked questions",
      relatedTitle: "More {vendor} models",
      ctaTitle: "Start building with {model}",
      ctaSubtitle:
        "One OpenAI-compatible key, prepaid billing, and bonus credit on your first top-up. Sign up in under a minute.",
    },
    coverage: "GPT, Claude, Gemini, DeepSeek, Seedance and 500+ other models",
    modalityChat: "chat and completion",
    modalityImage: "image-generation",
    unitInput: "per 1M input tokens",
    unitOutput: "per 1M output tokens",
    unitRequest: "per request",
    intro:
      "{model} is a {vendor} {modality} model you can call through flatkey.ai's OpenAI-compatible API. On flatkey it runs at {inputDiscounted} {inputUnit}{savings}, and {outputDiscounted} {outputUnit}. One API key covers {coverage}, so you can switch models without changing SDKs or juggling separate accounts. Billing is prepaid with live usage analytics and a single invoice, which keeps spend predictable as you scale.",
    savingsFull: "about {savingsPct}% below the {inputList} official list price",
    savingsShort: "roughly {savingsPct}% below the official list price",
    cheaper: "about {savingsPct}% cheaper",
    howTo: [
      {
        title: "Create a flatkey.ai account and API key",
        body: "Sign up for free, then generate an API key in the console. New accounts get bonus credit on their first top-up.",
      },
      {
        title: "Point your OpenAI client at flatkey",
        body: "Set base_url to {router} and use your flatkey key as the API key. No other code changes are needed — the API is OpenAI-compatible.",
      },
      {
        title: "Call {model}",
        body: 'Send a request with model set to "{model}" using the OpenAI SDK or curl. Copy a ready-to-run example below.',
      },
    ],
    faq: [
      {
        q: "How much does the {model} API cost?",
        a: "On flatkey.ai, {model} costs {inputDiscounted} {inputUnit} and {outputDiscounted} {outputUnit}{savingsShort}. Top up $200 and get $100 free to stretch the budget further.",
      },
      {
        q: "Is {model} OpenAI-compatible?",
        a: 'Yes. Keep your existing OpenAI SDK, switch base_url to {router}, and use your flatkey key. The model id stays "{model}".',
      },
      {
        q: "Is {model} free to use?",
        a: "Usage is pay-as-you-go, but priced well below the official list{cheaper}, and new accounts receive bonus credit on their first top-up, so you can start testing at low cost.",
      },
      {
        q: "How do I get an API key for {model}?",
        a: "Sign up on flatkey.ai, create an API key in the console, and add prepaid balance. You can start calling {model} in minutes.",
      },
      {
        q: "What other models can I use with the same key?",
        a: "One flatkey key gives you {coverage} through a single OpenAI-compatible endpoint and one invoice.",
      },
      {
        q: "How reliable is {model} on flatkey?",
        a: "We publish the live 30-day success rate, throughput and latency for {model} directly on this page, updated from real traffic.",
      },
    ],
  },
  zh: {
    ui: {
      ctaSignUp: "获取 API Key",
      saveVsOfficial: "比官方省约 {pct}%",
      specs: "规格参数",
      provider: "供应商",
      modality: "模态",
      access: "接入方式",
      endpoints: "端点",
      howToTitle: "如何调用 {model} API",
      compareTitle: "{model} 与同类模型对比",
      colModel: "模型",
      colInputPrice: "输入 / 100 万",
      faqTitle: "常见问题",
      relatedTitle: "更多 {vendor} 模型",
      ctaTitle: "立即用 {model} 开发",
      ctaSubtitle: "一把 OpenAI 兼容 Key、预付计费、首充赠额。不到一分钟完成注册。",
    },
    coverage: "GPT、Claude、Gemini、DeepSeek、Seedance 等 500+ 模型",
    modalityChat: "对话与补全",
    modalityImage: "图像生成",
    unitInput: "/100 万 tokens",
    unitOutput: "/100 万 tokens",
    unitRequest: "/次",
    intro:
      "{model} 是 {vendor} 的{modality}模型，可通过 flatkey.ai 的 OpenAI 兼容 API 调用。在 flatkey 上，输入 {inputDiscounted}{inputUnit}{savings}，输出 {outputDiscounted}{outputUnit}。一把 API Key 打通 {coverage}，无需更换 SDK 或维护多个账户即可切换模型。预付计费，配实时用量分析和统一账单，规模化时开支可控。",
    savingsFull: "较官方列表价 {inputList} 低约 {savingsPct}%",
    savingsShort: "约比官方列表价低 {savingsPct}%",
    cheaper: "约便宜 {savingsPct}%",
    howTo: [
      {
        title: "注册 flatkey.ai 账户并创建 API Key",
        body: "免费注册，在控制台生成 API Key。新账户首充可获赠额。",
      },
      {
        title: "把 OpenAI 客户端指向 flatkey",
        body: "将 base_url 设为 {router}，用你的 flatkey Key 作为 API Key。无需改动其他代码——接口与 OpenAI 兼容。",
      },
      {
        title: "调用 {model}",
        body: '用 OpenAI SDK 或 curl 发送请求，model 设为 "{model}"。下方可复制现成示例。',
      },
    ],
    faq: [
      {
        q: "{model} API 多少钱？",
        a: "在 flatkey.ai 上，{model} 输入 {inputDiscounted}{inputUnit}，输出 {outputDiscounted}{outputUnit}{savingsShort}。充值 $200 送 $100，预算更耐用。",
      },
      {
        q: "{model} 与 OpenAI 兼容吗？",
        a: '兼容。沿用现有 OpenAI SDK，把 base_url 换成 {router}，用 flatkey Key 即可，模型 id 仍为 "{model}"。',
      },
      {
        q: "{model} 免费吗？",
        a: "按用量付费，但定价远低于官方列表价{cheaper}，且新账户首充赠额，可低成本开始测试。",
      },
      {
        q: "如何获取 {model} 的 API Key？",
        a: "在 flatkey.ai 注册，于控制台创建 API Key 并预付余额，几分钟即可开始调用 {model}。",
      },
      {
        q: "同一把 Key 还能用哪些模型？",
        a: "一把 flatkey Key 通过单一 OpenAI 兼容端点和统一账单，即可使用 {coverage}。",
      },
      {
        q: "{model} 在 flatkey 上稳定吗？",
        a: "本页直接公布 {model} 近 30 天的实时成功率、吞吐与延迟，数据来自真实流量。",
      },
    ],
  },
  es: {
    ui: {
      ctaSignUp: "Obtén tu API key",
      saveVsOfficial: "Ahorra ~{pct}% frente al precio oficial",
      specs: "Especificaciones",
      provider: "Proveedor",
      modality: "Modalidad",
      access: "Acceso",
      endpoints: "Endpoints",
      howToTitle: "Cómo usar la API de {model}",
      compareTitle: "{model} frente a modelos similares",
      colModel: "Modelo",
      colInputPrice: "Entrada / 1M",
      faqTitle: "Preguntas frecuentes",
      relatedTitle: "Más modelos de {vendor}",
      ctaTitle: "Empieza a construir con {model}",
      ctaSubtitle:
        "Una clave compatible con OpenAI, facturación prepago y crédito de bonificación en tu primera recarga. Regístrate en menos de un minuto.",
    },
    coverage: "GPT, Claude, Gemini, DeepSeek, Seedance y más de 500 modelos",
    modalityChat: "de chat y completado",
    modalityImage: "de generación de imágenes",
    unitInput: "por 1M de tokens de entrada",
    unitOutput: "por 1M de tokens de salida",
    unitRequest: "por solicitud",
    intro:
      "{model} es un modelo {modality} de {vendor} que puedes llamar a través de la API compatible con OpenAI de flatkey.ai. En flatkey cuesta {inputDiscounted} {inputUnit}{savings} y {outputDiscounted} {outputUnit}. Una sola API key cubre {coverage}, así que puedes cambiar de modelo sin cambiar de SDK ni gestionar varias cuentas. La facturación es prepago, con analíticas de uso en vivo y una única factura, lo que mantiene el gasto previsible al escalar.",
    savingsFull: "alrededor de un {savingsPct}% por debajo del precio de lista oficial de {inputList}",
    savingsShort: "aproximadamente un {savingsPct}% por debajo del precio de lista oficial",
    cheaper: "alrededor de un {savingsPct}% más barato",
    howTo: [
      {
        title: "Crea una cuenta en flatkey.ai y una API key",
        body: "Regístrate gratis y genera una API key en la consola. Las cuentas nuevas reciben crédito de bonificación en su primera recarga.",
      },
      {
        title: "Apunta tu cliente OpenAI a flatkey",
        body: "Configura base_url en {router} y usa tu clave de flatkey como API key. No hacen falta más cambios de código: la API es compatible con OpenAI.",
      },
      {
        title: "Llama a {model}",
        body: 'Envía una petición con model igual a "{model}" usando el SDK de OpenAI o curl. Copia un ejemplo listo para usar más abajo.',
      },
    ],
    faq: [
      {
        q: "¿Cuánto cuesta la API de {model}?",
        a: "En flatkey.ai, {model} cuesta {inputDiscounted} {inputUnit} y {outputDiscounted} {outputUnit}{savingsShort}. Recarga $200 y recibe $100 gratis para estirar el presupuesto.",
      },
      {
        q: "¿Es {model} compatible con OpenAI?",
        a: 'Sí. Mantén tu SDK de OpenAI, cambia base_url a {router} y usa tu clave de flatkey. El id del modelo sigue siendo "{model}".',
      },
      {
        q: "¿Es gratis usar {model}?",
        a: "El uso es de pago por consumo, pero con un precio muy por debajo de la lista oficial{cheaper}, y las cuentas nuevas reciben crédito de bonificación en su primera recarga, así que puedes empezar a probar a bajo coste.",
      },
      {
        q: "¿Cómo obtengo una API key para {model}?",
        a: "Regístrate en flatkey.ai, crea una API key en la consola y añade saldo prepago. Puedes empezar a llamar a {model} en minutos.",
      },
      {
        q: "¿Qué otros modelos puedo usar con la misma clave?",
        a: "Una clave de flatkey te da {coverage} a través de un único endpoint compatible con OpenAI y una sola factura.",
      },
      {
        q: "¿Qué tan fiable es {model} en flatkey?",
        a: "Publicamos la tasa de éxito, el rendimiento y la latencia en vivo de los últimos 30 días de {model} en esta misma página, actualizados con tráfico real.",
      },
    ],
  },
  fr: {
    ui: {
      ctaSignUp: "Obtenez votre clé API",
      saveVsOfficial: "Économisez ~{pct}% par rapport au tarif officiel",
      specs: "Spécifications",
      provider: "Fournisseur",
      modality: "Modalité",
      access: "Accès",
      endpoints: "Endpoints",
      howToTitle: "Comment utiliser l'API {model}",
      compareTitle: "{model} face à des modèles similaires",
      colModel: "Modèle",
      colInputPrice: "Entrée / 1M",
      faqTitle: "Questions fréquentes",
      relatedTitle: "Plus de modèles {vendor}",
      ctaTitle: "Commencez à développer avec {model}",
      ctaSubtitle:
        "Une clé compatible OpenAI, une facturation prépayée et un crédit bonus dès votre première recharge. Inscrivez-vous en moins d'une minute.",
    },
    coverage: "GPT, Claude, Gemini, DeepSeek, Seedance et plus de 500 modèles",
    modalityChat: "de chat et de complétion",
    modalityImage: "de génération d'images",
    unitInput: "par million de tokens en entrée",
    unitOutput: "par million de tokens en sortie",
    unitRequest: "par requête",
    intro:
      "{model} est un modèle {modality} de {vendor} que vous pouvez appeler via l'API compatible OpenAI de flatkey.ai. Sur flatkey, il coûte {inputDiscounted} {inputUnit}{savings} et {outputDiscounted} {outputUnit}. Une seule clé API couvre {coverage}, ce qui vous permet de changer de modèle sans changer de SDK ni jongler avec plusieurs comptes. La facturation est prépayée, avec des analyses d'usage en temps réel et une facture unique, ce qui rend les dépenses prévisibles à mesure que vous montez en charge.",
    savingsFull: "environ {savingsPct}% en dessous du tarif catalogue officiel de {inputList}",
    savingsShort: "environ {savingsPct}% en dessous du tarif catalogue officiel",
    cheaper: "environ {savingsPct}% moins cher",
    howTo: [
      {
        title: "Créez un compte flatkey.ai et une clé API",
        body: "Inscrivez-vous gratuitement, puis générez une clé API dans la console. Les nouveaux comptes reçoivent un crédit bonus lors de leur première recharge.",
      },
      {
        title: "Pointez votre client OpenAI vers flatkey",
        body: "Définissez base_url sur {router} et utilisez votre clé flatkey comme clé API. Aucun autre changement de code n'est nécessaire — l'API est compatible OpenAI.",
      },
      {
        title: "Appelez {model}",
        body: 'Envoyez une requête avec model défini sur "{model}" via le SDK OpenAI ou curl. Copiez un exemple prêt à l\'emploi ci-dessous.',
      },
    ],
    faq: [
      {
        q: "Combien coûte l'API {model} ?",
        a: "Sur flatkey.ai, {model} coûte {inputDiscounted} {inputUnit} et {outputDiscounted} {outputUnit}{savingsShort}. Rechargez 200 $ et recevez 100 $ offerts pour prolonger votre budget.",
      },
      {
        q: "{model} est-il compatible OpenAI ?",
        a: 'Oui. Gardez votre SDK OpenAI, changez base_url en {router} et utilisez votre clé flatkey. L\'id du modèle reste "{model}".',
      },
      {
        q: "{model} est-il gratuit ?",
        a: "L'usage est à la consommation, mais tarifé bien en dessous du prix catalogue officiel{cheaper}, et les nouveaux comptes reçoivent un crédit bonus à la première recharge : vous pouvez donc commencer vos tests à faible coût.",
      },
      {
        q: "Comment obtenir une clé API pour {model} ?",
        a: "Inscrivez-vous sur flatkey.ai, créez une clé API dans la console et ajoutez un solde prépayé. Vous pouvez commencer à appeler {model} en quelques minutes.",
      },
      {
        q: "Quels autres modèles puis-je utiliser avec la même clé ?",
        a: "Une clé flatkey vous donne accès à {coverage} via un unique endpoint compatible OpenAI et une facture unique.",
      },
      {
        q: "Quelle est la fiabilité de {model} sur flatkey ?",
        a: "Nous publions le taux de réussite, le débit et la latence en direct des 30 derniers jours pour {model} directement sur cette page, mis à jour à partir du trafic réel.",
      },
    ],
  },
  pt: {
    ui: {
      ctaSignUp: "Obtenha sua API key",
      saveVsOfficial: "Economize ~{pct}% em relação ao preço oficial",
      specs: "Especificações",
      provider: "Fornecedor",
      modality: "Modalidade",
      access: "Acesso",
      endpoints: "Endpoints",
      howToTitle: "Como usar a API do {model}",
      compareTitle: "{model} versus modelos semelhantes",
      colModel: "Modelo",
      colInputPrice: "Entrada / 1M",
      faqTitle: "Perguntas frequentes",
      relatedTitle: "Mais modelos da {vendor}",
      ctaTitle: "Comece a construir com {model}",
      ctaSubtitle:
        "Uma chave compatível com OpenAI, cobrança pré-paga e crédito de bônus na primeira recarga. Cadastre-se em menos de um minuto.",
    },
    coverage: "GPT, Claude, Gemini, DeepSeek, Seedance e mais de 500 modelos",
    modalityChat: "de chat e conclusão",
    modalityImage: "de geração de imagens",
    unitInput: "por 1M de tokens de entrada",
    unitOutput: "por 1M de tokens de saída",
    unitRequest: "por requisição",
    intro:
      "{model} é um modelo {modality} da {vendor} que você pode chamar pela API compatível com OpenAI da flatkey.ai. Na flatkey ele custa {inputDiscounted} {inputUnit}{savings} e {outputDiscounted} {outputUnit}. Uma única API key cobre {coverage}, então você troca de modelo sem mudar de SDK nem gerenciar várias contas. A cobrança é pré-paga, com análises de uso ao vivo e uma única fatura, o que mantém o gasto previsível conforme você escala.",
    savingsFull: "cerca de {savingsPct}% abaixo do preço de tabela oficial de {inputList}",
    savingsShort: "cerca de {savingsPct}% abaixo do preço de tabela oficial",
    cheaper: "cerca de {savingsPct}% mais barato",
    howTo: [
      {
        title: "Crie uma conta na flatkey.ai e uma API key",
        body: "Cadastre-se de graça e gere uma API key no console. Contas novas ganham crédito de bônus na primeira recarga.",
      },
      {
        title: "Aponte seu cliente OpenAI para a flatkey",
        body: "Defina base_url como {router} e use sua chave da flatkey como API key. Nenhuma outra mudança de código é necessária — a API é compatível com OpenAI.",
      },
      {
        title: "Chame {model}",
        body: 'Envie uma requisição com model definido como "{model}" usando o SDK da OpenAI ou curl. Copie um exemplo pronto para usar abaixo.',
      },
    ],
    faq: [
      {
        q: "Quanto custa a API do {model}?",
        a: "Na flatkey.ai, {model} custa {inputDiscounted} {inputUnit} e {outputDiscounted} {outputUnit}{savingsShort}. Recarregue $200 e ganhe $100 grátis para esticar o orçamento.",
      },
      {
        q: "O {model} é compatível com OpenAI?",
        a: 'Sim. Mantenha seu SDK da OpenAI, troque base_url para {router} e use sua chave da flatkey. O id do modelo continua "{model}".',
      },
      {
        q: "O {model} é gratuito?",
        a: "O uso é pago conforme o consumo, mas com preço bem abaixo da tabela oficial{cheaper}, e contas novas recebem crédito de bônus na primeira recarga, então dá para começar a testar com baixo custo.",
      },
      {
        q: "Como obtenho uma API key para o {model}?",
        a: "Cadastre-se na flatkey.ai, crie uma API key no console e adicione saldo pré-pago. Você pode começar a chamar o {model} em minutos.",
      },
      {
        q: "Que outros modelos posso usar com a mesma chave?",
        a: "Uma chave da flatkey te dá {coverage} por meio de um único endpoint compatível com OpenAI e uma só fatura.",
      },
      {
        q: "Quão confiável é o {model} na flatkey?",
        a: "Publicamos a taxa de sucesso, a taxa de transferência e a latência ao vivo dos últimos 30 dias do {model} nesta própria página, atualizadas com tráfego real.",
      },
    ],
  },
  ru: {
    ui: {
      ctaSignUp: "Получить API-ключ",
      saveVsOfficial: "Экономия ~{pct}% против официальной цены",
      specs: "Характеристики",
      provider: "Поставщик",
      modality: "Модальность",
      access: "Доступ",
      endpoints: "Эндпоинты",
      howToTitle: "Как использовать API {model}",
      compareTitle: "{model} против похожих моделей",
      colModel: "Модель",
      colInputPrice: "Ввод / 1М",
      faqTitle: "Частые вопросы",
      relatedTitle: "Ещё модели {vendor}",
      ctaTitle: "Начните разработку с {model}",
      ctaSubtitle:
        "Один ключ, совместимый с OpenAI, предоплатная тарификация и бонус при первом пополнении. Регистрация меньше чем за минуту.",
    },
    coverage: "GPT, Claude, Gemini, DeepSeek, Seedance и ещё 500+ моделей",
    modalityChat: "для чата и завершений",
    modalityImage: "для генерации изображений",
    unitInput: "за 1М входных токенов",
    unitOutput: "за 1М выходных токенов",
    unitRequest: "за запрос",
    intro:
      "{model} — это модель {modality} от {vendor}, которую можно вызвать через совместимый с OpenAI API flatkey.ai. На flatkey она стоит {inputDiscounted} {inputUnit}{savings} и {outputDiscounted} {outputUnit}. Один API-ключ покрывает {coverage}, поэтому вы переключаете модели без смены SDK и без отдельных аккаунтов. Тарификация предоплатная, с аналитикой использования в реальном времени и единым счётом, что делает расходы предсказуемыми при масштабировании.",
    savingsFull: "примерно на {savingsPct}% ниже официальной прайс-цены {inputList}",
    savingsShort: "примерно на {savingsPct}% ниже официальной прайс-цены",
    cheaper: "примерно на {savingsPct}% дешевле",
    howTo: [
      {
        title: "Создайте аккаунт flatkey.ai и API-ключ",
        body: "Зарегистрируйтесь бесплатно и создайте API-ключ в консоли. Новые аккаунты получают бонус при первом пополнении.",
      },
      {
        title: "Направьте клиент OpenAI на flatkey",
        body: "Укажите base_url как {router} и используйте свой ключ flatkey в качестве API-ключа. Больше никаких изменений в коде — API совместим с OpenAI.",
      },
      {
        title: "Вызовите {model}",
        body: 'Отправьте запрос с model, равным "{model}", через SDK OpenAI или curl. Готовый пример можно скопировать ниже.',
      },
    ],
    faq: [
      {
        q: "Сколько стоит API {model}?",
        a: "На flatkey.ai {model} стоит {inputDiscounted} {inputUnit} и {outputDiscounted} {outputUnit}{savingsShort}. Пополните на $200 и получите $100 бесплатно, чтобы растянуть бюджет.",
      },
      {
        q: "Совместим ли {model} с OpenAI?",
        a: 'Да. Оставьте свой SDK OpenAI, смените base_url на {router} и используйте ключ flatkey. Id модели остаётся "{model}".',
      },
      {
        q: "Бесплатен ли {model}?",
        a: "Оплата по факту использования, но цена значительно ниже официального прайса{cheaper}, а новые аккаунты получают бонус при первом пополнении, так что тестировать можно с малыми затратами.",
      },
      {
        q: "Как получить API-ключ для {model}?",
        a: "Зарегистрируйтесь на flatkey.ai, создайте API-ключ в консоли и внесите предоплату. Начать вызывать {model} можно за считанные минуты.",
      },
      {
        q: "Какие ещё модели доступны с тем же ключом?",
        a: "Один ключ flatkey даёт вам {coverage} через единый совместимый с OpenAI эндпоинт и один счёт.",
      },
      {
        q: "Насколько надёжен {model} на flatkey?",
        a: "Мы публикуем актуальные показатели за 30 дней — успешность, пропускную способность и задержку {model} — прямо на этой странице, по данным реального трафика.",
      },
    ],
  },
  ja: {
    ui: {
      ctaSignUp: "APIキーを取得",
      saveVsOfficial: "公式価格より約{pct}%お得",
      specs: "仕様",
      provider: "プロバイダー",
      modality: "モダリティ",
      access: "アクセス方法",
      endpoints: "エンドポイント",
      howToTitle: "{model} APIの使い方",
      compareTitle: "{model} と類似モデルの比較",
      colModel: "モデル",
      colInputPrice: "入力 / 100万",
      faqTitle: "よくある質問",
      relatedTitle: "その他の{vendor}モデル",
      ctaTitle: "{model} で開発を始める",
      ctaSubtitle: "OpenAI互換キー1本、前払い課金、初回チャージ特典。1分以内に登録できます。",
    },
    coverage: "GPT、Claude、Gemini、DeepSeek、Seedance など500以上のモデル",
    modalityChat: "チャット・補完",
    modalityImage: "画像生成",
    unitInput: "入力100万トークンあたり ",
    unitOutput: "出力100万トークンあたり ",
    unitRequest: "1回あたり ",
    intro:
      "{model} は {vendor} の{modality}モデルで、flatkey.ai のOpenAI互換API経由で呼び出せます。flatkey では{inputUnit}{inputDiscounted}{savings}、{outputUnit}{outputDiscounted} です。APIキー1本で {coverage} をカバーし、SDKを変えたり複数アカウントを管理したりせずにモデルを切り替えられます。課金は前払いで、リアルタイムの利用状況分析と1枚の請求書により、スケール時も支出を予測しやすく保てます。",
    savingsFull: "公式定価 {inputList} より約{savingsPct}%安い水準",
    savingsShort: "公式定価より約{savingsPct}%安い",
    cheaper: "約{savingsPct}%お得",
    howTo: [
      {
        title: "flatkey.aiのアカウントとAPIキーを作成",
        body: "無料で登録し、コンソールでAPIキーを発行します。新規アカウントは初回チャージで特典クレジットを受け取れます。",
      },
      {
        title: "OpenAIクライアントをflatkeyに向ける",
        body: "base_url を {router} に設定し、flatkeyのキーをAPIキーとして使います。他のコード変更は不要——APIはOpenAI互換です。",
      },
      {
        title: "{model} を呼び出す",
        body: 'OpenAI SDKまたはcurlで、model を "{model}" に設定してリクエストを送ります。下のすぐ使える例をコピーしてください。',
      },
    ],
    faq: [
      {
        q: "{model} APIの料金は？",
        a: "flatkey.ai では、{model} は{inputUnit}{inputDiscounted}、{outputUnit}{outputDiscounted}{savingsShort}。$200チャージで$100プレゼントされ、予算をさらに延ばせます。",
      },
      {
        q: "{model} はOpenAI互換ですか？",
        a: '互換です。既存のOpenAI SDKをそのままに、base_url を {router} に変え、flatkeyキーを使うだけ。モデルidは "{model}" のままです。',
      },
      {
        q: "{model} は無料ですか？",
        a: "従量課金ですが、公式定価より大幅に安く{cheaper}、新規アカウントは初回チャージで特典クレジットを受け取れるため、低コストでテストを始められます。",
      },
      {
        q: "{model} のAPIキーはどう取得しますか？",
        a: "flatkey.aiで登録し、コンソールでAPIキーを作成して前払い残高を追加します。数分で {model} の呼び出しを開始できます。",
      },
      {
        q: "同じキーで他にどのモデルを使えますか？",
        a: "flatkeyキー1本で、単一のOpenAI互換エンドポイントと1枚の請求書を通じて {coverage} を利用できます。",
      },
      {
        q: "flatkey上の {model} の信頼性は？",
        a: "{model} の直近30日の成功率・スループット・レイテンシを、実トラフィックに基づきこのページで公開しています。",
      },
    ],
  },
  vi: {
    ui: {
      ctaSignUp: "Lấy API key",
      saveVsOfficial: "Tiết kiệm ~{pct}% so với giá chính thức",
      specs: "Thông số",
      provider: "Nhà cung cấp",
      modality: "Phương thức",
      access: "Truy cập",
      endpoints: "Endpoint",
      howToTitle: "Cách dùng API {model}",
      compareTitle: "{model} so với các mô hình tương tự",
      colModel: "Mô hình",
      colInputPrice: "Đầu vào / 1M",
      faqTitle: "Câu hỏi thường gặp",
      relatedTitle: "Thêm mô hình {vendor}",
      ctaTitle: "Bắt đầu xây dựng với {model}",
      ctaSubtitle:
        "Một key tương thích OpenAI, thanh toán trả trước và tín dụng thưởng cho lần nạp đầu. Đăng ký trong chưa đầy một phút.",
    },
    coverage: "GPT, Claude, Gemini, DeepSeek, Seedance và hơn 500 mô hình khác",
    modalityChat: "trò chuyện và hoàn thành",
    modalityImage: "tạo ảnh",
    unitInput: "cho mỗi 1M token đầu vào",
    unitOutput: "cho mỗi 1M token đầu ra",
    unitRequest: "mỗi lượt gọi",
    intro:
      "{model} là mô hình {modality} của {vendor} mà bạn có thể gọi qua API tương thích OpenAI của flatkey.ai. Trên flatkey, giá là {inputDiscounted} {inputUnit}{savings} và {outputDiscounted} {outputUnit}. Một API key bao trùm {coverage}, nên bạn đổi mô hình mà không cần đổi SDK hay quản lý nhiều tài khoản. Thanh toán trả trước, kèm phân tích sử dụng thời gian thực và một hóa đơn duy nhất, giúp chi phí dễ dự đoán khi mở rộng.",
    savingsFull: "thấp hơn khoảng {savingsPct}% so với giá niêm yết chính thức {inputList}",
    savingsShort: "thấp hơn khoảng {savingsPct}% so với giá niêm yết chính thức",
    cheaper: "rẻ hơn khoảng {savingsPct}%",
    howTo: [
      {
        title: "Tạo tài khoản flatkey.ai và API key",
        body: "Đăng ký miễn phí, rồi tạo API key trong console. Tài khoản mới nhận tín dụng thưởng ở lần nạp đầu tiên.",
      },
      {
        title: "Trỏ client OpenAI của bạn tới flatkey",
        body: "Đặt base_url thành {router} và dùng key flatkey làm API key. Không cần thay đổi code nào khác — API tương thích OpenAI.",
      },
      {
        title: "Gọi {model}",
        body: 'Gửi yêu cầu với model đặt là "{model}" bằng SDK OpenAI hoặc curl. Sao chép ví dụ sẵn dùng bên dưới.',
      },
    ],
    faq: [
      {
        q: "API {model} giá bao nhiêu?",
        a: "Trên flatkey.ai, {model} có giá {inputDiscounted} {inputUnit} và {outputDiscounted} {outputUnit}{savingsShort}. Nạp $200 tặng $100 để kéo dài ngân sách.",
      },
      {
        q: "{model} có tương thích OpenAI không?",
        a: 'Có. Giữ nguyên SDK OpenAI, đổi base_url thành {router} và dùng key flatkey. Id mô hình vẫn là "{model}".',
      },
      {
        q: "{model} có miễn phí không?",
        a: "Tính theo mức dùng, nhưng giá thấp hơn nhiều so với bảng giá chính thức{cheaper}, và tài khoản mới nhận tín dụng thưởng ở lần nạp đầu, nên bạn có thể bắt đầu thử với chi phí thấp.",
      },
      {
        q: "Làm sao lấy API key cho {model}?",
        a: "Đăng ký trên flatkey.ai, tạo API key trong console và thêm số dư trả trước. Bạn có thể bắt đầu gọi {model} trong vài phút.",
      },
      {
        q: "Cùng một key còn dùng được những mô hình nào?",
        a: "Một key flatkey cho bạn {coverage} qua một endpoint tương thích OpenAI duy nhất và một hóa đơn.",
      },
      {
        q: "{model} trên flatkey đáng tin cậy đến đâu?",
        a: "Chúng tôi công bố tỷ lệ thành công, thông lượng và độ trễ 30 ngày gần nhất của {model} ngay trên trang này, cập nhật từ lưu lượng thực.",
      },
    ],
  },
  de: {
    ui: {
      ctaSignUp: "API-Key holen",
      saveVsOfficial: "Spare ~{pct}% gegenüber dem offiziellen Preis",
      specs: "Spezifikationen",
      provider: "Anbieter",
      modality: "Modalität",
      access: "Zugang",
      endpoints: "Endpunkte",
      howToTitle: "So nutzt du die {model}-API",
      compareTitle: "{model} im Vergleich zu ähnlichen Modellen",
      colModel: "Modell",
      colInputPrice: "Eingabe / 1M",
      faqTitle: "Häufige Fragen",
      relatedTitle: "Weitere {vendor}-Modelle",
      ctaTitle: "Leg los mit {model}",
      ctaSubtitle:
        "Ein OpenAI-kompatibler Key, Prepaid-Abrechnung und Bonusguthaben bei der ersten Aufladung. Registrierung in unter einer Minute.",
    },
    coverage: "GPT, Claude, Gemini, DeepSeek, Seedance und über 500 weitere Modelle",
    modalityChat: "Chat- und Completion-",
    modalityImage: "Bildgenerierungs-",
    unitInput: "pro 1M Eingabe-Tokens",
    unitOutput: "pro 1M Ausgabe-Tokens",
    unitRequest: "pro Anfrage",
    intro:
      "{model} ist ein {modality}Modell von {vendor}, das du über die OpenAI-kompatible API von flatkey.ai aufrufen kannst. Auf flatkey kostet es {inputDiscounted} {inputUnit}{savings} und {outputDiscounted} {outputUnit}. Ein API-Key deckt {coverage} ab, sodass du Modelle wechselst, ohne SDKs zu tauschen oder mehrere Konten zu verwalten. Die Abrechnung ist Prepaid, mit Live-Nutzungsanalysen und einer einzigen Rechnung, was die Ausgaben beim Skalieren planbar hält.",
    savingsFull: "etwa {savingsPct}% unter dem offiziellen Listenpreis von {inputList}",
    savingsShort: "etwa {savingsPct}% unter dem offiziellen Listenpreis",
    cheaper: "etwa {savingsPct}% günstiger",
    howTo: [
      {
        title: "flatkey.ai-Konto und API-Key erstellen",
        body: "Kostenlos registrieren und in der Konsole einen API-Key erzeugen. Neue Konten erhalten bei der ersten Aufladung Bonusguthaben.",
      },
      {
        title: "Richte deinen OpenAI-Client auf flatkey aus",
        body: "Setze base_url auf {router} und nutze deinen flatkey-Key als API-Key. Weitere Codeänderungen sind nicht nötig — die API ist OpenAI-kompatibel.",
      },
      {
        title: "{model} aufrufen",
        body: 'Sende eine Anfrage mit model = "{model}" über das OpenAI-SDK oder curl. Kopiere unten ein sofort lauffähiges Beispiel.',
      },
    ],
    faq: [
      {
        q: "Was kostet die {model}-API?",
        a: "Auf flatkey.ai kostet {model} {inputDiscounted} {inputUnit} und {outputDiscounted} {outputUnit}{savingsShort}. Lade $200 auf und erhalte $100 gratis, um dein Budget zu strecken.",
      },
      {
        q: "Ist {model} OpenAI-kompatibel?",
        a: 'Ja. Behalte dein OpenAI-SDK, ändere base_url auf {router} und nutze deinen flatkey-Key. Die Modell-ID bleibt "{model}".',
      },
      {
        q: "Ist {model} kostenlos?",
        a: "Die Nutzung erfolgt nach Verbrauch, aber deutlich unter dem offiziellen Listenpreis{cheaper}, und neue Konten erhalten bei der ersten Aufladung Bonusguthaben — so kannst du günstig mit dem Testen beginnen.",
      },
      {
        q: "Wie bekomme ich einen API-Key für {model}?",
        a: "Registriere dich auf flatkey.ai, erstelle in der Konsole einen API-Key und lade Prepaid-Guthaben auf. Du kannst {model} in wenigen Minuten aufrufen.",
      },
      {
        q: "Welche anderen Modelle kann ich mit demselben Key nutzen?",
        a: "Ein flatkey-Key gibt dir {coverage} über einen einzigen OpenAI-kompatiblen Endpunkt und eine Rechnung.",
      },
      {
        q: "Wie zuverlässig ist {model} auf flatkey?",
        a: "Wir veröffentlichen die Live-Erfolgsquote, den Durchsatz und die Latenz der letzten 30 Tage für {model} direkt auf dieser Seite, aktualisiert aus echtem Traffic.",
      },
    ],
  },
};
