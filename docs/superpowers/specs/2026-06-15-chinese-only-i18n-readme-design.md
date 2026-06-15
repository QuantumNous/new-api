# 仅中文：i18n 收敛 + 删除语言切换 UI + README 精简

- 日期：2026-06-15
- 模块：前端 i18n（default 主题）、语言切换 UI、README
- 主题：仅 `web/default` + 仓库文档；**后端 i18n 不动**

## 1. 背景与目标

站点只面向中文用户。当前前端支持 en/zh/fr/ru/ja/vi 六种语言，带语言切换按钮与个人语言偏好。
本次收敛为**仅中文**：移除多语言切换 UI、删除非中文语言资源、README 只保留精简中文。

后续只维护 `zh.json`。

## 2. 关键约束 / 非目标

- **保留 `t()` 体系**（不拆 i18next）。`zh.json` 仍是「英文键 → 中文值」；只是强制 `lng='zh'`、
  仅加载 zh、去掉语言探测与切换。满足"只维护中文"且改动最小、最安全。
- **后端 i18n 不动**：`i18n/locales/{en,zh-CN,zh-TW}.yaml` 保持原样。
- **不拆 i18next**：不把 `t('English')` 替换成字面中文（几千处调用，风险高、收益低）。
- **不动 classic 主题**、不动已合并到 main 的内容。基于 main 开新分支。

## 3. i18n 配置（`web/default/src/i18n/config.ts`）

- 删除 `en/fr/ja/ru/vi` 的 import；`resources = { zh }`。
- `fallbackLng: 'zh'`、`supportedLngs: ['zh']`、新增 `lng: 'zh'`（强制，不探测）。
- 移除 `.use(LanguageDetector)`（不再需要）；保留 `initReactI18next`。
- `load: 'languageOnly'`、`nsSeparator: false`、`interpolation.escapeValue:false` 保持。

## 4. 删除语言资源文件

- 删除：`web/default/src/i18n/locales/{en,fr,ja,ru,vi}.json`（保留 `zh.json`）。
- 删除：`web/default/src/i18n/locales/_reports/`（i18n:sync 生成物，多语言报表，不再需要）。
- `i18n:sync` 脚本（package.json）保留（单语言下无害；不强制跑）。

## 5. 移除全部语言切换 UI

`LanguageSwitcher` 当前用于 3 处，`LanguagePreferencesCard` 用于 1 处：

| 文件 | 处理 |
|------|------|
| `components/layout/components/app-header.tsx` | 删 `<LanguageSwitcher/>` 及其 import |
| `components/layout/components/public-header.tsx` | 删 `<LanguageSwitcher/>`、`showLanguageSwitcher` prop 及其条件渲染块、import |
| `features/setup/setup-wizard.tsx` | 删 `<LanguageSwitcher/>` 及其 import |
| `features/profile/index.tsx` | 删 `<LanguagePreferencesCard/>` 及其 import |

删除文件：
- `components/language-switcher.tsx`
- `features/profile/components/language-preferences-card.tsx`
- `i18n/languages.ts`（或同名模块；仅被上述两组件引用，确认无其他引用后删）

不动：`date-picker.tsx` / `datetime-picker.tsx` / `use-auth-redirect.ts` 等（仅消费 `i18n.language`，
强制 zh 后照常工作）。

## 6. README：只留中文 + 精简

- **重写 `README.md`** 为极简中文，两部分：
  1. 本仓库 clone 自 `QuantumNous/new-api`（https://github.com/QuantumNous/new-api）。
  2. 本仓库定制修改记录（不赘述，列表即可）：
     - 用户统计排行榜：支持「费用消耗 / 调用次数」切换
     - 主页：移除「文档」按钮
     - 页脚：内容居中 + 支持 Markdown 超链接（可配备案信息）
     - 系统名称动态化（默认 "Yunlong API"），不再硬编码品牌名
     - 页脚：移除默认页脚的品牌区
     - 界面语言：仅中文（移除多语言切换与多语言资源）
- **删除**：`README.en.md`、`README.fr.md`、`README.ja.md`、`README.zh_CN.md`、`README.zh_TW.md`。

## 7. 受影响文件汇总

- 改：`web/default/src/i18n/config.ts`
- 删文件：`locales/{en,fr,ja,ru,vi}.json`、`locales/_reports/`、`language-switcher.tsx`、
  `language-preferences-card.tsx`、`i18n/languages.*`（确认无引用）、5 个非中文 README
- 改（移除引用）：`app-header.tsx`、`public-header.tsx`、`setup-wizard.tsx`、`profile/index.tsx`
- 重写：`README.md`

不改动：后端 i18n、classic、`zh.json`（内容不变）、`date-picker` 等 i18n 消费者。

## 8. 兼容性与回归

- `t('English key')` 全站照常工作（zh.json 仍提供中文值）。
- 强制 `lng='zh'`：所有界面固定中文，不再随浏览器语言变化。
- 验证点：
  - 首页/应用内顶栏无语言切换按钮；个人设置无语言偏好卡。
  - 界面全中文（无英文漏出）。
  - typecheck 通过（无对已删文件/组件的悬空引用）。
  - 构建成功；DEV 正常启动。

## 9. 构建 / 部署

- 仅前端 + 文档：`cd web/default && DISABLE_ESLINT_PLUGIN=true bun run build`。
- Go 因 `//go:embed web/default/dist` 需重编（`GOMAXPROCS=2 go build -p 2`）后重启 DEV。
- PROD 仅在用户明确指示时部署。
