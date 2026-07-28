# 主题分层调优计划 — 日间浓墨手账 × 夜间材质雅致

> **前提**：Phase 1-3 已落地（sketch 令牌、工具类、基础组件、导航层）。本计划在其上做「主题分叉」：
> 同一套组件与工具类不动，**令牌值按主题分道扬镳** —— 日间加重手绘笔墨，夜间收敛歪斜、
> 引入 Material Design 高程体系与雅致质感。零 DOM 分支、零组件 fork。

---

## 一、两个主题的调优哲学

### 1.1 日间 Desert Ledger — 手绘浓厚化三原则

**浓厚 ≠ 堆图形。** 只允许「结构性手绘」——凡是页面本来就需要的结构件（边框、分隔线、
底纹、控件形态、投影），全部换成手绘形态；**禁止**添加纯装饰插图、散落的叶子星星等
无功能图形。

1. **纹理有据**：纸纹升级为真实和纸质感（AI 生成无缝 tile），是页面的「材质」而非装饰。
2. **线条归位**：分隔线、边框、下划线本来就存在 —— 把它们从机械直线换成墨线笔刷形态。
3. **形态传意**：控件（checkbox / toggle / select 箭头 / 进度条）的手绘形态本身承载状态语义。

现有印章水印仅保留 BalanceCard 与 PageHero 两处，不再扩散。

### 1.2 夜间 One Night — Material×Elegant 三原则

夜间保留手绘的「骨」（衬线展示标题、金色细线、账本排版），去掉手绘的「形」
（歪斜圆角、铅笔 offset 投影、朱砂印章、虚线行分隔在暗底显脏）。

1. **高程分层**（MD3 Elevation）：表面亮度 = 海拔。卡片、Modal、悬浮层各归其位，
   用双层投影（key + ambient）+ 表面金色 tint 表达层级。
2. **状态即透明层**（MD3 State Layer）：hover / press / focus 统一为星辉金低透明度覆盖层，
   替代当前散落的 surface-hover 逻辑。
3. **雅致细节**：大数字轻字重、宽字距标签、金色 hairline、图表线条微发光 —— 参考图 3
   （Daility 深色面板发光折线）与参考图 4 的留白比例。

---

## 二、令牌架构分叉（核心工程）

### 2.1 分叉机制

组件已经全部通过 `var(--sketch-*)` / `var(--card-sketch-shadow)` / 工具类消费样式。
分叉只发生在 `tokens.css` 两个作用域的**令牌值**上：

```
:root        →  日间值（歪斜加重、墨线、纸纹）
html.dark    →  夜间值（uniform 圆角、MD elevation、state layer）
```

`.sketch-lg` 在日间渲染不均匀圆角、在夜间自动渲染 16px 正圆角 —— 组件零改动。

### 2.2 日间令牌修改表

| 令牌                        | 现值                      | 新值                                                             | 说明           |
| --------------------------- | ------------------------- | ---------------------------------------------------------------- | -------------- |
| `--sketch-border-radius-sm` | `6px 8px 7px 5px / …`     | `7px 10px 8px 5px / 5px 8px 10px 7px`                            | 歪斜幅度 +40%  |
| `--sketch-border-radius-md` | `10px 13px 11px 12px / …` | `12px 16px 13px 15px / 14px 12px 16px 13px`                      | 同上           |
| `--sketch-border-radius-lg` | `16px 18px 15px 17px / …` | `18px 22px 16px 20px / 17px 21px 18px 22px`                      | 同上           |
| `--card-sketch-shadow`      | `2px 3px 0 …10%`          | `3px 4px 0 rgba(56,55,43,0.13), 0 10px 28px rgba(56,55,43,0.10)` | 马克笔投影更实 |
| `--sketch-border-width`     | `1.5px`                   | `1.5px`（不变）                                                  |                |
| `--dec-grid-line`           | `rgba(56,55,43,0.055)`    | `rgba(56,55,43,0.07)`                                            | 账本格线略深   |

**日间新增令牌**：

```css
/* 墨线分隔（波浪 SVG data-URI，后续可换 AI 生成笔刷 PNG） */
--divider-ink: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='4' viewBox='0 0 120 4'%3E%3Cpath d='M0 2.2 Q10 1.2 20 2 T40 2.3 T60 1.8 T80 2.2 T100 1.9 T120 2.1' stroke='rgba(56,55,43,0.22)' stroke-width='1.3' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
--divider-ink-height: 4px;

/* 手绘纸纹强度（texture-paper 不透明度倍率；AI tile 接入后调低） */
--paper-noise-opacity: 1;

/* 统一交互状态层（日间为暖土系） */
--state-hover-layer: rgba(192, 139, 87, 0.1);
--state-press-layer: rgba(192, 139, 87, 0.16);

/* AI 和纸纹理挂载点（Phase D 生成后替换 var(--paper-noise)） */
--paper-texture-img: var(--paper-noise);
```

### 2.3 夜间令牌覆盖表（html.dark）

**去歪斜**：

```css
--sketch-border-radius-sm: 8px; /* uniform — MD shape scale small */
--sketch-border-radius-md: 12px; /* medium */
--sketch-border-radius-lg: 16px; /* large */
--dec-stamp: transparent; /* 印章水印夜间熄灭 */
--divider-ink: none; /* 墨线分隔夜间退化为 hairline */
```

**MD3 Elevation 体系（新增，5 级；日间同名令牌映射回铅笔投影）**：

```css
/* 夜间：umbra + penumbra 双层，底色炭蓝深压 */
--elevation-1:
  0 1px 2px rgba(0, 4, 16, 0.42), 0 1px 3px 1px rgba(0, 4, 16, 0.28);
--elevation-2:
  0 1px 2px rgba(0, 4, 16, 0.44), 0 2px 6px 2px rgba(0, 4, 16, 0.3);
--elevation-3:
  0 1px 3px rgba(0, 4, 16, 0.46), 0 4px 8px 3px rgba(0, 4, 16, 0.32);
--elevation-4:
  0 2px 3px rgba(0, 4, 16, 0.48), 0 6px 10px 4px rgba(0, 4, 16, 0.34);
--elevation-5:
  0 4px 4px rgba(0, 4, 16, 0.5), 0 8px 12px 6px rgba(0, 4, 16, 0.36);
--card-sketch-shadow: var(--elevation-2); /* 卡片落位 2 级 */
--card-sketch-shadow-hover: var(--elevation-3);
--overlay-shadow: var(--elevation-5); /* Modal / 下拉 */
```

**MD3 Surface Tint（表面金色染色，海拔越高越暖亮）** —— 预计算 hex，不依赖 color-mix：

```css
/* #2e3240 基面 + 星辉金 #e2bc55 按 MD3 透明度阶梯混合 */
--surface-tint-1: #373941; /* +5%  — 静置卡片 */
--surface-tint-2: #3c3d42; /* +8%  — hover 卡片 / 表头 */
--surface-tint-3: #424144; /* +11% — Modal / 命令面板 */
--surface-solid: #32363f; /* 基面微调：原 #2e3240 略提亮接近 tint-0.5 */
--surface-table-header: var(--surface-tint-2);
--surface-overlay: var(--surface-tint-3);
```

**MD3 State Layer（交互状态 = 金色透明层）**：

```css
--state-hover-layer: rgba(226, 188, 85, 0.08); /* MD hover 8% */
--state-press-layer: rgba(226, 188, 85, 0.12); /* MD press 12% */
--surface-hover: var(--state-hover-layer); /* 旧令牌别名到新体系 */
--surface-warm-tile: var(--state-hover-layer); /* 夜间导航 hover 同层 */
```

**雅致细节令牌**：

```css
--brush-highlight-height: 1.5px; /* 日间 38% 色块 → 夜间细金下划线 */
--brush-highlight-skew: 0deg; /* 夜间不倾斜 */
--chart-line-glow: rgba(226, 188, 85, 0.35); /* 图表线发光色 */
--hairline-gold: linear-gradient(
  90deg,
  transparent,
  rgba(226, 188, 85, 0.34) 30%,
  rgba(226, 188, 85, 0.34) 70%,
  transparent
);
--display-number-weight: 500; /* 大数字夜间轻字重（日间 700） */
```

对应 `base.css` 的 `.brush-highlight::after` 改为读
`height: var(--brush-highlight-height, 38%)` 与
`transform: skewX(var(--brush-highlight-skew, -5deg))`，日间维持现状、夜间自动变为
细金下划线 —— 一处改动，两种气质。

---

## 三、日间浓厚化执行清单

### 3.1 纸纹升级（依赖 Phase D 生图，先行占位）

- `texture-paper` 从 SVG feTurbulence 噪点升级为 AI 和纸 tile（`--paper-texture-img`）
- 侧边栏 / 主滚动区 / Modal 应用同一 tile，不透明度分级：主区 100%、侧边栏 60%、Modal 80%
- 生图完成前维持现有 SVG noise（令牌挂载点已预留，切换只改一行）

### 3.2 墨线分隔件（新工具类 `.ink-divider`）

```css
.ink-divider {
  height: var(--divider-ink-height);
  background: var(--divider-ink) repeat-x center / 120px 4px;
  border: 0;
}
html.dark .ink-divider {
  /* 夜间退化为金色 hairline */
  height: 1px;
  background: var(--hairline-gold);
}
```

**应用位**（全部是现有分隔线的替换，非新增装饰）：

- ConsoleSidebar 底部工具区上缘（替换 border-dashed）
- PageHero 与内容区之间（当前无线，加一条呼吸线）
- ConsoleModal footer 上缘
- Wallet / Dashboard 卡片内 section 分隔

### 3.3 控件形态手绘化

| 控件       | 文件                                         | 改造                                                                                                               |
| ---------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 圆形复选框 | `styles/console.css` `.checkbox-round`       | 边框 1.5px、圆角 `45% 55% 50% 48%`（微不圆）、勾选态勾线加粗至 2.2px                                               |
| 开关       | `components/common/ConsoleToggle.vue`        | 日间：轨道 sketch-sm 圆角、滑块微不圆 + 1px 描边墨点感；夜间：MD 标准 switch（uniform 圆、state layer hover 光环） |
| 下拉选择   | `FilterSelect.vue` / `MultiFilterSelect.vue` | 展开箭头换手绘 V 线（stroke-linecap round）；面板圆角 sketch-md；日间面板加纸纹                                    |
| 分段切换   | `SegmentedToggle.vue`                        | 激活段：日间描边 1.5px accent + sketch-sm；夜间 filled + elevation-1                                               |
| 搜索框     | `SearchInput.vue`                            | 对齐 TextInput 底线式（当前仍为盒式）                                                                              |
| 数字输入   | `AmountInput.vue`                            | 同底线式                                                                                                           |

### 3.4 表格账本 ruling

- `DataTable` body 区加可选 `ledger` 视觉：行背景叠加横线
  `repeating-linear-gradient(transparent 0 39px, var(--dec-grid-line) 39px 40px)`，
  仅日间开启（夜间令牌置 none）
- 数字列（额度/金额/token 数）统一 `font-mono tabular-nums` —— 台账对齐感

### 3.5 图表手绘 preset（`charts/` 新增 `themePreset.ts`）

`chartPalette()` 增加 `isDark` 字段（读 `document.documentElement.dataset.theme`）。
新文件导出两个 option 片段工厂：

```
daySketch(palette):
  line: { smooth: false, lineStyle: { width: 2.5 }, symbol: 'circle', symbolSize: 5 }
  grid splitLine: { lineStyle: { type: [4,5], color: palette.borderSubtle } }  // 虚线格
  bar: { itemStyle: { borderRadius: [3,2,0,0] } }

nightGlow(palette):
  line: { smooth: true, lineStyle: { width: 2, shadowBlur: 8, shadowColor: glow } }
  areaStyle: 顶部 accent 14% → 底部透明渐变
  grid splitLine: { lineStyle: { color: rgba(152,164,192,0.08) } }            // 素直细线
```

**接入图表组件清单**（改 option builder，一次一个）：
`TrendDualCard`、`TokenTrendCard`、`ModelDistributionCard`、`StatsDualTrend`、
`StatsHourlyChart`、`MiniSparkline`、`FlowChart`（wallet）、`InviteMonthChart`、
`OrderRevenueChart`、`RpmRing`、`MiniRing`

### 3.6 标题刷痕强化（日间）

`.brush-highlight::after` 日间从矩形 skew 升级为笔刷多边形：

```css
clip-path: polygon(0% 20%, 4% 0%, 97% 8%, 100% 55%, 96% 100%, 2% 92%);
```

夜间由 2.3 的令牌自动退化为细金下划线，不受此影响。

---

## 四、夜间 MD×Elegant 执行清单

### 4.1 Elevation 落位表

| 表面                           | 海拔 | 令牌                                    |
| ------------------------------ | ---- | --------------------------------------- |
| 页面底 / NavStrip              | 0    | 无投影                                  |
| 静置卡片（ConsoleCard 全变体） | 2    | `--elevation-2` + `--surface-tint-1` 底 |
| hover 卡片 / 表头              | 3    | `--elevation-3` + `--surface-tint-2`    |
| Sidebar / Topbar               | 2    | tint-1 底、右/下缘 1px hairline         |
| Modal / CommandPalette / 下拉  | 5    | `--elevation-5` + `--surface-tint-3`    |
| Toast                          | 5    | 同上                                    |

### 4.2 组件夜间微调（读令牌为主，少量 `html.dark` 分支）

- **ConsoleCard**：`sketch` 变体夜间自动获得 uniform 圆角 + elevation-2（令牌驱动，零改动）；
  补 `hover` 时 shadow 过渡到 elevation-3
- **ConsoleButton**：primary 夜间投影从 offset 改 elevation-1→2（hover）；
  ghost hover 用 `--state-hover-layer`
- **DataTable**：夜间行分隔从 dashed 改 solid `rgba(152,164,192,0.09)` hairline
  （令牌 `--row-divider-style` 分叉）；表头底线用 `--hairline-gold`
- **ConsoleTabs**：夜间激活条不收边（clip-path none），2px 金色圆头 + 4px 同色 20% 光晕
- **StatusChip**：夜间去左色条（`border-left-width: 0`），改为 MD tonal chip：
  soft 底 + 同族文字 + uniform 6px 圆角（令牌 `--chip-bar-width` 分叉）
- **大数字**（Balance / KPI / Wallet）：夜间 `font-weight: var(--display-number-weight)`
  （500 轻字重）+ `letter-spacing: 0.01em`，雅致数字牌气质
- **focus ring**：夜间已是金（`--focus-ring: #efd27e`）保持，外加 2px 12% 光环
  （`box-shadow: 0 0 0 4px rgba(226,188,85,0.12)`）

### 4.3 夜间微纹理（依赖 Phase D）

页面底叠极淡丝绒纹 tile（`--night-texture-img`，opacity 0.025-0.04）：
只在 `--page-background` 层，卡片表面保持纯净 tint —— 雅致 = 底有质、面干净。

---

## 五、AI 生图任务（纹理专项）

> 通用规则：每任务先生 2 张 → 选优方向再生 2 张迭代 → sharp 压缩 → `src/assets/textures/`。
> Endpoint `https://xkj.jisuanyun.vip/v1/images/generations`，model `gpt-image-2`。
> Key-A（sk-b046…）常规质量；Key-B（sk-b978…）hd / 2k-4k 高保真。

### IMG-T1 日间和纸纹理 tile（最高优先）

- Key-B · quality hd · 2048×2048 → 中心裁切 1024 → 缩至 512 tile
- 张数：4 张对比
- Prompt：
  ```
  Seamless tileable washi paper texture, warm cream color #f6f3eb, subtle visible
  paper fibers and mottling, traditional Japanese handmade paper, perfectly flat
  even lighting, no vignette, no shadows at edges, no text, no objects, uniform
  density across the whole frame, top-down macro scan, tileable pattern.
  ```
- 验收：四方连续无接缝（CSS repeat 检查）、亮度均匀（无暗角）、灰度方差小
  （叠加后不干扰文字对比度）

### IMG-T2 日间墨刷分隔线（透明底）

- Key-A · 1536×1024 → 裁切出 3-4 条横向笔刷线（每条约 1200×36）→ 透明 PNG
- 张数：3 张对比
- Prompt：
  ```
  Single horizontal dry-brush ink stroke, dark olive ink color #38372b, on fully
  transparent background, hand-painted sumi-e style, slightly tapered ends, subtle
  texture breaks in the stroke, minimal, elegant, isolated element, no paper, no
  other marks.
  ```
- 用途：替换 `--divider-ink` 的 SVG 波浪线（若生成质量优于 SVG）

### IMG-T3 夜间丝绒暗纹 tile

- Key-B · quality hd · 2048×2048 → 512 tile
- 张数：3 张对比
- Prompt：
  ```
  Seamless tileable dark velvet fabric texture, very deep charcoal navy #1e222c,
  extremely subtle woven silk sheen, barely visible fine grain, luxurious and calm,
  perfectly even lighting, no highlights, no folds, no vignette, tileable,
  top-down macro.
  ```
- 验收：叠 0.03 opacity 后肉眼几乎不可见但有「材质深度」；不产生可见重复图案

### IMG-T4 PageHero 印章纹样（可选，日间）

- Key-A · 1024×1024 透明底 · 2 张
- Prompt：
  ```
  Traditional Chinese seal stamp impression, square zhuwen style, vermilion red
  ink #9d3017, slightly distressed worn edges, abstract geometric character
  strokes (not real text), transparent background, isolated, flat.
  ```
- 用途：替换 `.stamp-watermark` 的 CSS 边框方块，仅 BalanceCard / PageHero 两处

### 处理管线

```
下载 → sharp: 裁切/缩放 → webp (纹理 tile) / png (透明元素) → src/assets/textures/
命名: paper-day.webp / divider-ink.png / velvet-night.webp / seal-stamp.png
tokens.css 挂载: --paper-texture-img: url('@/assets/textures/paper-day.webp')
（vite 处理 CSS url 别名；若不支持 @ 别名则用相对路径）
```

---

## 六、实施阶段

```
Phase A  令牌分叉（tokens.css + base.css 状态层/brush 参数化）     — 无组件改动，先行验证双主题
Phase B  日间浓厚化（控件形态 + ink-divider + 表格 ruling + 刷痕强化）
Phase C  夜间 MD 化（elevation 落位 + state layer 接线 + chip/tabs/数字夜间分支 + 图表 nightGlow）
Phase D  AI 纹理生成（IMG-T1→T3→T2→T4 顺序，与 B/C 并行）+ 接入
Phase E  回归验证：test/typecheck/lint + Playwright 双主题 × {dashboard, keys, logs, wallet, models, modal 开启态} 截图对比
```

依赖关系：A 先行；B、C、D 可并行；E 收尾。

### 风险与对策

| 风险                                 | 对策                                                                                   |
| ------------------------------------ | -------------------------------------------------------------------------------------- |
| 夜间去歪斜后某组件残留内联 sketch 值 | Phase A 后全局 grep 内联 `border-radius:.*px .*px` 清点，改读令牌                      |
| AI tile 接缝可见                     | prompt 强调 tileable + 验收时 `background-repeat` 放大检查；不合格改用 offset 镜像拼接 |
| elevation 投影过多导致合成层压力     | 只在卡片/浮层用，表格行、列表项禁用                                                    |
| 状态层别名改动影响现有 hover 视觉    | `--surface-hover` 别名保持向后兼容，逐组件目检                                         |
| 图表 preset 接入面广（11 个组件）    | 每改 3 个跑一次 vitest + 截图，分批提交                                                |
