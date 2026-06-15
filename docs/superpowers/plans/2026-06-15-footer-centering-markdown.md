# 页脚居中 + Markdown 超链接 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 系统设置的页脚内容居中显示，并支持 Markdown 超链接（可配置备案信息等可点链接）。

**Architecture:** 纯前端。复用已有的 `<Markdown>` 组件（`components/ui/markdown.tsx`，已封装 react-markdown + remark-gfm + rehype-raw，且外链自动新标签页）替换页脚里的 `dangerouslySetInnerHTML`；同时把页脚自定义块改为居中纵向布局。字段说明通过改 i18next 的**值**（不改键、不加键）来提示 Markdown 支持。

**Tech Stack:** React 19 + TypeScript + Rsbuild（bun）、react-markdown（已在依赖）、Tailwind Typography（`prose`）。Go（因 `//go:embed web/default/dist` 需重编）。

---

## 项目特定约定（执行前必读）

- **无前端测试运行器**：验证靠 `typecheck` + `build` + DEV 实例人工核对。
- **Go 以 embed 方式打包前端**：前端改完须**重建前端 dist + 重编 Go + 重启 DEV**才在 :3000 可见。
- **崩盘红线**：前端单独构建（不与 classic 并行）；Go 必须 `GOMAXPROCS=2 go build -p 2`；重活前 `swapon --show` 须列出 `/swapfile`。
- **重启 DEV 陷阱**：不要用 `pkill -f '/new-api'`（会误杀自身 shell）；按 :3000 上的精确 PID kill；启动**必须**带 `SQLITE_PATH=/root/new_api/data-dev/one-api.db PORT=3000 TZ=Asia/Shanghai`，否则启到空库。
- **不提交 git**（本项目约定）；**不碰 classic、不碰后端、不碰 PROD**。

## File Structure

| 文件 | 责任 | 改动 |
|------|------|------|
| `web/default/src/components/layout/components/footer.tsx` | 自定义页脚的渲染与布局 | 导入 `Markdown`；居中纵向布局；用 `<Markdown>` 替换 `dangerouslySetInnerHTML` |
| `web/default/src/i18n/locales/en.json` | 英文 base | 改 `Footer text displayed at the bottom of pages` 的**值**，提示 Markdown |
| `web/default/src/i18n/locales/zh.json` | 中文翻译 | 改同一键的**值**，含备案示例 |

不改动：`system-info-section.tsx`（说明文案通过 i18n 值变更即可生效）、后端、classic、其他页面。

---

## Task 1: 页脚居中 + Markdown 渲染（footer.tsx）

**Files:**
- Modify: `web/default/src/components/layout/components/footer.tsx`

- [ ] **Step 1: 导入已有的 `Markdown` 组件**

`old_string`（唯一）：
```tsx
import { cn } from '@/lib/utils'
import { useStatus } from '@/hooks/use-status'
```
`new_string`：
```tsx
import { cn } from '@/lib/utils'
import { Markdown } from '@/components/ui/markdown'
import { useStatus } from '@/hooks/use-status'
```

- [ ] **Step 2: 自定义页脚块改为居中纵向布局，并用 `<Markdown>` 渲染**

`old_string`（唯一，`footerHtml` 分支内的内层容器，约 199–207 行）：
```tsx
          <div className='bg-muted/20 border-border/50 flex flex-col items-center justify-between gap-4 rounded-2xl border px-4 py-4 backdrop-blur-sm sm:flex-row sm:px-5'>
            <div
              className='custom-footer text-muted-foreground min-w-0 text-center text-sm sm:text-left'
              dangerouslySetInnerHTML={{ __html: footerHtml }}
            />
            <div className='border-border/60 text-muted-foreground/45 flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t pt-4 text-xs sm:w-auto sm:justify-end sm:border-t-0 sm:border-l sm:pt-0 sm:pl-5'>
              <LegalLinks />
            </div>
          </div>
```
`new_string`：
```tsx
          <div className='bg-muted/20 border-border/50 flex flex-col items-center gap-4 rounded-2xl border px-4 py-4 backdrop-blur-sm sm:px-5'>
            <div className='custom-footer text-muted-foreground min-w-0 w-full text-center text-sm'>
              <Markdown className='text-center'>{footerHtml}</Markdown>
            </div>
            <div className='border-border/60 text-muted-foreground/45 flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t pt-4 text-xs'>
              <LegalLinks />
            </div>
          </div>
```

要点：去掉 `sm:flex-row` / `justify-between`（不再左右两端对齐）；内容块 `w-full text-center`（始终居中），`sm:text-left` 移除；`dangerouslySetInnerHTML` 换成 `<Markdown>`（外链自动新标签页，链接 prose 主色）；LegalLinks 改为下方居中。

- [ ] **Step 3: typecheck**

Run: `cd /root/new_api/repo/web/default && bun run typecheck`
Expected: 仅可能出现预存在的 `pricing/edit-pricing-dialog.tsx` 错误（与本改动无关）；`footer.tsx` 无新增错误。

---

## Task 2: 字段说明提示 Markdown（改 i18n 值，不改键）

**Files:**
- Modify: `web/default/src/i18n/locales/en.json`（键 `Footer text displayed at the bottom of pages` 的值，约 1803 行）
- Modify: `web/default/src/i18n/locales/zh.json`（同键的值，约 1854 行）

说明：仅改**值**（可含点号、括号、URL；i18next 值不受 keySeparator 影响），键不变 → 组件里的 `t('Footer text displayed at the bottom of pages')` 无需改动。

- [ ] **Step 1: en.json 更新值**

`old_string`（唯一）：
```
    "Footer text displayed at the bottom of pages": "Footer text displayed at the bottom of pages",
```
`new_string`：
```
    "Footer text displayed at the bottom of pages": "Footer content shown at the bottom of pages. Supports Markdown links, e.g. [ICP No.](https://beian.miit.gov.cn)",
```

- [ ] **Step 2: zh.json 更新值**

`old_string`（唯一）：
```
    "Footer text displayed at the bottom of pages": "显示在页面底部的页脚文本",
```
`new_string`：
```
    "Footer text displayed at the bottom of pages": "显示在页面底部的页脚内容，支持 Markdown 链接，例如 [京ICP备12345号](https://beian.miit.gov.cn)",
```

- [ ] **Step 3: 校验两个 JSON 合法**

Run: `cd /root/new_api/repo/web/default && node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/en.json','utf8')); JSON.parse(require('fs').readFileSync('src/i18n/locales/zh.json','utf8')); console.log('JSON ok')"`
Expected: 输出 `JSON ok`。

（无需跑 `i18n:sync`：未新增/删除键，仅改值。）

---

## Task 3: 构建并人工验证（DEV :3000）

**Files:** 无（仅构建与运行）

- [ ] **Step 1: Pre-flight**

Run: `swapon --show && free -h`
Expected: `/swapfile` 在列；`available` 合理（≥ ~400MB）。

- [ ] **Step 2: 构建前端（单独）**

Run: `cd /root/new_api/repo/web/default && DISABLE_ESLINT_PLUGIN=true bun run build`
Expected: 成功，写入 `web/default/dist`。

- [ ] **Step 3: 重编 Go（embed 新 dist，限并发）**

Run: `cd /root/new_api/repo && export PATH=/usr/local/btgo/bin:$PATH && GOMAXPROCS=2 go build -p 2 -ldflags "-s -w" -o new-api`
Expected: exit 0。

- [ ] **Step 4: 重启 DEV（按精确 PID + 完整环境变量）**

Run:
```bash
pid=$(ss -ltnp 2>/dev/null | grep ':3000' | grep -oP 'pid=\K[0-9]+' | head -1)
[ -n "$pid" ] && kill "$pid" && sleep 2
cd /root/new_api/repo && SQLITE_PATH=/root/new_api/data-dev/one-api.db PORT=3000 TZ=Asia/Shanghai nohup ./new-api > /root/new_api/data-dev/new-api.log 2>&1 &
sleep 5
grep -E "already initialized|ready in" /root/new_api/data-dev/new-api.log | tail -2
```
Expected: 日志含 `system is already initialized` 与 `ready in`（说明用的是正确 dev 库）。

- [ ] **Step 5: 机械校验**

Run:
```bash
curl -s -o /dev/null -w "GET / -> HTTP %{http_code}\n" http://127.0.0.1:3000/
curl -s http://127.0.0.1:3000/ | grep -oE 'static/js/index\.[a-z0-9]+\.js' | head -1
```
Expected: 首页 HTTP 200；bundle hash 为本次新构建产物。

- [ ] **Step 6: 人工核对（管理员登录 :3000）**

1. 系统设置 → 系统信息 → **Footer** 字段：确认说明文案已变为「支持 Markdown 链接，例如 [京ICP备…](…)」。
2. 在 Footer 字段填入测试内容并保存，例如：
   ```
   © 2025 泡泡API · [京ICP备12345678号](https://beian.miit.gov.cn)
   ```
3. 回到任意页面底部，核对：
   - 页脚**整体居中**（不再左对齐）；
   - 「京ICP备…」渲染为**可点链接**，点击在新标签页打开 `beian.miit.gov.cn`；
   - 用户协议/隐私政策（若启用）出现在页脚**下方居中**。
4. 再试纯文本 `© 2025 XX` → 居中正常；再试旧 HTML `<a href="https://example.com">link</a>` → 仍可点（rehype-raw 兼容）。

---

## 完成标准

- Task 1 typecheck：`footer.tsx` 无新增错误。
- Task 2：两个 JSON 合法。
- 前端构建成功；Go 重编成功；DEV 正确启动（用 dev 库）。
- Task 6 人工核对点全部符合：居中、Markdown 链接可点且新标签页、纯文本/旧 HTML 兼容。

## 备注

- 复用 `<Markdown>` 组件（prose 样式、外链新标签页），不再在 footer.tsx 自行配置 react-markdown。
- 链接为 prose 主色（非 muted）；如需更淡的页脚链接色，后续可单独微调（本次不做）。
- 不提交 git、不动 classic/后端/PROD。
