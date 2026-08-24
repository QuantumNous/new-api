import Link from "next/link";
import { type Locale, localizePath } from "@/lib/locales";
import { getOnlineStaticCopy } from "@/lib/online-static-copy";
import { consoleUrl } from "@/lib/origins";
import { OnlinePaymentMethodPicker } from "./online-payment-method-picker";
import { OnlineStaticShell } from "./online-static-shell";

const paymentMethods = [
  { kind: "card" },
  { height: 450, kind: "pix", src: "/assets/logos/payment/pix.jpg", width: 800 },
  { height: 900, kind: "upi", src: "/assets/logos/payment/upi.jpg", width: 1200 },
  { height: 77, kind: "alipay", src: "/assets/logos/payment/alipay.svg", width: 298 },
  { height: 96, kind: "usdc", src: "/assets/logos/payment/usdc.svg", width: 96 },
] as const;

type PaymentMethod = (typeof paymentMethods)[number];
type PlanName = "go" | "pro" | "max";
type PaymentCurrency = "USD" | "BRL" | "JPY";

const plans = [
  {
    href: subscriptionSignupHref("go"),
    hot: false,
    name: "Go",
    prices: { BRL: 49.9, JPY: 1_500, USD: 10 },
  },
  {
    href: subscriptionSignupHref("pro"),
    hot: true,
    name: "Pro",
    prices: { BRL: 149.9, JPY: 4_500, USD: 30 },
  },
  {
    href: subscriptionSignupHref("max"),
    hot: false,
    name: "Max",
    prices: { BRL: 499, JPY: 15_000, USD: 100 },
  },
] as const;

function paymentCurrency(locale: Locale): PaymentCurrency {
  if (locale === "pt") return "BRL";
  if (locale === "ja") return "JPY";
  return "USD";
}

function formatPaymentPrice(locale: Locale, prices: Readonly<Record<PaymentCurrency, number>>): string {
  const currency = paymentCurrency(locale);
  const amount = prices[currency];
  if (currency === "BRL") {
    return `R$ ${amount.toLocaleString("pt-BR", {
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: 2,
    })}`;
  }
  if (currency === "JPY") return `¥${amount.toLocaleString("ja-JP")}`;
  return `$${amount.toLocaleString("en-US")}`;
}

function subscriptionPaymentMethod(kind: PaymentMethod["kind"]) {
  if (kind === "card") return "stripe_recurring";
  if (kind === "pix" || kind === "upi" || kind === "alipay") return kind;
  return undefined;
}

function subscriptionSignupHref(plan: PlanName, paymentMethod?: string) {
  const redirectParams = new URLSearchParams({ intent: "subscribe", plan });
  if (paymentMethod) redirectParams.set("payment_method", paymentMethod);
  return consoleUrl("/sign-up", `redirect=${encodeURIComponent(`/wallet?${redirectParams}`)}`);
}

export function OnlinePricingPage(props: { locale: Locale }) {
  return (
    <OnlineStaticShell locale={props.locale} pathname="/pricing">
      <OnlinePricingPlansSection locale={props.locale} />
    </OnlineStaticShell>
  );
}

export function OnlinePricingPlansSection(props: { locale: Locale }) {
  const copy = getOnlineStaticCopy(props.locale);
  const displayedPlans = plans.map((plan) => ({
    ...plan,
    price: formatPaymentPrice(props.locale, plan.prices),
  }));
  const proPrice = displayedPlans.find((plan) => plan.name === "Pro")!.price;
  return (
    <>
      <style>{`
        .wrap{max-width:var(--fk-site-frame-max-width);margin:0 auto;padding:72px var(--fk-site-gutter)}.wrap>.display{font-size:46px;line-height:1.08;letter-spacing:0}.wrap>.sub{max-width:860px;font-size:16.5px;line-height:1.62}.tiers{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin:46px 0 30px}.tier{background:#fff;border:1.5px solid var(--line);border-radius:20px;padding:32px 27px;position:relative;display:grid;grid-template-rows:auto 66px 58px 48px 1fr;align-content:start}.tier.hot{border-color:var(--violet);box-shadow:0 18px 54px rgba(109,92,255,.16)}.tier .badge{position:absolute;top:-14px;left:24px;background:var(--violet);color:#fff;font-size:12px;font-weight:800;padding:6px 14px;border-radius:999px}.tier b{font-size:38px;letter-spacing:0;font-weight:650;line-height:1}.tier .tname{font-family:var(--disp);font-size:24px;letter-spacing:0;font-weight:700;color:var(--ink)}.tier .taud{font-size:14px;color:var(--ink3);margin:5px 0 0;line-height:1.45;min-height:0}.tier .per{font-size:15.5px;color:var(--ink3);font-weight:650;line-height:1;margin-left:3px}.tier .tprice{min-height:0;display:flex;align-items:baseline;white-space:nowrap}.tier .tcustom{font-size:30px}.tval{background:var(--violet-tint);border-radius:14px;padding:18px 17px;margin:16px 0 20px}.tglabel{font-family:var(--mono);font-size:11.5px;letter-spacing:.8px;color:var(--ink3);font-weight:700;display:block;margin-bottom:6px;text-transform:uppercase}.tgmain{color:var(--violet-deep);font-weight:850;font-size:16px;letter-spacing:0}.tgsub{font-size:13.5px;color:var(--ink2);margin-top:5px;line-height:1.55}.tdiv{border-top:1px dashed #D8D0F2;margin:15px 0}.tcta{margin:0;text-align:center;display:flex;align-items:center;justify-content:center;width:100%;height:48px;font-size:14.5px;line-height:1.15}.tier p{font-size:14.5px;color:var(--ink2);line-height:1.62}.pay{background:#fff;border:1.5px solid var(--line);border-radius:20px;padding:28px;display:flex;align-items:center;column-gap:30px;row-gap:14px;flex-wrap:wrap}.payLabel{font-weight:800;font-size:14px}.pm{display:inline-flex;align-items:center;gap:6px;min-height:48px;border:0;border-radius:0;padding:0;font:inherit;font-weight:750;font-size:14px;line-height:1;white-space:nowrap;background:transparent;color:var(--ink)}.pmLogo{display:grid;place-items:center;flex:none;height:28px;overflow:hidden}.pmLogo.card{width:32px;border:1px solid #E2DEE8;border-radius:8px;background:#FAFAF6;color:#111827}.pmLogo.pix{width:44px}.pmLogo.upi{width:44px}.pmLogo.alipay{width:50px;color:#111827}.pmLogo.usdc{width:28px}.pmLogo img,.pmLogo svg{display:block;width:100%;height:100%;object-fit:contain}.pmText{color:var(--ink)}.local{font-size:14px;color:var(--ink3);margin-top:16px;line-height:1.55}.curr{position:absolute;top:24px;right:24px;font-family:var(--mono);font-size:13px;color:var(--ink3)}
      `}</style>
      <div className="wrap">
        <h2 className="display">{copy.pricing.title}</h2>
        <p className="sub" style={{ marginTop: 16 }}>
          {copy.pricing.sub}
        </p>
        <div className="tiers">
          {displayedPlans.map((plan) => {
            const planCopy = copy.pricing.plans[plan.name];
            return (
            <div className={`tier${plan.hot ? " hot" : ""}`} key={plan.name}>
              {plan.hot && <div className="badge">{copy.pricing.mostPopular}</div>}
              <div className="tname">{plan.name}</div>
              <div className="taud">{planCopy.audience}</div>
              <div className="tprice">
                <b>{plan.price}</b>
                <span className="per">{copy.pricing.perMonth}</span>
              </div>
              <a className={`btn ${plan.hot ? "primary" : "white"} tcta`} href={plan.href}>{planCopy.cta}</a>
              <div className="tval">
                <span className="tglabel">{copy.pricing.textModelsLabel}</span>
                <div className="tgmain">{planCopy.text}</div>
                <div className="tgsub">{planCopy.window}</div>
                <div className="tdiv" />
                <span className="tglabel">{copy.pricing.imageVideoLabel}</span>
                <div className="tgmain">{planCopy.media}</div>
                <div className="tgsub">{planCopy.mediaSub}</div>
                <div className="tdiv" />
                <span className="tglabel">{copy.pricing.toolsLabel}</span>
                <div className="tgmain">{copy.pricing.toolsMain}</div>
                <div className="tgsub">{copy.pricing.toolsSub}</div>
              </div>
            </div>
            );
          })}
          <div className="tier">
            <div className="tname">{copy.pricing.enterpriseLabel}</div>
            <div className="taud">{copy.pricing.enterpriseAudience}</div>
            <div className="tprice"><b className="tcustom">{copy.pricing.customPrice}</b></div>
            <Link className="btn black tcta" href={localizePath("/contact", props.locale)}>{copy.pricing.enterpriseCta}</Link>
            <div className="tval"><p style={{ margin: 0 }}>{copy.pricing.enterpriseBody}</p></div>
          </div>
        </div>
        <OnlinePaymentMethodPicker
          ctaLabel={copy.pricing.payCta(proPrice)}
          methods={paymentMethods.map((method, index) => ({
            ...method,
            ctaHref: subscriptionSignupHref("pro", subscriptionPaymentMethod(method.kind)),
            label: copy.pricing.paymentMethods[index],
          }))}
          payWithLabel={copy.pricing.payWith}
        />
        <p className="local">{copy.pricing.local}</p>
      </div>
    </>
  );
}
