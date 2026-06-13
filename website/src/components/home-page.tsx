import Link from "next/link";
import { SiteShell } from "@/components/site-shell";
import { getCopy } from "@/lib/copy";
import type { Locale } from "@/lib/locales";
import { localizePath } from "@/lib/locales";

type Props = {
  locale: Locale;
};

export function HomePage(props: Props) {
  const copy = getCopy(props.locale);
  const metrics = [
    ["40+", "Provider adapters"],
    ["1", "Unified API surface"],
    ["24/7", "Operational telemetry"],
  ];

  return (
    <SiteShell locale={props.locale} pathname="/">
      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow">flatkey.ai</p>
          <h1>{copy.home.title}</h1>
          <p>{copy.home.description}</p>
          <div className="hero-actions">
            <Link className="primary-button" href={localizePath("/pricing", props.locale)}>
              {copy.home.primary}
            </Link>
            <Link className="secondary-button" href={localizePath("/blog", props.locale)}>
              {copy.home.secondary}
            </Link>
          </div>
        </div>
        <div className="signal-panel" aria-label="Platform highlights">
          {metrics.map(([value, label]) => (
            <div key={label}>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="feature-grid">
        {[
          ["Model routing", "Route requests across providers with controlled fallback behavior."],
          ["Usage analytics", "Track spend, latency, errors, and user activity from one gateway."],
          ["Billing controls", "Keep quotas, pricing, and account-level operations auditable."],
        ].map(([title, body]) => (
          <article key={title} className="feature-card">
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </section>
    </SiteShell>
  );
}
