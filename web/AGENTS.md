<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-18 | Updated: 2026-05-18 -->

# web

## Purpose
前端主题（theme）容器目录。new-api 同时维护两套前端实现，分别面向不同的技术栈偏好与历史包袱；通过构建产物挂载到 Go 后端的静态资源路由。两套主题共享同一后端 API。

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `default/` | 默认主题：React 19 + Rsbuild + Base UI + Tailwind CSS，由 Bun 管理依赖（详细规范见 `default/AGENTS.md`） |
| `classic/` | 经典主题：React 18 + Vite + Semi Design（@douyinfe/semi-ui），保留旧版界面与既有用户习惯（见 `classic/AGENTS.md`） |

## For AI Agents

### Working In This Directory
- 修改前端代码前先确认目标主题：`default/` 与 `classic/` 是两套**独立**实现，不共享组件与样式，**禁止跨主题复用文件**。
- 两套主题的国际化系统都基于 i18next，但文案文件互相独立；新增文案需在对应主题的 `src/i18n/locales/` 下补全。
- 任何文案、品牌与元数据涉及 **new-api / QuantumNous** 标识时，遵守根 `AGENTS.md` 的 Rule 5：不得删改。
- 后端 Go 代码不应直接依赖前端目录中的源文件，仅消费其构建产物（`dist/`）。

### Testing Requirements
- 进入对应子目录（`web/default/` 或 `web/classic/`）后再执行该主题约定的脚本：
  - `default/`：`bun install`、`bun run dev`、`bun run build`、`bun run typecheck`（Rule 3 优先使用 Bun）
  - `classic/`：参考其 `package.json` 中的脚本
- UI 改动请在浏览器中走一遍主路径，避免只依赖 typecheck 与 lint。

### Common Patterns
- 双主题策略：default 是新主题、长期演进方向；classic 维持稳定，原则上只做必要的兼容性维护与关键 bug 修复。
- 两套主题通过后端的 `THEME` 环境变量或前端构建选择决定挂载哪一套。

## Dependencies

### Internal
- 通过后端 API（由 `router/` 注册的 dashboard / web 路由）消费数据
- 两套主题共享同一份 OpenAPI/REST 接口契约

### External
- 见各子目录 `package.json`

<!-- MANUAL: 手动补充内容写在此分隔线下方，重新生成时保留 -->
