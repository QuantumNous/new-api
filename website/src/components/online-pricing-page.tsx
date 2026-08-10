import Link from "next/link";
import { type Locale, localizePath } from "@/lib/locales";
import { getOnlineStaticCopy } from "@/lib/online-static-copy";
import { consoleUrl } from "@/lib/origins";
import { OnlineStaticShell } from "./online-static-shell";

const plans = [
  {
    href: consoleUrl("/sign-up", "redirect=%2Fwallet%3Fplan%3Dgo%26intent%3Dsubscribe"),
    hot: true,
    name: "Go",
    price: "$10",
  },
  {
    href: consoleUrl("/sign-up", "redirect=%2Fwallet%3Fplan%3Dpro%26intent%3Dsubscribe"),
    hot: false,
    name: "Pro",
    price: "$30",
  },
  {
    href: consoleUrl("/sign-up", "redirect=%2Fwallet%3Fplan%3Dmax%26intent%3Dsubscribe"),
    hot: false,
    name: "Max",
    price: "$100",
  },
] as const;

export function OnlinePricingPage(props: { locale: Locale }) {
  const copy = getOnlineStaticCopy(props.locale);
  return (
    <OnlineStaticShell active="pricing" locale={props.locale} pathname="/pricing">
      <style>{`
        .wrap{max-width:1240px;margin:0 auto;padding:72px 48px}.wrap>.display{font-size:54px;line-height:1.04;letter-spacing:-1.9px}.wrap>.sub{max-width:860px;font-size:19px;line-height:1.65}.tiers{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin:46px 0 30px}.tier{background:#fff;border:1.5px solid var(--line);border-radius:20px;padding:32px 27px;position:relative;display:flex;flex-direction:column}.tier.hot{border-color:var(--violet);box-shadow:0 18px 54px rgba(109,92,255,.16)}.tier .badge{position:absolute;top:-14px;left:24px;background:var(--violet);color:#fff;font-size:12.5px;font-weight:800;padding:6px 14px;border-radius:999px}.tier b{font-size:43px;letter-spacing:-1.6px;font-weight:650}.tier .tname{font-family:var(--disp);font-size:28px;letter-spacing:-.7px;font-weight:700;color:var(--ink)}.tier .taud{font-size:14.5px;color:var(--ink3);margin:5px 0 18px;line-height:1.5;min-height:44px}.tier .per{font-size:17px;color:var(--ink3);font-weight:650;margin-left:3px}.tier .tcustom{font-size:34px}.tval{background:var(--violet-tint);border-radius:14px;padding:18px 17px;margin:18px 0 20px}.tglabel{font-family:var(--mono);font-size:11.5px;letter-spacing:.8px;color:var(--ink3);font-weight:700;display:block;margin-bottom:6px;text-transform:uppercase}.tgmain{color:var(--violet-deep);font-weight:850;font-size:16.5px;letter-spacing:-.2px}.tgsub{font-size:13.5px;color:var(--ink2);margin-top:5px;line-height:1.55}.tdiv{border-top:1px dashed #D8D0F2;margin:15px 0}.tcta{margin-top:auto;text-align:center;display:flex;font-size:15.5px;min-height:48px}.tier p{font-size:15px;color:var(--ink2);line-height:1.65}.pay{background:#fff;border:1.5px solid var(--line);border-radius:20px;padding:28px;display:flex;align-items:center;gap:18px}.pm{display:flex;align-items:center;gap:9px;border:1.5px solid var(--line);border-radius:13px;padding:13px 19px;font-weight:750;font-size:15px}.pm.on{border-color:var(--ink);background:#FAFAF6}.local{font-size:14.5px;color:var(--ink3);margin-top:16px;line-height:1.55}.curr{position:absolute;top:24px;right:24px;font-family:var(--mono);font-size:13px;color:var(--ink3)}
      `}</style>
      <div className="wrap">
        <h2 className="display">{copy.pricing.title}</h2>
        <p className="sub" style={{ marginTop: 16 }}>
          {copy.pricing.sub}
        </p>
        <div className="tiers">
          {plans.map((plan) => {
            const planCopy = copy.pricing.plans[plan.name];
            return (
            <div className={`tier${plan.hot ? " hot" : ""}`} key={plan.name}>
              {plan.hot && <div className="badge">{copy.pricing.mostPopular}</div>}
              <div className="tname">{plan.name}</div>
              <div className="taud">{planCopy.audience}</div>
              <div>
                <b>{plan.price}</b>
                <span className="per">/mo</span>
              </div>
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
              <a className={`btn ${plan.hot ? "primary" : "white"} tcta`} href={plan.href}>{planCopy.cta}</a>
            </div>
            );
          })}
          <div className="tier">
            <div className="curr">B2B</div>
            <div className="tname">{copy.pricing.enterpriseLabel}</div>
            <div className="taud">{copy.pricing.enterpriseAudience}</div>
            <div><b className="tcustom">Custom</b></div>
            <div className="tval"><p style={{ margin: 0 }}>{copy.pricing.enterpriseBody}</p></div>
            <Link className="btn black tcta" href={localizePath("/contact", props.locale)}>{copy.pricing.enterpriseCta}</Link>
          </div>
        </div>
        <div className="pay">
          <span style={{ fontWeight: 800, fontSize: 14.5 }}>{copy.pricing.payWith}</span>
          {["Card · 3DS", "Pix · BRL", "UPI · INR", "Alipay", "USDC"].map((item, index) => <div className={`pm${index === 0 ? " on" : ""}`} key={item}>{item}</div>)}
          <div style={{ flex: 1 }} />
          <a className="btn primary big" href={consoleUrl("/sign-up", "redirect=%2Fwallet%3Fplan%3Dgo%26intent%3Dsubscribe")}>{copy.pricing.payCta}</a>
        </div>
        <p className="local">{copy.pricing.local}</p>
      </div>
    </OnlineStaticShell>
  );
}
