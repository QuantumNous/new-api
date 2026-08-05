"use client";

import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { createPortal } from "react-dom";
import { Select } from "@base-ui/react/select";
import { Check, ChevronDown, Copy, ImageIcon, Maximize2, Settings2, Sparkles, Video, WandSparkles, X } from "lucide-react";
import { type Locale, withIdFallback } from "@/lib/locales";

type PromptActionCopy = {
  aspectRatio: string;
  auto: string;
  copy: string;
  copied: string;
  createTitle: string;
  generate: string;
  generateImage: string;
  generateVideo: string;
  imageHint: string;
  loginTitle: string;
  loginBody: string;
  login: string;
  model: string;
  quality: string;
  cancel: string;
  checking: string;
  promptLabel: string;
  size: string;
  videoHint: string;
};

const copyByLocale: Record<Locale, PromptActionCopy> = withIdFallback({
  en: {
    aspectRatio: "Aspect",
    auto: "Auto",
    copy: "Copy",
    copied: "Copied",
    createTitle: "Create with this prompt",
    generate: "Generate with this prompt",
    generateImage: "Generate image",
    generateVideo: "Generate video",
    imageHint: "Adjust the prompt, model, size, and quality before sending it to Flatkey Console.",
    loginTitle: "Sign in to generate",
    loginBody: "Sign in to Flatkey Console, then we will open Playground with this prompt and your selected settings.",
    login: "Sign in",
    model: "Model",
    quality: "Quality",
    cancel: "Cancel",
    checking: "Checking",
    promptLabel: "Editable prompt",
    size: "Size",
    videoHint: "Adjust the prompt, model, aspect, and quality before sending it to Flatkey Console.",
  },
  zh: {
    aspectRatio: "比例",
    auto: "自动",
    copy: "复制",
    copied: "已复制",
    createTitle: "用这个 Prompt 创作",
    generate: "使用此提示词生成",
    generateImage: "生成图片",
    generateVideo: "生成视频",
    imageHint: "你可以修改提示词，也可以选择模型、尺寸和质量后再发送到 Flatkey 控制台。",
    loginTitle: "登录后生成",
    loginBody: "请先登录 Flatkey 控制台，登录后会进入 Playground，并带上当前提示词和生成设置。",
    login: "去登录",
    model: "模型",
    quality: "质量",
    cancel: "取消",
    checking: "检测中",
    promptLabel: "可编辑提示词",
    size: "大小",
    videoHint: "你可以修改提示词，也可以选择模型、比例和质量后再发送到 Flatkey 控制台。",
  },
  es: {
    aspectRatio: "Aspecto",
    auto: "Auto",
    copy: "Copiar",
    copied: "Copiado",
    createTitle: "Crear con este prompt",
    generate: "Generar con este prompt",
    generateImage: "Generar imagen",
    generateVideo: "Generar video",
    imageHint: "Ajusta el prompt, modelo, tamaño y calidad antes de enviarlo a Flatkey Console.",
    loginTitle: "Inicia sesion para generar",
    loginBody: "Inicia sesion en Flatkey Console y abriremos Playground con este prompt y ajustes.",
    login: "Iniciar sesion",
    model: "Modelo",
    quality: "Calidad",
    cancel: "Cancelar",
    checking: "Comprobando",
    promptLabel: "Prompt editable",
    size: "Tamano",
    videoHint: "Ajusta el prompt, modelo, aspecto y calidad antes de enviarlo a Flatkey Console.",
  },
  fr: {
    aspectRatio: "Ratio",
    auto: "Auto",
    copy: "Copier",
    copied: "Copie",
    createTitle: "Creer avec ce prompt",
    generate: "Generer avec ce prompt",
    generateImage: "Generer image",
    generateVideo: "Generer video",
    imageHint: "Ajustez prompt, modele, taille et qualite avant Flatkey Console.",
    loginTitle: "Connectez-vous pour generer",
    loginBody: "Connectez-vous a Flatkey Console, puis Playground s'ouvrira avec ce prompt et ces reglages.",
    login: "Se connecter",
    model: "Modele",
    quality: "Qualite",
    cancel: "Annuler",
    checking: "Verification",
    promptLabel: "Prompt modifiable",
    size: "Taille",
    videoHint: "Ajustez prompt, modele, ratio et qualite avant Flatkey Console.",
  },
  pt: {
    aspectRatio: "Proporcao",
    auto: "Auto",
    copy: "Copiar",
    copied: "Copiado",
    createTitle: "Criar com este prompt",
    generate: "Gerar com este prompt",
    generateImage: "Gerar imagem",
    generateVideo: "Gerar video",
    imageHint: "Ajuste prompt, modelo, tamanho e qualidade antes de enviar ao Flatkey Console.",
    loginTitle: "Entre para gerar",
    loginBody: "Entre no Flatkey Console e abriremos o Playground com este prompt e ajustes.",
    login: "Entrar",
    model: "Modelo",
    quality: "Qualidade",
    cancel: "Cancelar",
    checking: "Verificando",
    promptLabel: "Prompt editavel",
    size: "Tamanho",
    videoHint: "Ajuste prompt, modelo, proporcao e qualidade antes do Flatkey Console.",
  },
  ru: {
    aspectRatio: "Aspect",
    auto: "Auto",
    copy: "Copy",
    copied: "Copied",
    createTitle: "Create with this prompt",
    generate: "Generate with this prompt",
    generateImage: "Generate image",
    generateVideo: "Generate video",
    imageHint: "Adjust prompt, model, size, and quality before opening Flatkey Console.",
    loginTitle: "Sign in to generate",
    loginBody: "Sign in to Flatkey Console, then Playground will open with this prompt and settings.",
    login: "Sign in",
    model: "Model",
    quality: "Quality",
    cancel: "Cancel",
    checking: "Checking",
    promptLabel: "Editable prompt",
    size: "Size",
    videoHint: "Adjust prompt, model, aspect, and quality before opening Flatkey Console.",
  },
  ja: {
    aspectRatio: "比率",
    auto: "自動",
    copy: "コピー",
    copied: "コピー済み",
    createTitle: "このPromptで作成",
    generate: "このプロンプトで生成",
    generateImage: "画像を生成",
    generateVideo: "動画を生成",
    imageHint: "Prompt、モデル、サイズ、品質を調整してから Flatkey Console に送ります。",
    loginTitle: "ログインして生成",
    loginBody: "Flatkey Consoleにログインすると、このプロンプトと設定でPlaygroundを開きます。",
    login: "ログイン",
    model: "モデル",
    quality: "品質",
    cancel: "キャンセル",
    checking: "確認中",
    promptLabel: "編集可能なプロンプト",
    size: "サイズ",
    videoHint: "Prompt、モデル、比率、品質を調整してから Flatkey Console に送ります。",
  },
  vi: {
    aspectRatio: "Ti le",
    auto: "Tu dong",
    copy: "Sao chep",
    copied: "Da sao chep",
    createTitle: "Tao bang prompt nay",
    generate: "Tao bang prompt nay",
    generateImage: "Tao anh",
    generateVideo: "Tao video",
    imageHint: "Sua prompt, model, kich co va chat luong truoc khi gui den Flatkey Console.",
    loginTitle: "Dang nhap de tao",
    loginBody: "Dang nhap Flatkey Console, sau do Playground se mo voi prompt va thiet lap nay.",
    login: "Dang nhap",
    model: "Model",
    quality: "Chat luong",
    cancel: "Huy",
    checking: "Dang kiem tra",
    promptLabel: "Prompt co the sua",
    size: "Kich co",
    videoHint: "Sua prompt, model, ti le va chat luong truoc khi gui den Flatkey Console.",
  },
  de: {
    aspectRatio: "Seitenverhältnis",
    auto: "Auto",
    copy: "Kopieren",
    copied: "Kopiert",
    createTitle: "Mit diesem Prompt erstellen",
    generate: "Mit diesem Prompt generieren",
    generateImage: "Bild generieren",
    generateVideo: "Video generieren",
    imageHint: "Prompt, Modell, Größe und Qualität vor Flatkey Console anpassen.",
    loginTitle: "Zum Generieren anmelden",
    loginBody: "Melde dich in der Flatkey Console an. Danach offnen wir Playground mit Prompt und Einstellungen.",
    login: "Anmelden",
    model: "Modell",
    quality: "Qualität",
    cancel: "Abbrechen",
    checking: "Prufen",
    promptLabel: "Bearbeitbarer Prompt",
    size: "Größe",
    videoHint: "Prompt, Modell, Seitenverhältnis und Qualität vor Flatkey Console anpassen.",
  },
});

type Props = {
  defaultPrompt: string;
  generateUrl: string;
  kind: "image" | "video";
  locale: Locale;
  model: string;
  ratio: string;
  title: string;
};

const imageModelOptions = ["gpt-image-2", "gemini-2.5-flash-image", "nano-banana-pro-preview"];
const videoModelOptions = ["veo-3.1-fast-generate-preview", "veo-3.1-generate-preview", "veo-3.0-fast-generate-preview"];
const imageSizeOptions = ["1024x1024", "1536x1024", "1024x1536"];
const videoAspectOptions = ["16:9", "9:16", "1:1"];
const qualityOptions = ["auto", "high", "medium", "low"];

export function CliPromptActionPanel(props: Props) {
  const copy = copyByLocale[props.locale];
  const [prompt, setPrompt] = useState(props.defaultPrompt);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const modelOptions = props.kind === "image" ? imageModelOptions : videoModelOptions;
  const [selectedModel, setSelectedModel] = useState(modelOptions.includes(props.model) ? props.model : modelOptions[0]);
  const [selectedSize, setSelectedSize] = useState(props.kind === "image" ? "1024x1024" : props.ratio === "9:16" ? "9:16" : "16:9");
  const [selectedQuality, setSelectedQuality] = useState("auto");
  const effectiveGenerateUrl = useMemo(() => {
    const url = new URL(props.generateUrl);
    url.searchParams.set("generate", props.kind);
    url.searchParams.set("model", selectedModel);
    url.searchParams.set("prompt", prompt);
    url.searchParams.set(props.kind === "image" ? "size" : "aspect", selectedSize);
    url.searchParams.set("quality", selectedQuality);
    return url.toString();
  }, [prompt, props.generateUrl, props.kind, selectedModel, selectedQuality, selectedSize]);

  const handleCopy = async () => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(prompt);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = prompt;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const handleGenerate = () => {
    window.location.assign(effectiveGenerateUrl);
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!showCreateDialog) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setShowCreateDialog(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showCreateDialog]);

  const createDialog = showCreateDialog && mounted
    ? createPortal(
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#0B0B0F]/42 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onMouseDown={() => setShowCreateDialog(false)}
        >
          <div
            className="max-h-[92vh] w-full max-w-4xl overflow-visible rounded-lg border border-violet-500/16 bg-[#fbfaff] shadow-[0_32px_90px_-38px_rgba(91,33,182,0.72)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-violet-500/10 bg-white/72 px-5 py-5 md:px-7">
              <div className="flex min-w-0 gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-violet-500/20 bg-violet-500/10 text-violet-700 shadow-[0_18px_44px_-30px_rgba(124,58,237,0.8)]">
                  <WandSparkles className="size-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-3xl font-black tracking-tight text-[#0B0B0F]">{copy.createTitle}</h3>
                  <p className="mt-1 text-sm leading-6 text-[#62626D]">{props.kind === "image" ? copy.imageHint : copy.videoHint}</p>
                </div>
              </div>
              <button type="button" className="rounded-md p-2 text-[#62626D] hover:bg-[#0B0B0F0A] hover:text-[#0B0B0F]" aria-label={copy.cancel} onClick={() => setShowCreateDialog(false)}>
                <X className="size-5" />
              </button>
            </div>
            <div className="max-h-[calc(92vh-88px)] overflow-visible p-5 md:p-7">
              <div className="overflow-visible rounded-lg border border-violet-500/16 bg-white/80 shadow-[0_24px_70px_-56px_rgba(91,33,182,0.58)] backdrop-blur-sm">
                <div className="flex items-center gap-2 border-b border-violet-500/10 px-4 py-3 text-sm font-black text-[#17131f]">
                  {props.kind === "image" ? <ImageIcon className="size-4 text-violet-700" /> : <Video className="size-4 text-violet-700" />}
                  {copy.promptLabel}
                </div>
                <textarea
                  aria-label={copy.promptLabel}
                  className="min-h-[300px] w-full resize-y border-0 bg-white px-5 py-5 font-mono text-sm leading-7 text-[#17131f] outline-none"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                />
                <div className="grid gap-3 border-t border-violet-500/10 bg-white/55 p-4 md:grid-cols-[1.25fr_0.8fr_0.8fr]">
                  <SelectControl icon={<Sparkles className="size-4" />} label={copy.model} value={selectedModel} values={modelOptions} onChange={setSelectedModel} />
                  <SelectControl icon={<Maximize2 className="size-4" />} label={props.kind === "image" ? copy.size : copy.aspectRatio} value={selectedSize} values={props.kind === "image" ? imageSizeOptions : videoAspectOptions} onChange={setSelectedSize} />
                  <SelectControl icon={<Settings2 className="size-4" />} label={copy.quality} value={selectedQuality} values={qualityOptions} valueLabel={(value) => (value === "auto" ? copy.auto : value)} onChange={setSelectedQuality} />
                </div>
              </div>
              <div className="mt-5 flex flex-wrap justify-end gap-3">
                <button type="button" className="h-11 rounded-lg border border-[#0B0B0F14] bg-white px-4 text-sm font-bold text-[#43434C] hover:text-[#0B0B0F]" onClick={() => setShowCreateDialog(false)}>
                  {copy.cancel}
                </button>
                <button
                  type="button"
                  className="flatkey-hero-cta inline-flex h-11 items-center gap-2 rounded-lg px-5 text-sm font-black text-white shadow-[0_16px_34px_-18px_rgba(124,58,237,0.85)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={!prompt.trim()}
                  onClick={handleGenerate}
                >
                  <WandSparkles className="size-4" />
                  {props.kind === "image" ? copy.generateImage : copy.generateVideo}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <article className="rounded-lg border border-violet-500/16 bg-white/72 p-5 shadow-[0_24px_70px_-52px_rgba(91,33,182,0.58)] backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-violet-500/10 pb-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight">{props.title}</h2>
          <p className="mt-1 text-xs font-bold text-[#62626D]">{copy.promptLabel}</p>
        </div>
        <span className="rounded border border-violet-500/16 bg-violet-500/8 px-2.5 py-1 text-[11px] font-black text-violet-700">{props.ratio}</span>
      </div>
      <textarea
        aria-label={copy.promptLabel}
        className="mt-4 min-h-[360px] w-full resize-y rounded-lg border border-[#0B0B0F18] bg-white/75 p-5 font-mono text-sm leading-7 text-[#17131f] outline-none transition focus:border-violet-500/45 focus:bg-white focus:ring-4 focus:ring-violet-500/10"
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
      />
      <div className="mt-4 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#0B0B0F14] bg-white px-4 text-sm font-black text-[#17131f] hover:border-violet-500/35 hover:text-violet-700"
          onClick={handleCopy}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? copy.copied : copy.copy}
        </button>
        <button
          type="button"
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-violet-600 px-4 text-sm font-black text-white shadow-[0_18px_38px_-26px_rgba(91,33,182,0.9)] hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={!prompt.trim()}
          onClick={() => setShowCreateDialog(true)}
        >
          <WandSparkles className="size-4" />
          {copy.generate}
        </button>
      </div>

      {createDialog}
    </article>
  );
}

function SelectControl(props: {
  icon: React.ReactNode;
  label: string;
  onChange: (value: string) => void;
  value: string;
  valueLabel?: (value: string) => string;
  values: string[];
}) {
  const selectedLabel = props.valueLabel ? props.valueLabel(props.value) : props.value;

  return (
    <div className="grid gap-1.5">
      <span className="inline-flex items-center gap-1.5 text-[11px] font-black tracking-[0.12em] text-[#62626D] uppercase">
        {props.icon}
        {props.label}
      </span>
      <Select.Root
        modal={false}
        value={props.value}
        onValueChange={(value) => {
          if (typeof value === "string") {
            props.onChange(value);
          }
        }}
      >
        <Select.Trigger className="group flex h-11 w-full items-center justify-between gap-3 rounded-lg border border-[#0B0B0F18] bg-white px-3 text-left text-sm font-black text-[#17131f] shadow-[0_14px_34px_-30px_rgba(91,33,182,0.6)] outline-none transition hover:border-violet-500/35 focus-visible:border-violet-500/45 focus-visible:ring-4 focus-visible:ring-violet-500/10 data-popup-open:border-violet-500/45 data-popup-open:ring-4 data-popup-open:ring-violet-500/10">
          <Select.Value className="min-w-0 truncate">{selectedLabel}</Select.Value>
          <Select.Icon className="shrink-0 text-[#62626D] transition-transform group-data-popup-open:rotate-180">
            <ChevronDown className="size-4" />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner
            align="start"
            alignItemWithTrigger={false}
            className="z-[1100] outline-none"
            collisionPadding={16}
            side="bottom"
            sideOffset={8}
          >
            <Select.Popup className="min-w-[var(--anchor-width)] max-w-[var(--available-width)] overflow-hidden rounded-lg border border-violet-500/18 bg-white p-1.5 text-[#17131f] shadow-[0_24px_70px_-38px_rgba(91,33,182,0.55)] outline-none">
              <Select.List className="max-h-[min(var(--available-height),15rem)] overflow-y-auto outline-none">
                {props.values.map((value) => {
                  const label = props.valueLabel ? props.valueLabel(value) : value;
                  return (
                    <Select.Item
                      key={value}
                      className="grid min-h-9 cursor-pointer grid-cols-[1fr_auto] items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-black text-[#17131f] outline-none transition hover:bg-violet-500/8 data-[highlighted]:bg-violet-500/8 data-[selected]:bg-violet-500/10 data-[selected]:text-violet-800"
                      label={label}
                      value={value}
                    >
                      <Select.ItemText className="min-w-0 break-words leading-4">{label}</Select.ItemText>
                      <Select.ItemIndicator className="text-violet-700">
                        <Check className="size-3.5" />
                      </Select.ItemIndicator>
                    </Select.Item>
                  );
                })}
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
