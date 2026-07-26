# Ren2Hub 控制台 · 手绘雅致风格重构计划

> **方针**：以「手账账本 × 田园手绘」为主调，以「雅致简约」为辅线，在不拆改现有路由、数据流和布局骨架的前提下，对 CSS Token 层、基础组件和各页面视觉进行分层提升。

---

## 一、设计语言定义

### 1.1 风格关键词

| 维度 | 手绘主线 | 雅致辅线 |
|---|---|---|
| 边框 | 略带笔压感的不均匀描边，非正圆角 | 细线 + 足量留白 |
| 色彩 | 暖土/橄榄绿/麦金，饱和度偏低 | 单色系渐变，减少纯黑 |
| 底纹 | 纸纹噪点 + 竖向/斜向笔触纹 | 半透明玻璃面 |
| 装饰 | 手绘植物叶脉、碑文草字、铅笔线格线 | 烫金分隔线、极细几何框 |
| 字型 | 衬线展示标题（Noto Serif SC）+ 无衬线正文 | 字重对比大，行间距宽松 |
| 动效 | 慢速淡入+轻微上浮，模拟翻页 | 微弹跳 spring 曲线 |
| 图标 | 手绘线稿风 SVG（stroke，非 fill） | 描边均匀，尖角收笔 |

### 1.2 配色适配策略

现有双主题完全保留，在其上叠加手绘质感层：

- **Desert Ledger（日间）**：纸米底 `#f6f3eb`，焦糖琥珀 `--accent`，草甸橄榄 `--glow`，锈红 `--status-danger`。  
  手绘层新增：竹纸纹（偏暖黄 SVG noise）+ 朱砂红小印章点缀 + 橄榄绿手绘边框。

- **One Night（夜间）**：炭蓝底 `#262a34`，星辉金 `--accent`，薄荷绿 `--glow`。  
  手绘层新增：深夜纸纹（冷灰 noise）+ 金箔描边 + 夜草色虚线。

### 1.3 字体策略

| 场景 | 现状 | 升级 |
|---|---|---|
| Hero 大标题 | `Ren2NotoSerifSC`（`.display-title`） | 保持，增大字号阶梯，加字间距 |
| 导航/功能文字 | `Ren2Inter` + `Ren2NotoSansSC` | 保持 |
| 数字/KPI 大字 | 同上 | 切换为 `font-mono`（JetBrains Mono）形成账本感 |
| 表头分组标签 | `text-[10px] tracking-widest` | 保持并加强间距至 `tracking-[0.2em]` |

### 1.4 手绘装饰元素体系

将以下装饰件设计为**纯 CSS + SVG 内联**，无外部依赖：

```
DEC-01  手绘虚线框（不均匀 dash-offset，SVG stroke-dasharray）
DEC-02  页面分组水平分隔线（竹节样式，左侧短横线束）
DEC-03  卡片左侧装饰竖笔条（已有，扩展为多色/多粗细变体）
DEC-04  叶脉角落装饰（小 SVG，`::before`/`::after` 实现）
DEC-05  数字序号手写风格圆圈 Badge
DEC-06  朱红印章背景（`.stamp` 工具类，fixed 旋转水印）
DEC-07  草纸网格背景（`.grid-paper`，仅用于 journal 型卡片）
DEC-08  刷痕高亮（`::after` 倾斜矩形遮罩，accent-soft 底）
```

---

## 二、CSS Token 层扩展

**文件：`src/styles/tokens.css`**

### 2.1 新增手绘风格令牌

```css
/* ===== 手绘笔触令牌 ===== */
--sketch-border-width: 1.5px;         /* 手绘描边基准粗细 */
--sketch-border-radius-sm: 6px 8px 7px 5px / 5px 6px 8px 7px; /* 不均匀圆角 */
--sketch-border-radius-md: 10px 13px 11px 12px / 11px 10px 13px 10px;
--sketch-border-radius-lg: 16px 18px 15px 17px / 15px 17px 16px 18px;
--sketch-rotate-1: rotate(-0.3deg);   /* 微妙歪斜，手持效果 */
--sketch-rotate-2: rotate(0.4deg);
--sketch-rotate-3: rotate(-0.6deg);

/* ===== 装饰色令牌 ===== */
--dec-stamp: rgba(157, 48, 23, 0.22); /* Desert Ledger: 朱砂印章 */
--dec-gold-line: rgba(216, 152, 76, 0.35);   /* 烫金分隔线 */
--dec-leaf: rgba(127, 164, 99, 0.28);         /* 叶脉装饰 */
--dec-grid-line: rgba(56, 55, 43, 0.06);      /* 草纸格线 */

/* ===== 卡片变体令牌 ===== */
--card-sketch-border: var(--sketch-border-width) solid var(--border-default);
--card-sketch-shadow:
  2px 3px 0 var(--border-subtle),
  0 8px 24px var(--shadow-color);
--card-warm-bg: #fdf6e3;              /* 竹纸暖底（仅日间局部使用） */
```

> Dark 模式在 `html.dark` 块内覆盖：`--dec-stamp` 换为金色系，`--card-warm-bg` 换为 `rgba(226,188,85,0.07)`，其余令牌保持。

---

## 三、基础工具类扩展

**文件：`src/styles/base.css`** — 仅追加，不修改现有规则。

```css
/* 手绘边框不均匀圆角工具类 */
.sketch-sm { border-radius: var(--sketch-border-radius-sm); }
.sketch-md { border-radius: var(--sketch-border-radius-md); }
.sketch-lg { border-radius: var(--sketch-border-radius-lg); }

/* 手绘刷痕高亮：文字下方倾斜色块 */
.brush-highlight {
  position: relative;
  display: inline-block;
}
.brush-highlight::after {
  content: '';
  position: absolute;
  bottom: 2px; left: -2px; right: -2px;
  height: 40%;
  background: var(--accent-soft);
  transform: skewX(-4deg);
  z-index: -1;
  border-radius: 2px;
}

/* 草纸格线背景 */
.grid-paper {
  background-image:
    linear-gradient(var(--dec-grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--dec-grid-line) 1px, transparent 1px);
  background-size: 24px 24px;
}

/* 分组标题「手绘斜线 + 文字」样式 */
.section-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: var(--font-display);
  font-size: 12px;
  letter-spacing: var(--letter-spacing-wide);
  text-transform: uppercase;
  color: var(--text-tertiary);
}
.section-heading::before,
.section-heading::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--dec-gold-line);
}
.section-heading::before { flex: 0 0 20px; }
```

---

## 四、全局基础组件改造

### 4.1 ConsoleCard（`src/components/common/ConsoleCard.vue`）

**改动点**：
- 新增 `variant: 'sketch'`：使用不均匀圆角 `--sketch-border-radius-lg`、手绘多层阴影 `--card-sketch-shadow`
- 原有 `variant: 'ink'` 加 `grid-paper` 底纹，增加账本感
- 卡片标题行左侧加 `DEC-03` 竖笔条，颜色从 `--accent` 取样
- `padded` 区域增加 `letter-spacing: 0.01em` 行距放宽

```
default  →  细边框 + 纸纹底（现有，微调阴影为 card-sketch-shadow）
sketch   →  不均匀圆角 + 多层笔压阴影 + 左侧装饰竖笔
ink      →  保留深底色 + 新增 grid-paper 纹理 + 金线标题
```

### 4.2 ConsoleButton（`src/components/common/ConsoleButton.vue`）

**改动点**：
- `primary`：保持 accent 底色，但 `border-radius` 换为 `--sketch-border-radius-sm`，加 `box-shadow: 2px 3px 0 rgba(56,55,43,0.18)` 手绘投影
- `secondary`：边框升级为略不规则，`border-width: 1.5px`
- `ghost`：hover 时加 `brush-highlight` 下划刷痕（伪元素 `::after`）
- 新增 `variant: 'stamp'`：朱红底 + 白字，旋转 -1.5deg，印章质感

### 4.3 StatusChip（`src/components/common/StatusChip.vue`）

- 圆角改为 `4px 6px 5px 5px / 5px 4px 6px 4px`（手绘小标签感）
- 新增左侧 2px 色块 `border-left: 3px solid currentColor`
- `neutral` 色调加纸纹底 `--surface-tile`

### 4.4 ConsoleTabs（`src/components/common/ConsoleTabs.vue`）

- 激活态指示条改为可变宽度刷痕：`height: 2.5px`，两端收细（`clip-path` 梯形）
- 激活文字加 `brush-highlight` 刷痕
- 底部分隔线改为双线（`--dec-gold-line` 细线 + 透明间距）

### 4.5 DataTable（`src/components/common/DataTable.vue`）

- 表头行加 `grid-paper` 横向格线背景（仅表头区域）
- 列头文字 + `section-heading` 样式（小号衬线 + 宽字距）
- 行分隔线改为虚线（`border-dashed`，`--dec-gold-line`）
- 选中行高亮背景改为 `--surface-muted` + 左侧 3px accent 实线

### 4.6 FormField / TextInput / SearchInput

- 输入框边框改为单底线风格（`border-bottom` 仅保留），配合宽行距，形成手账填写感
- Focus 状态底线加厚至 2px，颜色 `--accent`
- Label 使用 `.display-title` 衬线小字（12px，letter-spacing 宽）
- `SearchInput` 搜索图标改为手绘线稿风 SVG（stroke 风格，尖端收笔）
- 新增 `variant: 'filled'`：暖纸底 `--surface-muted` + 无边框，适合 Modal 内用

### 4.7 ConsoleModal（`src/components/common/ConsoleModal.vue`）

- Modal 顶部加一行装饰横条（`--dec-gold-line` 渐变，宽度 50% 居中）
- 标题区加 `display-title` 衬线渲染
- 内容区背景用 `texture-paper`
- 关闭按钮改为手绘 × 形状（SVG stroke，线条略抖动效果用 `stroke-dashoffset` 动画）

### 4.8 SegmentedToggle / ChipPicker

- 激活段不用纯底色填充，改为描边加底纹：`border: 1.5px solid --accent` + `--accent-soft` 底
- 未激活段字色降至 `--text-tertiary`，hover 时纸色底

### 4.9 EmptyState（`src/components/common/EmptyState.vue`）

- 空状态插图替换为手绘线稿风（内联 SVG，stroke 统一 1.5px，颜色用 `--text-tertiary`）
- 副标题字体切换为 `.display-title`

---

## 五、导航层改造

### 5.1 ConsoleSidebar（`src/components/console/ConsoleSidebar.vue`）

**现有手绘元素保留**：分组标签前竖笔条 SVG、底部虚线分隔。

**新增/强化**：
- 品牌区标题字换为 `.display-title` 衬线
- 侧边栏背景加 `texture-paper` 极淡纸纹（`opacity: 0.4`，避免与内容竞争）
- 激活导航项左侧 accent 竖条宽度从 2px 升至 3px，加圆头，并带入 `DEC-08` 刷痕底
- 折叠按钮的 `<` 图标换为手绘风向左箭头（SVG，stroke）
- 导航组分隔改为 `DEC-02`（竹节式横线束）
- 悬停态加微妙纸纹底色 `--surface-tile`（比 muted 更暖）

### 5.2 ConsoleTopbar（`src/components/console/ConsoleTopbar.vue`）

- Topbar 底部边线改为渐变：左右淡出的 `--dec-gold-line` 细线
- 搜索触发按钮改为「开放输入槽」外观：底线式边框 + 放大镜手绘图标
- 移动端 pill 导航激活态：accent 底 → accent 底 + `sketch-sm` 不均匀圆角 + `rotate(-0.4deg)` 微歪斜
- 用户头像 badge 改为手绘圆（`border-radius` 不均匀）

### 5.3 PageHero（`src/components/console/PageHero.vue`）

- 大标题 `h1` 已用 `.display-title` — 保持，增大为 `text-5xl`（桌面端）
- 面包屑箭头改为手绘斜线 `/`（字符，斜体衬线）
- 页面标题 accent 副词组加 `brush-highlight` 刷痕装饰
- Hero 区右侧 art slot 预留位改为「水印印章」背景装饰

---

## 六、控制台各页面改造方案

### 6.1 Dashboard — 仪表盘

| 区域 | 改造内容 |
|---|---|
| OverviewKpiStrip（4 KPI 条） | 每个 KPI 格改为 `sketch` 卡片变体，数字用 `font-mono`，加手绘上箭头/下箭头 SVG |
| BalanceCard | 左上角加「账本」印章水印（`DEC-06`，极淡），额度条改为手绘刷痕进度条 |
| TrendDualCard | ECharts 折线改为手绘感：关闭平滑曲线、启用 `symbol: 'circle'` 手绘节点、grid 改为 `--dec-grid-line` 虚线 |
| TokenTrendCard | 同上，面积图底色改为 `--accent-soft` |
| ModelDistributionCard | 环图改为手绘感描边（ECharts `borderWidth: 2, borderColor: '--surface-solid'`），图例用 `StatusChip` 手绘标签 |
| SystemStatusCard | 各指标行加左侧彩色「手绘状态圆点」（`DEC-05`），进度条改为粗刷笔刷形 |
| DiscountCard | 表格行改为 `--border-dashed-color` 虚线分隔 |

**草稿线稿 Banner AI 生图计划** → 见第八章 IMG-01

### 6.2 Keys — API Key 管理

- Key 卡片（表格行）左侧加「钥匙孔」手绘装饰图标（内联 SVG，绿色草甸色）
- 已隐藏 key 值显示为手绘短横线 `— — — — —`（dash 字符，等宽字体）
- 渠道数量 badge 改为 `StatusChip sketch` 变体
- `KeyRevealModal` 内背景改为 `grid-paper + texture-paper` 叠加，增加密码本感

### 6.3 Logs — 请求日志

- 日志表改为「账本台账」风格：行高增大，首列时间戳用衬线小字
- 错误行高亮从纯底色改为：左侧 3px 锈红实线 + `--status-danger-soft` 底
- 性能指标柱（`LogPerformanceCell`）改为手绘横向柱条（纯 CSS，`border-radius` 一侧）
- 日期范围选择器改为「日历本」翻页感：加折角 `::after` 装饰

### 6.4 Models — 模型列表

- 厂商分组标题改为 `section-heading` 双线样式
- ModelCard 改为 `sketch` 变体，加左上角厂商色块装饰
- VendorLogo 容器改为手绘圆角背景（不均匀），悬停加 `rotate(-1deg)` 轻微倾斜

**模型插图 AI 生图计划** → 见第八章 IMG-02

### 6.5 Marketplace — 渠道市场

- MarketListingCard 改为「商品标签」手绘感：`sketch-md` + 顶部彩色 ribbon 角标
- `ServiceTierBadge` 改为手绘印章风（`stamp` variant）
- 评分星号改为手绘勾画填充（CSS clip-path 星形，stroke 1.5px）
- MyChannelsPanel 分区标题用 `section-heading`

### 6.6 Channels — 渠道管理

- 状态列 chip 改为 `sketch` 手绘标签
- 渠道列表表格改为账本台账风格（同 Logs）
- 批量操作 toolbar 改为底部浮动条，手绘矩形外框，圆角 `sketch-sm`

### 6.7 Users — 用户管理

- 用户 Avatar 改为手绘圆框（不均匀边框 `--sketch-border-radius`）
- 配额进度条改为手绘刷笔条（`height: 6px`，`border-radius: 3px 2px 4px 2px`）
- 权限角色 chip 改为手绘方印样式（`stamp` variant，不同颜色对应不同角色）

### 6.8 Wallet — 钱包

- 余额数字换为 `font-mono text-5xl font-bold`，配合账本质感
- `TopupPanel` 充值金额格改为网格状手绘选择框（`sketch-sm` + 虚线边框）
- `FlowChart` 收支曲线改为手绘感 ECharts（同 TrendDualCard 方案）
- 账单记录列表改为账本流水台账风格，日期左对齐，金额右对齐衬线数字

**收支插图 AI 生图计划** → 见第八章 IMG-03

### 6.9 Invite — 邀请

- 邀请码展示区改为「信封开口」手绘卡片（SVG 装饰）
- `InviteMonthChart` 柱状图改为手绘风（带顶部圆形节点，`DEC-05`）
- 分销返利层级改为手绘树形图/阶梯图（纯 CSS + SVG 连线）

### 6.10 Tickets — 工单

- `TicketFormModal` 富文本区改为「信纸」感：`grid-paper` 横线底纹
- 工单线程消息气泡改为手绘对话框（`sketch-md` + 尖角用 CSS clip-path）
- 状态 chip 加手绘印章效果

### 6.11 Activity / Farm / Bigame — 游戏化页面

这三个页面已有强视觉内容，手绘改造重点在装饰层：
- 活动 Banner 背景替换为 AI 生图（手绘插画，见 IMG-04/05/06）
- 进度条、里程碑轨道改为手绘刷笔条
- 盲盒/农场格子改为 `sketch-md` 不均匀圆角
- 倒计时 Pill 改为手绘印章样式

---

## 七、认证页与首页

### 7.1 Auth 页（Sign In / Sign Up / Reset）

- 左侧/背景区替换为 AI 生图手绘插画（纵向暖土色系，见 IMG-07）
- 表单改为「手账填写本」风格：底线式输入框 + 衬线 label
- 密码强度 Meter 改为手绘格线进度条
- 提交按钮改为 `sketch` 手绘实体按钮

### 7.2 HomeView — 公开首页

首页目前已有强动态 Canvas，手绘改造限于静态层：
- Hero 大标题区加「朱砂印章」背景水印（`DEC-06`，极淡透明度）
- 功能区卡片改为 `sketch-md` 不均匀圆角
- 底部 Footer 加 `section-heading` 双金线分组标题
- 营销 Banner 背景替换为 AI 生图（见 IMG-08）

---

## 八、AI 生图计划

### 8.1 任务清单

| ID | 用途 | 尺寸 | API Key | 质量 | 数量 |
|---|---|---|---|---|---|
| IMG-01 | Dashboard 仪表盘横幅装饰插画（账本/钱币/笔墨） | 2400×600 | Key-A | standard | 4张对比 |
| IMG-02 | Models 页空状态插画（各厂商 AI 模型手绘排列） | 1200×800 | Key-A | standard | 3张对比 |
| IMG-03 | Wallet 钱包页 Hero 插画（古典账本+现代感） | 1600×600 | Key-A | standard | 4张对比 |
| IMG-04 | Activity 活动 Banner（节日/庆典手绘） | 1920×480 | Key-A | standard | 4张对比 |
| IMG-05 | Farm 农场页 Hero（田野/农作物线稿彩绘） | 1920×480 | Key-B | hd | 4张对比 |
| IMG-06 | Bigame 盲盒/游戏页 Banner（玩具/礼盒手绘） | 1920×480 | Key-A | standard | 3张对比 |
| IMG-07 | Auth 页面背景（手绘植物/几何，暖土色） | 1080×1920 | Key-B | hd | 4张对比 |
| IMG-08 | 首页 Hero 背景底纹（抽象水墨+暖土色块） | 3840×2160 (4K) | Key-B | hd | 3张对比 |
| IMG-09 | 侧边栏底部装饰插画（小型，书架/笔筒风） | 200×300 | Key-A | standard | 3张对比 |
| IMG-10 | 通用纸纹噪点底纹（替换现有 SVG noise） | 480×480 tile | Key-B | hd | 3张对比 |

### 8.2 API 调用规范

```
Endpoint: https://xkj.jisuanyun.vip/v1/images/generations
Model: gpt-image-2
Key-A: 用于 standard 质量，1x、2x 分辨率
Key-B: 用于 hd 质量，2k/4k 分辨率，高保真背景图

调用参数模板:
{
  "model": "gpt-image-2",
  "prompt": "<见 8.3>",
  "n": 1,
  "size": "1024x1024 | 1536x1024 | 1024x1536 | auto",
  "quality": "standard | hd"
}

每个任务生成 n 次（见上表），人工挑选最优后存入 src/assets/generated/
文件命名：{IMG-ID}-{variant}.webp
```

### 8.3 Prompt 模板

**IMG-01 Dashboard 横幅（手绘账本）**
```
Hand-drawn illustration, warm earth tones palette (#f6f3eb beige, #d8984c caramel, #7fa463 olive green), 
Japanese-style sketchbook aesthetic, horizontal banner, showing an open ledger book with ink brush 
calligraphy numbers, scattered coins and receipts, minimalist pencil sketch style with subtle paper 
texture, no text overlay, transparent-friendly edges, 2400x600 ratio composition, elegant and calm mood.
```

**IMG-07 Auth 背景（手绘植物）**
```
Full-screen vertical illustration, hand-drawn botanical style, warm sand and parchment tones 
(#f6f3eb, #fffdf8, #d8984c accent), delicate ink-sketch leaves and branches, washi paper texture, 
traditional Japanese wabi-sabi aesthetic mixed with modern minimal design, soft gradient fog overlay, 
portrait orientation 1080x1920, elegant, calm, welcoming mood. No text, no UI elements.
```

**IMG-08 首页 Hero 背景（4K）**
```
4K abstract background, hand-drawn ink wash painting style (水墨画), warm earth color palette with 
deep charcoal (#38372b) strokes, golden (#d8984c) flowing lines, cream (#f6f3eb) base, subtle paper 
grain texture overlay, inspired by Chinese literati painting, abstract topographic lines mixed with 
botanical elements, ultra-wide landscape composition 3840x2160, cinematic depth, elegant and refined.
```

**IMG-05 Farm 农场 Hero（高清彩绘）**
```
HD hand-drawn illustration, pastoral farmland aerial view style, inspired by Japanese countryside art, 
warm olive green (#7fa463), wheat gold (#cfaf6b) and cream (#fffdf8) color palette, sketch-style 
plants, crops, small farm animals in minimal cartoon-sketch fusion, wide banner composition 1920x480, 
gentle ink outline, watercolor fill, paper texture, cheerful and cozy mood. No text.
```

### 8.4 生图执行原则

1. 每个任务先生成 2 张，从中选出更符合项目配色的，再生成 2 张变体迭代
2. 最终选图标准：① 与 Desert Ledger 暖土配色协调 ② 去除文字 ③ 边缘适合作为背景（不过曝）
3. 生成的图片均转为 `.webp` 格式，压缩比 85%（使用 `sharp` 已在 devDependencies）
4. 所有生成图存入 `src/assets/generated/`，在组件中以 CSS 变量或 `import` 引入

---

## 九、实施阶段与优先级

### Phase 1 — 基础层（1周，低风险，优先执行）

- [ ] `tokens.css`：追加手绘令牌（DEC 系列 + sketch 圆角）
- [ ] `base.css`：追加工具类（`sketch-*`、`brush-highlight`、`grid-paper`、`section-heading`）
- [ ] `ConsoleCard`：新增 `sketch` 变体
- [ ] `ConsoleButton`：全变体升级手绘描边和投影
- [ ] `StatusChip`：左色条 + 不均匀圆角
- [ ] `ConsoleTabs`：刷痕激活指示条

### Phase 2 — 导航层（3天）

- [ ] `ConsoleSidebar`：纸纹底 + 导航项激活刷痕 + 品牌衬线字
- [ ] `ConsoleTopbar`：底线渐变 + 搜索框手绘化 + 移动 pill 微歪斜
- [ ] `PageHero`：标题加大 + 面包屑手绘斜线 + brush-highlight 副词组

### Phase 3 — 核心页面（2周）

- [ ] Dashboard：KPI strip + Chart 手绘感 + Card 变体应用
- [ ] Keys：账本感行样式 + 手绘遮码
- [ ] Logs：台账风格 + 错误行左色条
- [ ] Wallet：大字余额 + 账本流水 + 进度条

### Phase 4 — 表单与 Modal（1周）

- [ ] `FormField / TextInput`：底线式输入框
- [ ] `ConsoleModal`：装饰横条 + 衬线标题
- [ ] `DataTable`：账本格线 + 虚线分隔
- [ ] Auth 页面：信纸感表单

### Phase 5 — 次要页面与游戏化（1周）

- [ ] Models / Marketplace / Channels / Users / Invite / Tickets
- [ ] Activity / Farm / Bigame：Banner AI 生图替换

### Phase 6 — AI 生图资产（并行执行）

- [ ] 执行 IMG-01 ～ IMG-10 生图任务（优先 IMG-07、IMG-08 影响大）
- [ ] webp 压缩 + 引入到对应组件
- [ ] 首页 Hero 背景替换

### 风险管控

| 风险 | 措施 |
|---|---|
| 不均匀圆角在某些浏览器表现不一致 | 提供 `@supports` 降级回圆角 `border-radius: 12px` |
| 手绘阴影增加 CSS 复杂度导致重绘性能 | 限制只在静态卡片使用，表格行不用多层 shadow |
| AI 生图与品牌配色偏差 | 先生成 preview，人工审核通过后引入 |
| 现有测试快照（vitest）因样式改变失败 | 此次只改 CSS 和 class，不改 DOM 结构，快照不受影响 |

---

## 十、文件改动清单（最终）

```
src/styles/tokens.css       — 追加 DEC + sketch 令牌
src/styles/base.css         — 追加 6 个工具类
src/styles/console.css      — checkbox-round 微调
src/components/common/ConsoleCard.vue
src/components/common/ConsoleButton.vue
src/components/common/StatusChip.vue
src/components/common/ConsoleTabs.vue
src/components/common/DataTable.vue
src/components/common/FormField.vue
src/components/common/TextInput.vue
src/components/common/SearchInput.vue
src/components/common/ConsoleModal.vue
src/components/common/SegmentedToggle.vue
src/components/common/EmptyState.vue
src/components/console/ConsoleSidebar.vue
src/components/console/ConsoleTopbar.vue
src/components/console/PageHero.vue
src/components/console/dashboard/*.vue    — KPI/Chart 组件
src/components/console/wallet/*.vue
src/components/console/keys/*.vue
src/components/console/log-ui/*.vue
src/views/auth/*.vue
src/assets/generated/                     — AI 生图资产（新建目录）
tailwind.config.js          — 可选：新增 sketch borderRadius preset
```
