"use client";

import { ArrowRight, BadgeCheck, Clock3, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { Locale } from "@/lib/locales";

const OFFER_DELAY_MS = 5_000;
const OFFER_DURATION_SECONDS = 10 * 60;

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
  reopenLabel: (countdown: string) => string;
};

export const OFFER_MODAL_COPY: Record<Locale, OfferModalCopy> = {
  en: {
    timerLabel: "Limited offer",
    title: "Recharge USD20, get USD5 bonus.",
    accent: "GPT Plus x3 style value.",
    body: "Use official-token AI for longer than a fixed monthly plan. Absolute genuine quality, backed by our OpenAI 10B-token recognition.",
    officialTokens: "Official upstream tokens",
    longerBalance: "Bonus balance lasts longer",
    fabLabel: "Offer",
    fabValue: "USD20 + USD5",
    closeLabel: "Close limited offer",
    reopenLabel: (countdown) => `Reopen limited offer, ${countdown} left`,
  },
  zh: {
    timerLabel: "限时优惠",
    title: "充值 USD20，送 USD5。",
    accent: "GPT Plus x3 级使用价值。",
    body: "使用官方上游 token，比固定月费套餐用得更久。正品质量保证，并有 OpenAI 10B token 认可作为背书。",
    officialTokens: "官方上游 token",
    longerBalance: "赠送余额可用更久",
    fabLabel: "优惠",
    fabValue: "USD20 + USD5",
    closeLabel: "关闭限时优惠",
    reopenLabel: (countdown) => `重新打开限时优惠，剩余 ${countdown}`,
  },
  es: {
    timerLabel: "Oferta limitada",
    title: "Recarga USD20 y recibe USD5 extra.",
    accent: "Valor tipo GPT Plus x3.",
    body: "Usa IA con tokens oficiales durante más tiempo que con un plan mensual fijo. Calidad genuina garantizada, respaldada por nuestro reconocimiento de OpenAI por 10B tokens.",
    officialTokens: "Tokens oficiales upstream",
    longerBalance: "El saldo extra dura más",
    fabLabel: "Oferta",
    fabValue: "USD20 + USD5",
    closeLabel: "Cerrar oferta limitada",
    reopenLabel: (countdown) => `Reabrir oferta limitada, quedan ${countdown}`,
  },
  fr: {
    timerLabel: "Offre limitée",
    title: "Rechargez USD20, recevez USD5 offerts.",
    accent: "Valeur façon GPT Plus x3.",
    body: "Utilisez l'IA avec des tokens officiels plus longtemps qu'avec un forfait mensuel fixe. Qualité authentique garantie, appuyée par notre reconnaissance OpenAI pour 10B tokens.",
    officialTokens: "Tokens upstream officiels",
    longerBalance: "Le bonus dure plus longtemps",
    fabLabel: "Offre",
    fabValue: "USD20 + USD5",
    closeLabel: "Fermer l'offre limitée",
    reopenLabel: (countdown) => `Rouvrir l'offre limitée, ${countdown} restantes`,
  },
  pt: {
    timerLabel: "Oferta limitada",
    title: "Recarregue USD20 e ganhe USD5 bônus.",
    accent: "Valor estilo GPT Plus x3.",
    body: "Use IA com tokens oficiais por mais tempo do que em um plano mensal fixo. Qualidade genuína garantida, com reconhecimento da OpenAI por 10B tokens.",
    officialTokens: "Tokens oficiais upstream",
    longerBalance: "O saldo bônus dura mais",
    fabLabel: "Oferta",
    fabValue: "USD20 + USD5",
    closeLabel: "Fechar oferta limitada",
    reopenLabel: (countdown) => `Reabrir oferta limitada, restam ${countdown}`,
  },
  ru: {
    timerLabel: "Ограниченное предложение",
    title: "Пополните на USD20 и получите USD5 бонусом.",
    accent: "Ценность в стиле GPT Plus x3.",
    body: "Используйте ИИ на официальных upstream token дольше, чем в фиксированном месячном плане. Подлинное качество гарантировано и подтверждено признанием OpenAI за 10B tokens.",
    officialTokens: "Официальные upstream token",
    longerBalance: "Бонусный баланс действует дольше",
    fabLabel: "Оффер",
    fabValue: "USD20 + USD5",
    closeLabel: "Закрыть ограниченное предложение",
    reopenLabel: (countdown) => `Открыть предложение снова, осталось ${countdown}`,
  },
  ja: {
    timerLabel: "期間限定オファー",
    title: "USD20 チャージで USD5 ボーナス。",
    accent: "GPT Plus x3 相当の利用価値。",
    body: "公式 upstream token の AI を、固定月額プランより長く使えます。OpenAI の 10B token 認定に裏付けられた、本物の品質を保証します。",
    officialTokens: "公式 upstream token",
    longerBalance: "ボーナス残高を長く使える",
    fabLabel: "オファー",
    fabValue: "USD20 + USD5",
    closeLabel: "期間限定オファーを閉じる",
    reopenLabel: (countdown) => `期間限定オファーを再表示、残り ${countdown}`,
  },
  vi: {
    timerLabel: "Ưu đãi giới hạn",
    title: "Nạp USD20, nhận thêm USD5.",
    accent: "Giá trị kiểu GPT Plus x3.",
    body: "Dùng AI bằng token upstream chính thức lâu hơn so với gói tháng cố định. Chất lượng chính hãng được bảo đảm, có chứng nhận OpenAI mốc 10B token.",
    officialTokens: "Token upstream chính thức",
    longerBalance: "Số dư thưởng dùng lâu hơn",
    fabLabel: "Ưu đãi",
    fabValue: "USD20 + USD5",
    closeLabel: "Đóng ưu đãi giới hạn",
    reopenLabel: (countdown) => `Mở lại ưu đãi giới hạn, còn ${countdown}`,
  },
  de: {
    timerLabel: "Zeitlich begrenztes Angebot",
    title: "USD20 aufladen, USD5 Bonus erhalten.",
    accent: "Wert wie GPT Plus x3.",
    body: "Nutze KI mit offiziellen Upstream-Tokens länger als mit einem festen Monatsplan. Echte Qualität garantiert, gestützt durch unsere OpenAI-Anerkennung für 10B Tokens.",
    officialTokens: "Offizielle Upstream-Tokens",
    longerBalance: "Bonusguthaben hält länger",
    fabLabel: "Angebot",
    fabValue: "USD20 + USD5",
    closeLabel: "Zeitlich begrenztes Angebot schließen",
    reopenLabel: (countdown) => `Zeitlich begrenztes Angebot erneut öffnen, ${countdown} verbleibend`,
  },
};

export function shouldShowOfferModal(elapsedMs: number) {
  return elapsedMs >= OFFER_DELAY_MS;
}

export function getOfferCountdownSeconds(elapsedMs: number) {
  return Math.max(0, OFFER_DURATION_SECONDS - Math.floor(elapsedMs / 1_000));
}

export function formatOfferCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export function shouldShowOfferFab(state: {
  hasOfferStarted: boolean;
  isCollapsed: boolean;
  secondsLeft: number;
}) {
  return state.hasOfferStarted && state.isCollapsed && state.secondsLeft > 0;
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
  const secondsLeft = getOfferCountdownSeconds(Math.max(0, elapsedMs - OFFER_DELAY_MS));
  const isVisible = hasOfferStarted && !isCollapsed && secondsLeft > 0;
  const showFab = shouldShowOfferFab({ hasOfferStarted, isCollapsed, secondsLeft });
  const countdown = useMemo(() => formatOfferCountdown(secondsLeft), [secondsLeft]);

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
        aria-label={copy.reopenLabel(countdown)}
        onClick={() => setIsCollapsed(false)}
        className="fixed right-4 bottom-20 z-50 inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-3 text-left text-slate-950 shadow-[0_18px_50px_-22px_rgba(15,23,42,0.45)] transition hover:bg-slate-50 dark:border-yellow-300/40 dark:bg-slate-950 dark:text-white dark:shadow-[0_18px_50px_-22px_rgba(0,0,0,0.9)] dark:hover:bg-slate-900"
      >
        <span className="flex size-10 items-center justify-center rounded-full bg-red-600 text-sm font-black tabular-nums">
          {countdown}
        </span>
        <span className="grid">
          <span className="text-xs font-black tracking-[0.14em] text-red-600 uppercase dark:text-yellow-300">{copy.fabLabel}</span>
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
            <span className="inline-flex items-center gap-1.5 text-xs font-black tracking-[0.2em] text-red-600 uppercase dark:text-yellow-300">
              <Clock3 className="size-4" />
              {copy.timerLabel}
            </span>
            <span className="inline-flex items-center rounded-full bg-red-600 px-3 py-1.5 text-sm font-black text-white tabular-nums">
              {countdown}
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
