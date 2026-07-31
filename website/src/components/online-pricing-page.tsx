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
        .wrap{max-width:1180px;margin:0 auto;padding:60px 48px}.tiers{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin:38px 0 26px}.tier{background:#fff;border:1.5px solid var(--line);border-radius:18px;padding:26px 24px;position:relative;display:flex;flex-direction:column}.tier.hot{border-color:var(--violet);box-shadow:0 16px 48px rgba(109,92,255,.14)}.tier .badge{position:absolute;top:-13px;left:22px;background:var(--violet);color:#fff;font-size:11.5px;font-weight:800;padding:5px 12px;border-radius:999px}.tier b{font-size:34px;letter-spacing:-1.4px;font-weight:600}.tier .tname{font-family:var(--disp);font-size:21px;letter-spacing:-.5px;font-weight:700;color:var(--ink)}.tier .taud{font-size:12.5px;color:var(--ink3);margin:3px 0 14px;line-height:1.45;min-height:36px}.tier .per{font-size:15px;color:var(--ink3);font-weight:600;margin-left:2px}.tier .tcustom{font-size:28px}.tval{background:var(--violet-tint);border-radius:12px;padding:14px 15px;margin:14px 0 16px}.tglabel{font-family:var(--mono);font-size:10px;letter-spacing:.8px;color:var(--ink3);font-weight:700;display:block;margin-bottom:4px;text-transform:uppercase}.tgmain{color:var(--violet-deep);font-weight:800;font-size:14.5px;letter-spacing:-.2px}.tgsub{font-size:12px;color:var(--ink2);margin-top:3px;line-height:1.5}.tdiv{border-top:1px dashed #D8D0F2;margin:12px 0}.tcta{margin-top:auto;text-align:center;display:block}.tier p{font-size:13px;color:var(--ink2);line-height:1.6}.gopayg{display:block;margin:12px 0 14px;padding:12px 13px;border:1px solid #D8D0F2;border-radius:12px;background:linear-gradient(135deg,#F8F6FF,#F0EBFF);color:var(--ink);text-decoration:none}.gopaygtop{display:flex;align-items:center;justify-content:space-between;gap:8px}.gopaygtop strong{font-family:var(--disp);font-size:13.5px;letter-spacing:-.15px;color:var(--violet-deep)}.gopaygtop span{font-family:var(--mono);font-size:8px;font-weight:700;letter-spacing:.55px;color:var(--ink3);text-transform:uppercase}.goamounts{margin-top:6px;font-family:var(--mono);font-size:9.5px;line-height:1.5;color:var(--ink2)}.pay{background:#fff;border:1.5px solid var(--line);border-radius:18px;padding:26px;display:flex;align-items:center;gap:18px}.pm{display:flex;align-items:center;gap:9px;border:1.5px solid var(--line);border-radius:12px;padding:12px 18px;font-weight:750;font-size:14px}.pm.on{border-color:var(--ink);background:#FAFAF6}.local{font-size:13px;color:var(--ink3);margin-top:14px}.curr{position:absolute;top:22px;right:22px;font-family:var(--mono);font-size:12px;color:var(--ink3)}
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
              {plan.hot && (
                <a className="gopayg" href={consoleUrl("/sign-up", "redirect=%2Fwallet")}>
                  <div className="gopaygtop"><strong>{copy.pricing.payAsYouGo}</strong><span>{copy.pricing.subscriptionNotRequired}</span></div>
                  <div className="goamounts">$10 → $13 · $20 → $28 · $200 → $300</div>
                </a>
              )}
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
