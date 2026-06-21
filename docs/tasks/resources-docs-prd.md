# PRD — Resources 文档区（工具接入指南）

> Status: Draft v1 · 2026-06-20 · author: Claude（待 Lightman 评审）
> Owner: DeepRouter Frontend
> Scope: 在网站导航新增 **Resources** 入口，站内展示「如何把各类 AI 工具
> （Claude Code / Cursor / Cherry Studio / SDK …）接到 DeepRouter」的一组指南 ——
> 对标 hao.ai 的 `/docs/en/integrations`。包含导航入口 + 索引页 + 单篇指南页。
> Parents（先读）: `CLAUDE.md` §0（persona + 黑话禁令边界），
> `docs/tasks/key-setup-guide-prd.md`（key 拿到后怎么用，本区是它的「深入版」延伸），
> `docs/DESIGN.md` §0–5（视觉系统，UI 强制）。
> 代码: `web/default/src/features/docs/`、`web/default/src/routes/docs/`、
> `web/default/public/docs/integrations/*.md`、`web/default/src/hooks/use-top-nav-links.ts`。
> 内容来源: 23 篇指南已写于 `deeprouter-ai/docs/integrations/`（已 copy 进 public）。

---

## 0. 为什么要这份 PRD（现状问题）

DeepRouter 的核心定位是「手把手教小白配置好、用起来」（`CLAUDE.md` §0）。但
**「我装好了某个工具，到底怎么让它走 DeepRouter」这个问题，网站上没有任何答案**。
hao.ai 把这件事做成了一个完整的 Integrations 文档区（每个工具一篇 3 步配方），
是它最直接的「上手」抓手；我们「啥也没有」。

| 现状缺口 | 影响 |
|---|---|
| 用户拿到 key 后，想接 Cursor/Cherry Studio/Claude Code，站内无指南 | 卡在「最后一公里」，要么问客服要么放弃 |
| key-setup-guide 只覆盖「粘到工具设置框」一句话，没有逐工具的具体位置/字段 | 非主流工具用户照不出来 |
| 导航没有任何「文档/资源」入口 | 即使有内容也找不到 |

**根因**：接入知识只存在于人脑/聊天记录里，没沉淀成网站可浏览的文档。本 PRD 把
它做成导航里的 **Resources** 区。

---

## 1. 目标 / 非目标

**目标**
1. 导航出现 **Resources** 入口，点进去能浏览全部工具接入指南（对标 hao.ai integrations）。
2. 用户能按「我用的工具」找到对应指南，照着改两个值（Base URL + API Key）即接通。
3. 内容可维护：作者改 markdown → 站点更新，无需改组件。

**非目标**
- 不做全文搜索、版本化、多语言（v1 英文；中文 fast-follow）。
- 不做 chat / playground（红线）。
- 不替代 key-setup-guide 的 casual 自检；本区是其**开发者向深入延伸**。

---

## 2. persona 边界（这块允许黑话，但要放对地方）

`CLAUDE.md` §0 黑话禁令（API/token/Base URL/SDK/第三方品牌名）约束的是
**注册→拿密钥的 casual 主路径**。本 Resources 区是**明确的参考/开发者向表面**，
工具品牌名、Base URL 是用户主动来查时要的信息 —— 因此**允许出现**，但必须：

- 入口是用户**主动点** Resources 才进入，不弹窗、不塞进 casual 主流程。
- 与 key 页的 casual 引导分离：key 页仍是「粘到工具设置框 + 自检」，需要细节的人点
  「查看接入指南 →」跳到本区对应工具。

---

## 3. 信息架构（IA）

```
Resources (/resources)
├─ 索引页：Hero（一句话讲清=改 Base URL + Key）+ 分类网格 + 完整指南(GUIDE)
└─ 单篇页 (/resources/$slug)：左侧分类侧边栏 + 正文（markdown 渲染）
分类：
  AI coding assistants (terminal) — claude-code / codex / gemini-cli / opencode
  Code editors & extensions       — cursor / copilot / cline / zed
  Desktop & chat apps             — claude-coworks / openclaw / cherry-studio /
                                    botgem / chatbox / lobehub / opencat /
                                    nextchat / workbuddy
  Helpers, SDKs & frameworks      — cc-switch / openai-sdk / langchain / llamaindex
  Browser & other                 — immersive-translate / others
```

每篇统一模板（已写好）：TL;DR 框 → 一步步配置 → Verify → Troubleshooting 表 → Reference 表。

---

## 4. 内容模型与技术方案

- **内容**：每个工具一份 `public/docs/integrations/<slug>.md`，运行时 `fetch` 加载。
  分类/标题/排序由 `src/features/docs/catalog.ts` 单点控制。
- **渲染**：复用已装依赖 `react-markdown` + `remark-gfm` + `rehype-raw`（**不加新依赖**）。
  `doc-markdown.tsx` 负责：内部 `*.md` 链接 → 站内路由、相对 `./images/x.png` → 资源路径。
- **路由**：TanStack 文件式 `routes/docs/index.tsx`（索引）+ `routes/docs/$slug.tsx`（单篇），
  公开页（无需登录），复用 `PublicLayout` / `PublicNavigation`。
- **配图**：`public/docs/integrations/images/`，按 `images/README.md` shot list 补；
  缺图时 alt 文本降级，不影响阅读。
- **版权**：本区为 DeepRouter 原创文件 → 头用 `Copyright (C) 2026 DeepRouter`
  （上游 fork 文件按 AGPL 保留 QuantumNous，不动；见 `.claude/rules/fork-and-branding.md`）。

---

## 5. 导航接线（首页能读取）

导航由 `PublicNavigation` → `useTopNavLinks()` 渲染；`DEFAULT_HEADER_NAV_MODULES.docs`
默认 `true`，槽位本就预留（上游曾指向 `docs.newapi.pro`，被注释待 DeepRouter 自有文档站）。

- 在 `use-top-nav-links.ts` 恢复该块，push `{ title: t('Resources'), href: '/docs' }`。
- 运营可在 **System Settings → Site → HeaderNavModules.docs** 关闭/开启，无需改代码。
- 验收：首页顶栏出现 **Resources**，点击进 `/docs`（站内，非外链）。

---

## 6. 设计（DESIGN.md 合规）

UI 必须遵循 `docs/DESIGN.md` §0–5。v1 复用现有 prose / Tailwind token 与
`components/ui/markdown.tsx` 同源样式；**待办：用 `design-system` skill 正式过一遍
配色/间距/字体，确认侧边栏 + 卡片网格符合规范**（当前为功能性实现，视觉待校）。

---

## 7. Spec → Ship status

| 项 | 状态 |
|---|---|
| 23 篇指南内容（markdown） | ✅ 已写（`docs/integrations/` + copy 进 `public/`） |
| `catalog.ts` 分类目录 | ✅ |
| `doc-markdown.tsx` 渲染（内链/图片重写） | ✅ |
| `use-doc-content.ts` 运行时 fetch | ✅ |
| 索引页 + 单篇页（`features/docs/index.tsx`） | ✅ |
| 路由 `/resources`、`/resources/$slug`（与导航名一致） | ✅（路由树已重新生成；§8 决策 2 拍板改名） |
| 导航 Resources 入口 | ✅（`use-top-nav-links.ts` → `/resources`） |
| `bun run typecheck` | ✅ exit 0 |
| dev 实测：`/resources` 200、`*.md` 200 text/markdown | ✅ |
| 配图（images/ 实图） | 🟡 已上 9 张 DeepRouter 品牌占位图（真图待拍，shot list 仍就绪） |
| DESIGN.md 视觉正式校对（§0–5） | ✅ 已过：侧栏 active 改 `bg-info/10 text-info`（双模式保 AI-blue）、卡片 `rounded-xl bg-card`、代码块 `prose-pre:bg-card` |
| 中文版指南 | ✅ 全 24 篇 `<slug>.zh.md`（只译正文，代码/URL/品牌名原样）；`useDocContent` 按界面语言自动选中/英文，缺失回退英文 |

> ⚠️ 流程订正：本应**先评审本 PRD 再实现**（`AGENTS.md` Rule 11）。实现已先行，
> 故本 PRD 兼做「已建内容的规格固化 + 待办」。请 Lightman 评审 §1 目标与 §8 决策。

---

## 8. 待决策（需 Lightman 拍板）

1. **导航名**：Resources（本 PRD 采用）vs Docs vs Integrations？
2. **URL**：✅ **已决策 = `/resources`**（2026-06-20）。路由文件夹 `routes/docs/` → `routes/resources/`，
   `createFileRoute` 改 `/resources/`、`/resources/$slug`，导航 href、站内 `<Link>`、`doc-markdown.tsx`
   的内链解析（`*.md` → `/resources/<slug>`、`README.md` → `/resources`）一并改齐；URL 与导航标签一致。
   markdown **静态资源**路径仍为 `/docs/integrations`（`public/` 下的静态文件，未移动）。
3. **与 key 页的链接**：key-setup-guide 的「怎么用」是否加一条「查看接入指南 →」跳本区？
4. **语言**：v1 英文先上，中文何时跟？
5. **配图**：先上无图文字版，还是等关键图（拿 key 那张）补齐再露出导航入口？

---

## 9. 验收标准

- [x] 首页导航出现 **Resources**，路由 `/resources`（站内）。
- [x] `/resources` 展示分类网格 + 完整指南，覆盖全部 23 个工具。
- [x] 任一 `/resources/$slug` 正确渲染：标题、表格、代码块、内部链接可跳。
- [x] 图片占位解析到 `/docs/integrations/images/...`；缺图优雅降级（9 张品牌占位图已上）。
- [x] 无新增运行时依赖；`bun run typecheck` 通过（exit 0）+ `bun run build` 通过（exit 0）。
- [x] 公开（未登录）可访问。
- [x] DESIGN.md §0–5 视觉校对通过。
- [x] 加载失败显示具体原因（HTTP 状态 / 陈旧缓存命中 HTML）+ Retry 重试按钮（非"could not be loaded"一句话）。
- [x] 导航标签 `Resources` 已注册进 i18n（en/zh），中文站显示「资源」。
