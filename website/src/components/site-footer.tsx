import Image from "next/image";
import Link from "next/link";
import { Fragment } from "react";
import { FlatkeyBrandLogo } from "@/components/flatkey-brand-logo";
import { getCopy } from "@/lib/copy";
import { type Locale, localizePath } from "@/lib/locales";

type SiteFooterProps = {
  locale: Locale;
};

const TRUST_BADGES = [
  {
    src: "/trust/vanta-trust.png",
    alt: "GDPR powered by Vanta",
    href: "https://www.vanta.com/integrations?built-by=Partner",
    width: 1260,
    height: 1260,
  },
  {
    src: "/trust/soc2.png",
    alt: "CAI SOC 2 certification",
    href: "https://www.cert-assure.com/serchresult.php?type=Management+System+Certification&certificate=USA-SOC2-220513",
    width: 94,
    height: 94,
  },
  {
    src: "/trust/iso-27001.png",
    alt: "CAI ISO 27001:2022 certification",
    href: "https://www.cert-assure.com/serchresult.php?type=Management+System+Certification&certificate=USA-I-270513",
    width: 94,
    height: 94,
  },
] as const;

const LEGAL_LINKS = [
  { key: "termsOfService", href: "/terms" },
  { key: "privacyPolicy", href: "/privacy" },
  { key: "serviceLevelAgreement", href: "/sla" },
  { key: "refundPolicy", href: "/refund-policy" },
  { key: "supportEmail", href: "mailto:support@flatkey.ai" },
] as const;

function TrustedVerification(props: { locale: Locale; className?: string }) {
  const copy = getCopy(props.locale).footer;

  return (
    <div className={["border-border/30 mt-10 flex justify-center border-t pt-8", props.className].filter(Boolean).join(" ")}>
      <div className="flex w-fit flex-col items-center gap-4 text-center">
        <p className="text-foreground text-xs font-bold">{copy.trustedVerifiedBy}</p>
        <div className="flex w-full flex-wrap items-center justify-center gap-4">
          {TRUST_BADGES.map((badge) => (
            <a
              key={badge.href}
              href={badge.href}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex transition-opacity duration-200 hover:opacity-75"
            >
              <Image
                src={badge.src}
                alt={badge.alt}
                width={badge.width}
                height={badge.height}
                className="h-14 w-auto object-contain"
              />
            </a>
          ))}
        </div>
        <a
          href="mailto:support@flatkey.ai"
          className="text-muted-foreground/65 hover:text-foreground text-xs transition-colors duration-200"
        >
          {copy.emailSupport}
        </a>
      </div>
    </div>
  );
}

function LegalLinks(props: { locale: Locale; leadingSeparator?: boolean }) {
  const copy = getCopy(props.locale).footer;

  return (
    <>
      {LEGAL_LINKS.map((link, index) => {
        const label = copy[link.key];
        const isMail = link.href.startsWith("mailto:");

        return (
          <Fragment key={link.href}>
            {(props.leadingSeparator || index > 0) && (
              <span aria-hidden="true" className="text-muted-foreground/30">
                ·
              </span>
            )}
            {isMail ? (
              <a href={link.href} className="hover:text-foreground transition-colors duration-200">
                {label}
              </a>
            ) : (
              <Link href={localizePath(link.href, props.locale)} className="hover:text-foreground transition-colors duration-200">
                {label}
              </Link>
            )}
          </Fragment>
        );
      })}
    </>
  );
}

function ProjectAttribution(props: { currentYear: number; locale: Locale }) {
  const copy = getCopy(props.locale).footer;

  return (
    <div className="text-muted-foreground/32 text-center text-[10px] leading-relaxed sm:text-right">
      <span>
        &copy; {props.currentYear}{" "}
        <a
          href="https://flatkey.ai/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground/45 hover:text-muted-foreground/70 font-normal transition-colors"
        >
          flatkey.ai
        </a>
        . {copy.projectAttributionSuffix}
      </span>
    </div>
  );
}

export function SiteFooter(props: SiteFooterProps) {
  const copy = getCopy(props.locale).footer;
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-border/40 relative z-10 border-t">
      <div className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        <div className="grid gap-10 md:grid-cols-[minmax(200px,280px)_1fr] md:items-center md:gap-16">
          <div className="shrink-0">
            <Link href={localizePath("/", props.locale)} className="group inline-flex items-center">
              {/* Same natural mark+wordmark lockup as the header — the old
                  full-image variant relied on scale/translate cropping tuned
                  to the pre-v5 artwork and clipped the v5 shield mark. */}
              <FlatkeyBrandLogo className="transition-transform duration-300 group-hover:scale-[1.02]" />
              <span className="sr-only text-sm font-semibold tracking-tight">flatkey.ai</span>
            </Link>
            <p className="text-muted-foreground/60 mt-3 max-w-[200px] text-xs leading-relaxed">{copy.tagline}</p>
          </div>

          <TrustedVerification locale={props.locale} className="mt-0 border-t-0 pt-0 md:justify-end" />
        </div>

        <div className="border-border/30 mt-12 flex flex-col items-center justify-between gap-x-3 gap-y-2 border-t pt-6 sm:flex-row">
          <div className="text-muted-foreground/40 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs sm:justify-start">
            <span>
              &copy; {currentYear} flatkey.ai. {copy.defaultCopyright}
            </span>
            <LegalLinks locale={props.locale} leadingSeparator />
          </div>
          <ProjectAttribution currentYear={currentYear} locale={props.locale} />
        </div>
      </div>
    </footer>
  );
}
