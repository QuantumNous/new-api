"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type MouseEvent, type ReactNode } from "react";
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  Code2,
  Copy,
  ExternalLink,
  FileText,
  ImageIcon,
  Layers3,
  Minus,
  Music2,
  Play,
  Plus,
  Settings2,
  ShieldCheck,
  Sparkles,
  Timer,
  Trash2,
  Upload,
  Video,
  WandSparkles,
  Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { localizePath, type Locale } from "@/lib/locales";
import {
  modelLandingCopy,
  normalizeModelId,
  type ModelConfig,
  type ModelGeneratorField,
  type ModelLandingKey,
} from "@/lib/model-landing";
import { consoleUrl } from "@/lib/origins";
import {
  formatModelPrice,
  isTokenBasedModel,
  type PricingModel,
} from "@/lib/pricing";

type Props = {
  config: ModelConfig;
  locale: Locale;
  liveModels?: PricingModel[];
};

type GtagWindow = Window & {
  gtag?: (...args: unknown[]) => void;
};

type DraftValue = Record<string, unknown>;

type MediaExample = {
  poster: string;
  video?: string;
};

type ReferenceImageDraft = {
  id: string;
  name: string;
  size: number;
  type: string;
  previewUrl: string;
};

const MEDIA_EXAMPLES: Record<"image" | "video" | "audio", readonly MediaExample[]> = {
  image: [
    { poster: "/assets/prompts/awesome-images/gpt-image-2-showcase-complex.png" },
    { poster: "/assets/prompts/awesome-images/ecommerce-skincare.png" },
    { poster: "/assets/prompts/awesome-images/ugc-coffee-ad.png" },
  ],
  video: [
    { poster: "/assets/video/v1.1.jpg", video: "/assets/video/v1.1.mp4" },
    { poster: "/assets/video/v1.2.jpg", video: "/assets/video/v1.2.mp4" },
    { poster: "/assets/video/v1.3.jpg", video: "/assets/video/v1.3.mp4" },
  ],
  audio: [
    { poster: "/assets/prompts/awesome-images/ai-agent-poster.png" },
    { poster: "/assets/prompts/awesome-images/liquid-bento.png" },
    { poster: "/assets/prompts/awesome-images/campaign-hero.png" },
  ],
} as const;

export function ModelLandingPage({ config, locale, liveModels = [] }: Props) {
  const [prompt, setPrompt] = useState(config.examplePrompt);
  const [fieldValues, setFieldValues] = useState<Record<string, string | number | boolean>>(() =>
    buildInitialGeneratorValues(config)
  );
  const [referenceImages, setReferenceImages] = useState<ReferenceImageDraft[]>([]);
  const generator = config.generator;
  const mediaKind = generator?.kind ?? "text";
  const t = (key: string, vars?: Record<string, string>) => modelLandingCopy(locale, key as ModelLandingKey, vars);
  const primaryLiveModel =
    liveModels.find((model) => normalizeModelId(model.model_name) === normalizeModelId(config.modelId)) ??
    liveModels[0] ??
    null;

  useEffect(() => {
    (window as GtagWindow).gtag?.("event", "flatkey_model_page_view", {
      model: config.slug,
      lng: locale,
    });
  }, [config.slug, locale]);

  const buildDraft = (): DraftValue => ({
    source: "model_landing",
    model: config.modelId,
    slug: config.slug,
    mediaKind,
    endpoint: generator?.endpoint ?? "/v1/chat/completions",
    storageKey: generator?.storageKey ?? "flatkey:model-generator-draft",
    prompt,
    fields: fieldValues,
    referenceImages: referenceImages.map(({ name, size, type }) => ({ name, size, type })),
    request: buildGeneratorRequest(config, prompt, fieldValues, referenceImages),
    locale,
    savedAt: new Date().toISOString(),
  });

  const onRunClick = (event: MouseEvent<HTMLAnchorElement>) => {
    (window as GtagWindow).gtag?.("event", "flatkey_sign_in_to_run_click", {
      model: config.slug,
      media_kind: mediaKind,
    });
    const draft = buildDraft();
    window.localStorage.setItem(generator?.storageKey ?? "flatkey:model-generator-draft", JSON.stringify(draft));
    event.currentTarget.href = withCurrentSearch(buildRunHref(config, locale, prompt, draft));
  };

  if (generator) {
    return (
      <MediaModelLanding
        config={config}
        locale={locale}
        prompt={prompt}
        fieldValues={fieldValues}
        referenceImages={referenceImages}
        onPromptChange={setPrompt}
        onFieldChange={(name, value) => setFieldValues((current) => ({ ...current, [name]: value }))}
        onReferenceImagesChange={setReferenceImages}
        onRunClick={onRunClick}
        primaryLiveModel={primaryLiveModel}
        t={t}
      />
    );
  }

  return (
    <TextModelGuide
      config={config}
      locale={locale}
      prompt={prompt}
      onRunClick={onRunClick}
      primaryLiveModel={primaryLiveModel}
      t={t}
    />
  );
}

function MediaModelLanding(props: {
  config: ModelConfig;
  locale: Locale;
  prompt: string;
  fieldValues: Record<string, string | number | boolean>;
  referenceImages: ReferenceImageDraft[];
  onPromptChange: (prompt: string) => void;
  onFieldChange: (name: string, value: string | number | boolean) => void;
  onReferenceImagesChange: (images: ReferenceImageDraft[]) => void;
  onRunClick: (event: MouseEvent<HTMLAnchorElement>) => void;
  primaryLiveModel: PricingModel | null;
  t: (key: string, vars?: Record<string, string>) => string;
}) {
  const generator = props.config.generator!;
  const examples = MEDIA_EXAMPLES[generator.kind];
  const runHref = buildRunHref(props.config, props.locale, props.prompt, {
    model: props.config.modelId,
    prompt: props.prompt,
    fields: props.fieldValues,
  });
  const Icon = generator.kind === "video" ? Video : generator.kind === "audio" ? Music2 : ImageIcon;
  const pricingRows = buildMediaPricingRows(props.config);

  return (
    <SiteShell locale={props.locale} pathname={`/models/${props.config.slug}`}>
      <div className="model-square-page bg-[linear-gradient(180deg,#f4f0ff_0%,#fbfaff_32%,#ffffff_62%,#f4f1ff_100%)] text-[#0B0B0F] dark:bg-[linear-gradient(180deg,#050712_0%,#080b18_36%,#070712_72%,#03040b_100%)] dark:text-white">
        <div className="px-6 pt-10 pb-8 sm:px-8 lg:px-10 lg:pt-14">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <Link
              href={localizePath("/models", props.locale)}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-[#0B0B0F14] bg-white px-5 text-sm font-bold shadow-sm hover:border-[#7c3aed]/35 hover:text-[#4c1d95]"
            >
              <ArrowRight className="size-3 rotate-180" />
              {props.t("Back to Market")}
            </Link>
          </div>

          <section className="grid gap-6 pb-5">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <span className="grid size-8 place-items-center rounded-full bg-[#f4f0ff] text-[#7c3aed]">
                  <Icon className="size-4" />
                </span>
                <h1 className="text-[clamp(2.25rem,5vw,3.7rem)] leading-none font-extrabold tracking-tight">
                  {props.config.displayName}
                </h1>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(props.config.modelId).catch(() => undefined)}
                  className="rounded-full border border-[#0B0B0F14] bg-white p-1.5 text-[#706a74] hover:border-[#7c3aed]/35 hover:text-[#4c1d95]"
                  aria-label={props.t("Copy model id")}
                >
                  <Copy className="size-3.5" />
                </button>
              </div>
              <div className="mb-4 inline-flex rounded-full border border-[#ded6f4] bg-[#f4f0ff] px-3.5 py-1.5 text-[13px] font-extrabold text-[#4c1d95]">
                {props.t("Flatkey Router")}
              </div>
              <p className="max-w-3xl text-[17px] leading-8 text-[#43434c]">
                {props.t("Configure a {{model}} request on the public page. Flatkey saves the draft locally, then opens the console so you can run it with your account and API key.", {
                  model: props.config.displayName,
                })}
              </p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <Pill label={props.t("Model Type")} value={generator.kind === "video" ? props.t("Text to Video") : generator.kind === "audio" ? props.t("Audio") : props.t("Image to Image")} />
                <Pill label={props.t("API")} value={generator.endpoint} />
                <Pill label={props.t("Pricing")} value={`${props.config.flatkeyPrice} ${props.t(props.config.priceUnit)}`} />
              </div>
            </div>
          </section>

        </div>

        <section id="playground" className="border-y border-[#0B0B0F14] bg-[#f8f6fc] py-8">
          <div className="px-6 sm:px-8 lg:px-10">
            <div className="grid overflow-hidden rounded-2xl border border-[#0B0B0F14] bg-white shadow-[0_24px_70px_-46px_rgba(46,16,101,.26)] lg:grid-cols-[minmax(0,0.9fr)_minmax(390px,1.1fr)] xl:grid-cols-[minmax(0,0.86fr)_minmax(430px,1.14fr)]">
              <div className="min-w-0 border-b border-[#0B0B0F14] p-4 sm:p-5 lg:border-r lg:border-b-0 xl:p-6">
                <PanelHeader title={props.t("Input")} right={props.t("Form")} />
                <MediaPromptEditor
                  generator={generator}
                  modelId={props.config.modelId}
                  prompt={props.prompt}
                  fieldValues={props.fieldValues}
                  referenceImages={props.referenceImages}
                  onPromptChange={props.onPromptChange}
                  onFieldChange={props.onFieldChange}
                  onReferenceImagesChange={props.onReferenceImagesChange}
                  t={props.t}
                />
                <a
                  href={runHref}
                  onClick={props.onRunClick}
                  className="mt-5 flex h-12 items-center justify-center gap-2 rounded-full bg-[#070707] text-base font-extrabold !text-white shadow-[0_18px_42px_-24px_rgba(11,11,15,.46)] hover:bg-[#1a1a1d]"
                  style={{ color: "#fff" }}
                >
                  <WandSparkles className="size-4" />
                  {props.t("Start generating")}
                  <span className="text-white/75">·</span>
                  <span className="text-sm font-semibold text-white/85">{props.t("Join and run")}</span>
                </a>
              </div>

              <div className="min-w-0 p-4 sm:p-5 xl:p-6">
                <PanelHeader title={props.t("Output")} right={props.t("Preview")} />
                <OutputPreview
                  modelName={props.config.displayName}
                  prompt={props.prompt}
                  kind={generator.kind}
                  images={examples}
                  t={props.t}
                />
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <a
                    href={localizePath("/docs", props.locale)}
                    className="rounded-full border border-[#0B0B0F14] px-4 py-2.5 text-center text-sm font-bold hover:border-[#7c3aed]/35 hover:text-[#4c1d95]"
                  >
                    {props.t("View API Docs")}
                  </a>
                  <a
                    href={runHref}
                    onClick={props.onRunClick}
                    className="rounded-full border border-[#0B0B0F14] px-4 py-2.5 text-center text-sm font-bold hover:border-[#7c3aed]/35 hover:text-[#4c1d95]"
                  >
                    {props.t("Get API Key")}
                  </a>
                </div>
              </div>
            </div>
            <RequestPreview
              config={props.config}
              prompt={props.prompt}
              fieldValues={props.fieldValues}
              referenceImages={props.referenceImages}
              t={props.t}
            />
          </div>
        </section>

        <section id="examples" className="px-6 py-12 sm:px-8 lg:px-10">
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard value="2M+" label={props.t(generator.kind === "video" ? "Videos generated" : "Images generated")} />
            <StatCard value="8s" label={props.t("Avg. response time")} />
            <StatCard value="99.9%" label={props.t("Uptime")} />
            <StatCard value="API" label={props.t("Ready for production")} />
          </div>

          <div className="mt-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-xs font-extrabold tracking-[0.16em] text-[#7c3aed] uppercase">
                {props.t("Generated Examples")}
              </div>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight">
                {props.t("Explore what {{model}} can create", { model: props.config.displayName })}
              </h2>
            </div>
            <a href={runHref} onClick={props.onRunClick} className="inline-flex items-center gap-2 text-base font-bold">
              {props.t("Create with this model")}
              <ArrowRight className="size-4" />
            </a>
          </div>
          <div className={`mt-5 grid gap-4 ${generator.kind === "image" ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
            {examples.map((example, index) => (
              <GeneratedExampleCard
                key={example.video ?? example.poster}
                example={example}
                index={index}
                modelName={props.config.displayName}
                featured={generator.kind === "image" && index === 0}
                t={props.t}
              />
            ))}
          </div>
        </section>

        <section className="border-y border-[#0B0B0F0D] bg-[#f8f6fc] py-12">
          <div className="px-6 sm:px-8 lg:px-10">
            <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-xs font-extrabold tracking-[0.16em] text-[#7c3aed] uppercase">
                  {props.t("Transparent Pricing")}
                </div>
                <h2 className="mt-2 text-3xl font-extrabold tracking-tight">
                  {props.t("Flatkey {{model}} usage pricing", { model: props.config.displayName })}
                </h2>
                <p className="mt-2 max-w-2xl text-base leading-7 text-[#706a74]">
                  {props.t("Use the same Flatkey balance and API key across image, video, audio, and text models.")}
                </p>
              </div>
              <a
                href={runHref}
                onClick={props.onRunClick}
                className="inline-flex h-11 items-center rounded-full bg-[#070707] px-5 text-sm font-extrabold !text-white hover:bg-[#1a1a1d]"
                style={{ color: "#fff" }}
              >
                {props.t("Open wallet")}
              </a>
            </div>
            <div className="overflow-hidden rounded-2xl border border-[#0B0B0F14] bg-white">
              <div className="hidden grid-cols-[1fr_1fr_0.75fr_1fr] gap-5 border-b border-[#0B0B0F14] px-6 py-4 text-xs font-extrabold tracking-[0.14em] text-[#706a74] uppercase md:grid">
                <span>{props.t("Model Type")}</span>
                <span>{props.t("Flatkey price")}</span>
                <span className="text-center">{props.t("Pricing vs official")}</span>
                <span>{props.t("Reference price")}</span>
              </div>
              {pricingRows.map((row) => (
                <div key={row.spec} className="grid gap-4 border-b border-[#0B0B0F0D] px-5 py-5 text-base last:border-b-0 md:grid-cols-[1fr_1fr_0.75fr_1fr] md:items-center md:px-6">
                  <div className="flex items-center gap-2 font-extrabold">
                    <span className="size-2 rounded-full bg-[#7c3aed]" />
                    {row.spec}
                  </div>
                  <PriceBox label={props.t("Flatkey price")} value={row.flatkey} />
                  <div className="text-sm font-extrabold text-emerald-600 md:text-center">
                    <span className="block text-lg leading-none">{formatSavings(row.flatkey, row.official)}</span>
                    <span className="mt-1 block text-[10px] tracking-[0.14em] text-emerald-600/70 uppercase">vs {props.config.officialName}</span>
                  </div>
                  <PriceBox label={props.t("Reference price")} value={row.official} muted />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 py-12 sm:px-8 lg:px-10">
          <div className="text-xs font-extrabold tracking-[0.16em] text-[#7c3aed] uppercase">
            {props.t("Why Flatkey")}
          </div>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight">
            {props.t("Why use Flatkey for {{model}}?", { model: props.config.displayName })}
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <ReasonCard icon={<Zap className="size-5" />} title={props.t("Lower generation pricing")} body={props.t("Route media workloads through Flatkey and keep prompt tests cheaper before scaling.")} />
            <ReasonCard icon={<Sparkles className="size-5" />} title={props.t("Draft handoff")} body={props.t("The public page stores prompt settings locally before sending the user into Flatkey.")} />
            <ReasonCard icon={<Code2 className="size-5" />} title={props.t("Unified API access")} body={props.t("Use one account and API key across image, video, audio, and language models.")} />
          </div>
        </section>

        <section className="grid gap-5 px-6 pb-12 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:px-10">
          <div className="rounded-2xl border border-[#0B0B0F14] bg-white p-7 shadow-sm xl:p-8">
            <div className="mb-5 grid size-10 place-items-center rounded-full bg-[#f4f0ff] text-[#7c3aed]">
              <Code2 className="size-5" />
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight">{props.t("Start generating in three steps")}</h2>
            <ol className="mt-5 grid gap-4">
              {[
                [props.t("Try a prompt"), props.t("Use the playground to validate quality and style fit.")],
                [props.t("Create an API key"), props.t("Sign up, open Dashboard, and create a token for this model.")],
                [props.t("Ship your workflow"), props.t("Call the same endpoint, then top up credits as usage grows.")],
              ].map(([title, body], index) => (
                <li key={title} className="grid grid-cols-[auto_1fr] gap-3">
                  <span className="grid size-7 place-items-center rounded-full bg-[#070707] text-sm font-extrabold text-white">{index + 1}</span>
                  <span>
                    <b className="block text-sm">{title}</b>
                    <span className="text-sm leading-6 text-[#706a74]">{body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-2xl bg-[#0d0d10] p-7 text-white shadow-[0_24px_80px_-60px_rgba(0,0,0,.9)] xl:p-8">
            <div className="mb-5 grid size-10 place-items-center rounded-full bg-white/10">
              <ImageIcon className="size-5" />
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight">{props.t("Built for generation teams")}</h2>
            <div className="mt-5 grid gap-3">
              {[
                [props.t("Ads and social creative"), props.t("Produce campaign concepts, thumbnails, posters, and localized variants.")],
                [props.t("Product visuals"), props.t("Generate product-style shots, merchandising scenes, and reference-guided variations.")],
                [props.t("Developer pipelines"), props.t("Add async generation for agents, CMS tools, and batch creative systems.")],
              ].map(([title, body]) => (
                <div key={title} className="rounded-xl bg-white/8 p-4">
                  <b className="text-sm">{title}</b>
                  <p className="mt-1 text-sm leading-6 text-white/68">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-5 px-6 pb-12 sm:px-8 lg:grid-cols-[1.3fr_0.8fr] lg:px-10">
          <div>
            <div className="text-xs font-extrabold tracking-[0.16em] text-[#7c3aed] uppercase">FAQ</div>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight">
              {props.t("{{model}} pricing FAQ", { model: props.config.displayName })}
            </h2>
            <div className="mt-5 grid gap-3">
              {props.config.faq.map((item) => (
                <details key={item.question} className="rounded-xl border border-[#0B0B0F14] bg-white px-4 py-3 text-sm">
                  <summary className="cursor-pointer font-extrabold">{props.t(item.question)}</summary>
                  <p className="mt-2 leading-6 text-[#706a74]">{props.t(item.answer)}</p>
                </details>
              ))}
            </div>
          </div>
          <div className="self-start rounded-2xl bg-[#0d0d10] p-6 text-white shadow-[0_24px_80px_-54px_rgba(0,0,0,.9)]">
            <div className="mb-4 text-sm font-bold text-white/55">{props.config.displayName} API</div>
            <h3 className="text-2xl font-extrabold tracking-tight">
              {props.t("Generate your first {{model}} on Flatkey", { model: props.config.displayName })}
            </h3>
            <p className="mt-3 text-sm leading-6 text-white/62">
              {props.t("Save the draft, continue to signup if needed, or open the console directly when already logged in.")}
            </p>
            <a
              href={runHref}
              onClick={props.onRunClick}
              className="mt-5 flex h-11 items-center justify-center rounded-xl bg-white text-sm font-extrabold !text-[#4c1d95] hover:bg-[#f4f0ff]"
              style={{ color: "#4c1d95" }}
            >
              {props.t("Start generating")}
            </a>
          </div>
        </section>
      </div>
    </SiteShell>
  );
}

function TextModelGuide(props: {
  config: ModelConfig;
  locale: Locale;
  prompt: string;
  onRunClick: (event: MouseEvent<HTMLAnchorElement>) => void;
  primaryLiveModel: PricingModel | null;
  t: (key: string, vars?: Record<string, string>) => string;
}) {
  const runHref = buildRunHref(props.config, props.locale, props.prompt, {
    model: props.config.modelId,
    prompt: props.prompt,
  });
  const updated = new Date().toISOString().slice(0, 10);
  const price =
    props.primaryLiveModel && isTokenBasedModel(props.primaryLiveModel)
      ? `${formatModelPrice(props.primaryLiveModel, "input")} in / ${formatModelPrice(props.primaryLiveModel, "output")} out`
      : `${props.config.flatkeyPrice} ${props.t(props.config.priceUnit)}`;
  const features = buildTextGuideFeatures(props.config, props.t);

  return (
    <SiteShell locale={props.locale} pathname={`/models/${props.config.slug}`}>
      <div className="model-square-page bg-[linear-gradient(180deg,#f4f0ff_0%,#fbfaff_32%,#ffffff_62%,#f4f1ff_100%)] text-[#161821] dark:bg-[linear-gradient(180deg,#050712_0%,#080b18_36%,#070712_72%,#03040b_100%)] dark:text-white">
        <div className="mx-auto max-w-[1030px] px-5 pt-10 pb-16 sm:px-6 lg:pt-14">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <Link
              href={localizePath("/models", props.locale)}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-black/10 bg-white px-4 text-xs font-bold shadow-sm"
            >
              <ArrowRight className="size-3 rotate-180" />
              {props.t("Back to Market")}
            </Link>
            <div className="flex gap-2">
              <a href="#overview" className="inline-flex h-9 items-center gap-2 rounded-full border border-black/10 bg-white px-4 text-xs font-bold shadow-sm">
                <BookOpen className="size-3.5" />
                Markdown
              </a>
            </div>
          </div>

          <section className="grid overflow-hidden rounded-3xl border border-black/10 bg-white shadow-[0_24px_80px_-62px_rgba(15,15,18,.75)] lg:grid-cols-[1.3fr_0.9fr]">
            <div className="p-7 md:p-9">
              <div className="text-[11px] font-extrabold tracking-[0.18em] text-[#8b8891] uppercase">
                {props.t("Model Guide")}
              </div>
              <h1 className="mt-3 text-[clamp(2rem,5vw,3.5rem)] leading-none font-extrabold tracking-tight">
                {props.config.modelId}
              </h1>
              <p className="mt-4 max-w-2xl text-[15px] leading-7 text-[#5f5d67]">
                {props.t("{{model}} is a production text model for chat, coding, long-context reasoning, and tool-enabled workflows through Flatkey-compatible API access.", {
                  model: props.config.modelId,
                })}
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <GuideFact label={props.t("Vendor")} value={props.config.officialName} />
                <GuideFact label={props.t("Modalities")} value={props.t("Text")} />
                <GuideFact label={props.t("Price")} value={price} />
                <GuideFact label={props.t("Updated")} value={updated} />
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={runHref}
                  onClick={props.onRunClick}
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-[#070707] px-5 text-sm font-extrabold !text-white"
                  style={{ color: "#fff" }}
                >
                  <Play className="size-4 fill-current" />
                  {props.t("Open in Playground")}
                </a>
                <Link
                  href={localizePath("/docs", props.locale)}
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-black/10 bg-white px-5 text-sm font-bold"
                >
                  {props.t("Docs")}
                  <ExternalLink className="size-3.5" />
                </Link>
              </div>
            </div>
            <div className="border-t border-black/10 p-7 md:p-9 lg:border-t-0 lg:border-l">
              <div className="text-[11px] font-extrabold tracking-[0.18em] text-[#8b8891] uppercase">
                {props.t("Model ID")}
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#f2f0ed] p-3 font-mono text-xs font-bold">
                <span className="min-w-0 flex-1 truncate">{props.config.modelId}</span>
                <Copy className="size-4 text-[#8b8891]" />
              </div>
            </div>
          </section>

          <section id="overview" className="mt-6 rounded-3xl border border-black/10 bg-white p-6 shadow-[0_24px_80px_-62px_rgba(15,15,18,.75)] md:p-8">
            <h2 className="text-xl font-extrabold tracking-tight">{props.t("Model Overview")}</h2>
            <div className="mt-5">
              <h3 className="text-sm font-extrabold">{props.t("Quick Answer")}</h3>
              <ul className="mt-2 grid gap-2 text-sm leading-6 text-[#65636b]">
                <li>• {props.t("Best for chat, code generation, agent workflows, and production assistants.")}</li>
                <li>• {props.t("Use Flatkey when you want OpenAI-compatible routing, unified billing, and reusable API keys.")}</li>
                <li>• {props.t("Start with the default parameters, then tune max tokens and temperature for your workload.")}</li>
              </ul>
            </div>

            <div className="mt-8 text-center">
              <h2 className="text-2xl font-extrabold tracking-tight">
                {props.t("{{model}} Model Features", { model: props.config.modelId })}
              </h2>
              <p className="mt-1 text-xs text-[#77747d]">{props.t("Core capabilities and practical engineering value")}</p>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {features.map((feature) => (
                <FeatureCard key={feature.title} icon={feature.icon} title={feature.title} body={feature.body} />
              ))}
            </div>

            <div className="mt-7">
              <h3 className="text-sm font-extrabold">{props.t("How to Use {{model}} API", { model: props.config.modelId })}</h3>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-[#65636b]">
                <li>{props.t("Create an API key and set Authorization: Bearer <YOUR_API_KEY>.")}</li>
                <li>{props.t("POST to /v1/chat/completions with at least model and messages.")}</li>
                <li>{props.t("Tune max_tokens, temperature, and top_p based on task complexity.")}</li>
                <li>{props.t("Enable streaming for chat UIs, terminal assistants, and agent workflows.")}</li>
                <li>{props.t("Use logs and retries to refine prompts before broader rollout.")}</li>
              </ol>
            </div>

            <div className="mt-7">
              <h3 className="text-sm font-extrabold">{props.t("Common Errors")}</h3>
              <div className="mt-3 grid gap-3">
                {[
                  ["400 invalid_request_error", props.t("Missing required fields, malformed messages, or unsupported parameter values.")],
                  ["401 authentication_error", props.t("Missing Authorization header, malformed bearer token, or invalid API key.")],
                  ["429 rate_limit_error", props.t("Request rate, concurrency, or quota is above current account limits.")],
                  ["500 internal_error", props.t("Transient upstream instability, tool execution failure, or processing issue.")],
                ].map(([title, body]) => (
                  <div key={title} className="rounded-xl border border-black/10 bg-[#fbfaf7] p-4 text-sm">
                    <b>{title}</b>
                    <p className="mt-1 leading-6 text-[#65636b]">{body}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8">
              <h3 className="text-sm font-extrabold">FAQ</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {props.config.faq.map((item) => (
                  <details key={item.question} className="rounded-xl border border-black/10 bg-[#fbfaf7] p-4 text-sm">
                    <summary className="cursor-pointer font-extrabold">{props.t(item.question)}</summary>
                    <p className="mt-2 leading-6 text-[#65636b]">{props.t(item.answer)}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>

          <section className="py-20 text-center">
            <h2 className="text-4xl font-extrabold tracking-tight">{props.t("Ready to unify your AI model access?")}</h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-[#65636b]">
              {props.t("Use one Flatkey account to test prompts, compare models, and move the saved request into the console.")}
            </p>
            <div className="mt-7 flex justify-center gap-3">
              <a
                href={runHref}
                onClick={props.onRunClick}
                className="inline-flex h-12 items-center gap-2 rounded-full bg-[#070707] px-7 text-sm font-extrabold !text-white"
                style={{ color: "#fff" }}
              >
                {props.t("Start generating")}
                <ArrowRight className="size-4" />
              </a>
              <Link href={localizePath("/pricing", props.locale)} className="inline-flex h-12 items-center rounded-full border border-black/10 bg-white px-7 text-sm font-bold">
                {props.t("View Pricing")}
              </Link>
            </div>
          </section>
        </div>
      </div>
    </SiteShell>
  );
}

function MediaPromptEditor(props: {
  generator: NonNullable<ModelConfig["generator"]>;
  modelId: string;
  prompt: string;
  fieldValues: Record<string, string | number | boolean>;
  referenceImages: ReferenceImageDraft[];
  onPromptChange: (prompt: string) => void;
  onFieldChange: (name: string, value: string | number | boolean) => void;
  onReferenceImagesChange: (images: ReferenceImageDraft[]) => void;
  t: (key: string, vars?: Record<string, string>) => string;
}) {
  const fields = useMemo(() => props.generator.fields, [props.generator.fields]);
  const quickPrompts = props.generator.kind === "video"
    ? ["Product Reveal", "UGC Ad", "Cinematic Scene", "Social Clip"]
    : ["Product Photo", "Anime Portrait", "Realistic Human", "YouTube Thumbnail", "Fantasy Landscape"];
  const supportsReferenceImages = props.generator.kind === "image";

  const onReferenceInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    if (files.length === 0) return;
    const remainingSlots = Math.max(0, 4 - props.referenceImages.length);
    const nextImages = files.slice(0, remainingSlots).map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}`,
      name: file.name,
      size: file.size,
      type: file.type || "image",
      previewUrl: URL.createObjectURL(file),
    }));
    props.onReferenceImagesChange([...props.referenceImages, ...nextImages]);
    event.currentTarget.value = "";
  };

  const removeReferenceImage = (image: ReferenceImageDraft) => {
    URL.revokeObjectURL(image.previewUrl);
    props.onReferenceImagesChange(props.referenceImages.filter((item) => item.id !== image.id));
  };

  return (
    <>
      <label className="block text-sm font-extrabold text-[#2c2d33]">
        {props.t("Prompt")}
        <textarea
          value={props.prompt}
          onChange={(event) => props.onPromptChange(event.target.value)}
          className="mt-2 min-h-[140px] w-full resize-y rounded-[1.1rem] border border-[#ded8ea] bg-[#fcfbff] p-4 font-mono text-sm leading-6 font-medium text-[#20222a] shadow-[0_10px_28px_-26px_rgba(76,29,149,.72)] outline-none transition focus:border-[#7c3aed] focus:bg-white focus:ring-4 focus:ring-[#7c3aed]/10"
        />
      </label>
      <div className="mt-2 text-right text-xs font-medium text-[#8b8891]">
        {props.prompt.length} / 10000
      </div>
      <div className="mt-5">
        <div className="mb-3 text-sm font-extrabold text-[#2c2d33]">{props.t("Quick Prompts")}</div>
        <div className="flex flex-wrap gap-2.5">
          {quickPrompts.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => props.onPromptChange(buildQuickPrompt(item, props.generator.kind))}
              className="rounded-xl border border-[#e4deed] bg-[#fcfbff] px-3.5 py-2 text-[13px] font-bold text-[#4f4d56] shadow-[0_10px_20px_-18px_rgba(76,29,149,.45)] transition hover:border-[#7c3aed]/45 hover:bg-white hover:text-[#4c1d95]"
            >
              {props.t(item)}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-6">
        <div className="rounded-[1.35rem] border border-[#e2dbea] bg-[linear-gradient(180deg,#ffffff_0%,#fbf9ff_100%)] p-4 shadow-[0_18px_38px_-32px_rgba(76,29,149,.55)] sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="text-sm font-extrabold text-[#2c2d33]">{props.t("Advanced Options")}</div>
          </div>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-6">
            {fields.map((field) => (
              <div key={field.name} className={generatorFieldColumnClass(props.generator.kind, field)}>
                <GeneratorFieldControl
                  kind={props.generator.kind}
                  field={field}
                  value={props.fieldValues[field.name] ?? field.defaultValue}
                  onChange={(value) => props.onFieldChange(field.name, value)}
                  t={props.t}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
      {supportsReferenceImages ? (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-sm font-extrabold text-[#2c2d33]">{props.t("Reference Images")}</div>
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-black/10 bg-white px-4 text-sm font-bold text-[#4f4d56] hover:border-[#7c3aed] hover:text-[#4c1d95]">
              <Upload className="size-3.5" />
              {props.t("Upload reference")}
              <input type="file" accept="image/*" multiple className="sr-only" onChange={onReferenceInputChange} />
            </label>
          </div>
          {props.referenceImages.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {props.referenceImages.map((image) => (
                <div key={image.id} className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 rounded-xl border border-black/10 bg-[#fbfaff] p-3">
                  <div className="relative aspect-square overflow-hidden rounded-lg bg-white">
                    <Image src={image.previewUrl} alt="" fill sizes="52px" className="object-cover" unoptimized />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-extrabold text-[#2c2d33]">{image.name}</div>
                    <div className="mt-0.5 text-[10px] font-medium text-[#8b8891]">{formatUploadedSize(image.size)}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeReferenceImage(image)}
                    className="grid size-8 place-items-center rounded-full text-[#706a74] hover:bg-white hover:text-[#4c1d95]"
                    aria-label="Remove reference image"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function GeneratorFieldControl(props: {
  kind: NonNullable<ModelConfig["generator"]>["kind"];
  field: ModelGeneratorField;
  value: string | number | boolean;
  onChange: (value: string | number | boolean) => void;
  t: (key: string, vars?: Record<string, string>) => string;
}) {
  const optionCount = props.field.options?.length ?? 0;
  const canUseSegmented =
    props.field.type === "select" && optionCount > 0 && (optionCount <= 4 || (props.kind === "video" && props.field.name === "ratio"));

  if (props.field.type === "boolean") {
    return (
      <label className="flex min-h-[4.55rem] min-w-0 cursor-pointer items-center justify-between gap-4 rounded-[1.05rem] border border-[#ded8ea] bg-white px-4 py-3 text-sm font-extrabold text-[#5d5b64] shadow-[0_10px_22px_-20px_rgba(76,29,149,.5)] transition hover:border-[#7c3aed]/35 hover:bg-[#fdfcff]">
        <span className="min-w-0 leading-5">{props.t(props.field.label)}</span>
        <span className="relative inline-flex h-7 w-12 shrink-0 items-center">
          <input
            type="checkbox"
            checked={Boolean(props.value)}
            onChange={(event) => props.onChange(event.target.checked)}
            className="peer sr-only"
          />
          <span className="absolute inset-0 rounded-full bg-[#e7e1f5] transition-colors peer-checked:bg-[#7c3aed]" />
          <span className="absolute left-1 size-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
        </span>
      </label>
    );
  }

  if (props.field.type === "number" && props.field.name === "n") {
    const numericValue = Number(props.value);
    const min = props.field.min ?? 1;
    const max = props.field.max ?? 10;
    const update = (next: number) => props.onChange(Math.min(max, Math.max(min, next)));

    return (
      <label className="grid min-w-0 gap-2 text-[11px] font-extrabold tracking-normal text-[#77717f] uppercase">
        <span>{props.t(props.field.label)}</span>
        <span className="grid h-11 grid-cols-[2.75rem_1fr_2.75rem] overflow-hidden rounded-[0.95rem] border border-[#ded8ea] bg-white text-base font-bold tracking-normal text-[#20222a] shadow-[0_10px_22px_-20px_rgba(76,29,149,.5)] transition focus-within:border-[#7c3aed] focus-within:ring-4 focus-within:ring-[#7c3aed]/10">
          <button
            type="button"
            onClick={() => update(numericValue - 1)}
            className="grid place-items-center border-r border-[#ede7f4] text-[#5d5b64] transition hover:bg-[#f4f0ff] hover:text-[#4c1d95]"
          >
            <Minus className="size-3.5" />
          </button>
          <input
            type="number"
            min={min}
            max={max}
            value={String(props.value)}
            onChange={(event) => props.onChange(coerceGeneratorValue(props.field, event.target.value))}
            className="min-w-0 bg-transparent px-2 text-center outline-none"
          />
          <button
            type="button"
            onClick={() => update(numericValue + 1)}
            className="grid place-items-center border-l border-[#ede7f4] text-[#5d5b64] transition hover:bg-[#f4f0ff] hover:text-[#4c1d95]"
          >
            <Plus className="size-3.5" />
          </button>
        </span>
      </label>
    );
  }

  if (canUseSegmented) {
    return (
      <div className="grid min-w-0 gap-2 text-[11px] font-extrabold tracking-normal text-[#77717f] uppercase">
        <span>{props.t(props.field.label)}</span>
        <div className={`${segmentedGridClass(props.field)} min-h-11 gap-1.5 rounded-[0.95rem] border border-[#ded8ea] bg-[#f3f0f9] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,.8)]`}>
          {(props.field.options ?? []).map((item) => {
            const active = String(props.value) === item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => props.onChange(coerceGeneratorValue(props.field, item))}
                className={`min-h-9 min-w-0 rounded-[0.72rem] px-3 py-2 text-[13px] leading-5 font-extrabold tracking-normal transition ${
                  active
                    ? "bg-white text-[#4c1d95] shadow-[0_8px_18px_-12px_rgba(76,29,149,.85)] ring-1 ring-[#7c3aed]/20"
                    : "text-[#5d5b64] hover:bg-white/75 hover:text-[#3f236b]"
                }`}
              >
                <span className="block">{item}</span>
              </button>
            );
          })}
        </div>
        {props.field.help ? <span className="text-[10px] font-medium tracking-normal text-[#8b8891] normal-case">{props.t(props.field.help)}</span> : null}
      </div>
    );
  }

  return (
    <label className="grid min-w-0 gap-2 text-[11px] font-extrabold tracking-normal text-[#77717f] uppercase">
      <span>{props.t(props.field.label)}</span>
      {props.field.type === "select" ? (
        <span className="relative block">
          <select
            value={String(props.value)}
            onChange={(event) => props.onChange(coerceGeneratorValue(props.field, event.target.value))}
            className="h-11 w-full min-w-0 appearance-none rounded-[0.95rem] border border-[#ded8ea] bg-white px-3.5 pr-9 text-sm font-bold tracking-normal text-[#20222a] shadow-[0_10px_22px_-20px_rgba(76,29,149,.5)] outline-none transition focus:border-[#7c3aed] focus:ring-4 focus:ring-[#7c3aed]/10"
          >
            {(props.field.options ?? []).map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-[#8b8891]" />
        </span>
      ) : (
        <input
          type={props.field.type === "number" ? "number" : "text"}
          min={props.field.min}
          max={props.field.max}
          value={String(props.value)}
          onChange={(event) => props.onChange(coerceGeneratorValue(props.field, event.target.value))}
          className="h-11 w-full min-w-0 rounded-[0.95rem] border border-[#ded8ea] bg-white px-3.5 text-sm font-bold tracking-normal text-[#20222a] shadow-[0_10px_22px_-20px_rgba(76,29,149,.5)] outline-none transition focus:border-[#7c3aed] focus:ring-4 focus:ring-[#7c3aed]/10"
        />
      )}
      {props.field.help ? <span className="text-[10px] font-medium tracking-normal text-[#8b8891] normal-case">{props.t(props.field.help)}</span> : null}
    </label>
  );
}

function generatorFieldColumnClass(kind: NonNullable<ModelConfig["generator"]>["kind"], field: ModelGeneratorField) {
  if (kind === "image") {
    if (field.name === "n") return "sm:col-span-2";
    if (field.name === "size") return "sm:col-span-6";
    return "sm:col-span-3";
  }
  if (kind === "video") {
    if (field.name === "ratio") return "sm:col-span-6";
    if (field.name === "resolution" || field.name === "duration" || field.name === "frames" || field.name === "seed") {
      return "sm:col-span-3";
    }
    return "sm:col-span-2";
  }
  return "sm:col-span-3";
}

function segmentedGridClass(field: ModelGeneratorField) {
  if (field.name === "ratio") {
    const optionCount = field.options?.length ?? 0;
    if (optionCount >= 7) return "grid grid-cols-2 min-[900px]:grid-cols-4 min-[1280px]:grid-cols-7";
    if (optionCount === 5) return "grid grid-cols-2 min-[900px]:grid-cols-3 min-[1280px]:grid-cols-5";
  }
  if (field.name === "size") return "grid grid-cols-2 min-[1280px]:grid-cols-4";
  if ((field.options?.length ?? 0) === 4) return "grid grid-cols-2";
  if ((field.options?.length ?? 0) === 3) return "grid grid-cols-3";
  return "grid grid-cols-2";
}

function formatUploadedSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "0 KB";
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function formatSavings(flatkey: string, official: string) {
  const flatkeyPrice = parsePrice(flatkey);
  const officialPrice = parsePrice(official);
  if (!flatkeyPrice || !officialPrice || flatkeyPrice >= officialPrice) return "0%";
  return `${Math.round(((officialPrice - flatkeyPrice) / officialPrice) * 100)}%`;
}

function parsePrice(value: string) {
  const match = value.match(/[\d.]+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function OutputPreview(props: {
  modelName: string;
  prompt: string;
  kind: "image" | "video" | "audio";
  images: readonly MediaExample[];
  t: (key: string, vars?: Record<string, string>) => string;
}) {
  const primary = props.images[0] ?? { poster: "/assets/prompts/awesome-images/sports-shoe.png" };

  return (
    <div className={props.kind === "video" ? "overflow-hidden rounded-[1.35rem] border border-black/10 bg-[#10131a] p-2 text-white shadow-[0_18px_42px_-32px_rgba(15,15,18,.8)]" : "overflow-hidden rounded-[1.35rem] border border-black/10 bg-white p-2 text-[#0B0B0F] shadow-[0_18px_42px_-34px_rgba(76,29,149,.65)]"}>
      <div className={`relative overflow-hidden rounded-[1.05rem] ${props.kind === "video" ? "aspect-video bg-[#171b24]" : "aspect-[16/10] bg-[#11131a]"}`}>
        {props.kind === "video" && primary?.video ? (
          <video
            className="h-full w-full object-cover"
            autoPlay
            controls
            loop
            muted
            playsInline
            poster={primary.poster}
            preload="metadata"
            src={primary.video}
          />
        ) : (
          <>
            <Image
              src={primary.poster}
              alt=""
              fill
              sizes="(min-width: 1280px) 620px, (min-width: 1024px) 56vw, 100vw"
              className="object-cover"
              priority={props.kind === "image"}
            />
          </>
        )}
      </div>
      <div className={`grid gap-1 px-2 pt-3 pb-1 text-xs leading-5 ${props.kind === "video" ? "" : "text-[#3f3d46]"}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${props.kind === "video" ? "bg-white/10 text-white/78" : "bg-[#f4f0ff] text-[#6d28d9]"}`}>
            {props.t("Example output")}
          </span>
          <b>{props.modelName}</b>
        </div>
        <span className={props.kind === "video" ? "text-white/72" : "text-[#706a74]"}>{props.prompt}</span>
      </div>
    </div>
  );
}

function GeneratedExampleCard(props: {
  example: MediaExample;
  featured?: boolean;
  index: number;
  modelName: string;
  t: (key: string, vars?: Record<string, string>) => string;
}) {
  return (
    <figure className={`overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm ${props.featured ? "md:col-span-2" : ""}`}>
      <div className={`relative w-full bg-[#10131a] ${props.featured ? "aspect-[16/10]" : "aspect-[4/5]"}`}>
        {props.example.video ? (
          <video
            className="h-full w-full object-cover"
            autoPlay
            controls
            loop
            muted
            playsInline
            poster={props.example.poster}
            preload="metadata"
            src={props.example.video}
          />
        ) : (
          <Image
            src={props.example.poster}
            alt=""
            fill
            sizes={props.featured ? "(min-width: 768px) 560px, 100vw" : "(min-width: 768px) 280px, 100vw"}
            className={props.featured ? "object-cover" : "object-cover"}
          />
        )}
        {props.example.video ? (
          <div className="pointer-events-none absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-extrabold text-white backdrop-blur">
            <Play className="size-3 fill-current" />
            {props.t("Preview")}
          </div>
        ) : null}
      </div>
      <figcaption className="px-4 py-3 text-xs font-bold text-[#4b4a52]">
        {props.t("Generated with {{model}}", { model: props.modelName })} #{props.index + 1}
      </figcaption>
    </figure>
  );
}

function RequestPreview(props: {
  config: ModelConfig;
  prompt: string;
  fieldValues: Record<string, string | number | boolean>;
  referenceImages?: ReferenceImageDraft[];
  t: (key: string, vars?: Record<string, string>) => string;
}) {
  const request = buildGeneratorRequest(props.config, props.prompt, props.fieldValues, props.referenceImages);
  return (
    <div className="mt-5 rounded-2xl border border-black/10 bg-white p-5">
      <div className="mb-3 flex items-center justify-between text-sm font-extrabold text-[#2c2d33]">
        {props.t("Request preview")}
        <button type="button" className="inline-flex items-center gap-1 rounded-full border border-black/10 px-3 py-1.5 text-xs">
          <Copy className="size-3" />
          {props.t("Copy request")}
        </button>
      </div>
      <pre className="max-h-56 overflow-auto rounded-xl bg-[#11131a] p-5 font-mono text-xs leading-6 text-white/78">
        {JSON.stringify(request, null, 2)}
      </pre>
    </div>
  );
}

function PanelHeader(props: { title: string; right: string }) {
  return (
    <div className="mb-5 flex items-center justify-between">
      <h2 className="text-base font-extrabold">{props.title}</h2>
      <span className="rounded-full bg-[#f2f0ed] px-3.5 py-1.5 text-xs font-bold text-[#77747d]">
        {props.right}
      </span>
    </div>
  );
}

function Pill(props: { label: string; value: string }) {
  return (
    <span className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
      <span className="block text-xs font-extrabold tracking-[0.12em] text-[#8b8891] uppercase">{props.label}</span>
      <b className="mt-1.5 block text-sm">{props.value}</b>
    </span>
  );
}

function StatCard(props: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
      <b className="text-3xl font-extrabold">{props.value}</b>
      <div className="mt-2 text-sm font-medium text-[#77747d]">{props.label}</div>
    </div>
  );
}

function PriceBox(props: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${props.muted ? "border-dashed border-[#cbd5e1] bg-[#f8fafc]" : "border-[#d8c9ff] bg-[#fbfaff]"}`}>
      <div className={`text-xs font-extrabold tracking-[0.12em] uppercase ${props.muted ? "text-[#64748b]" : "text-[#7c3aed]"}`}>
        {props.label}
      </div>
      <div className={`mt-2 text-xl font-extrabold ${props.muted ? "text-[#475569]" : "text-[#0B0B0F]"}`}>{props.value}</div>
    </div>
  );
}

function ReasonCard(props: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
      <div className="mb-5 grid size-10 place-items-center rounded-full bg-[#f4f0ff] text-[#7c3aed]">{props.icon}</div>
      <h3 className="text-base font-extrabold">{props.title}</h3>
      <p className="mt-2 text-base leading-7 text-[#6b6872]">{props.body}</p>
    </div>
  );
}

function GuideFact(props: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-[#fbfaf7] p-4">
      <div className="text-[10px] font-extrabold tracking-[0.12em] text-[#8b8891] uppercase">{props.label}</div>
      <div className="mt-2 break-words text-sm font-extrabold">{props.value}</div>
    </div>
  );
}

function FeatureCard(props: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
      <div className="mb-5 grid size-9 place-items-center rounded-full bg-[#141824] text-white">{props.icon}</div>
      <h3 className="text-base font-extrabold">{props.title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#6b6872]">{props.body}</p>
    </div>
  );
}

function buildTextGuideFeatures(config: ModelConfig, t: (key: string, vars?: Record<string, string>) => string) {
  return [
    {
      icon: <Code2 className="size-4" />,
      title: t("OpenAI-compatible migration path"),
      body: t("Chat Completions-style payloads reduce switching friction from existing model stacks."),
    },
    {
      icon: <Layers3 className="size-4" />,
      title: t("Structured and tool-based output"),
      body: t("Use structured JSON, tools, and code-generation flows for agentic workflows."),
    },
    {
      icon: <Timer className="size-4" />,
      title: t("Streaming interaction"),
      body: t("Streaming supports chat UIs, terminal assistants, and progressive rendering."),
    },
    {
      icon: <ShieldCheck className="size-4" />,
      title: t("Production routing"),
      body: t("Keep usage, keys, quotas, and model routing in one Flatkey account."),
    },
    {
      icon: <FileText className="size-4" />,
      title: t("Long-context work"),
      body: t("Useful for document summarization, codebase analysis, and knowledge workflows."),
    },
    {
      icon: <Settings2 className="size-4" />,
      title: t("Coding and technical generation"),
      body: t("Useful for code explanation, tests, refactors, SDK wrappers, and technical drafts."),
    },
  ];
}

function buildMediaPricingRows(config: ModelConfig) {
  if (config.slug === "gpt-image-2") {
    return [
      { spec: "1K", flatkey: "$0.0075", official: "$0.22" },
      { spec: "2K", flatkey: "$0.010", official: "$0.50" },
      { spec: "4K", flatkey: "$0.0125", official: "$1.30" },
    ];
  }
  if (config.generator?.kind === "video") {
    return [
      { spec: "720p", flatkey: config.flatkeyPrice, note: "Shared balance", official: config.officialPrice },
      { spec: "1080p", flatkey: "$0.067", note: "Shared balance", official: "$0.10" },
      { spec: "I2V", flatkey: "$0.053", note: "Shared balance", official: "$0.08" },
    ];
  }
  if (config.generator?.kind === "audio") {
    return [
      { spec: "Standard", flatkey: config.flatkeyPrice, note: "Shared balance", official: config.officialPrice },
      { spec: "High quality", flatkey: config.estFlatkey, note: "Shared balance", official: config.estOfficial },
      { spec: "Batch", flatkey: config.flatkeyPrice, note: "Shared balance", official: config.officialPrice },
    ];
  }
  return [
    { spec: "1024x1024", flatkey: config.flatkeyPrice, note: "Shared balance", official: config.officialPrice },
    { spec: "1536x1024", flatkey: config.flatkeyPrice, note: "Shared balance", official: config.officialPrice },
    { spec: "1024x1536", flatkey: config.flatkeyPrice, note: "Shared balance", official: config.officialPrice },
  ];
}

function buildInitialGeneratorValues(config: ModelConfig) {
  return Object.fromEntries((config.generator?.fields ?? []).map((field) => [field.name, field.defaultValue]));
}

function buildGeneratorRequest(
  config: ModelConfig,
  prompt: string,
  values: Record<string, string | number | boolean>,
  referenceImages: ReferenceImageDraft[] = []
) {
  if (config.generator?.kind === "video") {
    const content = [{ type: "text", text: prompt }];
    return compactRequest({ model: config.modelId, content, ...values });
  }
  if (config.generator?.kind === "audio") {
    return compactRequest({ model: config.modelId, input: prompt, ...values });
  }
  if (config.generator?.kind === "image") {
    return compactRequest({
      model: config.modelId,
      prompt,
      ...values,
      reference_images:
        referenceImages.length > 0
          ? referenceImages.map(({ name, size, type }) => ({ name, size, type }))
          : undefined,
    });
  }
  return { model: config.modelId, prompt };
}

function compactRequest(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== "" && entry !== 0 && entry !== undefined)
  );
}

function buildRunHref(
  config: ModelConfig,
  locale: Locale,
  prompt: string,
  draft: DraftValue
) {
  const playgroundParams = new URLSearchParams({
    model: config.modelId,
    prompt,
    lng: locale,
    draft: JSON.stringify(draft),
  });
  if (config.generator?.kind === "image" || config.generator?.kind === "video") {
    playgroundParams.set("generate", config.generator.kind);
  }
  const signUpParams = new URLSearchParams({
    redirect: `/playground?${playgroundParams.toString()}`,
    lng: locale,
  });
  return consoleUrl("/sign-up", signUpParams.toString());
}

function withCurrentSearch(baseHref: string) {
  const currentSearch = window.location.search;
  if (!currentSearch) return baseHref;
  const url = new URL(baseHref);
  const current = new URLSearchParams(currentSearch);
  current.forEach((value, key) => {
    if (!url.searchParams.has(key)) url.searchParams.set(key, value);
  });
  return url.toString();
}

function coerceGeneratorValue(field: ModelGeneratorField, raw: string) {
  if (field.type !== "number" && typeof field.defaultValue !== "number") return raw;
  const value = Number(raw);
  if (!Number.isFinite(value)) return field.defaultValue;
  return Math.min(field.max ?? value, Math.max(field.min ?? value, value));
}

function buildQuickPrompt(label: string, kind: "image" | "video" | "audio") {
  if (kind === "video") {
    return `${label}: a concise commercial video shot with clear subject motion, realistic lighting, stable camera, and production-ready framing.`;
  }
  if (kind === "audio") {
    return `${label}: a clean studio-quality audio generation brief with precise tone, pacing, ambience, and delivery notes.`;
  }
  return `${label}: a high-quality product visual with clean composition, precise lighting, strong subject focus, and realistic detail.`;
}
