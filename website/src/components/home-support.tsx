"use client";

import { Mail, MessageCircle, Smartphone } from "lucide-react";
import type { HomeCopy } from "@/lib/home-copy";

const SUPPORT_EMAIL = "support@flatkey.ai";
const SUPPORT_SMS_NUMBER = "+15705397112";
const SUPPORT_SMS_DISPLAY = "+1 (570) 539-7112";
const SUPPORT_X_URL = "https://x.com/flatkey101";
const SUPPORT_X_HANDLE = "@flatkey101";

// The Solvea livechat embed (bootstrapped in root-document.tsx) appends a
// <shulex-chatbot-lancher> custom element whose shadow root holds the real
// launcher button. The embed lazy-loads on the first pointerdown, so the
// click that lands here may arrive before it exists — retry briefly.
function openLiveChat() {
  let attempts = 0;
  const tryOpen = () => {
    const host = document.querySelector("shulex-chatbot-lancher");
    const target = host?.shadowRoot?.getElementById("livechat_launcher_btn") ?? host;
    if (target instanceof HTMLElement) {
      target.click();
      return;
    }
    attempts += 1;
    if (attempts < 24) setTimeout(tryOpen, 250);
  };
  tryOpen();
}

type Props = {
  copy: HomeCopy["support"];
};

// Official X logo mark (lucide has no up-to-date X icon).
function XLogo(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={props.className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function HomeSupport({ copy }: Props) {
  const cardClass =
    "group flex flex-col items-start rounded-2xl border border-violet-500/16 bg-white/62 p-7 text-left shadow-[0_24px_70px_-52px_rgba(91,33,182,0.78)] backdrop-blur-sm transition-colors duration-300 hover:border-violet-500/28 hover:bg-white/78 md:p-8 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]";
  const iconClass =
    "mb-5 flex size-12 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/8 text-violet-700 shadow-[0_18px_44px_-30px_rgba(124,58,237,0.8)] transition-transform duration-300 group-hover:scale-[1.03] dark:text-violet-300";
  const actionClass = "mt-auto inline-flex items-center pt-5 text-sm font-semibold text-violet-700 dark:text-violet-300";

  return (
    <section className="relative z-10 border-t border-violet-500/10 px-6 py-20 md:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 max-w-2xl">
          <p className="text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase">{copy.eyebrow}</p>
          <h2 className="text-2xl leading-tight font-bold tracking-tight md:text-3xl">{copy.title}</h2>
          <p className="text-muted-foreground mt-4 text-sm leading-relaxed md:text-base">{copy.description}</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <a className={cardClass} href={`mailto:${SUPPORT_EMAIL}`}>
            <div className={iconClass}>
              <Mail className="size-5" strokeWidth={1.6} />
            </div>
            <h3 className="text-lg font-semibold tracking-tight">{copy.email.title}</h3>
            <p className="text-muted-foreground mt-2 text-sm leading-6">{copy.email.desc}</p>
            <span className={actionClass}>{SUPPORT_EMAIL}</span>
          </a>
          <button type="button" className={`${cardClass} cursor-pointer`} onClick={openLiveChat}>
            <div className={iconClass}>
              <MessageCircle className="size-5" strokeWidth={1.6} />
            </div>
            <h3 className="text-lg font-semibold tracking-tight">{copy.chat.title}</h3>
            <p className="text-muted-foreground mt-2 text-sm leading-6">{copy.chat.desc}</p>
            <span className={actionClass}>{copy.chat.action}</span>
          </button>
          <a className={cardClass} href={`sms:${SUPPORT_SMS_NUMBER}`}>
            <div className={iconClass}>
              <Smartphone className="size-5" strokeWidth={1.6} />
            </div>
            <h3 className="text-lg font-semibold tracking-tight">{copy.sms.title}</h3>
            <p className="text-muted-foreground mt-2 text-sm leading-6">{copy.sms.desc}</p>
            <span className={actionClass}>{SUPPORT_SMS_DISPLAY}</span>
          </a>
          <a className={cardClass} href={SUPPORT_X_URL} target="_blank" rel="noopener noreferrer">
            <div className={iconClass}>
              <XLogo className="size-4" />
            </div>
            <h3 className="text-lg font-semibold tracking-tight">{copy.x.title}</h3>
            <p className="text-muted-foreground mt-2 text-sm leading-6">{copy.x.desc}</p>
            <span className={actionClass}>{SUPPORT_X_HANDLE}</span>
          </a>
        </div>
      </div>
    </section>
  );
}
