# 仅中文：i18n 收敛 + 删除语言 UI + README 精简 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 前端收敛为仅中文（强制 zh、删非中文 locale、移除全部语言切换 UI），README 只保留精简中文。

**Architecture:** 保留 `t()` 体系与 `zh.json`，只把 i18n 配置强制为单一中文（`lng:'zh'`、移除语言探测）；删除 en/fr/ja/ru/vi.json 与多语言切换组件；README 重写为「clone 来源 + 定制记录」。后端 i18n 不动。

**Tech Stack:** React 19 + i18next（保留）、Rsbuild（bun）。Go（因 `//go:embed web/default/dist` 需重编）。

---

## 项目特定约定（执行前必读）

- **无前端测试运行器**：验证靠 `typecheck` + `build` + DEV 人工核对。
- **Go 以 embed 方式打包前端**：前端改完须**重建 dist + 重编 Go + 重启 DEV**才在 :3000 可见。
- **崩盘红线**：前端单独构建；Go 必须 `GOMAXPROCS=2 go build -p 2`；重活前 `swapon --show` 须列出 `/swapfile`。
- **重启 DEV 陷阱**：按 :3000 精确 PID kill（勿用 `pkill -f '/new-api'`）；启动必须带 `SQLITE_PATH=/root/new_api/data-dev/one-api.db PORT=3000 TZ=Asia/Shanghai`。
- **分支**：基于 `main` 开新分支 `feat/chinese-only`；不提交 git（除非用户要）；不碰 classic、后端、PROD。

## File Structure

| 文件 | 改动 |
|------|------|
| `web/default/src/i18n/config.ts` | 仅加载 zh、强制 `lng:'zh'`、移除 LanguageDetector |
| `web/default/src/i18n/locales/{en,fr,ja,ru,vi}.json` | 删除 |
| `web/default/src/i18n/locales/_reports/` | 删除（生成物） |
| `components/layout/components/app-header.tsx` | 移除 `<LanguageSwitcher/>` + import |
| `components/layout/components/public-header.tsx` | 移除 `<LanguageSwitcher/>`、`showLanguageSwitcher` prop/条件、import |
| `features/setup/setup-wizard.tsx` | 移除 `<LanguageSwitcher/>` 包装 div + import |
| `features/profile/index.tsx` | 移除 `<LanguagePreferencesCard/>` + import |
| `components/language-switcher.tsx` | 删除 |
| `features/profile/components/language-preferences-card.tsx` | 删除 |
| `web/default/src/i18n/languages.ts` | 删除（仅被上述两组件引用） |
| `README.md` | 重写为精简中文 |
| `README.{en,fr,ja}.md`、`README.zh_CN.md`、`README.zh_TW.md` | 删除 |

不改动：后端 `i18n/`、`zh.json`（内容不变）、classic、`date-picker`/`datetime-picker` 等 i18n 消费者。

---

## Task 1: i18n 配置改为仅中文 + 删除非中文 locale

**Files:**
- Modify: `web/default/src/i18n/config.ts`
- Delete: `web/default/src/i18n/locales/{en,fr,ja,ru,vi}.json`、`web/default/src/i18n/locales/_reports/`

- [ ] **Step 1: 重写 `config.ts`（从 `import i18n` 到文件末尾）**

`old_string`（整段，唯一）：
```ts
import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import fr from './locales/fr.json'
import ja from './locales/ja.json'
import ru from './locales/ru.json'
import vi from './locales/vi.json'
import zh from './locales/zh.json'

export const resources = {
  en,
  zh,
  fr,
  ru,
  ja,
  vi,
} as const

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: ['en', 'zh', 'fr', 'ru', 'ja', 'vi'],
    load: 'languageOnly', // Convert zh-CN -> zh
    nsSeparator: false, // Allow literal colons in keys (e.g., URLs, labels)
    debug: import.meta.env.DEV,
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  })

export default i18n
```
`new_string`：
```ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import zh from './locales/zh.json'

// 仅中文：只加载 zh，强制 lng，不做语言探测。
export const resources = {
  zh,
} as const

i18n.use(initReactI18next).init({
  resources,
  lng: 'zh',
  fallbackLng: 'zh',
  supportedLngs: ['zh'],
  load: 'languageOnly', // Convert zh-CN -> zh
  nsSeparator: false, // Allow literal colons in keys (e.g., URLs, labels)
  debug: import.meta.env.DEV,
  interpolation: {
    escapeValue: false, // not needed for react as it escapes by default
  },
})

export default i18n
```

- [ ] **Step 2: 删除非中文 locale 文件与 _reports**

Run:
```bash
cd /root/new_api/repo
git rm web/default/src/i18n/locales/en.json web/default/src/i18n/locales/fr.json web/default/src/i18n/locales/ja.json web/default/src/i18n/locales/ru.json web/default/src/i18n/locales/vi.json
rm -rf web/default/src/i18n/locales/_reports
```
Expected: 5 个 json 标记删除；`_reports` 目录移除。

- [ ] **Step 3: 确认无残留引用 `resources`（多语言）或 LanguageDetector**

Run: `cd /root/new_api/repo/web/default && grep -rn "from '@/i18n/config'" src | head; grep -rn "LanguageDetector\|i18next-browser-languagedetector" src`
Expected: `resources` 若被引用仍可用（现为 `{zh}`）；`LanguageDetector` 在 src 中应无引用（package.json 里的依赖可留作未用，不报错）。

---

## Task 2: 移除全部语言切换 UI + 删除组件文件

**Files:**
- Modify: `app-header.tsx`、`public-header.tsx`、`setup-wizard.tsx`、`profile/index.tsx`
- Delete: `language-switcher.tsx`、`language-preferences-card.tsx`、`i18n/languages.ts`

- [ ] **Step 1: app-header.tsx 移除 import**

`old_string`（唯一）：
```tsx
import { ConfigDrawer } from '@/components/config-drawer'
import { LanguageSwitcher } from '@/components/language-switcher'
import { NotificationPopover } from '@/components/notification-popover'
```
`new_string`：
```tsx
import { ConfigDrawer } from '@/components/config-drawer'
import { NotificationPopover } from '@/components/notification-popover'
```

- [ ] **Step 2: app-header.tsx 移除 `<LanguageSwitcher/>`**

`old_string`（唯一）：
```tsx
            <LanguageSwitcher />
            {showConfigDrawer && <ConfigDrawer />}
```
`new_string`：
```tsx
            {showConfigDrawer && <ConfigDrawer />}
```

- [ ] **Step 3: public-header.tsx 移除 import**

`old_string`（唯一）：
```tsx
import { Dialog } from '@/components/dialog'
import { LanguageSwitcher } from '@/components/language-switcher'
import { NotificationPopover } from '@/components/notification-popover'
```
`new_string`：
```tsx
import { Dialog } from '@/components/dialog'
import { NotificationPopover } from '@/components/notification-popover'
```

- [ ] **Step 4: public-header.tsx 移除 `showLanguageSwitcher` prop（接口）**

`old_string`（唯一）：
```tsx
  showThemeSwitch?: boolean
  showLanguageSwitcher?: boolean
  logo?: React.ReactNode
```
`new_string`：
```tsx
  showThemeSwitch?: boolean
  logo?: React.ReactNode
```

- [ ] **Step 5: public-header.tsx 移除 `showLanguageSwitcher` 解构默认值**

`old_string`（唯一）：
```tsx
    showThemeSwitch = true,
    showLanguageSwitcher = true,
    logo: customLogo,
```
`new_string`：
```tsx
    showThemeSwitch = true,
    logo: customLogo,
```

- [ ] **Step 6: public-header.tsx 简化分隔符条件 + 删除 switcher 渲染**

`old_string`（唯一）：
```tsx
              {(showLanguageSwitcher ||
                showThemeSwitch ||
                showNotifications) && (
                <div className='bg-border/40 mx-2 h-4 w-px' />
              )}

              {showLanguageSwitcher && <LanguageSwitcher />}
              {showThemeSwitch && <ThemeSwitch />}
```
`new_string`：
```tsx
              {(showThemeSwitch ||
                showNotifications) && (
                <div className='bg-border/40 mx-2 h-4 w-px' />
              )}

              {showThemeSwitch && <ThemeSwitch />}
```

- [ ] **Step 7: setup-wizard.tsx 移除 import**

`old_string`（唯一）：
```tsx
import { ErrorState } from '@/components/error-state'
import { LanguageSwitcher } from '@/components/language-switcher'
import { LoadingState } from '@/components/loading-state'
```
`new_string`：
```tsx
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
```

- [ ] **Step 8: setup-wizard.tsx 移除 switcher 包装 div**

`old_string`（唯一）：
```tsx
    <div className='bg-muted/40 relative min-h-svh py-10'>
      <div className='absolute top-4 right-4 sm:top-6 sm:right-6'>
        <LanguageSwitcher />
      </div>
      <div className='container mx-auto flex max-w-5xl flex-col gap-8 px-4 sm:px-6'>
```
`new_string`：
```tsx
    <div className='bg-muted/40 relative min-h-svh py-10'>
      <div className='container mx-auto flex max-w-5xl flex-col gap-8 px-4 sm:px-6'>
```

- [ ] **Step 9: profile/index.tsx 移除 import**

`old_string`（唯一）：
```tsx
import { CheckinCalendarCard } from './components/checkin-calendar-card'
import { LanguagePreferencesCard } from './components/language-preferences-card'
import { PasskeyCard } from './components/passkey-card'
```
`new_string`：
```tsx
import { CheckinCalendarCard } from './components/checkin-calendar-card'
import { PasskeyCard } from './components/passkey-card'
```

- [ ] **Step 10: profile/index.tsx 移除 `<LanguagePreferencesCard/>`**

`old_string`（唯一）：
```tsx
                <LanguagePreferencesCard
                  profile={profile}
                  onProfileUpdate={refreshProfile}
                />
                <ProfileSecurityCard profile={profile} loading={loading} />
```
`new_string`：
```tsx
                <ProfileSecurityCard profile={profile} loading={loading} />
```

- [ ] **Step 11: 删除语言组件与 languages 模块**

Run:
```bash
cd /root/new_api/repo
git rm web/default/src/components/language-switcher.tsx \
       web/default/src/features/profile/components/language-preferences-card.tsx \
       web/default/src/i18n/languages.ts
```
Expected: 3 个文件标记删除。

- [ ] **Step 12: typecheck**

Run: `cd /root/new_api/repo/web/default && bun run typecheck`
Expected: 仅可能剩预存在的 `pricing/edit-pricing-dialog.tsx` 错误；无对已删组件/文件/`showLanguageSwitcher` 的引用错误。

---

## Task 3: README 精简为仅中文

**Files:**
- Rewrite: `README.md`
- Delete: `README.en.md`、`README.fr.md`、`README.ja.md`、`README.zh_CN.md`、`README.zh_TW.md`

- [ ] **Step 1: 重写 `README.md`（整体覆盖）**

用 Write 工具写入 `/root/new_api/repo/README.md`，内容：
```markdown
# new-api（定制版）

本仓库 clone 自上游 [QuantumNous/new-api](https://github.com/QuantumNous/new-api)。

## 定制修改记录

- 用户统计：排行榜支持「费用消耗 / 调用次数」切换
- 主页：移除「文档」按钮
- 页脚：内容居中 + 支持 Markdown 超链接（可配置备案信息）
- 系统名称动态化（默认 "Yunlong API"），不再硬编码品牌名
- 页脚：移除默认页脚的品牌区
- 界面语言：仅中文（移除多语言切换与多语言资源）
```

- [ ] **Step 2: 删除其他语言 README**

Run:
```bash
cd /root/new_api/repo
git rm README.en.md README.fr.md README.ja.md README.zh_CN.md README.zh_TW.md
```
Expected: 5 个文件标记删除。

---

## Task 4: 构建并验证（DEV :3000）

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

- [ ] **Step 4: 重启 DEV（精确 PID + 完整环境变量）**

Run:
```bash
pid=$(ss -ltnp 2>/dev/null | grep ':3000' | grep -oP 'pid=\K[0-9]+' | head -1)
[ -n "$pid" ] && kill "$pid" && sleep 2
cd /root/new_api/repo && SQLITE_PATH=/root/new_api/data-dev/one-api.db PORT=3000 TZ=Asia/Shanghai nohup ./new-api > /root/new_api/data-dev/new-api.log 2>&1 &
sleep 5
grep -E "already initialized|ready in" /root/new_api/data-dev/new-api.log | tail -2
```
Expected: 日志含 `system is already initialized` 与 `ready in`。

- [ ] **Step 5: 机械校验**

Run:
```bash
curl -s -o /dev/null -w "GET / -> HTTP %{http_code}\n" http://127.0.0.1:3000/
curl -s http://127.0.0.1:3000/ | grep -oE 'static/js/index\.[a-z0-9]+\.js' | head -1
```
Expected: 首页 200；bundle 为本次新构建产物。

- [ ] **Step 6: 人工核对（管理员登录 :3000）**

1. 首页（公开页）顶栏：**无语言切换按钮**；界面**全中文**。
2. 登录后应用内顶栏：**无语言切换按钮**。
3. 个人设置：**无「语言偏好」卡片**。
4. 设置向导页（如能进入）：无语言切换。
5. 浏览器控制台无 i18n/模块解析报错。

---

## 完成标准

- Task 1–2 typecheck 通过（仅剩预存在 pricing 错误）。
- 非中文 locale、语言组件、languages 模块、非中文 README 全部删除。
- 前端构建成功；Go 重编成功；DEV 正确启动（dev 库）。
- Task 6 人工核对点全部符合：无任何语言切换 UI，界面全中文，无报错。

## 备注

- 保留 `i18next-browser-languagedetector` 依赖（未用，不报错；如需可后续从 package.json 移除）。
- 不提交 git、不动 classic/后端/PROD。
- `zh.json` 内容不变；`t('English key')` 全站照常返回中文。
