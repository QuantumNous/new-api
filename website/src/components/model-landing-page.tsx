"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { BadgeCheck, Sparkles } from "lucide-react";
import { SiteShell } from "@/components/site-shell";
import type { Locale } from "@/lib/locales";
import { modelLandingCopy, normalizeModelId, type ModelConfig, type ModelLandingKey } from "@/lib/model-landing";
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

export function ModelLandingPage({ config, locale, liveModels = [] }: Props) {
  const [prompt, setPrompt] = useState(config.examplePrompt);
  const signInHref = consoleUrl("/sign-up");
  const t = (key: ModelLandingKey, vars?: Record<string, string>) => modelLandingCopy(locale, key, vars);
  const sdkExampleModelId = getSdkExampleModelId(config.modelId);
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

  const onRunClick = (event: MouseEvent<HTMLAnchorElement>) => {
    (window as GtagWindow).gtag?.("event", "flatkey_sign_in_to_run_click", {
      model: config.slug,
    });
    event.currentTarget.href = `${consoleUrl("/sign-up")}${window.location.search}`;
  };

  return (
    <SiteShell locale={locale} pathname={`/models/${config.slug}`}>
      <div className="relative overflow-x-hidden bg-[linear-gradient(180deg,#f4f0ff_0%,#fbfaff_30%,#ffffff_62%,#f4f1ff_100%)] dark:bg-[linear-gradient(180deg,#050712_0%,#080b18_40%,#070712_72%,#03040b_100%)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-0 bg-[linear-gradient(to_right,rgba(124,58,237,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(124,58,237,0.1)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_64%_52%_at_50%_22%,black_18%,transparent_100%)] opacity-50 dark:opacity-40"
        />
        <div className="relative z-10 mx-auto max-w-5xl px-6 pt-16 pb-20 md:pt-24">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/22 bg-violet-500/10 px-3 py-1.5 text-[11px] font-semibold tracking-wide text-violet-700 uppercase dark:border-violet-300/20 dark:bg-violet-300/10 dark:text-violet-200">
            <Sparkles className="size-3.5" />
            {t("{{model}} · OpenAI-compatible · one key, all models", {
              model: config.displayName,
            })}
          </div>

          <h1 className="mt-5 text-[clamp(1.9rem,4.2vw,2.9rem)] leading-[1.12] font-bold tracking-tight">
            {t("The same {{model}},", { model: config.displayName })}{" "}
            <span className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-indigo-500 bg-clip-text text-transparent dark:from-violet-200 dark:via-fuchsia-300 dark:to-indigo-300">
              {t("30–50% cheaper")}
            </span>
          </h1>
          <p className="text-muted-foreground mt-4 max-w-2xl text-base leading-7">
            {t("Same {{official}} upstream, same quality — flatkey costs half. Change one line of base_url and your existing OpenAI SDK just works. Try it below, sign in when you are ready.", {
              official: config.officialName,
            })}
          </p>
          <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-6">
            {t(config.positioning)}
          </p>

          <div className="mt-7 grid grid-cols-1 overflow-hidden rounded-2xl border border-violet-500/16 bg-white/74 shadow-[0_24px_80px_-56px_rgba(91,33,182,0.86)] backdrop-blur-sm sm:grid-cols-[1fr_auto_1fr] dark:border-violet-300/14 dark:bg-white/[0.04]">
            <div className="p-6">
              <div className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
                {t("{{official}} official", { official: config.officialName })}
              </div>
              <div className="text-4xl font-extrabold tracking-tight text-red-500/60 line-through">
                {config.officialPrice}
              </div>
              <div className="text-muted-foreground mt-1 text-[13px]">
                {t(config.priceUnit)}
              </div>
            </div>
            <div className="text-muted-foreground hidden items-center justify-center px-3 text-sm font-bold sm:flex">
              VS
            </div>
            <div className="bg-emerald-500/[0.06] p-6">
              <div className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
                {t("flatkey · same model, same quality")}
              </div>
              <div className="text-4xl font-extrabold tracking-tight text-emerald-600">
                {config.flatkeyPrice}
              </div>
              <div className="text-muted-foreground mt-1 text-[13px]">
                {t(config.priceUnit)}
              </div>
            </div>
          </div>
          <div className="mt-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-3 text-center text-base font-extrabold text-white shadow-[0_18px_40px_-24px_rgba(5,150,105,0.8)]">
            {t("↓ Save 50% — double your token budget")}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-2xl border border-violet-500/16 bg-white/74 p-5 shadow-[0_24px_80px_-56px_rgba(91,33,182,0.86)] backdrop-blur-sm dark:border-violet-300/14 dark:bg-white/[0.04]">
              <div className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
                {t("Playground (edit before sign-up)")}
              </div>
              <div className="text-muted-foreground mb-2 flex justify-between text-xs">
                <span>
                  model: <b className="text-foreground">{config.modelId}</b>
                </span>
                <span>temp 0.7 · 1024 tok</span>
              </div>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                className="min-h-[118px] w-full resize-y rounded-xl border border-violet-500/18 bg-white/70 p-3 font-mono text-[13px] dark:bg-white/[0.03]"
              />
              <div className="my-2 flex flex-wrap gap-2">
                {["temperature 0.7", "max_tokens 1024", "top_p 1.0"].map((chip) => (
                  <span
                    key={chip}
                    className="text-muted-foreground rounded-lg border border-violet-500/16 bg-violet-500/[0.05] px-2.5 py-1 font-mono text-[11px]"
                  >
                    {chip}
                  </span>
                ))}
              </div>
              <a
                href={signInHref}
                onClick={onRunClick}
                className="block rounded-xl bg-violet-600 px-5 py-3.5 text-center text-[15px] font-semibold !text-white shadow-[0_16px_34px_-18px_rgba(124,58,237,0.85)] hover:bg-violet-500"
              >
                {t("▶ Sign in to run")}
                <span className="block text-[11px] font-normal text-white/90">
                  {t("Google / GitHub one-click · no credit card to start")}
                </span>
              </a>
              <div className="text-muted-foreground mt-2.5 text-center text-xs">
                {t("Est. this run")} <b className="text-emerald-600">≈ {config.estFlatkey}</b>{" "}
                {t("(flatkey · official ≈ {{price}})", {
                  price: config.estOfficial,
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-violet-500/16 bg-white/74 p-5 shadow-[0_24px_80px_-56px_rgba(91,33,182,0.86)] backdrop-blur-sm dark:border-violet-300/14 dark:bg-white/[0.04]">
              <div className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
                {t("Pricing vs official")}
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {config.rows.map((row) => (
                    <tr key={row.label} className="border-b border-violet-500/10 last:border-0">
                      <td className="py-2.5 pr-2">{t(row.label as ModelLandingKey)}</td>
                      <td className="py-2.5 text-right font-medium tabular-nums">
                        {row.official ? (
                          <>
                            <span className="text-emerald-600">{row.flatkey}</span>{" "}
                            <s className="text-muted-foreground/70">{row.official}</s>
                          </>
                        ) : (
                          <span className="text-emerald-600">
                            {row.value === "50% off" ? t("50% off") : row.value}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-muted-foreground/70 mt-3 text-[11px]">
                {t("* Illustrative pricing — see flatkey pricing page")}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-2xl border border-violet-500/16 bg-white/74 p-5 shadow-[0_24px_80px_-56px_rgba(91,33,182,0.86)] backdrop-blur-sm dark:border-violet-300/14 dark:bg-white/[0.04]">
              <div className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
                {t("Live model data from pricing API")}
              </div>
              <div className="text-2xl font-extrabold tracking-tight">
                {primaryLiveModel ? primaryLiveModel.model_name : config.modelId}
              </div>
              <div className="text-muted-foreground mt-1 text-sm">
                {primaryLiveModel?.vendor_name ?? config.officialName}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {primaryLiveModel ? (
                  isTokenBasedModel(primaryLiveModel) ? (
                    <>
                      <LiveMetric label="Input / 1M" value={formatModelPrice(primaryLiveModel, "input")} />
                      <LiveMetric label="Output / 1M" value={formatModelPrice(primaryLiveModel, "output")} />
                    </>
                  ) : (
                    <LiveMetric label="Request" value={formatModelPrice(primaryLiveModel)} />
                  )
                ) : (
                  <>
                    <LiveMetric label="Flatkey" value={config.flatkeyPrice} />
                    <LiveMetric label="Official" value={config.officialPrice} />
                  </>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {(primaryLiveModel?.supported_endpoint_types ?? config.modelIds).slice(0, 4).map((item) => (
                  <span key={item} className="rounded-lg border border-violet-500/16 bg-violet-500/[0.05] px-2.5 py-1 text-xs text-muted-foreground">
                    {item}
                  </span>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-violet-500/16 bg-white/74 p-5 shadow-[0_24px_80px_-56px_rgba(91,33,182,0.86)] backdrop-blur-sm dark:border-violet-300/14 dark:bg-white/[0.04]">
              <div className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
                {t("Matched live models")}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {(liveModels.length > 0 ? liveModels : [{ model_name: config.modelId, vendor_name: config.officialName } as PricingModel]).slice(0, 4).map((model) => (
                  <div key={model.model_name} className="rounded-xl border border-violet-500/12 bg-white/70 p-3 dark:bg-white/[0.03]">
                    <div className="break-all font-mono text-sm font-bold">{model.model_name}</div>
                    <div className="text-muted-foreground mt-1 text-xs">{model.vendor_name ?? config.officialName}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {config.useCases.map((useCase) => (
                  <div key={useCase} className="rounded-xl border border-violet-500/12 bg-violet-500/[0.05] px-3 py-2 text-sm font-semibold">
                    {t(useCase)}
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-violet-500/16 bg-[#faf8ff] dark:bg-white/[0.03]">
            <div className="flex items-center gap-1.5 border-b border-violet-500/12 px-4 py-2.5">
              <span className="size-2.5 rounded-full bg-[#ff5f57]" />
              <span className="size-2.5 rounded-full bg-[#febc2e]" />
              <span className="size-2.5 rounded-full bg-[#28c840]" />
              <span className="text-muted-foreground ml-2 font-mono text-xs">
                {t("migrate.py — change one line")}
              </span>
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-7 text-zinc-700 dark:text-zinc-300">
              <span className="text-muted-foreground">{t("# Your existing OpenAI code:")}</span>
              {"\n"}client = OpenAI(
              {"\n"}{"  "}
              <span className="border-l-2 border-violet-600 bg-violet-500/[0.08] pl-2">
                base_url=<span className="text-emerald-600">&quot;https://router.flatkey.ai/v1&quot;</span>
              </span>
              {"\n"}{"  "}api_key=<span className="text-emerald-600">&quot;sk-flatkey-...&quot;</span>,
              {"\n"})
              {"\n"}client.chat.completions.create(model=
              <span className="text-emerald-600">&quot;{sdkExampleModelId}&quot;</span>, ...)
            </pre>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {config.faq.map((item) => (
              <section key={item.question} className="rounded-2xl border border-violet-500/16 bg-white/74 p-5 shadow-[0_24px_80px_-56px_rgba(91,33,182,0.86)] backdrop-blur-sm dark:border-violet-300/14 dark:bg-white/[0.04]">
                <h2 className="text-base font-extrabold">{t(item.question)}</h2>
                <p className="text-muted-foreground mt-2 text-sm leading-6">{t(item.answer)}</p>
              </section>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-5 rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-500/[0.08] to-fuchsia-500/[0.06] p-5 px-6">
            <div>
              <div className="flex items-center gap-2 text-[17px] font-extrabold">
                <BadgeCheck className="size-4 text-violet-600" />
                {t("First top-up")} <span className="text-violet-600">{t("50% bonus")}</span>
              </div>
              <div className="text-muted-foreground mt-1 text-[13px]">
                {t("Pay to unlock · credited instantly · not a free-signup giveaway")}
              </div>
            </div>
            <div className="flex gap-2.5">
              <div className="rounded-xl border border-violet-500/18 bg-white/70 px-4 py-3 text-center dark:bg-white/[0.04]">
                <b className="block font-mono text-[15px] font-extrabold text-violet-700 dark:text-violet-200">
                  {t("Top up $200 get $100")}
                </b>
                <small className="text-muted-foreground text-[11px]">
                  {t("Starter / individual")}
                </small>
              </div>
              <div className="rounded-xl border border-violet-500/18 bg-white/70 px-4 py-3 text-center dark:bg-white/[0.04]">
                <b className="block font-mono text-[15px] font-extrabold text-violet-700 dark:text-violet-200">
                  {t("Top up $1000 get $500")}
                </b>
                <small className="text-muted-foreground text-[11px]">
                  {t("Team / high-volume")}
                </small>
              </div>
            </div>
            <a
              href={signInHref}
              onClick={onRunClick}
              className="ml-auto rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_34px_-18px_rgba(124,58,237,0.85)] hover:bg-violet-500"
            >
              {t("Sign in to claim →")}
            </a>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}

function getSdkExampleModelId(modelId: string) {
  return modelId === "gpt-5" ? "gpt-5.5" : modelId;
}

function LiveMetric(props: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-violet-500/12 bg-violet-500/[0.05] p-3">
      <div className="text-muted-foreground text-xs">{props.label}</div>
      <div className="mt-1 font-mono text-lg font-extrabold tabular-nums text-violet-700 dark:text-violet-200">
        {props.value}
      </div>
    </div>
  );
}
