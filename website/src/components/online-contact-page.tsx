import Link from "next/link";
import { OnlineFooter, OnlineNav } from "@/components/online-static-shell";
import { type Locale, localizePath } from "@/lib/locales";
import { getOnlineStaticCopy } from "@/lib/online-static-copy";

export function OnlineContactPage(props: { locale: Locale }) {
  const copy = getOnlineStaticCopy(props.locale);
  return (
    <>
      <link rel="stylesheet" href="/assets/fk2.css?v=728n" />
      <style>{`
        body{background:linear-gradient(180deg,#FFFFFF,#F7F5FD)}
        .onlineNavGroup{display:inline-flex;align-items:center;gap:10px}.onlineNavDot{color:var(--ink3);font-weight:800}
        .contactPage{display:grid;grid-template-columns:1.05fr .95fr;min-height:calc(100vh - 76px)}
        .left{padding:48px 64px 56px;display:flex;flex-direction:column;position:relative}
        .right{display:flex;align-items:flex-start;justify-content:center;padding-top:120px}
        .box{width:470px;background:#fff;border-radius:16px;box-shadow:0 24px 70px rgba(10,26,60,.16);padding:38px 40px}
        .contactWhy{margin-top:38px;display:flex;flex-direction:column;gap:22px;max-width:560px}
        .wi{padding-right:28px}.wi .wt{display:flex;gap:12px;align-items:center;margin-bottom:7px}.wi b{font-family:var(--disp);font-size:16.5px;letter-spacing:-.3px;white-space:nowrap}.wi p{font-size:14px;color:var(--ink2);line-height:1.6;padding-left:44px}.wi .n{font-family:var(--mono);font-size:12.5px;color:var(--violet-deep);font-weight:700;background:var(--violet-tint);border-radius:8px;padding:5px 10px;flex:none}
        .act{display:flex;align-items:center;justify-content:center;gap:12px;height:56px;border-radius:8px;font-size:16px;font-weight:750;background:#fff;box-shadow:inset 0 0 0 1.5px var(--ink);margin-bottom:13px;cursor:pointer;text-decoration:none;color:var(--ink)}
        .act.dark{background:var(--ink);color:#fff;box-shadow:none}.fine{font-size:12.5px;color:var(--ink3);text-align:center;margin-top:16px;line-height:1.7}.slot{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:18px 0 6px}.slot input{height:46px;border:1.5px solid var(--line);border-radius:8px;padding:0 14px;font-size:14px;font-family:var(--sans);color:var(--ink)}
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
          <h2 style={{ fontSize: 29, letterSpacing: -1, fontWeight: 800 }}>{copy.contact.formTitle}</h2>
          <p style={{ color: "var(--ink2)", margin: "10px 0 22px", fontSize: 15 }}>{copy.contact.sub}</p>
          <form action="https://formsubmit.co/mguozhen@gmail.com" method="POST">
            <input type="hidden" name="_subject" value="[flatkey] Contact sales lead" />
            <input type="hidden" name="_captcha" value="false" />
            <input type="hidden" name="_next" value={`https://flatkey.ai${localizePath("/contact", props.locale)}?sent=1`} />
            <div className="slot">
              <input type="text" name="name" required placeholder={copy.contact.placeholders.name} />
              <input name="email" type="email" required placeholder={copy.contact.placeholders.email} />
            </div>
            <div className="slot">
              <input type="text" name="company" required placeholder={copy.contact.placeholders.company} />
              <input type="text" name="volume" placeholder={copy.contact.placeholders.volume} />
            </div>
            <div className="slot" style={{ gridTemplateColumns: "1fr" }}>
              <textarea name="message" rows={4} required placeholder={copy.contact.placeholders.message} style={{ border: "1.5px solid var(--line)", borderRadius: 8, padding: "12px 14px", fontSize: 14, fontFamily: "var(--sans)", color: "var(--ink)", resize: "vertical" }} />
            </div>
            <button type="submit" className="act dark" style={{ width: "100%", border: "none", fontFamily: "var(--sans)" }}>
              {copy.contact.send}
            </button>
          </form>
          <a className="act" href="mailto:support@flatkey.ai" style={{ marginTop: 2 }}>{copy.contact.email}</a>
          <a className="act" href="https://discord.gg/VrbZFDXj5g" style={{ background: "#5865F2", color: "#fff", boxShadow: "none" }}>{copy.contact.discord}</a>
          <a className="act" href="https://www.linkedin.com/company/flatkey/" style={{ background: "#0A66C2", color: "#fff", boxShadow: "none" }}>{copy.contact.linkedin}</a>
          <p className="fine">{copy.contact.fine}</p>
          </div>
      </div>
      </div>
      <OnlineFooter locale={props.locale} />
    </>
  );
}
