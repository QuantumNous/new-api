import { describe, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

mock.module("server-only", () => ({}));

describe("OnlinePricingPage", () => {
  test("renders subscribe and contact sales actions below the plan prices", async () => {
    const { OnlinePricingPage } = await import("./online-pricing-page");
    const html = renderToStaticMarkup(<OnlinePricingPage locale="en" />);

    const goPrice = html.indexOf("<b>$10</b>");
    const proBadge = html.indexOf('<div class="tier hot"><div class="badge">MOST POPULAR</div><div class="tname">Pro</div>');
    const enterpriseCustom = html.indexOf(">Custom<");
    const goCta = html.indexOf("Subscribe", goPrice);
    const enterpriseCta = html.indexOf("Contact sales", enterpriseCustom);

    expect(goCta).toBeGreaterThanOrEqual(0);
    expect(goPrice).toBeGreaterThanOrEqual(0);
    expect(goCta).toBeGreaterThan(goPrice);
    expect(proBadge).toBeGreaterThanOrEqual(0);
    expect(html).not.toContain('<div class="tier hot"><div class="badge">MOST POPULAR</div><div class="tname">Go</div>');
    expect(enterpriseCta).toBeGreaterThanOrEqual(0);
    expect(enterpriseCustom).toBeGreaterThanOrEqual(0);
    expect(enterpriseCta).toBeGreaterThan(enterpriseCustom);
    expect(html).toContain('<div class="tprice"><b class="tcustom">Custom</b></div><a class="btn black tcta"');
    expect(html).toContain('data-payment-method="pix"');
    expect(html).toContain('<span class="pm" data-payment-method="card"');
    expect(html).not.toContain('aria-pressed="true"');
    expect(html).not.toContain('class="pm on"');
    expect(html).not.toContain('<button class="pm"');
    expect(html).toContain('payment_method%3Dstripe_recurring');
    expect(html).toContain("%2Fassets%2Flogos%2Fpayment%2Fpix.jpg");
    expect(html).toContain("%2Fassets%2Flogos%2Fpayment%2Fupi.jpg");
    expect(html).toContain('src="/assets/logos/payment/alipay.svg"');
    expect(html).toContain("All models");
    expect(html).not.toContain("Text models");
    expect(html).not.toContain("B2B");
  });

  test("localizes payment method labels outside English", async () => {
    const { OnlinePricingPage } = await import("./online-pricing-page");
    const zhHtml = renderToStaticMarkup(<OnlinePricingPage locale="zh" />);
    const esHtml = renderToStaticMarkup(<OnlinePricingPage locale="es" />);

    expect(zhHtml).toContain("支付方式");
    expect(zhHtml).toContain("银行卡 · 3DS");
    expect(zhHtml).toContain("支付宝");
    expect(esHtml).toContain("Paga con");
    expect(esHtml).toContain("Tarjeta · 3DS");
    expect(esHtml).not.toContain("Pay with");
  });

  test("localizes pricing plan details outside English", async () => {
    const { OnlinePricingPage } = await import("./online-pricing-page");
    const localizedCases = [
      { locale: "zh", snippets: ["灵活定价", "适合个人与轻量日常使用", "全部模型", "每月最多 $45 模型用量", "定制", "/月"] },
      { locale: "es", snippets: ["Precios flexibles", "Para uso individual y diario ligero", "Todos los modelos", "Hasta $45 de uso de modelos / mes", "Personalizado", "/mes"] },
      { locale: "fr", snippets: ["Tarifs flexibles", "Pour les particuliers", "Tous les modèles", "Jusqu", "$45", "Sur mesure", "/mois"] },
      { locale: "pt", snippets: ["Preços flexíveis", "Para uso individual", "Todos os modelos", "Até $45 de uso de modelos / mês", "Personalizado", "/mês"] },
      { locale: "ru", snippets: ["Гибкие тарифы", "Для индивидуального", "Все модели", "До $45 использования моделей / мес.", "Индивидуально", "/мес."] },
      { locale: "ja", snippets: ["柔軟な料金", "個人利用と軽い日常利用向け", "すべてのモデル", "月あたり最大 $45 のモデル利用", "カスタム", "/月"] },
      { locale: "vi", snippets: ["Giá linh hoạt", "Cho cá nhân", "Tất cả model", "Tối đa $45 mức sử dụng model / tháng", "Tùy chỉnh", "/tháng"] },
      { locale: "de", snippets: ["Flexible Preise", "Für Einzelpersonen", "Alle Modelle", "Bis zu $45 Modellnutzung / Monat", "Individuell", "/Monat"] },
      { locale: "id", snippets: ["Harga fleksibel", "Untuk individu", "Semua model", "Hingga $45 penggunaan model / bulan", "Kustom", "/bulan"] },
    ] as const;

    for (const item of localizedCases) {
      const html = renderToStaticMarkup(<OnlinePricingPage locale={item.locale} />);
      for (const snippet of item.snippets) {
        expect(html).toContain(snippet);
      }
      expect(html).not.toContain("For individuals & light daily use");
      expect(html).not.toContain("Text models");
      expect(html).not.toMatch(/media credits|media quota|media credit|crédit(?:s)? média|créditos multimedia|медиакредит|メディアクレジット|媒体额度|მედиа/i);
    }
  });

  test("does not render a separate media-credit balance in any locale", async () => {
    const { OnlinePricingPage } = await import("./online-pricing-page");
    for (const locale of ["en", "zh", "es", "fr", "pt", "ru", "ja", "vi", "de", "id"] as const) {
      const html = renderToStaticMarkup(<OnlinePricingPage locale={locale} />);
      expect(html).not.toMatch(/media credits|media quota|media credit|crédit(?:s)? média|créditos multimedia|медиакредит|メディアクレジット|媒体额度/i);
    }
  });

  test("does not publish legacy media-credit pricing copy", () => {
    const publicCopy = readFileSync(path.join(process.cwd(), "public", "assets", "i18n.js"), "utf8");
    const offerCopy = readFileSync(path.join(process.cwd(), "src", "components", "lp-limited-offer-modal.tsx"), "utf8");

    const legacyMediaCreditCopy = /media credits?|image (?:and video )?credits?|video credits?|媒体额度|媒体点数|图像与视频额度|créditos? (?:de )?imagen(?: y v[ií]deo)?|crédits? image(?: et vidéo)?|кредиты? на изображения(?: и видео)?|画像・動画クレジット|hạn mức ảnh và video|Bild- und Video-Credits/i;

    expect(publicCopy).not.toMatch(legacyMediaCreditCopy);
    expect(offerCopy).not.toMatch(legacyMediaCreditCopy);
    expect(publicCopy).not.toMatch(/"tu\.(?:mc|mv)[123]"/);
  });

  test("localizes only payable prices for Portuguese and Japanese", async () => {
    const { OnlinePricingPage } = await import("./online-pricing-page");
    const cases = [
      {
        locale: "pt",
        prices: ["R$ 49,90", "R$ 149,90", "R$ 499"],
        cta: "Assine Pro por R$ 149,90/mês e entre",
        retainedUsdCopy: "Até $45 de uso de modelos / mês",
      },
      {
        locale: "ja",
        prices: ["¥1,500", "¥4,500", "¥15,000"],
        cta: "Pro を ¥4,500/月で登録してログイン",
        retainedUsdCopy: "月あたり最大 $45 のモデル利用",
      },
    ] as const;

    for (const item of cases) {
      const html = renderToStaticMarkup(<OnlinePricingPage locale={item.locale} />);
      for (const price of item.prices) {
        expect(html).toContain(`<b>${price}</b>`);
      }
      expect(html).toContain(item.cta);
      expect(html).toContain(item.retainedUsdCopy);
      if (item.locale === "pt") expect(html).not.toContain("<b>R$ 499,90</b>");
      expect(html).not.toContain("<b>$10</b>");
      expect(html).not.toContain("<b>$30</b>");
      expect(html).not.toContain("<b>$100</b>");
    }
  });
});
