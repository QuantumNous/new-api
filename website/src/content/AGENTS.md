<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-02 | Updated: 2026-07-02 -->

# website/src/content

## Purpose

官网的**静态文案与法务文档**数据源。`pages.ts` 提供 about/rankings/pricing/terms/privacy/sla/refund-policy 等页面的 i18n 标题/描述/sections；`legal/` 子目录以 markdown 字符串形式存放 4 类法务文档（Terms of Service、Privacy Policy、SLA、Refund Policy）的英文默认版 + 西班牙语/葡萄牙语本地化版，由 `<PublicPage>` + `<LegalMarkdown>` 渲染。

## Key Files

| File | Description |
|------|-------------|
| `pages.ts` | `getPageContent(pageKey, locale): PageContent`。维护 7 个公开页（pricing/rankings/about/terms/privacy/sla/refund-policy）的英文默认 sections + 9 种 locale 的 title/description 覆盖；terms/privacy/sla/refund-policy 通过 `document: getDefaultLegalDocument(kind, locale)` 引用 markdown 全文 |
| `pages.test.ts` | `bun:test`。覆盖 `getPageContent` 在 9 种 locale 下都返回非空 title/description，且法务页 document 非空 |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `legal/` | 法务 markdown 文档（作为 TS 模板字符串导出，非 `.md` 文件）。详见下表 |

### `legal/` 内部文件

| File | Description |
|------|-------------|
| `default-documents.ts` | 英文版 4 类法务文档默认正文（`DEFAULT_TERMS_OF_SERVICE` / `DEFAULT_PRIVACY_POLICY` / `DEFAULT_SLA` / `DEFAULT_REFUND_POLICY`，markdown 字符串），并组合本地化覆盖。导出 `getDefaultLegalDocument(kind: LegalDocumentKind, locale: Locale)`、`LegalDocumentKind` 类型。运营主体默认 `VOC AI INC, 160 E Tasman Drive, Suite 202, San Jose, CA 95134, United States`（**日本站除外**，见父文档 Legal Localization Notes） |
| `localized-default-documents.ts` | 9 种 locale 的法务文档覆盖（含 `LOCALIZED_DEFAULT_LEGAL_DOCUMENTS`）。**日本（ja）的运营主体地址为 `VOC AI株式会社, 東京都港区六本木3-3-27 スハラ六本木3階`，不能套用美国地址**。约 2124 行 |
| `localized-default-documents-es.ts` | 西班牙语专项覆盖（`ES_DEFAULT_LEGAL_DOCUMENTS`），约 150 行 |
| `localized-default-documents-pt.ts` | 葡萄牙语专项覆盖（`PT_DEFAULT_LEGAL_DOCUMENTS`），约 437 行 |

## For AI Agents

### Working In This Directory
- **i18n 全 9 种语言**（en + zh/es/fr/pt/ru/ja/vi/de）：`pages.ts` 改 title/description 必须改全 9 种；`legal/` 改法务条款主体时，英文（`default-documents.ts`）+ `localized-default-documents.ts`（9 种全覆盖）必须同步，es/pt 还要同步两个专项文件。
- **法务运营主体地址**：默认是 VOC AI INC（美国），**日本站（`/ja/terms`、`/ja/privacy`、`/ja/refund-policy`）的主体是 `VOC AI株式会社, 東京都港区六本木3-3-27 スハラ六本木3階`**——修改时不要自动套用美国地址（父 `website/AGENTS.md` 的 Legal Localization Notes 已锁定）。
- `pages.ts` 的 sections 结构（`{ title, body }[]`）只用于非法务页（about/rankings/pricing）的展示；法务页（terms/privacy/sla/refund-policy）的 sections 是空数组，正文走 `document` 字段。
- 法务 markdown 通过 `<LegalMarkdown>` 渲染（`components/legal-markdown.tsx`），不要在 markdown 里嵌不支持的语法（仅 heading/list/table/链接等基础 markdown）。
- 新增公开页时，在 `pages.ts` 的 `generic` 与 `localizedPageCopy`（9 种 locale）里补条目，并在 `components/public-page.tsx` 的 `PublicPageKey` 联合类型里加 key。

### Testing Requirements
- `cd website && bun run lint && bun run typecheck && bun run build` 必须通过。
- `bun test` 覆盖 `pages.test.ts`：保证 9 种 locale × 7 个 pageKey 都有非空 title/description，且 4 类法务页 document 非空。
- 修改法务正文后，本地用 `curl -s http://localhost:4000/terms | grep -i 'VOC AI'` 等确认运营主体渲染正确，特别是日本站路径 `/ja/terms`。

### Common Patterns
- `pages.ts`：英文默认走 `generic[pageKey]`，再被 `localizedPageCopy[locale][pageKey]` 覆盖 title/description；`document` 通过 `getDefaultLegalDocument(kind, locale)` 注入。
- `legal/`：每类文档是 TS 文件里的**模板字符串**（带 `Copyright (C) ... QuantumNous` 头注释 + AGPL 声明），不是 `.md` 文件，便于在 `getDefaultLegalDocument` 里做 locale 查表。

## Dependencies

### Internal
- `pages.ts` ← `./legal/default-documents`（`getDefaultLegalDocument` + `LegalDocumentKind`）
- 被 `components/public-page.tsx` 调用：`getPageContent`、`PublicPageKey`
- 被 `app/(en)/<pageKey>/page.tsx` 与 `app/[locale]/<pageKey>/page.tsx` 间接调用（经 `<PublicPage>`）
- `legal/default-documents.ts` ← 三个 localized 文件

### External
- 无运行时外部依赖；纯 TS 字符串与数据结构

<!-- MANUAL: -->
