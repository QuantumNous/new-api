<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-06-10 -->

# classic

## Purpose
经典主题前端：基于 React 19 + Rsbuild 2.x + Semi Design（`@douyinfe/semi-ui`）的旧版管理界面。承担在新主题 `web/default/` 完全替代前的过渡职责，保留既有 UI 体验与用户使用习惯。原则上以稳定性维护为主，不主动引入大规模重构。

## Key Files
| File | Description |
|------|-------------|
| `package.json` | 依赖清单与脚本（React 19、Semi UI、Rsbuild 2.x、i18next、axios 等） |
| `rsbuild.config.ts` | Rsbuild 2.x 构建配置（已替代 Vite），环境变量前缀 `VITE_` |
| `index.html` | SPA 入口 HTML |
| `i18next.config.js` | i18next 初始化配置 |
| `tailwind.config.js` | Tailwind CSS 3.x 配置（与 Semi 主题共存） |
| `postcss.config.js` | PostCSS 配置 |
| `jsconfig.json` | JS 路径别名等编辑器辅助配置 |
| `vercel.json` | 部署辅助配置 |
| `src/index.jsx` | React 渲染入口 |
| `src/App.jsx` | 应用根组件与路由装配（react-router-dom 6.x） |
| `src/index.css` | 全局样式入口 |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `src/components/` | 业务组件库：auth / dashboard / layout / playground / settings / setup / table / topup / model-deployments / common 等；`layout/headerbar/LanguageSelector.jsx` 提供语言切换 UI（含 pt 选项） |
| `src/pages/` | 页面级组件（路由对应视图） |
| `src/context/` | 全局上下文：`User/`、`Status/`、`Theme/`（PascalCase 子目录） |
| `src/contexts/` | 兼容历史命名，另一组上下文实现（与 `context/` 共存，新增请优先复用现有目录） |
| `src/hooks/` | 业务 Hooks：usage-logs / mj-logs / task-logs / playground / models / chat / redemptions 等 |
| `src/helpers/` | 通用工具函数 |
| `src/services/` | 后端 API 封装（axios） |
| `src/constants/` | 常量与枚举 |
| `src/i18n/` | i18next 本地化资源与配置（独立于 `default/`）；含 `i18n.js`（初始化，使用 `i18next-browser-languagedetector`）、`language.js`（`supportedLanguages` 列表与 `normalizeLanguage` 函数）；locales 含 en / zh-CN / zh-TW / fr / ru / ja / vi / **pt**（近期新增） |
| `public/` | 静态资源 |
| `dist/` | 构建产物（不要手工修改） |

## For AI Agents

### Working In This Directory
- 这是 **经典主题**，技术栈与 `web/default/` 截然不同，**禁止跨主题复制组件**；如需在两套主题间对齐功能，分别在各自代码库实现。
- UI 组件优先复用 Semi Design（`@douyinfe/semi-ui`）；图标使用 `@douyinfe/semi-icons` 或 `react-icons`，与 default 主题的 Hugeicons / Lucide 体系不同。
- 文案需走 i18next（`useTranslation()`、`t('...')`），翻译资源放在 `src/i18n/locales/`；支持 en / zh-CN / zh-TW / fr / ru / ja / vi / **pt**（葡萄牙语，近期新增）。`src/i18n/language.js` 中维护 `supportedLanguages` 列表与语言代码归一化逻辑（`normalizeLanguage`）。
- JS 项目，存在 `jsconfig.json`，未启用 TypeScript；**新增文件保持 JS/JSX**，不要引入 `.ts/.tsx`，避免构建配置改动。
- 构建工具已从 Vite 迁移至 **Rsbuild 2.x**（`rsbuild.config.ts`）；不要引入 `vite.config.js` 或 Vite 专属插件。

### Testing Requirements
- 安装依赖：在本目录下执行 `bun install`（Rule 3 优先使用 Bun）
- 开发：`bun run dev` 启动 Rsbuild dev server
- 构建：`bun run build` 产出 `dist/`
- i18n 工具：`bun run i18n:sync`、`bun run i18n:extract`、`bun run i18n:status`、`bun run i18n:lint`（基于 `i18next-cli`）
- 浏览器端走一遍受影响页面的主路径（登录、Dashboard、Channel/Token/Redeem 管理、Playground、Topup）

### Common Patterns
- 函数式组件 + Hooks；状态偏向局部组件 state 与 Context（`src/context/`），不使用 Zustand。
- API 请求统一通过 `src/services/` 的 axios 实例，认证与错误在拦截器处理。
- 路由：react-router-dom 6.x，路由声明集中在 `src/App.jsx`，页面组件位于 `src/pages/`。
- 国际化键沿用既有命名风格，新增键时与同模块现有键保持一致。
- 长列表与表格优先使用 Semi Design 的 `Table` 组件能力。

## Dependencies

### Internal
- 后端 API（由 Go 端 `router/` 提供 dashboard / relay 等接口）
- 与 `web/default/` 互相独立，不共享代码

### External
- React 19 / React DOM 19
- `@douyinfe/semi-ui` / `@douyinfe/semi-icons` / `@douyinfe/semi-illustrations`
- Rsbuild 2.x（构建，替代 Vite）、Tailwind CSS 3.x（与 Semi 并存）
- axios、history 5.x、i18next 23.x + react-i18next 13.x、i18next-cli（i18n 工具）
- @visactor/react-vchart 1.8.x（图表）、@visactor/vchart-semi-theme
- mermaid、katex、marked、react-markdown、rehype-highlight、rehype-katex、remark-gfm、remark-math、remark-breaks
- highlight.js、lucide-react、react-icons、@lobehub/icons
- react-router-dom 6.x、react-dropzone、react-fireworks、react-telegram-login、react-turnstile
- qrcode.react、sse.js、use-debounce、unist-util-visit
- 其余以 `package.json` 为准

## 更新日志

- **2026-06-08**：添加 Generated/Updated 头、Purpose/Key Files/Subdirectories/For AI Agents/Dependencies 结构化块；记录 Rsbuild 2.x 构建工具替换 Vite；补充 i18n 工具命令（`bun run i18n:sync` 等）。
- **2026-06-10**：新增 pt（葡萄牙语）locale（`src/i18n/locales/pt.json`）及 Semi UI `pt_BR` 本地化绑定（`src/index.jsx`）；更新 `src/i18n/language.js` `supportedLanguages` 列表，新增 `normalizeLanguage` 函数说明；新增 `LanguageSelector.jsx`（含 pt 选项）说明；更新 For AI Agents 国际化描述（en / zh-CN / zh-TW / fr / ru / ja / vi / pt）。

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
