"use client";

import { ArrowRight, BadgeCheck, Sparkles, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { type Locale, withIdFallback } from "@/lib/locales";

const OFFER_DELAY_MS = 5_000;

type OfferModalCopy = {
  timerLabel: string;
  title: string;
  accent: string;
  body: string;
  officialTokens: string;
  longerBalance: string;
  fabLabel: string;
  fabValue: string;
  closeLabel: string;
  reopenLabel: string;
};

export const OFFER_MODAL_COPY: Record<Locale, OfferModalCopy> =withIdFallback({
  en: {
    timerLabel: "New plans",
    title: "Plans from USD10/month.",
    accent: "Usage worth up to 4.5x the price.",
    body: "One subscription covers GPT, Claude, Gemini, DeepSeek, Kimi and more on official upstream tokens — monthly usage worth up to 4.5x what you pay, plus image and video credits.",
    officialTokens: "Official upstream tokens",
    longerBalance: "Text, image and video in one plan",
    fabLabel: "Plans",
    fabValue: "from USD10/mo",
    closeLabel: "Close plans panel",
    reopenLabel: "Reopen plans panel",
  },
  zh: {
    timerLabel: "全新套餐",
    title: "订阅套餐每月 $10 起。",
    accent: "可用量最高达套餐价 4.5 倍。",
    body: "一份订阅覆盖 GPT、Claude、Gemini、DeepSeek、Kimi 等官方上游 token——每月可用量最高达套餐价的 4.5 倍，另含图像与视频额度。",
    officialTokens: "官方上游 token",
    longerBalance: "文本·图像·视频一个套餐",
    fabLabel: "套餐",
    fabValue: "$10/月起",
    closeLabel: "关闭套餐面板",
    reopenLabel: "重新打开套餐面板",
  },
  es: {
    timerLabel: "Nuevos planes",
    title: "Planes desde USD10/mes.",
    accent: "Uso de hasta 4.5x el precio.",
    body: "Una suscripción cubre GPT, Claude, Gemini, DeepSeek, Kimi y más con tokens oficiales upstream: uso mensual de hasta 4.5x lo que pagas, más créditos de imagen y vídeo.",
    officialTokens: "Tokens oficiales upstream",
    longerBalance: "Texto, imagen y vídeo en un plan",
    fabLabel: "Planes",
    fabValue: "desde USD10/mes",
    closeLabel: "Cerrar panel de planes",
    reopenLabel: "Reabrir panel de planes",
  },
  fr: {
    timerLabel: "Nouveaux plans",
    title: "Plans dès USD10/mois.",
    accent: "Usage jusqu'à 4,5x le prix.",
    body: "Un seul abonnement couvre GPT, Claude, Gemini, DeepSeek, Kimi et plus, sur tokens upstream officiels — usage mensuel valant jusqu'à 4,5x le prix, plus des crédits image et vidéo.",
    officialTokens: "Tokens upstream officiels",
    longerBalance: "Texte, image et vidéo dans un plan",
    fabLabel: "Plans",
    fabValue: "dès USD10/mois",
    closeLabel: "Fermer le panneau des plans",
    reopenLabel: "Rouvrir le panneau des plans",
  },
  pt: {
    timerLabel: "Novos planos",
    title: "Planos a partir de USD10/mês.",
    accent: "Uso de até 4,5x o preço.",
    body: "Uma assinatura cobre GPT, Claude, Gemini, DeepSeek, Kimi e mais, com tokens oficiais upstream — uso mensal de até 4,5x o que você paga, além de créditos de imagem e vídeo.",
    officialTokens: "Tokens oficiais upstream",
    longerBalance: "Texto, imagem e vídeo em um plano",
    fabLabel: "Planos",
    fabValue: "desde USD10/mês",
    closeLabel: "Fechar painel de planos",
    reopenLabel: "Reabrir painel de planos",
  },
  ru: {
    timerLabel: "Новые планы",
    title: "Планы от USD10/мес.",
    accent: "Использование до 4,5x цены.",
    body: "Одна подписка покрывает GPT, Claude, Gemini, DeepSeek, Kimi и другие модели на официальных upstream token — месячное использование до 4,5x цены, плюс кредиты на изображения и видео.",
    officialTokens: "Официальные upstream token",
    longerBalance: "Текст, изображения и видео в одном плане",
    fabLabel: "Планы",
    fabValue: "от USD10/мес",
    closeLabel: "Закрыть панель планов",
    reopenLabel: "Открыть панель планов снова",
  },
  ja: {
    timerLabel: "新プラン",
    title: "プランは月額 USD10 から。",
    accent: "利用枠は料金の最大 4.5 倍。",
    body: "1 つのサブスクで GPT・Claude・Gemini・DeepSeek・Kimi ほかを公式 upstream token で利用可能——月間利用枠は料金の最大 4.5 倍、画像・動画クレジット付き。",
    officialTokens: "公式 upstream token",
    longerBalance: "テキスト・画像・動画を 1 プランで",
    fabLabel: "プラン",
    fabValue: "月額 USD10 から",
    closeLabel: "プランパネルを閉じる",
    reopenLabel: "プランパネルを再表示",
  },
  vi: {
    timerLabel: "Gói mới",
    title: "Các gói từ USD10/tháng.",
    accent: "Mức dùng tới 4,5x giá.",
    body: "Một gói thuê bao bao trọn GPT, Claude, Gemini, DeepSeek, Kimi và hơn thế trên token upstream chính thức — mức dùng hằng tháng tới 4,5x giá gói, kèm hạn mức ảnh và video.",
    officialTokens: "Token upstream chính thức",
    longerBalance: "Văn bản, ảnh và video trong một gói",
    fabLabel: "Gói",
    fabValue: "từ USD10/tháng",
    closeLabel: "Đóng bảng gói",
    reopenLabel: "Mở lại bảng gói",
  },
  de: {
    timerLabel: "Neue Pläne",
    title: "Pläne ab USD10/Monat.",
    accent: "Nutzung bis zum 4,5-Fachen des Preises.",
    body: "Ein Abo deckt GPT, Claude, Gemini, DeepSeek, Kimi und mehr auf offiziellen Upstream-Tokens ab — monatliche Nutzung bis zum 4,5-Fachen des Preises, plus Bild- und Video-Credits.",
    officialTokens: "Offizielle Upstream-Tokens",
    longerBalance: "Text, Bild und Video in einem Plan",
    fabLabel: "Pläne",
    fabValue: "ab USD10/Monat",
    closeLabel: "Plan-Panel schließen",
    reopenLabel: "Plan-Panel erneut öffnen",
  },
});

export function shouldShowOfferModal(elapsedMs: number) {
  return elapsedMs >= OFFER_DELAY_MS;
}

export function shouldShowOfferFab(state: {
  hasOfferStarted: boolean;
  isCollapsed: boolean;
}) {
  return state.hasOfferStarted && state.isCollapsed;
}

type Props = {
  ctaLabel: string;
  ctaUrl: string;
  locale: Locale;
};

export function LpLimitedOfferModal({ ctaLabel, ctaUrl, locale }: Props) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const copy = OFFER_MODAL_COPY[locale] ?? OFFER_MODAL_COPY.en;

  const hasOfferStarted = shouldShowOfferModal(elapsedMs);
  const isVisible = hasOfferStarted && !isCollapsed;
  const showFab = shouldShowOfferFab({ hasOfferStarted, isCollapsed });

  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 250);

    return () => window.clearInterval(timer);
  }, []);

  if (showFab) {
    return (
      <button
        type="button"
        aria-label={copy.reopenLabel}
        onClick={() => setIsCollapsed(false)}
        className="fixed right-4 bottom-20 z-50 inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-3 text-left text-slate-950 shadow-[0_18px_50px_-22px_rgba(15,23,42,0.45)] transition hover:bg-slate-50 dark:border-violet-300/40 dark:bg-slate-950 dark:text-white dark:shadow-[0_18px_50px_-22px_rgba(0,0,0,0.9)] dark:hover:bg-slate-900"
      >
        <span className="flex size-10 items-center justify-center rounded-full bg-violet-600 text-sm font-black text-white">
          4.5×
        </span>
        <span className="grid">
          <span className="text-xs font-black tracking-[0.14em] text-violet-600 uppercase dark:text-violet-300">{copy.fabLabel}</span>
          <span className="text-sm font-extrabold">{copy.fabValue}</span>
        </span>
      </button>
    );
  }

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/38 px-4 py-6 backdrop-blur-sm dark:bg-slate-950/72">
      <section
        aria-modal="true"
        role="dialog"
        aria-labelledby="lp-limited-offer-title"
        className="relative grid w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-950 shadow-[0_30px_100px_-36px_rgba(15,23,42,0.5)] md:grid-cols-[minmax(0,1fr)_420px] dark:border-white/15 dark:bg-slate-950 dark:text-white dark:shadow-[0_30px_100px_-36px_rgba(0,0,0,0.85)]"
      >
        <button
          type="button"
          aria-label={copy.closeLabel}
          onClick={() => setIsCollapsed(true)}
          className="absolute top-3 right-3 z-10 inline-flex size-9 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-700 transition hover:bg-slate-100 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/18"
        >
          <X className="size-4" />
        </button>

        <div className="p-6 pr-14 md:p-7 md:pr-10">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-black tracking-[0.2em] text-violet-600 uppercase dark:text-violet-300">
              <Sparkles className="size-4" />
              {copy.timerLabel}
            </span>
          </div>

          <h2 id="lp-limited-offer-title" className="mt-4 text-3xl leading-[1.02] font-black tracking-tight md:text-4xl">
            {copy.title}
            <span className="block text-yellow-500 dark:text-yellow-300">{copy.accent}</span>
          </h2>

          <p className="mt-4 max-w-lg text-sm leading-6 text-slate-600 md:text-base dark:text-slate-300">
            {copy.body}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-slate-700 dark:text-slate-200">
            <span className="inline-flex items-center gap-1.5">
              <BadgeCheck className="size-4 text-emerald-300" />
              {copy.officialTokens}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <BadgeCheck className="size-4 text-emerald-300" />
              {copy.longerBalance}
            </span>
          </div>

          <a
            href={ctaUrl}
            className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-yellow-300 px-6 text-sm font-black text-slate-950 transition hover:bg-yellow-200 sm:w-auto"
          >
            {ctaLabel}
            <ArrowRight className="size-4" />
          </a>
        </div>

        <div className="relative min-h-72 overflow-hidden border-t border-slate-200 bg-slate-100 md:min-h-0 md:border-t-0 md:border-l dark:border-white/12 dark:bg-slate-900/90">
          <div className="relative h-full min-h-72 md:min-h-96">
            <Image
              src="/lp/openai-10b-token-plaque.jpg"
              alt="OpenAI recognition plaque for passing 10 billion tokens"
              fill
              sizes="(min-width: 768px) 420px, 100vw"
              className="object-cover object-center"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
