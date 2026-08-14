"use client";

import Image from "next/image";
import Link from "next/link";
import { FlatkeyBrandLogo } from "@/components/flatkey-brand-logo";
import { useSiteConfig } from "@/components/site-config-provider";
import { getCopy } from "@/lib/copy";
import { type Locale, localizePath, withIdFallback } from "@/lib/locales";
import { consoleUrl } from "@/lib/origins";

type SiteFooterProps = {
  locale: Locale;
};

type FooterLink = {
  external?: boolean;
  href: string;
  label: string;
};

const footerLabels = withIdFallback({
  en: {
    product: "Product",
    developers: "Developers",
    company: "Company",
    socials: "Socials",
    tools: "Tools",
    playground: "Playground",
    compute: "Compute",
    usecases: "Use cases",
    status: "API status",
    careers: "Careers",
    about: "About",
    contact: "Contact us",
    trusted: "TRUSTED & VERIFIED BY",
    zeroRetention: "Zero retention of request content",
  },
  zh: {
    product: "产品",
    developers: "开发者",
    company: "公司",
    socials: "社交",
    tools: "工具",
    playground: "Playground",
    compute: "算力",
    usecases: "使用场景",
    status: "服务状态",
    careers: "加入我们",
    about: "关于我们",
    contact: "联系我们",
    trusted: "可信与认证",
    zeroRetention: "不保留请求内容",
  },
  es: {
    product: "Producto",
    developers: "Desarrolladores",
    company: "Empresa",
    socials: "Redes",
    tools: "Herramientas",
    playground: "Playground",
    compute: "Compute",
    usecases: "Casos de uso",
    status: "Estado de API",
    careers: "Carreras",
    about: "Acerca de",
    contact: "Contacto",
    trusted: "CONFIANZA Y VERIFICACIÓN",
    zeroRetention: "Cero retención del contenido de solicitudes",
  },
  fr: {
    product: "Produit",
    developers: "Développeurs",
    company: "Entreprise",
    socials: "Réseaux",
    tools: "Outils",
    playground: "Playground",
    compute: "Compute",
    usecases: "Cas d'usage",
    status: "Statut API",
    careers: "Carrières",
    about: "À propos",
    contact: "Contact",
    trusted: "CONFIANCE ET VÉRIFICATION",
    zeroRetention: "Aucune rétention du contenu des requêtes",
  },
  pt: {
    product: "Produto",
    developers: "Desenvolvedores",
    company: "Empresa",
    socials: "Redes",
    tools: "Ferramentas",
    playground: "Playground",
    compute: "Compute",
    usecases: "Casos de uso",
    status: "Status da API",
    careers: "Carreiras",
    about: "Sobre",
    contact: "Contato",
    trusted: "CONFIÁVEL E VERIFICADO",
    zeroRetention: "Zero retenção do conteúdo das solicitações",
  },
  ru: {
    product: "Продукт",
    developers: "Разработчикам",
    company: "Компания",
    socials: "Соцсети",
    tools: "Инструменты",
    playground: "Playground",
    compute: "Compute",
    usecases: "Сценарии",
    status: "Статус API",
    careers: "Вакансии",
    about: "О нас",
    contact: "Контакты",
    trusted: "ДОВЕРИЕ И ПРОВЕРКА",
    zeroRetention: "Нулевое хранение содержимого запросов",
  },
  ja: {
    product: "プロダクト",
    developers: "開発者向け",
    company: "会社",
    socials: "ソーシャル",
    tools: "ツール",
    playground: "Playground",
    compute: "Compute",
    usecases: "ユースケース",
    status: "API ステータス",
    careers: "採用情報",
    about: "会社概要",
    contact: "お問い合わせ",
    trusted: "信頼と認証",
    zeroRetention: "リクエスト内容を保持しません",
  },
  vi: {
    product: "Sản phẩm",
    developers: "Nhà phát triển",
    company: "Công ty",
    socials: "Mạng xã hội",
    tools: "Tools",
    playground: "Playground",
    compute: "Compute",
    usecases: "Use cases",
    status: "Trạng thái API",
    careers: "Tuyển dụng",
    about: "Giới thiệu",
    contact: "Liên hệ",
    trusted: "ĐÁNG TIN CẬY & ĐÃ XÁC MINH",
    zeroRetention: "Không lưu nội dung yêu cầu",
  },
  de: {
    product: "Produkt",
    developers: "Entwickler",
    company: "Unternehmen",
    socials: "Socials",
    tools: "Tools",
    playground: "Playground",
    compute: "Compute",
    usecases: "Anwendungsfälle",
    status: "API-Status",
    careers: "Karriere",
    about: "Über uns",
    contact: "Kontakt",
    trusted: "VERTRAUEN & VERIFIZIERUNG",
    zeroRetention: "Keine Speicherung von Anfrageinhalten",
  },
});

function FooterColumn(props: { links: FooterLink[]; locale: Locale; title: string }) {
  return (
    <div className="min-w-0">
      <h5 className="mb-3.5 text-sm font-semibold text-[#83838E]">{props.title}</h5>
      <div className="grid gap-[11px]">
        {props.links.map((link) =>
          link.external || link.href.startsWith("mailto:") ? (
            <a
              key={link.href}
              href={link.href}
              target={link.external ? "_blank" : undefined}
              rel={link.external ? "noopener noreferrer" : undefined}
              className="text-[15px] font-semibold text-[#0B0B0F] no-underline hover:text-[#4C1D95]"
            >
              {link.label}
            </a>
          ) : (
            <Link
              key={link.href}
              href={link.href === "/llms.txt" ? link.href : localizePath(link.href, props.locale)}
              className="text-[15px] font-semibold text-[#0B0B0F] no-underline hover:text-[#4C1D95]"
            >
              {link.label}
            </Link>
          )
        )}
      </div>
    </div>
  );
}

export function SiteFooter(props: SiteFooterProps) {
  const { docsUrl } = useSiteConfig();
  const siteCopy = getCopy(props.locale);
  const copy = siteCopy.footer;
  const labels = footerLabels[props.locale] ?? footerLabels.en;
  const currentYear = new Date().getFullYear();
  const productLinks: FooterLink[] = [
    { href: "/models", label: siteCopy.nav.modelPricing },
    { href: "/tools", label: labels.tools },
    { href: "/playground", label: labels.playground },
    { href: "/rankings", label: siteCopy.nav.rankings },
    { href: "/pricing", label: siteCopy.nav.pricing },
    { href: "/compute", label: labels.compute },
    { href: "/usecases", label: labels.usecases },
    { href: consoleUrl("/dashboard"), label: `${siteCopy.nav.console} ↗`, external: true },
  ];
  const developerLinks: FooterLink[] = [
    { href: "/cli", label: "CLI" },
    ...(docsUrl
      ? [{ href: docsUrl, label: siteCopy.nav.docs, external: true }]
      : []),
    { href: "/status", label: labels.status },
    { href: "/llms.txt", label: "llms.txt" },
    { href: "/blog", label: `${siteCopy.nav.blog} ↗` },
  ];
  const companyLinks: FooterLink[] = [
    { href: "/careers", label: labels.careers },
    { href: "/contact", label: labels.contact },
    { href: "/about", label: labels.about },
    { href: "/terms", label: copy.termsOfService },
    { href: "/privacy", label: copy.privacyPolicy },
    { href: "/sla", label: copy.serviceLevelAgreement },
    { href: "/refund-policy", label: copy.refundPolicy },
  ];
  const socialLinks: FooterLink[] = [
    { href: "https://x.com/flatkey101", label: "X @flatkey101", external: true },
    { href: "mailto:support@flatkey.ai", label: "support@flatkey.ai" },
    { href: "https://www.linkedin.com/company/flatkey/", label: "LinkedIn", external: true },
    { href: "https://discord.gg/Xnm8Cc7JRD", label: "Discord", external: true },
  ];

  return (
    <footer className="fk-site-footer relative overflow-hidden border-t border-[#0B0B0F14] bg-[#F7F6FB] text-[#0B0B0F]">
      <div className="fk-site-frame grid grid-cols-1 gap-8 pt-12 pb-2 sm:grid-cols-2 md:pt-14 lg:grid-cols-[2fr_repeat(4,1fr)] lg:gap-10">
        <div className="sm:col-span-2 lg:col-span-1">
          <Link href={localizePath("/", props.locale)} className="inline-flex items-center">
            <FlatkeyBrandLogo className="[&_[data-flatkey-wordmark='true']]:text-[30px] [&_img]:h-11 [&_img]:w-11" />
            <span className="sr-only">flatkey.ai</span>
          </Link>
          <p className="mt-3 max-w-[300px] text-sm leading-7 text-[#43434C]">{copy.tagline}</p>
        </div>

        <FooterColumn title={labels.product} links={productLinks} locale={props.locale} />
        <FooterColumn title={labels.developers} links={developerLinks} locale={props.locale} />
        <FooterColumn title={labels.company} links={companyLinks} locale={props.locale} />
        <FooterColumn title={labels.socials} links={socialLinks} locale={props.locale} />
      </div>

      <div className="fk-site-frame flex flex-wrap items-center gap-3 pt-5 pb-2">
        <span className="font-mono text-[10.5px] tracking-[1.2px] text-[#83838E]">{labels.trusted}</span>
        <a className="rounded-full border border-[#0B0B0F14] bg-white px-3.5 py-1.5 text-[13px] font-semibold text-[#43434C] hover:border-[#5B21B6] hover:text-[#4C1D95]" href="https://www.cert-assure.com/serchresult.php?type=Management+System+Certification&certificate=USA-SOC2-220513" target="_blank" rel="noopener noreferrer nofollow">
          SOC 2 Type II
        </a>
        <a className="rounded-full border border-[#0B0B0F14] bg-white px-3.5 py-1.5 text-[13px] font-semibold text-[#43434C] hover:border-[#5B21B6] hover:text-[#4C1D95]" href="https://www.cert-assure.com/serchresult.php?type=Management+System+Certification&certificate=USA-I-270513" target="_blank" rel="noopener noreferrer nofollow">
          ISO 27001
        </a>
        <span className="rounded-full border border-[#0B0B0F14] bg-white px-3.5 py-1.5 text-[13px] font-semibold text-[#43434C]">GDPR compliant</span>
        <a className="rounded-full border border-[#0B0B0F14] bg-white px-3.5 py-1.5 text-[13px] font-semibold text-[#43434C] hover:border-[#5B21B6] hover:text-[#4C1D95]" href="https://www.vanta.com/integrations?built-by=Partner" target="_blank" rel="noopener noreferrer nofollow">
          Vanta monitored
        </a>
        <span className="rounded-full border border-[#0B0B0F14] bg-white px-3.5 py-1.5 text-[13px] font-semibold text-[#43434C]">{labels.zeroRetention}</span>
      </div>

      <div className="fk-site-frame flex flex-col gap-6 pt-2 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
        <div className="max-w-[470px] pb-8 text-sm leading-7 text-[#43434C]">
          © {currentYear} flatkey.ai · VOC AI INC, San Jose, CA. {copy.defaultCopyright}{" "}
          <Link className="text-[#0B0B0F] underline underline-offset-4" href={localizePath("/terms", props.locale)}>
            Terms
          </Link>{" "}
          ·{" "}
          <Link className="text-[#0B0B0F] underline underline-offset-4" href={localizePath("/privacy", props.locale)}>
            Privacy
          </Link>{" "}
          ·{" "}
          <Link className="text-[#0B0B0F] underline underline-offset-4" href={localizePath("/sla", props.locale)}>
            SLA
          </Link>{" "}
          ·{" "}
          <Link className="text-[#0B0B0F] underline underline-offset-4" href={localizePath("/refund-policy", props.locale)}>
            Refunds
          </Link>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-[clamp(14px,1.8vw,30px)] pb-8 font-bold leading-none tracking-[-0.045em] whitespace-nowrap text-[#0B0B0F]">
          <Image src="/flatkey-mark.svg" alt="" width={160} height={160} className="h-[0.84em] w-[0.84em] text-[clamp(58px,13.5vw,200px)]" />
          <span className="text-[clamp(58px,13.5vw,200px)]">flatkey</span>
        </div>
      </div>

      <div className="flex h-2.5">
        <i className="flex-1 bg-[#0B0B0F]" />
        <i className="flex-1 bg-[#7C3AED]" />
        <i className="flex-1 bg-[#4C1D95]" />
        <i className="flex-1 bg-[#15803D]" />
        <i className="flex-1 bg-[#1E1B4B]" />
      </div>
    </footer>
  );
}
