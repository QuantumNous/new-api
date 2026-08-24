import Image from "next/image";
import { SiteShell } from "@/components/site-shell";
import type { Locale } from "@/lib/locales";

type CareersLocale = "en" | "zh";

const APPLY_EMAIL = "mguozhen@gmail.com";

const copy: Record<CareersLocale, {
  heroPills: string[];
  heroTitle1: string;
  heroTitle2: string;
  heroSub: string;
  stats: { big: string; small: string }[];
  valuesTitle: string;
  valuesLead: string;
  values: { k: string; title: string; body: string }[];
  podTitle: string;
  podBody: string[];
  photosTitle: string;
  photosLead: string;
  awardCaption: string;
  teamCaption: string;
  dinnerCaption: string;
  conversationCaption: string;
  audienceCaption: string;
  communityCaption: string;
  rolesTitle: string;
  rolesLead: string;
  roles: { title: string; body: string; tags: string[]; mailSubject: string; cta: string }[];
  barTitle: string;
  barBody: string;
  barQuestion: string;
}> = {
  en: {
    heroPills: ["Hiring now", "San Jose, CA · Onsite", "AI-native since day one"],
    heroTitle1: "Build the AI-native company.",
    heroTitle2: "From Silicon Valley.",
    heroSub:
      "flatkey, VOC AI and Solvea are built by a small, happy team in San Jose where every person works with a fleet of AI agents — and nobody spends their day on work a machine can do. We hire people who ship.",
    stats: [
      { big: "4M+", small: "users served by our products" },
      { big: "10B+", small: "tokens — recognized by OpenAI" },
      { big: "0", small: "middle managers" },
      { big: "Week 1", small: "you ship to real users" },
    ],
    valuesTitle: "How it feels to work here",
    valuesLead:
      "Free, open, and genuinely happy — not as perks, but as a system. When agents do the busywork, humans get to do the interesting part.",
    values: [
      { k: "SHIP DAILY", title: "Ideas become products in days", body: "No approval chains, no ticket queues. You see a problem, you fix it, it's live. Claude Code is how we all work." },
      { k: "AGENTS DO THE BUSYWORK", title: "Your job is judgment", body: "Screening, reporting, scheduling, data pulls — agents handle it. Your time goes to taste, decisions, and the 5% only humans can do." },
      { k: "OPEN BY DEFAULT", title: "Direct access, zero politics", body: "Everyone works directly with the founder. Metrics, revenue, roadmaps — open to the whole team. Disagree loudly, decide fast." },
      { k: "HAPPY IS A METRIC", title: "Energy matters", body: "A small team in sunny Silicon Valley that actually likes Mondays. Team lunches, demo days, and the joy of watching millions use what you built." },
    ],
    podTitle: "The pod: 1 human × N agents",
    podBody: [
      "Our org chart isn't a pyramid — it's pods. Each pod is one person with real ownership plus a fleet of agents doing the execution.",
      "You own outcomes, not tasks. A pod runs its product line, its growth channel, or its function end-to-end.",
      "Scaling the company means adding pods, never adding layers.",
    ],
    photosTitle: "The team, in the room",
    photosLead: "We build together in San Jose, then take what we learn into the wider AI and builder community.",
    awardCaption: "OpenAI's award to our team — honored for passing 10 billion tokens",
    teamCaption: "Our team at Amazon Accelerate",
    dinnerCaption: "A team dinner after a full day of building and meeting customers",
    conversationCaption: "Sharing Solvea with operators at an IntelliPro event",
    audienceCaption: "Builders and operators exchanging practical AI lessons",
    communityCaption: "A Seattle community session with founders and developers",
    rolesTitle: "Open roles",
    rolesLead: "All roles are onsite in San Jose. New grads and students welcome — we care about what you've built, not how long you've worked.",
    roles: [
      {
        title: "AI Builder",
        body: "Own products end-to-end: idea → prototype → production → iteration. Claude Code is your default way of working. You've shipped things of your own that real people use.",
        tags: ["Full-time / Intern", "San Jose · Onsite", "New grads welcome"],
        mailSubject: "[flatkey careers] AI Builder — Your Name",
        cta: "Apply →",
      },
      {
        title: "Growth Engineer (GTM)",
        body: "Treat go-to-market as engineering: programmatic SEO, agent-driven outbound, paid acquisition, data loops. A marketing role where you write code and drive numbers you can point at.",
        tags: ["Full-time / Intern", "San Jose · Onsite", "New grads welcome"],
        mailSubject: "[flatkey careers] Growth Engineer — Your Name",
        cta: "Apply →",
      },
      {
        title: "Don't see your role?",
        body: "We also hire business owners, customer-facing servicers, and AI-native operators across functions. If you've used AI to do a week's work in a day, we want to hear the story.",
        tags: ["Open application"],
        mailSubject: "[flatkey careers] Open application — Your Name",
        cta: "Say hi →",
      },
    ],
    barTitle: "How we hire — read this before applying",
    barBody:
      "Every application is read twice: once by our agents, once by a human. We don't screen by GPA, school, or brand names. We screen for evidence you've built something yourself — a product with users, growth numbers you personally drove, an audience you grew. Attach links, not adjectives.",
    barQuestion: "Our favorite interview question: “What did you have AI do for you last week?”",
  },
  zh: {
    heroPills: ["正在招聘", "San Jose · 现场办公", "生而 AI-native"],
    heroTitle1: "来硅谷，",
    heroTitle2: "一起建一家 AI-native 公司。",
    heroSub:
      "flatkey、VOC AI 和 Solvea 由一支扎根 San Jose 的小而快乐的团队打造：每个人都带着一队 AI agent 工作，没有人把时间花在机器就能干的事上。我们只招真正动手做出过东西的人。",
    stats: [
      { big: "4M+", small: "产品服务的用户" },
      { big: "10B+", small: "tokens — 获 OpenAI 官方授奖" },
      { big: "0", small: "中层管理" },
      { big: "第 1 周", small: "你的代码就服务真实用户" },
    ],
    valuesTitle: "在这里工作是什么感觉",
    valuesLead: "自由、开放、真心快乐——不是福利话术，而是一套系统：agent 干掉杂活之后，人只做有意思的部分。",
    values: [
      { k: "SHIP DAILY", title: "想法几天内变成产品", body: "没有审批链、没有工单队列。看到问题就修，修完就上线。Claude Code 是我们所有人的日常工作方式。" },
      { k: "AGENTS DO THE BUSYWORK", title: "你的工作是判断", body: "筛选、报表、排期、拉数——agent 全包。你的时间花在品味、决策，和只有人能做的那 5% 上。" },
      { k: "OPEN BY DEFAULT", title: "直达创始人，零办公室政治", body: "每个人直接和创始人工作。指标、收入、路线图对全员公开。大声反对，快速决定。" },
      { k: "HAPPY IS A METRIC", title: "能量很重要", body: "阳光硅谷的一支小团队，真心喜欢星期一。团队聚餐、demo day，以及看着几百万人用你造的东西的那种快乐。" },
    ],
    podTitle: "Pod：1 个人 × N 个 agent",
    podBody: [
      "我们的组织架构不是金字塔，是 pod：每个 pod 是一个有真实所有权的人，加上一队负责执行的 agent。",
      "你为结果负责，而不是为任务负责。一个 pod 端到端地跑一条产品线、一个增长渠道或一个职能。",
      "公司扩张靠增加 pod，永远不加层级。",
    ],
    photosTitle: "真实在场的团队",
    photosLead: "我们在 San Jose 一起做产品，也把一线经验带到更广泛的 AI 与开发者社区。",
    awardCaption: "OpenAI 授予我们团队的奖杯——表彰 100 亿 tokens 里程碑",
    teamCaption: "团队亮相 Amazon Accelerate",
    dinnerCaption: "做产品、见完客户之后的团队聚餐",
    conversationCaption: "在 IntelliPro 活动现场与一线运营者交流 Solvea",
    audienceCaption: "与创业者和运营者分享可落地的 AI 实践",
    communityCaption: "在西雅图与创始人、开发者面对面交流",
    rolesTitle: "开放职位",
    rolesLead: "所有岗位均为 San Jose 现场办公。欢迎应届生和在校生——我们看你造过什么，不看你工作了多久。",
    roles: [
      {
        title: "AI Builder",
        body: "端到端地拥有产品：想法 → 原型 → 上线 → 迭代。Claude Code 是你的默认工作方式。你自己做过、并且有真实用户在用的东西，是最好的敲门砖。",
        tags: ["全职 / 实习", "San Jose · 现场", "欢迎应届生"],
        mailSubject: "[flatkey careers] AI Builder — 你的名字",
        cta: "投递 →",
      },
      {
        title: "增长工程师（GTM）",
        body: "把增长当工程做：程序化 SEO、agent 化外呼、投放、数据闭环。一个要写代码的 marketing 岗位，用你亲手做出的数字说话。",
        tags: ["全职 / 实习", "San Jose · 现场", "欢迎应届生"],
        mailSubject: "[flatkey careers] Growth Engineer — 你的名字",
        cta: "投递 →",
      },
      {
        title: "没有你的岗位？",
        body: "我们也招业务 Owner、面向客户的 Servicer，以及各职能的 AI-native 运营者。如果你用 AI 把一周的活一天干完过，讲给我们听。",
        tags: ["开放申请"],
        mailSubject: "[flatkey careers] Open application — 你的名字",
        cta: "打个招呼 →",
      },
    ],
    barTitle: "我们怎么招人——投递前请读",
    barBody:
      "每份简历都会被读两遍：agent 一遍，人一遍。我们不按 GPA、学校或大厂名字筛选，只找「你亲手做出过东西」的证据——有用户的产品、你个人驱动的增长数字、你做起来的账号。请附链接，不要堆形容词。",
    barQuestion: "我们最爱的面试问题：「上周你让 AI 替你干了什么？」",
  },
};

function mailto(subject: string) {
  return `mailto:${APPLY_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

export function CareersPage({ locale, pathname }: { locale: Locale; pathname: string }) {
  const t = copy[(locale === "zh" ? "zh" : "en") as CareersLocale];
  return (
    <SiteShell locale={locale} pathname={pathname}>
      <main className="relative min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#f4f0ff_0%,#fbfaff_28%,#ffffff_58%,#f4f1ff_100%)] px-6 pt-28 pb-24 dark:bg-[linear-gradient(180deg,#050712_0%,#080b18_36%,#070712_72%,#03040b_100%)]">
        <div className="mx-auto w-full max-w-5xl">
          <header>
            <div className="mb-5 flex flex-wrap gap-2">
              {t.heroPills.map((p) => (
                <span key={p} className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-800 dark:bg-violet-500/15 dark:text-violet-300">{p}</span>
              ))}
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
              {t.heroTitle1}
              <br />
              <span className="text-violet-700 dark:text-violet-400">{t.heroTitle2}</span>
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">{t.heroSub}</p>
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {t.stats.map((s) => (
                <div key={s.big} className="rounded-xl border border-slate-200 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{s.big}</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{s.small}</div>
                </div>
              ))}
            </div>
          </header>

          <section className="mt-16">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t.valuesTitle}</h2>
            <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">{t.valuesLead}</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {t.values.map((v) => (
                <div key={v.k} className="rounded-xl border border-slate-200 bg-white/70 p-5 dark:border-white/10 dark:bg-white/5">
                  <div className="font-mono text-[11px] font-bold tracking-widest text-violet-700 dark:text-violet-400">{v.k}</div>
                  <div className="mt-2 font-semibold text-slate-900 dark:text-white">{v.title}</div>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{v.body}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-16 rounded-2xl bg-slate-950 p-8 text-slate-100 sm:p-10 dark:border dark:border-white/10">
            <h2 className="text-2xl font-bold text-white">{t.podTitle}</h2>
            {t.podBody.map((p) => (
              <p key={p.slice(0, 16)} className="mt-3 max-w-3xl leading-relaxed text-slate-300">{p}</p>
            ))}
          </section>

          <section className="mt-16">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t.photosTitle}</h2>
            <p className="mt-2 text-slate-600 dark:text-slate-300">{t.photosLead}</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {([
                { src: "/careers/openai-award.jpg", w: 720, h: 960, cap: t.awardCaption },
                { src: "/team/amazon-accelerate-team.jpg", w: 1200, h: 1600, cap: t.teamCaption },
                { src: "/team/team-dinner.jpg", w: 1600, h: 1200, cap: t.dinnerCaption },
                { src: "/team/product-conversations.jpg", w: 1600, h: 1067, cap: t.conversationCaption },
                { src: "/team/community-audience.jpg", w: 1600, h: 1066, cap: t.audienceCaption },
                { src: "/team/seattle-community.jpg", w: 1600, h: 1200, cap: t.communityCaption },
              ] as const).map((ph) => (
                <figure key={ph.src} className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10">
                  <Image src={ph.src} alt={ph.cap} width={ph.w} height={ph.h} loading="eager" sizes="(min-width: 640px) 50vw, 100vw" className="h-64 w-full object-cover" />
                  <figcaption className="bg-white/80 px-4 py-3 text-sm text-slate-600 dark:bg-white/5 dark:text-slate-300">{ph.cap}</figcaption>
                </figure>
              ))}
            </div>
          </section>

          <section className="mt-16">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t.rolesTitle}</h2>
            <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">{t.rolesLead}</p>
            <div className="mt-6 space-y-4">
              {t.roles.map((r) => (
                <div key={r.title} className="flex flex-wrap items-center gap-5 rounded-xl border border-slate-200 bg-white/70 p-6 dark:border-white/10 dark:bg-white/5">
                  <div className="min-w-[240px] flex-1">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{r.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{r.body}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {r.tags.map((tag) => (
                        <span key={tag} className="rounded-full border border-slate-200 px-2.5 py-0.5 font-mono text-[11px] text-slate-500 dark:border-white/15 dark:text-slate-400">{tag}</span>
                      ))}
                    </div>
                  </div>
                  <a href={mailto(r.mailSubject)} className="rounded-lg bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-600">{r.cta}</a>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-16 rounded-2xl bg-violet-50 p-8 dark:bg-violet-500/10">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t.barTitle}</h3>
            <p className="mt-3 max-w-3xl leading-relaxed text-slate-700 dark:text-slate-300">{t.barBody}</p>
            <p className="mt-4 inline-block rounded-lg bg-white px-4 py-2 font-mono text-sm font-semibold text-violet-800 dark:bg-white/10 dark:text-violet-300">{t.barQuestion}</p>
          </section>
        </div>
      </main>
    </SiteShell>
  );
}
