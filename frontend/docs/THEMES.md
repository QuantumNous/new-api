# 主题与样式结构

前端只维护一套语义令牌和两种视觉主题：浅色 `Desert Ledger` 与深色“炭蓝星金”。夜间以 Elegant + Material 为主体，手绘表达控制在约 25–30%；浅色继续保持现有 Desert Ledger 视觉。

## 文件职责

- `src/styles/fonts.css`：本地自托管 WOFF2 字体声明。
- `src/styles/tokens.css`：颜色、阴影、状态、品牌和 Canvas 共享令牌。
- `src/styles/base.css`：Tailwind 层、文档默认值、焦点和选区规则。
- `src/styles/home.css`：首页专属视觉，选择器限制在 `.landing-shell`；仅首页滚动状态允许作用于 `html.hero-scrollbar-hidden`。
- `src/styles/console.css`：Console 与 Lab 的滚动区域，由两个懒加载布局按需引入。
- `src/styles/index.css`：全局汇总入口，只引入字体、令牌、基础规则和首页样式，不定义新的业务令牌。

组件必须使用 `--page-background`、`--surface-container-*`、`--text-*`、`--outline-*`、`--accent`、`--signal`、`--support` 和 `--status-*` 等语义变量，不得在业务组件中复制主题色板。旧的 `--surface-*`、`--card-shadow` 和 `--sketch-*` 仅作为兼容别名。

## 夜间视觉规范

夜间核心色为页面 `#262a34`、主表面 `#32363f`、主文字 `#dee3f0`、星辉金 `#e2bc55`、雾蓝 `#6a8cb8` 和薄荷 `#8ec8aa`。

允许的手绘元素仅包括展示级衬线标题、细金色不完美线条、少量导航组标、首页与认证页 Canvas 路由场景，以及明确设计的少量特殊操作。夜间禁止歪斜或不规则圆角、铅笔 offset 阴影、虚线账本分隔、印章水印，以及卡片、Sidebar、菜单、Modal、Toast 上的纸纹。丝绒纹理只能通过 `.night-page-texture` 出现在页面底层。

首页首屏导航保留独立滚动契约：未滚动时透明，滚动后才使用 raised surface 与高程；品牌 Logo 与“RenRen AI”不得使用 tonal 背景、active pill 或金色导轨。

## 夜间表面与高程

- `surface-container-lowest`：页面下沉区域和底层背景。
- `surface-container-low`：Sidebar、Topbar、控件轨道和默认低层卡片，通常使用 `elevation-0`。
- `surface-container`：普通内容表面和移动列表项，按是否独立悬浮使用 `elevation-0/1`。
- `surface-container-high`：重点卡片、表头和强调区域，使用 `elevation-2`；hover 或 focus 可升至 `elevation-3`。
- `surface-container-highest`：菜单、Modal、Drawer、命令面板和 Toast，统一使用 `elevation-5`。

新组件优先使用 `--surface-container-*`、`--shape-*`、`--state-*` 和 `--elevation-*`，普通内容依靠 tonal surface 与细描边表达层级，只有重点卡片和浮层使用明显高程。

## 品牌与媒体例外

外部供应商 Logo 保留官方品牌色；活动 Banner、游戏和农场插画保留业务强调色。为保证媒体文字可读性，可以使用 `--media-scrim-strong/medium/soft` 黑色遮罩，不得在组件内复制固定暗色渐变。除供应商品牌色外，Canvas 与 ECharts 的结构色必须从 CSS 语义令牌解析。

## 持久化

- 主题偏好键：`ren2hub_theme_mode`
- 旧主题键：`renren_theme_mode`，只在迁移和首屏兼容读取时使用
- 语言偏好键：`ren2hub_locale`
- 旧语言键：`renren_locale`，只在首次读取时迁移，随后删除

首屏内联脚本只负责 anti-FOUC：优先读取 `ren2hub_theme_mode`，没有新键时兼容读取旧键，并且只接受 `light`、`dark`、`auto`。

## 字体

字体通过 `src/assets/fonts/` 中的本地 WOFF2 文件自托管，不依赖运行时外部样式加载：

- Inter：正文与界面拉丁字符
- Noto Sans SC：中文无衬线字符
- Noto Serif SC：展示标题与两套主题中的克制衬线表达
- JetBrains Mono：代码、数字和等宽信息

系统字体仅作为本地字体不可用时的回退。

## 可访问性

浅色和深色主题都必须保留可见焦点、状态文本和足够的文本对比度。`prefers-reduced-motion` 下关闭非必要动画；Canvas 仍绘制稳定静态帧，并继续遵守 DPR 上限和整数释放规则。

## 视觉回归

视觉回归仅在本地手动运行，不接入 GitHub Actions：

- `bun run test:visual`
- `bun run test:visual:update`

更新命令必须保留 `--update-snapshots=all`。测试环境固定为 `Asia/Shanghai`、Mock 登录身份与公共 API、本地字体和 `reduced-motion`；固定时间由视觉测试 fixture 负责。
