"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, X } from "lucide-react";
import { FlatkeyTallyEmbed } from "@/components/flatkey-tally-embed";
import type { Locale } from "@/lib/locales";
import { SIGN_UP_URL } from "@/lib/pricing-links";
import type { PricingPlan } from "@/components/pricing-page";

type PricingPlansGridProps = {
  plans: PricingPlan[];
  locale: Locale;
};

export function PricingPlansGrid(props: PricingPlansGridProps) {
  const [contactOpen, setContactOpen] = useState(false);

  useEffect(() => {
    if (!contactOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setContactOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [contactOpen]);

  return (
    <>
      <section className="mt-10 grid gap-4 lg:grid-cols-4">
        {props.plans.map((plan) => (
          <article
            key={plan.name}
            className={[
              "relative flex min-h-[440px] flex-col rounded-2xl border bg-white/78 p-6 shadow-[0_24px_80px_-56px_rgba(91,33,182,0.68)] backdrop-blur-sm dark:bg-white/[0.055] dark:shadow-[0_24px_80px_-56px_rgba(124,58,237,0.95)]",
              plan.featured ? "border-violet-500/45 ring-2 ring-violet-500/12 dark:border-violet-300/45 dark:ring-violet-300/15" : "border-violet-500/14 dark:border-white/10",
            ].join(" ")}
          >
            {plan.badge ? (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600 px-3.5 py-1 text-xs font-bold whitespace-nowrap text-white shadow-[0_12px_30px_-18px_rgba(91,33,182,0.8)]">{plan.badge}</span>
            ) : null}
            <h2 className="text-xl font-black text-slate-950 dark:text-white">{plan.name}</h2>
            <p className="mt-2 h-[4.5rem] text-sm leading-6 text-slate-600 dark:text-slate-300">{plan.description}</p>
            <div className="relative mt-6 w-fit pr-20">
              <span className={plan.price === "Custom" ? "text-4xl font-black tracking-tight text-slate-950 dark:text-white" : "text-5xl font-black tracking-tight text-slate-950 dark:text-white"}>{plan.price}</span>
              {plan.discount ? (
                <span className="absolute top-1/2 right-0 -translate-y-1/2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-black whitespace-nowrap text-emerald-700 dark:border-emerald-300/20 dark:bg-emerald-300/10 dark:text-emerald-200">{plan.discount}</span>
              ) : null}
            </div>
            {plan.action === "contact" ? (
              <button
                type="button"
                onClick={() => setContactOpen(true)}
                className="mt-6 inline-flex h-11 items-center justify-center rounded-xl border border-violet-500/18 bg-violet-500/8 px-4 text-sm font-bold text-violet-700 transition-colors hover:bg-violet-500/12 dark:border-violet-300/20 dark:bg-violet-300/10 dark:text-violet-100 dark:hover:bg-violet-300/15"
              >
                {plan.cta}
                <ArrowRight className="ml-2 size-4" />
              </button>
            ) : (
              <a
                href={plan.checkoutUrl ?? SIGN_UP_URL}
                className={[
                  "mt-6 inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-bold transition-colors",
                  plan.featured ? "bg-violet-600 !text-white hover:bg-violet-500 dark:bg-violet-500 dark:hover:bg-violet-400" : "border border-violet-500/18 bg-violet-500/8 text-violet-700 hover:bg-violet-500/12 dark:border-violet-300/20 dark:bg-violet-300/10 dark:text-violet-100 dark:hover:bg-violet-300/15",
                ].join(" ")}
              >
                {plan.cta}
                <ArrowRight className="ml-2 size-4" />
              </a>
            )}
            <p className="mt-3 min-h-10 text-sm leading-5 text-slate-500 dark:text-slate-400">{plan.caption}</p>
            <div className="mt-6 space-y-3">
              {plan.features.map((feature) => (
                <p key={feature} className="flex gap-2 text-sm leading-6 text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-violet-600 dark:text-violet-300" />
                  <span>{feature}</span>
                </p>
              ))}
            </div>
          </article>
        ))}
      </section>

      <div
        className={[
          "fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm transition-opacity duration-200",
          contactOpen ? "visible opacity-100" : "pointer-events-none invisible opacity-0",
        ].join(" ")}
        role="dialog"
        aria-hidden={!contactOpen}
        aria-modal="true"
        aria-labelledby="enterprise-contact-title"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) setContactOpen(false);
        }}
      >
        <div className="relative max-h-[94dvh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-violet-500/14 bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-[#080b18] sm:p-5 lg:max-w-4xl">
          <button
            type="button"
            onClick={() => setContactOpen(false)}
            className="absolute top-4 right-4 inline-flex size-9 items-center justify-center rounded-full border border-violet-500/14 bg-violet-500/8 text-slate-500 transition-colors hover:bg-violet-500/12 hover:text-slate-950 dark:border-violet-300/20 dark:bg-violet-300/10 dark:text-slate-300 dark:hover:bg-violet-300/15 dark:hover:text-white"
            aria-label="Close enterprise contact form"
            tabIndex={contactOpen ? 0 : -1}
          >
            <X className="size-4" />
          </button>
          <div className="pr-10">
            <p className="text-xs font-bold tracking-[0.18em] text-violet-700 uppercase dark:text-violet-200">Enterprise teams</p>
            <h2 id="enterprise-contact-title" className="mt-2 text-2xl font-black text-slate-950 dark:text-white">
              Contact sales
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Need higher monthly usage, invoicing, team procurement, or custom routing discounts? Send the form and we will follow up.
            </p>
          </div>
          {contactOpen ? (
            <FlatkeyTallyEmbed
              locale={props.locale}
              loading="lazy"
              iframeClassName="block h-[72dvh] min-h-[620px] w-full border-0 bg-transparent"
              className="mt-4 rounded-xl border border-violet-500/12 bg-white/62 p-2 shadow-[0_18px_46px_-36px_rgba(91,33,182,0.5)] dark:border-white/10 dark:bg-white/[0.06]"
            />
          ) : null}
        </div>
      </div>
    </>
  );
}
