import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { FiveCreditPromoPage, PROMO_CLAIM_URL } from "./five-credit-promo-page";

describe("FiveCreditPromoPage", () => {
  test("renders the approved Portuguese promotion copy and CTA", () => {
    const html = renderToStaticMarkup(<FiveCreditPromoPage />);

    expect(html).toContain("Ganhe US$5 em créditos para APIs de IA");
    expect(html).toContain("Crie sua conta na Flatkey, resgate US$5 em créditos e comece a testar APIs de IA.");
    expect(html).toContain("Crédito promocional para novos usuários. Sem cartão. Limitado a uma vez por conta.");
    expect(html).toContain("Resgate sem recarga inicial");
    expect(html).toContain("Modelos disponíveis");
    expect(html).toContain("Não é necessário fazer recarga para resgatar o crédito.");
    expect(html).toContain("DeepSeek");
    expect(html).toContain("Qwen");
    expect(html).toContain("Kimi");
    expect(html).toContain("Seedance");
    expect(html).toContain("Claude");
    expect(html).toContain("GPT");
    expect(html).not.toContain("GLM");
    const modelSection = html.slice(html.indexOf("Modelos disponíveis"));
    expect(modelSection.indexOf("Claude")).toBeLessThan(modelSection.indexOf("DeepSeek"));
    expect(modelSection.indexOf("GPT")).toBeLessThan(modelSection.indexOf("DeepSeek"));
    expect(html).toContain("/logos/deepseek.svg");
    expect(html).toContain("/logos/moonshotai.svg");
    expect(html).toContain("/logos/bytedance.svg");
    expect(html).toContain(PROMO_CLAIM_URL.replaceAll("&", "&amp;"));
  });

  test("uses the existing console redemption flow without top-up copy", () => {
    const html = renderToStaticMarkup(<FiveCreditPromoPage />);

    expect(PROMO_CLAIM_URL).toBe("https://console.flatkey.ai/redeem?from=google");
    expect(html).toContain("Sem necessidade de recarga para resgatar.");
    expect(html).not.toContain("top up");
    expect(html).not.toContain("Faça seu primeiro top up");
  });
});
