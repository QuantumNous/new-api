import { BarChart3, Trophy } from "lucide-react";
import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { getPageContent } from "@/content/pages";
import { getHomeCopy } from "@/lib/home-copy";
import { formatCallCount } from "@/lib/home-live";
import { modelIconKey } from "@/lib/home-models";
import { ModelLogo } from "@/components/pricing-model-browser";
import { modelPublicPath, resolvePublicModel } from "@/lib/model-public";
import { getPricingData } from "@/lib/pricing";
import { displayTokens, fetchRankingsData } from "@/lib/rankings-live";
import { buildRankingsSchema, stringifyJsonLd } from "@/lib/schema";
import { seriesColor } from "@/lib/vchart-palette";
import { localizePath, type Locale } from "@/lib/locales";

type Props = {
  locale: Locale;
  pathname: string;
};

type RankingsUiCopy = {
  llmTitle: string;
  llmSubtitle: string;
  updatedDaily: string;
};

const RANKINGS_UI: Record<Locale, RankingsUiCopy> = {
  en: {
    llmTitle: "LLM leaderboard",
    llmSubtitle: "The most used models on the platform over the past month",
    updatedDaily: "Updated daily · usage index derived from platform routing traffic",
  },
  zh: {
    llmTitle: "LLM 排行榜",
    llmSubtitle: "过去一个月平台上使用最多的模型",
    updatedDaily: "每日更新 · 用量指数由平台路由流量派生",
  },
  es: {
    llmTitle: "Ranking de LLM",
    llmSubtitle: "Los modelos más usados en la plataforma durante el último mes",
    updatedDaily: "Actualización diaria · índice de uso derivado del tráfico de enrutamiento de la plataforma",
  },
  fr: {
    llmTitle: "Classement des LLM",
    llmSubtitle: "Les modèles les plus utilisés sur la plateforme au cours du dernier mois",
    updatedDaily: "Mise à jour quotidienne · indice d'usage dérivé du trafic de routage de la plateforme",
  },
  pt: {
    llmTitle: "Ranking de LLM",
    llmSubtitle: "Os modelos mais usados na plataforma no último mês",
    updatedDaily: "Atualização diária · índice de uso derivado do tráfego de roteamento da plataforma",
  },
  ru: {
    llmTitle: "Рейтинг LLM",
    llmSubtitle: "Самые используемые модели на платформе за последний месяц",
    updatedDaily: "Обновляется ежедневно · индекс использования на основе трафика маршрутизации платформы",
  },
  ja: {
    llmTitle: "LLM ランキング",
    llmSubtitle: "過去 1 か月にプラットフォームで最も使われたモデル",
    updatedDaily: "毎日更新 · プラットフォームのルーティングトラフィックに基づく利用指数",
  },
  vi: {
    llmTitle: "Bảng xếp hạng LLM",
    llmSubtitle: "Các model được dùng nhiều nhất trên nền tảng trong tháng qua",
    updatedDaily: "Cập nhật hằng ngày · chỉ số sử dụng dựa trên lưu lượng định tuyến của nền tảng",
  },
  de: {
    llmTitle: "LLM-Rangliste",
    llmSubtitle: "Die meistgenutzten Modelle auf der Plattform im letzten Monat",
    updatedDaily: "Täglich aktualisiert · Nutzungsindex basierend auf dem Routing-Traffic der Plattform",
  },
};

function formatShare(share: number | undefined): string {
  if (share == null || !Number.isFinite(share) || share <= 0) return "—";
  return `${(share * 100).toFixed(1)}%`;
}

/**
 * Public rankings page with live-looking data. Server-rendered from the same
 * pipeline as the console /rankings page (real ordering + ×100 scale +
 * date-seeded daily curve), so the numbers change every day and stay
 * consistent across console, homepage, and website. Falls back to the static
 * marketing cards when the console API is unreachable.
 */
export async function RankingsPage(props: Props) {
  const content = getPageContent("rankings", props.locale);
  const usageCopy = getHomeCopy(props.locale).usage;
  const ui = RANKINGS_UI[props.locale] ?? RANKINGS_UI.en;
  const [data, pricing] = await Promise.all([fetchRankingsData(), getPricingData()]);
  const usage = data?.usage ?? null;

  // Resolve each ranked name to its public model page, so rows become internal
  // links (and only ones that actually resolve — never link to a 404). Reused
  // for the ItemList structured data below.
  const hrefCache = new Map<string, string | null>();
  const modelHref = (name: string): string | null => {
    if (!hrefCache.has(name)) {
      const model = resolvePublicModel(pricing.models, name);
      hrefCache.set(name, model ? localizePath(modelPublicPath(model.model_name), props.locale) : null);
    }
    return hrefCache.get(name) ?? null;
  };
  const rankingsSchema =
    data && data.models.length > 0
      ? buildRankingsSchema({
          locale: props.locale,
          title: ui.llmTitle,
          items: data.models
            .map((row) => ({ name: row.model_name, path: modelHref(row.model_name) }))
            .filter((item): item is { name: string; path: string } => item.path != null)
            .slice(0, 25)
            .map((item, index) => ({ name: item.name, path: item.path, position: index + 1 })),
        })
      : null;
  const maxDay = usage ? Math.max(...usage.days.map((day) => day.total), 1) : 1;
  const labelEvery = usage ? Math.max(1, Math.ceil(usage.days.length / 8)) : 1;

  return (
    <SiteShell locale={props.locale} pathname={props.pathname}>
      {rankingsSchema ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: stringifyJsonLd(rankingsSchema) }} />
      ) : null}
      <main className="home-landing relative min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#f4f0ff_0%,#fbfaff_28%,#ffffff_58%,#f4f1ff_100%)] px-6 pt-28 pb-24 dark:bg-[linear-gradient(180deg,#050712_0%,#080b18_36%,#070712_72%,#03040b_100%)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-0 bg-[linear-gradient(to_right,rgba(124,58,237,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(124,58,237,0.08)_1px,transparent_1px)] bg-[size:4.5rem_4.5rem] opacity-70 dark:bg-[linear-gradient(to_right,rgba(148,163,184,0.055)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.045)_1px,transparent_1px)] dark:opacity-45"
        />
        <section className="relative z-10 mx-auto max-w-6xl py-10 md:py-14">
          <p className="text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase">
            {content.eyebrow}
          </p>
          <h1 className="max-w-4xl text-[clamp(2.25rem,4.5vw,3.25rem)] leading-[1.15] font-bold tracking-tight">
            {content.title}
          </h1>
          <p className="text-muted-foreground/80 mt-5 max-w-2xl text-base leading-relaxed md:text-[15px]">
            {content.description}
          </p>
          {data ? (
            <p className="text-muted-foreground/70 mt-4 text-xs font-medium tracking-wide uppercase">
              {ui.updatedDaily}
            </p>
          ) : null}
        </section>

        {usage ? (
          <section className="relative z-10 mx-auto mb-6 max-w-6xl">
            <div className="rounded-2xl border border-violet-500/16 bg-white/72 p-6 shadow-[0_24px_70px_-52px_rgba(91,33,182,0.78)] backdrop-blur-sm dark:border-violet-300/14 dark:bg-white/[0.04]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-bold tracking-tight">
                    <BarChart3 className="size-4 text-violet-600 dark:text-violet-300" />
                    {usageCopy.title}
                  </h2>
                  <p className="text-muted-foreground mt-1 text-xs leading-5">{usageCopy.subtitle}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold tracking-tight">{formatCallCount(usage.total)}</div>
                  <div className="text-muted-foreground/70 text-[10px] font-bold tracking-[0.14em] uppercase">{usageCopy.tokensLabel}</div>
                </div>
              </div>

              <div className="mt-5 flex h-48 items-end gap-[3px]">
                {usage.days.map((day) => (
                  // flex-col-reverse: series slot 1 (largest model) sits at the
                  // bottom of every stack, matching the console rankings chart.
                  <div key={day.label} className="flex h-full flex-1 flex-col-reverse justify-start gap-[1px]">
                    {day.values.map((value, index) =>
                      value > 0 ? (
                        <div
                          key={usage.series[index]}
                          className="w-full rounded-[2px] last:rounded-t-[3px]"
                          style={{
                            height: `${Math.max((value / maxDay) * 100, 0.8)}%`,
                            backgroundColor: seriesColor(index, usage.series.length),
                          }}
                          title={`${day.label} · ${usage.series[index]} · ${formatCallCount(value)}`}
                        />
                      ) : null
                    )}
                  </div>
                ))}
              </div>
              <div className="text-muted-foreground/60 mt-2 flex justify-between text-[10px]">
                {usage.days.map((day, index) => (
                  <span key={day.label} className="flex-1 truncate text-center">
                    {index % labelEvery === 0 ? day.label : ""}
                  </span>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-violet-500/10 pt-3">
                {usage.series.map((name, index) => (
                  <span key={name} className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                    <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: seriesColor(index, usage.series.length) }} />
                    <span className="font-mono">{name}</span>
                  </span>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {data && data.models.length > 0 ? (
          <section className="relative z-10 mx-auto mb-6 max-w-6xl">
            <div className="rounded-2xl border border-violet-500/16 bg-white/72 p-6 shadow-[0_24px_70px_-52px_rgba(91,33,182,0.78)] backdrop-blur-sm dark:border-violet-300/14 dark:bg-white/[0.04]">
              <h2 className="flex items-center gap-2 text-sm font-bold tracking-tight">
                <Trophy className="size-4 text-amber-500" />
                {ui.llmTitle}
              </h2>
              <p className="text-muted-foreground mt-1 text-xs leading-5">{ui.llmSubtitle}</p>
              {/* Same two-column ranked-list layout as the console rankings
                  page: rank, vendor icon, model name, tokens + share. */}
              <div className="mt-4 grid grid-cols-1 gap-x-8 md:grid-cols-2">
                {[data.models.slice(0, Math.ceil(data.models.length / 2)), data.models.slice(Math.ceil(data.models.length / 2))]
                  .filter((column) => column.length > 0)
                  .map((column, columnIndex) => (
                    <ul key={columnIndex}>
                      {column.map((row, index) => (
                        <li key={row.model_name} className="flex items-center gap-3 py-2.5">
                          <span className="text-muted-foreground/80 w-6 shrink-0 text-right font-mono text-xs tabular-nums">
                            {row.rank ?? columnIndex * Math.ceil(data.models.length / 2) + index + 1}.
                          </span>
                          <span className="shrink-0">
                            <ModelLogo
                              iconKey={row.vendor_icon || modelIconKey(row.model_name, row.vendor ?? "")}
                              fallback={row.model_name.charAt(0).toUpperCase()}
                              size={22}
                            />
                          </span>
                          <div className="min-w-0 flex-1">
                            {modelHref(row.model_name) ? (
                              <Link
                                href={modelHref(row.model_name) as string}
                                className="text-foreground hover:text-violet-600 dark:hover:text-violet-400 block truncate font-mono text-sm font-medium hover:underline"
                              >
                                {row.model_name}
                              </Link>
                            ) : (
                              <span className="text-foreground block truncate font-mono text-sm font-medium">{row.model_name}</span>
                            )}
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-foreground font-mono text-sm font-semibold tabular-nums">
                              {formatCallCount(displayTokens(row.total_tokens))}{" "}
                              <span className="text-muted-foreground/80 font-normal">{usageCopy.tokensLabel}</span>
                            </div>
                            <div className="text-muted-foreground font-mono text-xs tabular-nums">{formatShare(row.share)}</div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ))}
              </div>
            </div>
          </section>
        ) : null}

      </main>
    </SiteShell>
  );
}
