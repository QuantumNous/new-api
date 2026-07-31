import Link from "next/link";
import type { ReactNode } from "react";
import { OnlineLanguageSelect } from "@/components/online-language-select";
import { type Locale, withIdFallback } from "@/lib/locales";
import { getOnlineStaticCopy } from "@/lib/online-static-copy";
import { consoleUrl } from "@/lib/origins";

type ShellProps = {
  active?: "models" | "pricing" | "playground" | "compute" | "usecases" | "status";
  children: ReactNode;
  contactAction?: boolean;
  locale: Locale;
  pathname?: string;
};

function asset(path: string) {
  return `/assets/${path}`;
}

const navGroupLabels: Record<Locale, { developers: string; products: string; resources: string }> = withIdFallback({
  en: { products: "Products", developers: "Developers", resources: "Resources" },
  zh: { products: "产品", developers: "开发者", resources: "资源" },
  es: { products: "Productos", developers: "Desarrolladores", resources: "Recursos" },
  fr: { products: "Produits", developers: "Développeurs", resources: "Ressources" },
  pt: { products: "Produtos", developers: "Desenvolvedores", resources: "Recursos" },
  ru: { products: "Продукты", developers: "Разработчикам", resources: "Ресурсы" },
  ja: { products: "プロダクト", developers: "開発者向け", resources: "リソース" },
  vi: { products: "Sản phẩm", developers: "Nhà phát triển", resources: "Tài nguyên" },
  de: { products: "Produkte", developers: "Entwickler", resources: "Ressourcen" },
});

type NavLink = {
  active?: ShellProps["active"];
  external?: boolean;
  href: string;
  label: string;
  target?: "_blank";
};

function NavGroup(props: { current?: ShellProps["active"]; items: NavLink[]; label: string }) {
  const isCurrent = props.items.some((item) => item.active && item.active === props.current);
  return (
    <div className={`nav-group${isCurrent ? " is-current" : ""}`}>
      <button className="nav-group-trigger" type="button" aria-haspopup="true" aria-expanded="false">
        <span className="nav-group-dot" aria-hidden="true" />
        <span className="nav-group-label">{props.label}</span>
      </button>
      <div className="nav-group-menu" role="menu">
        {props.items.map((item) => {
          const className = item.active && item.active === props.current ? "is-current-link" : undefined;
          return item.external ? (
            <a className={className} href={item.href} key={item.href} target={item.target} rel={item.target ? "noopener noreferrer" : undefined} role="menuitem">
              {item.label}
            </a>
          ) : (
            <Link className={className} href={item.href} key={item.href} role="menuitem">
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function OnlineNav(props: { active?: ShellProps["active"]; contactAction?: boolean; locale: Locale; pathname?: string }) {
  const copy = getOnlineStaticCopy(props.locale);
  const groupLabels = navGroupLabels[props.locale];
  const products: NavLink[] = [
    { active: "models", href: "/models", label: copy.nav.models },
    { external: true, href: consoleUrl("/api-marketplace"), label: copy.nav.tools },
    { active: "playground", href: "/playground", label: copy.nav.playground },
    { active: "compute", href: "/compute", label: copy.nav.compute },
  ];
  const developers: NavLink[] = [
    { href: "/cli", label: copy.nav.cli },
    { external: true, href: "https://docs.flatkey.ai/", label: copy.nav.docs, target: "_blank" },
  ];
  const resources: NavLink[] = [
    { href: "/models#leaderboard", label: copy.nav.rankings },
    { active: "usecases", href: "/usecases", label: copy.nav.useCases },
    { active: "status", href: "/status", label: copy.nav.status },
  ];

  return (
    <nav className="nav pricing-nav">
      <Link className="logo" href="/">
        <img src={asset("flatkey-mark.svg?v=4")} alt="flatkey" />
        flatkey
      </Link>
      <div className="desktop-nav-groups">
        <NavGroup current={props.active} label={groupLabels.products} items={products} />
        <NavGroup current={props.active} label={groupLabels.developers} items={developers} />
        <NavGroup current={props.active} label={groupLabels.resources} items={resources} />
      </div>
      <Link href="/pricing" className={props.active === "pricing" ? "on" : undefined} data-i18n="nav.pricing">
        {copy.nav.pricing}
      </Link>
      <div className="sp" />
      <OnlineLanguageSelect locale={props.locale} pathname={props.pathname ?? "/"} />
      <Link href="/login" data-i18n="nav.signin">{copy.nav.signin}</Link>
      {props.contactAction !== false && (
        <Link className="btn white" href="/contact" data-i18n="nav.contact">
          {copy.nav.contact}
        </Link>
      )}
      <Link className="btn black" href="/login" data-i18n="nav.start">
        {copy.nav.start}
      </Link>
    </nav>
  );
}

export function OnlineFooter(props: { locale: Locale }) {
  const copy = getOnlineStaticCopy(props.locale);
  return (
    <>
      <footer className="megafoot">
        <div className="cols">
          <div className="col brandcol">
            <Link className="logo" href="/">
              <img src={asset("flatkey-mark.svg?v=4")} alt="flatkey" />
              flatkey
            </Link>
            <p>{copy.footer.brand}</p>
          </div>
          <div className="col">
            <h5>{copy.footer.product}</h5>
            <Link href="/models">{copy.footer.models}</Link>
            <Link href="/playground">{copy.footer.playground}</Link>
            <Link href="/rankings">{copy.footer.rankings}</Link>
            <Link href="/pricing">{copy.nav.pricing}</Link>
            <Link href="/compute">{copy.footer.compute}</Link>
            <Link href="/usecases">{copy.footer.useCases}</Link>
            <a href={consoleUrl("/dashboard")}>{copy.footer.console}</a>
          </div>
          <div className="col">
            <h5>{copy.footer.developers}</h5>
            <Link href="/cli" data-i18n="nav.cli">CLI</Link>
            <Link href="/docs">{copy.footer.docs}</Link>
            <Link href="/docs#community">gateway-bench</Link>
            <Link href="/status">{copy.footer.apiStatus}</Link>
            <a href="https://docs.flatkey.ai/llms.txt">llms.txt</a>
            <Link href="/blog">{copy.footer.blog}</Link>
          </div>
          <div className="col">
            <h5>{copy.footer.company}</h5>
            <Link href="/careers">{copy.footer.careers}</Link>
            <Link href="/contact">{copy.footer.contact}</Link>
            <Link href="/about">{copy.footer.about}</Link>
            <Link href="/terms">{copy.footer.termsFull}</Link>
            <Link href="/privacy">{copy.footer.privacyFull}</Link>
            <Link href="/sla">{copy.footer.serviceLevelFull}</Link>
            <Link href="/refund-policy">{copy.footer.refundFull}</Link>
          </div>
          <div className="col">
            <h5>{copy.footer.social}</h5>
            <a href="https://x.com/flatkey101">X @flatkey101</a>
            <a href="mailto:support@flatkey.ai">support@flatkey.ai</a>
            <Link href="/docs#community">GitHub</Link>
            <a href="https://www.linkedin.com/company/flatkey/">LinkedIn</a>
            <a href="https://discord.gg/VrbZFDXj5g">Discord</a>
          </div>
        </div>
        <div className="trustrow">
          <span>{copy.footer.trusted}</span>
          <a href="https://www.cert-assure.com/serchresult.php?type=Management+System+Certification&certificate=USA-SOC2-220513">SOC 2 Type II</a>
          <a href="https://www.cert-assure.com/serchresult.php?type=Management+System+Certification&certificate=USA-I-270513">ISO 27001</a>
          <span className="b">{copy.footer.gdpr}</span>
          <a href="https://www.vanta.com/integrations?built-by=Partner">{copy.footer.vanta}</a>
          <span className="b">{copy.footer.zeroRetention}</span>
        </div>
        <div className="bottom">
          <div className="legal">
            {copy.footer.legalPrefix} <Link href="/terms">{copy.footer.terms}</Link> · <Link href="/privacy">{copy.footer.privacy}</Link> · <Link href="/sla">{copy.footer.serviceLevel}</Link> ·{" "}
            <Link href="/refund-policy">{copy.footer.refund}</Link>
          </div>
          <div className="word">
            <img src={asset("flatkey-mark.svg?v=4")} alt="" />
            flatkey
          </div>
        </div>
      </footer>
      <div className="stripe">
        <i className="s1" />
        <i className="s2" />
        <i className="s3" />
        <i className="s4" />
        <i className="s5" />
      </div>
    </>
  );
}

export function OnlineStaticShell(props: ShellProps) {
  return (
    <>
      <link rel="stylesheet" href="/fk2.css?v=728n" />
      <style>
        {`
          .nav-group:hover .nav-group-menu,
          .nav-group:focus-within .nav-group-menu {
            opacity: 1;
            visibility: visible;
            transform: translate(-50%,0) scale(1);
            pointer-events: auto;
          }
          .nav-group:hover .nav-group-trigger,
          .nav-group:focus-within .nav-group-trigger {
            color: var(--ink);
            background: var(--line2);
            outline: none;
          }
        `}
      </style>
      <OnlineNav active={props.active} contactAction={props.contactAction} locale={props.locale} pathname={props.pathname} />
      {props.children}
      <OnlineFooter locale={props.locale} />
    </>
  );
}
