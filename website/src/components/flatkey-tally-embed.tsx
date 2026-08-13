"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/locales";
import { withIdFallback } from "@/lib/locales";

const TALLY_EMBED_SCRIPT_SRC = "https://tally.so/widgets/embed.js";
const TALLY_FORM_ID = "1A6gM4";
const TALLY_EMBED_SRC = `https://tally.so/embed/${TALLY_FORM_ID}?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1`;

const TALLY_COPY: Record<Locale, { openForm: string; title: string; unavailable: string }> = withIdFallback({
  en: {
    openForm: "Open sales inquiry form",
    title: "Talk to sales",
    unavailable: "Sales inquiry form could not be loaded.",
  },
  zh: {
    openForm: "打开销售咨询表单",
    title: "联系销售",
    unavailable: "销售咨询表单暂时无法加载。",
  },
  es: {
    openForm: "Abrir formulario de ventas",
    title: "Hablar con ventas",
    unavailable: "No se pudo cargar el formulario de ventas.",
  },
  fr: {
    openForm: "Ouvrir le formulaire commercial",
    title: "Contacter l'équipe commerciale",
    unavailable: "Le formulaire commercial n'a pas pu être chargé.",
  },
  pt: {
    openForm: "Abrir formulário comercial",
    title: "Falar com vendas",
    unavailable: "Não foi possível carregar o formulário comercial.",
  },
  ru: {
    openForm: "Открыть форму для отдела продаж",
    title: "Связаться с отделом продаж",
    unavailable: "Не удалось загрузить форму обращения в отдел продаж.",
  },
  ja: {
    openForm: "営業相談フォームを開く",
    title: "営業に相談",
    unavailable: "営業相談フォームを読み込めませんでした。",
  },
  vi: {
    openForm: "Mở biểu mẫu tư vấn bán hàng",
    title: "Trao đổi với bộ phận bán hàng",
    unavailable: "Không tải được biểu mẫu tư vấn bán hàng.",
  },
  de: {
    openForm: "Vertriebsformular öffnen",
    title: "Mit dem Vertrieb sprechen",
    unavailable: "Das Vertriebsformular konnte nicht geladen werden.",
  },
});

declare global {
  interface Window {
    Tally?: {
      loadEmbeds: () => void;
    };
  }
}

let tallyEmbedScriptPromise: Promise<void> | null = null;

export function FlatkeyTallyEmbed(props: { locale: Locale; className?: string; iframeClassName?: string; loading?: "lazy" | "eager" }) {
  const [loadFailed, setLoadFailed] = useState(false);
  const tallyEmbedSrc = useMemo(() => TALLY_EMBED_SRC, []);
  const copy = TALLY_COPY[props.locale] ?? TALLY_COPY.en;

  useEffect(() => {
    let mounted = true;
    void loadTallyEmbedScript()
      .then(() => {
        if (mounted) {
          setLoadFailed(false);
          window.Tally?.loadEmbeds();
        }
      })
      .catch(() => {
        if (mounted) {
          tallyEmbedScriptPromise = null;
          setLoadFailed(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, [tallyEmbedSrc]);

  return (
    <div className={cn("w-full overflow-hidden", props.className)}>
      <iframe
        key={tallyEmbedSrc}
        className={props.iframeClassName ?? "block h-[760px] w-full border-0 bg-transparent sm:h-[560px] lg:h-[520px]"}
        data-tally-src={tallyEmbedSrc}
        loading={props.loading ?? "lazy"}
        width="100%"
        height="520"
        frameBorder="0"
        marginHeight={0}
        marginWidth={0}
        allow="clipboard-write"
        title={copy.title}
      />
      {loadFailed ? (
        <div className="border-border/70 bg-background/92 text-muted-foreground mt-3 rounded-lg border px-3 py-2 text-sm">
          {copy.unavailable}{" "}
          <a
            className="font-medium text-violet-700 underline-offset-4 hover:underline"
            href={`https://tally.so/r/${TALLY_FORM_ID}`}
            rel="noreferrer"
            target="_blank"
          >
            {copy.openForm}
          </a>
        </div>
      ) : null}
    </div>
  );
}

function loadTallyEmbedScript(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  if (window.Tally) return Promise.resolve();
  if (tallyEmbedScriptPromise) return tallyEmbedScriptPromise;

  tallyEmbedScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${TALLY_EMBED_SCRIPT_SRC}"]`);
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Failed to load Tally embed script")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = TALLY_EMBED_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Tally embed script"));
    document.body.appendChild(script);
  });

  return tallyEmbedScriptPromise;
}
