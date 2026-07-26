# 登录页左栏「活化」计划 — 一把钥匙，点亮所有模型

> **目标**：左侧品牌栏从静态三段文案升级为「动起来、与内容相关」的叙事面板。
> 视觉语言同时继承首页（世界地图路由、飞线数据包、字符雨）与控制台（账本墨绿、
> 星辉金、衬线标题、状态 ticker），配合 gpt-image-2 生成的 3D 氛围背景。
> **只做计划，不执行。**

---

## 一、叙事概念（三选一，推荐 V1）

### V1 ★推荐 —「钥匙星座」(Key Constellation)

把 slogan「一个 Key，接入所有大模型」直接画出来：

```
┌─────────────────────┐
│ ◆ Ren2Hub           │  ← 品牌行（现有，保留）
│                     │
│   ✦ Claude  ✦ GPT   │  ← 模型星座：8-10 个真实模型 Logo 节点
│  ✦ Gemini     ✦ Qwen│     （复用 public/models/ 图标）呈星空散布
│     ✦ DeepSeek      │     节点被数据包点亮时脉冲发光
│   ╲   │   ╱         │
│    ╲  │  ╱          │  ← 金色飞线：从钥匙升起的弧线数据包
│     ╲ │ ╱              （复用 Flyline 贝塞尔 + 字符尾迹）
│      🔑             │  ← 3D 钥匙徽章（AI 生成，悬浮 + 呼吸光晕）
│                     │
│ ONE KEY, ALL MODELS │  ← slogan + 衬线大标题（现有，保留）
│ 一个 Key，接入所有大模型│
│                     │
│ ▸ 模型 xx · 在线率 xx%│  ← 底部三个进度点 → 升级为真实数据 mini-ticker
└─────────────────────┘
```

- **动**：飞线包从钥匙持续升向随机模型节点（金色请求），节点脉冲后偶发
  薄荷绿响应包回落（完全对齐首页画布的请求/响应色彩语义）
- **活**：鼠标视差（节点按深度轻微偏移）、悬停节点显名并高亮、钥匙缓慢浮动
- **相关**：模型 Logo 是真的、底部 ticker 数据是真的（`app.modelCountLabel` /
  `uptimeLabel` / `versionLabel`）——不是装饰，是产品本身

### V2 —「灯塔航线」

AI 生成 3D 灯塔立于底部，光束缓慢扫过；模型节点是海面远处的灯点，
光束扫到即亮。氛围更强但「钥匙」意象弱，与 slogan 的直接关联降一档。

### V3 —「水墨山径」

延续日间手账风：水墨远山 + 山径灯笼逐一点亮为模型节点。
与控制台日间风格最契合，但夜间的 Material 雅致感难以兼容，双主题分裂风险高。

> V1 胜出理由：叙事=产品、复用首页现成的视觉词汇（弧线包/字符尾/双色语义）、
> 纵向构图天然适配 42% 宽的窄栏、双主题只换色盘不换叙事。

---

## 二、分层架构

左栏（`lg:` 以上才渲染，移动端零成本）从单层静态改为五层叠放：

```
Layer 0  底色       var(--surface-footer)（保持「双主题恒深」规则不变）
Layer 1  AI 背景    gpt-image-2 生成的 3D 氛围图（portrait webp，双主题各一张）
                    + 顶/底渐变 scrim 保证文字对比度
Layer 2  视差层     CSS transform 随鼠标微移（背景 1x、星座 1.5x 反向），
                    纯 transform 无重排
Layer 3  Canvas    AuthScene 迷你引擎：钥匙 + 模型节点 + 飞线包 + 微尘
Layer 4  HTML      品牌行 / slogan / 衬线标题 / tagline / mini-ticker
                    （全部现有内容保留，aria 结构不变）
```

---

## 三、AI 生图任务（gpt-image-2）

> 经验教训已吸收：Key-B 上轮全程连接失败 → 本轮**先试 Key-B 1 次，失败立即
> 降级 Key-A**（上轮验证可用，注意去掉尾部多余的 `h`）。
> 每任务生成 2 张 → 选优方向 → 再生 2 张迭代 → sharp 后处理。

### IMG-A1 日间背景「墨绿峰峦」（portrait 1024×1536）

```
Vertical atmospheric background, deep ink-green (#38372b) base, layered
misty mountain silhouettes in traditional Chinese ink-wash style fading
into darkness, subtle warm gold (#d8984c) rim light on ridges, tiny
floating dust particles, bottom third darkest for text overlay, elegant,
minimal, no text, no buildings, no people, portrait orientation.
```

- 后处理：tone-map 压向 `#38372b`、底部 30% 叠加深色渐变、512 宽 webp（≤150KB）

### IMG-A2 夜间背景「炭蓝星海」（portrait 1024×1536）

```
Vertical atmospheric background, deep charcoal navy (#181b24) base, faint
aurora ribbons in muted gold (#e2bc55) and mint (#8ec8aa) high in the sky,
sparse tiny stars, extremely subtle silk-like gradient, Material Design
elegant dark surface feel, bottom third darkest for text overlay, no text,
no ground objects, portrait orientation.
```

### IMG-A3 3D 钥匙徽章（1024×1024 透明底候选）

```
Single ornate 3D key artifact, clay-render / soft isometric style, warm
brass gold (#d8984c) metal with subtle emissive glow, key head shaped as
a rounded hexagonal API chip, floating at slight angle, soft studio
lighting, plain white background for easy matting, centered, no text.
```

- 后处理：白底抠透明（沿用上轮 seal 的红度/亮度 alpha 反演法，改为亮度+色相判定）、
  裁切 → 360px PNG；**备选方案**：若 3D 生成质感不合格，退回纯 Canvas 绘制
  手绘线稿钥匙（BrandMark 同款 stroke 语言），不阻塞主线
- 双主题共用一张（金色在两个深底上都成立），夜间叠加更强 glow

### IMG-A4（可选加分）浮空岛屿视差元素（1024×1024 透明底）

```
Two or three small floating rock islands with tiny glowing lanterns,
soft 3D clay style, ink-green and gold palette, isolated on plain white
background, no text, minimal, dreamy.
```

- 仅在 A1/A2 完成且预算允许时执行；置于 Layer 2 视差层，日夜各调一版色

### 验收标准

1. 深色区占比 ≥70%，标题文字区（中下部）局部对比度 ≥ 4.5:1（叠 scrim 后）
2. 无文字、无水印、无生硬边缘；portrait 构图上轻下重
3. webp 后单张 ≤150KB，两张背景合计 ≤300KB（登录页是首触页面，体积敏感）

---

## 四、Canvas 迷你引擎 `AuthScene`

新文件 `src/canvas/AuthScene.ts`（目标 ~300 行，MapScene 的 1/4），**不依赖
MapScene**，但复用其成熟模块：

| 复用                     | 来源                   | 用途                                        |
| ------------------------ | ---------------------- | ------------------------------------------- |
| `arcAway()`              | `canvas/arc.ts`        | 飞线贝塞尔控制点                            |
| `withAlpha()` / 色盘模式 | `canvas/theme.ts`      | 主题色解析                                  |
| 图标加载                 | `canvas/iconLoader.ts` | 模型 Logo 位图（public/models/）            |
| 运行闸门模式             | HeroWorldMap.vue       | visibilitychange 暂停 / DPR 上限 / 销毁释放 |

### 4.1 场景元素

```ts
interface AuthSceneSpec {
  key:   { x: 0.5, y: 0.72 }            // 钥匙锚点（相对坐标）
  nodes: 8-10 个 ModelStar               // 星座节点：icon + 深度(0.6~1.4) + 相位
  packets: Flyline[]                     // 并发上限 4：金色升 / 薄荷绿落
  dust:  ~24 个微尘粒子                   // 极暗，替代整幅字符雨（窄栏字符雨会显挤）
}
```

- **节点布局**：手工调优的固定星座位（非随机），保证与 HTML 文案区不重叠；
  节点带轻微正弦浮动（幅度 3px，周期各异）
- **包调度**：每 1.2-2.4s 随机发一个请求包（钥匙→节点），到达时节点 halo 脉冲；
  30% 概率 0.6s 后回发响应包（节点→钥匙，薄荷绿）——与首页请求/响应语义一致
- **钥匙**：若 IMG-A3 合格则绘制位图 + 呼吸 glow；否则 Canvas 矢量手绘线稿钥匙
- **悬停**：命中节点 → 放大 1.15 + 显示模型名标签（复用 MapNode 标签样式）

### 4.2 双主题色盘（加入 `canvas/theme.ts`）

左栏「恒深」但分两种深：

```ts
authLight: {  // 日间：墨绿夜 — 对齐 --surface-footer #38372b
  bgTint: '#38372b', packet: '#d8984c', response: '#7fa463',
  nodeSurface: '#2e2d23', halo: '#e4c276', dust: '#9b9c86', label: '#f4f2e8',
}
authDark: {   // 夜间：炭蓝夜 — 对齐 footer #181b24
  bgTint: '#181b24', packet: '#e2bc55', response: '#8ec8aa',
  nodeSurface: '#232d42', halo: '#efd27e', dust: '#636e8a', label: '#dee3f0',
}
```

（日夜切换即时换盘，沿用 `scene.setTheme()` 模式，无需重建）

### 4.3 性能与可达性闸门

- `prefers-reduced-motion`：不跑动画循环，绘制一帧静态星座（节点+钥匙+两条
  定格飞线），保留完整构图
- `document.visibilitychange` → stop/start；无需 IntersectionObserver（面板常驻）
- DPR 上限 2；canvas 尺寸 = 面板实际尺寸（≈ 42vw × 100vh）
- 引擎走 `await import()` 异步 chunk（同 MapScene 模式），表单首屏不等它
- Canvas `aria-hidden="true"`（纯装饰，品牌语义在 HTML 层）
- 移动端（`< lg`）面板隐藏，引擎不实例化

---

## 五、组件与文件改动

```
新建
  src/components/auth/AuthBrandPanel.vue   左栏整体（五层结构 + 视差 + ticker）
  src/components/auth/AuthScene.vue        canvas 宿主（生命周期闸门，~120 行）
  src/canvas/AuthScene.ts                  迷你引擎（~300 行）
  src/canvas/__tests__/AuthScene.spec.ts   布局/调度纯逻辑测试
  src/assets/auth/panel-day.webp           IMG-A1 产物
  src/assets/auth/panel-night.webp         IMG-A2 产物
  src/assets/auth/key-emblem.png           IMG-A3 产物（若采用位图方案）

修改
  src/components/layout/AuthLayout.vue     左栏内容整体委托给 AuthBrandPanel
  src/canvas/theme.ts                      + authLight/authDark 色盘
  src/i18n/locales/{zh-CN,en}/auth.ts      + ticker 标签键（modelsOnline 等 3 个）
  src/i18n/locales/{zh-CN,en}/common.ts    （若 ticker 复用 common 键则不动 auth）
```

### mini-ticker 设计（替换底部三个装饰点）

```
▸ 支持模型 {modelCountLabel}    ▸ 在线率 {uptimeLabel}    ▸ 版本 {versionLabel}
```

- 数据源：`useAppStore`（已有 initialize，登录页本就调用）
- 3 项轮播淡切（4s/项），`prefers-reduced-motion` 时静态并列
- 数据缺省显示 `--`（store 已内建），不发额外请求

### 视差实现

- `pointermove` 节流至 rAF，写两个 CSS 变量 `--tilt-x/--tilt-y`（±6px）
- Layer 1 `translate(calc(var(--tilt-x) * -0.4), …)`、Layer 3 canvas 内节点按
  depth 系数偏移（引擎内部处理，不动 canvas 元素本身）
- 触屏设备跳过（无 hover 能力查询 `(hover: hover)`）

---

## 六、实施阶段

```
P1  生图（IMG-A1/A2 并行 → 选优 → A3 → 可选 A4）          与 P2 并行
P2  AuthBrandPanel 骨架：五层结构迁移 + scrim + ticker + 视差
P3  AuthScene 引擎：星座布局 → 飞线调度 → 钥匙 → 悬停
P4  主题切换 / reduced-motion 静态帧 / 性能核查（CPU 空闲占用 <3%）
P5  回归：test / typecheck / lint / format / build +
    Playwright 双主题 × {sign-in, sign-up, reset} × reduced-motion 截图
P6  提交（子模块 + 外层指针）
```

### 风险与对策

| 风险                           | 对策                                                 |
| ------------------------------ | ---------------------------------------------------- |
| Key-B 连接不稳（上轮实证）     | 每任务 Key-B 只试 1 次即降级 Key-A；A 已验证可用     |
| AI 背景压不住文字对比度        | 强制 scrim 渐变层 + 验收 4.5:1；不达标就加深 scrim   |
| 3D 钥匙质感翻车                | 预设 Canvas 矢量钥匙 fallback，主线不阻塞            |
| 星座与文案区重叠（窄屏 lg~xl） | 节点坐标按面板高宽比两档微调（栅格断点内测）         |
| 登录页首屏变重                 | 背景 ≤300KB、引擎异步 chunk、canvas 延迟到 idle 启动 |
| 图标加载失败（无网/缺文件）    | iconLoader 已有 fallback → 彩色圆点 + 首字母         |

---

## 七、验收清单

- [ ] 双主题下：背景氛围图正确切换、飞线/节点/钥匙色盘正确
- [ ] slogan、标题、tagline、品牌行文案与 DOM 结构不变（i18n 键不删改）
- [ ] ticker 显示真实 store 数据，加载失败显示 `--`
- [ ] `prefers-reduced-motion: reduce` 下为静态构图帧，无任何动画
- [ ] 标签页切后台 CPU 占用归零（visibilitychange 暂停生效）
- [ ] 移动端布局与现在完全一致（面板隐藏）
- [ ] 全部校验绿：test:run / typecheck / lint / format:check / build
