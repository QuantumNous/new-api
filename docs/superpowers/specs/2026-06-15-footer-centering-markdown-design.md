# 页脚：居中显示 + Markdown 超链接（含备案信息）

- 日期：2026-06-15
- 模块：系统设置 → 页脚（Footer）；default 主题
- 主题：仅 `web/default`

## 1. 背景与目标

系统设置里的「页脚」目前存在两个问题：

1. **左对齐**：自定义页脚内容块为 `text-center ... sm:text-left`，且在 `sm:flex-row justify-between`
   行里靠左（LegalLinks 靠右），桌面端整体左对齐。
2. **超链接不直观**：页脚经 `dangerouslySetInnerHTML` 渲染原始 HTML（链接其实可用），但字段说明写的是
   "Footer text"，使用者不易意识到可写链接；HTML 也不便手写。

目标：
- 页脚内容**居中**显示。
- 支持 **Markdown** 超链接，便于配置**备案信息**（如 `[京ICP备12345号](https://beian.miit.gov.cn)`）。

## 2. 关键约束 / 非目标

- **纯前端**：后端 `Footer` 选项、`footer_html` 状态接口不变。
- **复用已有依赖**：`react-markdown`、`remark-gfm`、`rehype-raw` 均已在 `web/default` 依赖中，不新增包。
- **向后兼容**：已有纯文本 / HTML 页脚须继续正常渲染（靠 `rehype-raw` 解析内嵌 HTML）。
- **安全**：`rehype-raw` 允许原始 HTML，XSS 面与今天 `dangerouslySetInnerHTML` 相同（管理员设置项，无回归）。
- **外链新标签页**：`http(s)` 链接自动 `target="_blank" rel="noopener noreferrer"`。
- **非目标**：不改动 classic 主题（`web/classic/.../Footer.jsx`）、不改动后端、不加结构化「备案字段」。

## 3. 居中布局（`components/layout/components/footer.tsx`，`footerHtml` 分支）

现状（自定义页脚）：
```jsx
<div className='... flex flex-col items-center justify-between gap-4 ... sm:flex-row sm:px-5'>
  <div className='custom-footer ... text-center text-sm sm:text-left' dangerouslySetInnerHTML={{__html: footerHtml}} />
  <div className='... sm:justify-end sm:border-l ...'><LegalLinks/></div>
</div>
```

改为居中纵向布局：
```jsx
<div className='... flex flex-col items-center gap-4 ... px-4 py-4'>
  <div className='custom-footer w-full text-center text-sm'>
    <ReactMarkdown ...>{footerHtml}</ReactMarkdown>
  </div>
  <div className='flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-border/60 pt-4 text-xs text-muted-foreground/45'>
    <LegalLinks/>
  </div>
</div>
```

要点：去掉 `sm:flex-row` / `justify-between` / `sm:text-left`；内容块 `w-full text-center` 始终居中；
LegalLinks 移到下方居中（保留分隔上边框）。

## 4. Markdown 渲染（`footer.tsx`）

- 导入：`import ReactMarkdown from 'react-markdown'`、`import remarkGfm from 'remark-gfm'`、
  `import rehypeRaw from 'rehype-raw'`。
- 替换 `dangerouslySetInnerHTML`：
  ```jsx
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    rehypePlugins={[rehypeRaw]}
    components={{ a: FooterLinkAnchor, p: ({ children }) => <p className='m-0'>{children}</p> }}
  >
    {footerHtml}
  </ReactMarkdown>
  ```
- `FooterLinkAnchor`（组件内小函数）：对 `http(s)` 外链加 `target='_blank' rel='noopener noreferrer'`；
  统一链接样式 `text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors`。
- `p` 覆写去默认 margin，避免多行页脚出现多余间距。
- `remark-gfm`：支持 GFM（自动链接、删除线等）。`rehype-raw`：兼容已有 HTML 页脚。

## 5. 字段提示（`system-settings/general/system-info-section.tsx` + i18n）

- 页脚字段 `FormDescription` 由 `t('Footer text displayed at the bottom of pages')` 改为新文案，
  提示支持 Markdown 链接并给出备案示例，例如：
  `Footer content shown at the bottom of pages. Supports Markdown links, e.g. [ICP No.](https://beian.miit.gov.cn)`
- 新增 en/zh 翻译键（旧键 `Footer text displayed at the bottom of pages` 保留为孤儿，无害）。
- placeholder 可同步更新为含 Markdown 链接的示例（可选，低优先）。

## 6. 受影响文件

| 文件 | 改动 |
|------|------|
| `web/default/src/components/layout/components/footer.tsx` | 居中布局 + react-markdown 渲染 + 链接样式/新标签页 |
| `web/default/src/features/system-settings/general/system-info-section.tsx` | 页脚字段说明文案 |
| `web/default/src/i18n/locales/en.json` / `zh.json` | 新增说明文案翻译键（+ 可选 placeholder 键） |

不改动：后端（`controller/misc.go`、`model/option.go`、`common.Footer`）、classic 主题。

## 7. 兼容性与回归

- 已有纯文本页脚 → Markdown 当作普通段落渲染，正常。
- 已有 HTML 页脚（含 `<a>`、`<div>` 等）→ `rehype-raw` 解析，正常。
- 默认多列页脚（`footerHtml` 为空时）不受影响。
- 验证点：
  - 设置一段 `[京ICP备12345号](https://beian.miit.gov.cn)` → 居中、可点、新标签页打开。
  - 设置纯文本 `© 2025 XX` → 居中正常。
  - 设置含 `<a href=...>` 的旧 HTML → 仍可点。
  - LegalLinks（用户协议/隐私政策）出现在下方居中。

## 8. 构建 / 部署

- 仅前端：`cd web/default && DISABLE_ESLINT_PLUGIN=true bun run build`（单主题）。
- Go 因 `//go:embed web/default/dist` 需重编（`GOMAXPROCS=2 go build -p 2`）后重启 DEV :3000。
- PROD（docker :3001）仅在用户明确指示时部署。
