import { FlatkeyTallyEmbed } from "@/components/flatkey-tally-embed";
import { OnlineFooter, OnlineNav } from "@/components/online-static-shell";
import type { Locale } from "@/lib/locales";
import { getOnlineStaticCopy } from "@/lib/online-static-copy";

export function OnlineContactPage(props: { locale: Locale }) {
  const copy = getOnlineStaticCopy(props.locale);
  return (
    <>
      <link rel="stylesheet" href="/assets/fk2.css?v=728n" />
      <style>{`
        body{background:linear-gradient(180deg,#FFFFFF,#F7F5FD)}
        .onlineNavGroup{display:inline-flex;align-items:center;gap:10px}.onlineNavDot{color:var(--ink3);font-weight:800}
        .contactPage{display:grid;grid-template-columns:1fr minmax(520px,.95fr);min-height:calc(100vh - 76px)}
        .left{padding:54px 64px 56px;display:flex;flex-direction:column;position:relative}
        .right{display:flex;align-items:flex-start;justify-content:center;padding:92px 56px 72px 24px}
        .box{width:min(100%,560px);background:rgba(255,255,255,.92);border:1px solid rgba(107,70,193,.12);border-radius:18px;box-shadow:0 28px 80px rgba(36,24,90,.14);padding:34px 34px 30px}
        .box h2{font-size:29px;letter-spacing:-1px;font-weight:800;margin:0 0 18px}
        .tallyFrame{display:block;width:100%;height:560px;border:0;background:transparent}
        .contactWhy{margin-top:38px;display:flex;flex-direction:column;gap:22px;max-width:560px}
        .wi{padding-right:28px}.wi .wt{display:flex;gap:12px;align-items:center;margin-bottom:7px}.wi b{font-family:var(--disp);font-size:16.5px;letter-spacing:-.3px;white-space:nowrap}.wi p{font-size:14px;color:var(--ink2);line-height:1.6;padding-left:44px}.wi .n{font-family:var(--mono);font-size:12.5px;color:var(--violet-deep);font-weight:700;background:var(--violet-tint);border-radius:8px;padding:5px 10px;flex:none}
        @media (max-width:900px){.contactPage{grid-template-columns:1fr}.right{padding-top:20px}.box{max-width:620px}.tallyFrame{height:540px}}
        @media (max-width:620px){.box{padding:24px 18px 20px;border-radius:14px}.box h2{font-size:25px;margin-bottom:14px}.tallyFrame{height:560px}}
      `}</style>
      <OnlineNav contactAction={false} locale={props.locale} pathname="/contact" />
      <div className="contactPage">
        <div className="left">
          <div className="pxgrid" data-seed="89" data-cell="20" data-cols="7" data-rows="4" data-n="10" style={{ top: 8, right: 28, opacity: 0.8 }} />
          <h2 className="display" style={{ fontSize: 54 }}>
            {copy.contact.heading}
          </h2>
          <div className="contactWhy">
            {copy.contact.why.map(({ body, num, title }) => (
              <div className="wi" key={num}>
                <div className="wt">
                  <span className="n">{num}</span>
                  <b>{title}</b>
                </div>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="right">
          <div className="box">
          <h2>{copy.contact.formTitle}</h2>
          <FlatkeyTallyEmbed
            locale={props.locale}
            iframeClassName="tallyFrame"
          />
          </div>
      </div>
      </div>
      <OnlineFooter locale={props.locale} />
    </>
  );
}
