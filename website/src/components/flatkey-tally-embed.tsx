"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/locales";

const TALLY_EMBED_SCRIPT_SRC = "https://tally.so/widgets/embed.js";
const TALLY_FORM_ID = "1A6gM4";
const TALLY_EMBED_SRC = `https://tally.so/embed/${TALLY_FORM_ID}?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1`;

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
        title="Talk to sales"
      />
      {loadFailed ? (
        <div className="border-border/70 bg-background/92 text-muted-foreground mt-3 rounded-lg border px-3 py-2 text-sm">
          Sales inquiry form could not be loaded.{" "}
          <a
            className="font-medium text-violet-700 underline-offset-4 hover:underline"
            href={`https://tally.so/r/${TALLY_FORM_ID}`}
            rel="noreferrer"
            target="_blank"
          >
            Open sales inquiry form
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
