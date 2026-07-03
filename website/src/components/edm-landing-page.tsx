import { ArrowRight, CheckCircle2, ExternalLink, ShieldCheck, Sparkles } from "lucide-react";
import Image from "next/image";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { LpLimitedOfferModal } from "@/components/lp-limited-offer-modal";
import type { EdmCampaignCopy } from "@/lib/edm-landing";
import { getEdmCtaUrl } from "@/lib/edm-landing";
import type { Locale } from "@/lib/locales";

type Props = {
  campaign: EdmCampaignCopy;
  locale: Locale;
  pathname: string;
};

const trustBadges = [
  { src: "/trust/vanta-trust.png", alt: "GDPR powered by Vanta" },
  { src: "/trust/soc2.png", alt: "SOC 2 certification" },
  { src: "/trust/iso-27001.png", alt: "ISO 27001 certification" },
];

export function shouldRenderLandingOfferModal(locale: Locale) {
  return locale !== "ja";
}

export function EdmLandingPage(props: Props) {
  const ctaUrl = getEdmCtaUrl();
  const mainClassName = ["min-h-screen bg-background pt-20 text-foreground", props.locale === "ja" ? "ja-gothic-landing" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <SiteHeader locale={props.locale} pathname={props.pathname} />
      <main className={mainClassName}>
      <section className="mx-auto grid max-w-6xl gap-8 px-5 py-9 md:grid-cols-[minmax(0,1.02fr)_minmax(340px,0.98fr)] md:px-6 md:py-14 lg:gap-14">
        <div className="flex flex-col justify-center">
          <p className="mb-3 text-xs font-bold tracking-[0.22em] text-violet-700 uppercase dark:text-violet-300">{props.campaign.eyebrow}</p>
          <div className="mb-4 inline-flex w-fit max-w-full items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-sm leading-5 font-semibold text-emerald-800 dark:text-emerald-300">
            <Sparkles className="size-4" />
            {props.campaign.badge}
          </div>
          <h1 className="max-w-3xl text-[2.25rem] leading-[1.08] font-bold tracking-tight text-balance max-[420px]:text-[2rem] md:text-5xl md:leading-[1.06]">
            {props.campaign.hero.title}{" "}
            <span className="text-violet-700 dark:text-violet-300">{props.campaign.hero.accent}</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground md:mt-5 md:text-lg">{props.campaign.hero.description}</p>
          {props.campaign.hero.highlight ? (
            <p className="mt-4 max-w-2xl border-l-4 border-violet-600 bg-card px-4 py-3 text-sm leading-6 font-semibold text-foreground shadow-[0_16px_50px_-40px_rgba(15,23,42,0.75)] max-[420px]:leading-6 md:mt-5 md:text-base md:leading-7 md:font-medium dark:border-violet-300 dark:bg-white/[0.04]">
              {props.campaign.hero.highlight}
            </p>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a
              href={ctaUrl}
              className="flatkey-primary-cta inline-flex h-12 items-center justify-center gap-2 rounded-lg px-6 text-sm font-bold transition hover:opacity-90"
            >
              {props.campaign.primaryCta}
              <ArrowRight className="size-4" />
            </a>
            {props.campaign.secondaryCta ? (
              <a
                href={props.campaign.secondaryCta.href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-border bg-card px-6 text-sm font-semibold text-foreground transition hover:bg-muted"
              >
                {props.campaign.secondaryCta.label}
                <ExternalLink className="size-4" />
              </a>
            ) : null}
          </div>
        </div>

        <aside className="relative">
          {props.campaign.heroPanel ? (
            <div className="rounded-lg border border-border bg-card p-5 shadow-[0_28px_90px_-60px_rgba(15,23,42,0.7)] md:p-6">
              <p className="text-xs font-bold tracking-[0.18em] text-violet-700 uppercase dark:text-violet-300">{props.campaign.heroPanel.kicker}</p>
              <h2 className="mt-3 text-2xl leading-tight font-bold tracking-tight text-foreground">
                {props.campaign.heroPanel.title}
              </h2>
              <div className="mt-5 divide-y divide-border border-y border-border">
                {props.campaign.heroPanel.rows.map((row) => (
                  <div key={row.label} className="grid grid-cols-1 gap-2 py-3 max-[420px]:grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-foreground">{row.label}</h3>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{row.body}</p>
                    </div>
                    <div className="break-words text-left text-xl leading-tight font-bold tracking-tight text-violet-700 sm:text-right sm:text-2xl dark:text-violet-300">{row.value}</div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">{props.campaign.heroPanel.footnote}</p>
            </div>
          ) : props.campaign.showcase ? (
            <div className="grid gap-3">
              {props.campaign.showcase.map((item) => (
                <figure
                  key={item.src}
                  className={[
                    "overflow-hidden rounded-lg border border-border bg-card shadow-[0_22px_70px_-50px_rgba(15,23,42,0.75)]",
                    item.wide ? "md:col-span-2" : "",
                  ].join(" ")}
                >
                  <div className={item.wide ? "relative aspect-[2/1]" : "relative aspect-[4/3]"}>
                    <Image
                      src={item.src}
                      alt={item.alt}
                      fill
                      priority={item.wide}
                      sizes={item.wide ? "(min-width: 768px) 520px, 100vw" : "(min-width: 768px) 250px, 100vw"}
                      className="object-cover"
                    />
                  </div>
                  <figcaption className="border-t border-border p-3">
                    <h2 className="text-sm font-bold">{item.title}</h2>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.body}</p>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-card shadow-[0_28px_90px_-50px_rgba(15,23,42,0.65)]">
              <Image
                src="/lp/openai-10b-token-plaque.jpg"
                alt="OpenAI recognition plaque for passing 10 billion tokens"
                width={1792}
                height={1152}
                priority
                className="aspect-[4/3] w-full object-cover object-[50%_62%]"
              />
              <div className="border-t border-border p-5">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-1 size-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                  <div>
                    <h2 className="text-base font-bold">{props.campaign.proof.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{props.campaign.proof.body}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </aside>
      </section>

      {props.campaign.showcase || props.campaign.heroPanel ? (
        <section className="border-y border-border bg-card/70">
          <div className="mx-auto grid max-w-6xl gap-6 px-5 py-8 md:grid-cols-[minmax(260px,0.7fr)_1fr] md:px-6">
            <div className="overflow-hidden rounded-lg border border-border bg-muted">
              <Image
                src="/lp/openai-10b-token-plaque.jpg"
                alt="OpenAI recognition plaque for passing 10 billion tokens"
                width={1792}
                height={1152}
                className="aspect-[16/10] w-full object-cover object-[50%_62%]"
              />
            </div>
            <div className="flex items-center gap-3">
              <ShieldCheck className="size-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
              <div>
                <h2 className="text-base font-bold">{props.campaign.proof.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{props.campaign.proof.body}</p>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="border-y border-border bg-card/70">
        <div className="mx-auto grid max-w-6xl gap-4 px-5 py-8 md:grid-cols-3 md:px-6">
          {props.campaign.evidence.map((item) => (
            <article key={item.title} className="rounded-lg border border-border bg-muted p-5">
              <CheckCircle2 className="mb-4 size-5 text-emerald-700 dark:text-emerald-300" />
              <h2 className="text-base font-bold">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14 md:px-6 md:py-18">
        <div className="max-w-2xl">
          <p className="text-xs font-bold tracking-[0.22em] text-violet-700 uppercase dark:text-violet-300">
            {props.campaign.sectionLabels.startEyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight">{props.campaign.sectionLabels.startTitle}</h2>
        </div>
        <div className="mt-8 grid gap-4 border-y border-border py-6 md:grid-cols-3 md:gap-0">
          {props.campaign.steps.map((step, index) => (
            <article
              key={step.title}
              className="relative grid grid-cols-[2.25rem_1fr] gap-4 md:block md:border-l md:border-border md:pl-6 md:first:border-l-0 md:first:pl-0"
            >
              <div className="flex size-9 items-center justify-center rounded-full bg-violet-500/12 text-sm font-bold text-violet-800 md:mb-4 dark:text-violet-200">
                {index + 1}
              </div>
              <div>
                <h3 className="font-bold">{step.title}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{step.body}</p>
                {index === 0 ? (
                  <a
                    href={ctaUrl}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-violet-700 transition hover:text-violet-900 dark:text-violet-300 dark:hover:text-violet-200"
                  >
                    {props.campaign.primaryCta}
                    <ArrowRight className="size-3.5" />
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>

        <div className="mt-12 border-t border-border pt-10">
          <p className="text-xs font-bold tracking-[0.22em] text-violet-700 uppercase dark:text-violet-300">
            {props.campaign.sectionLabels.faqEyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight">{props.campaign.sectionLabels.faqTitle}</h2>
          <div className="mt-6 divide-y divide-border border-y border-border">
            {props.campaign.faqs.map((faq) => (
              <article key={faq.question} className="grid gap-2 py-5 md:grid-cols-[minmax(220px,0.42fr)_1fr] md:gap-8">
                <h3 className="font-bold">{faq.question}</h3>
                <p className="text-sm leading-6 text-muted-foreground">{faq.answer}</p>
              </article>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            {trustBadges.map((badge) => (
              <Image
                key={badge.src}
                src={badge.src}
                alt={badge.alt}
                width={120}
                height={120}
                className="h-12 w-auto rounded bg-white object-contain p-1 ring-1 ring-border"
              />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-card/70 px-5 py-14 md:px-6 md:py-18">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">{props.campaign.finalTitle}</h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">{props.campaign.finalBody}</p>
          <a
            href={ctaUrl}
            className="flatkey-primary-cta mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-lg px-6 text-sm font-bold transition hover:opacity-90"
          >
            {props.campaign.primaryCta}
            <ArrowRight className="size-4" />
          </a>
        </div>
      </section>
      <SiteFooter locale={props.locale} />
      {shouldRenderLandingOfferModal(props.locale) ? (
        <LpLimitedOfferModal ctaLabel={props.campaign.primaryCta} ctaUrl={ctaUrl} locale={props.locale} />
      ) : null}
      </main>
    </>
  );
}
