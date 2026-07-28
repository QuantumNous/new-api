# 登录页中转动画重构计划 — 多上游聚合转发

> **目标**：把左栏顶部的静态三段链路图，换成一条「提示词 → 网关 → 多上游扇出 →
> 回程」的极简动画；右侧上游簇完整显示；日夜给出各自的材质语言；顺带修掉当前
> 布局实测出来的三处硬伤。
>
> **风格基准**：参考图的克制感 —— 发丝线、抽象字节符、小字标签、大留白。
> 不加插画、不加彩色 logo、不加第二个 Canvas。

---

## 一、现状实测（1440×900 / 1024×820，Chrome DevTools 量取）

| 项              | 实测                                 | 问题                                                          |
| --------------- | ------------------------------------ | ------------------------------------------------------------- |
| 1440 左栏内容盒 | 672px                                | 链路图内容仅 ~406px 且左对齐 → **右侧 266px 死区**            |
| 1024 左栏内容盒 | 344px                                | 链路图实测 344px → **零余量**，再宽即裁切                     |
| 三个内容块宽度  | 672 / 576(max-w-xl) / 448(max-w-md)  | 右边缘三档参差                                                |
| 竖向间距        | `justify-between` 产出 138px / 139px | 非设计值，随视口高度漂移                                      |
| DotGlobe        | 800×635 @ x=224                      | 右侧被 `overflow-hidden` 裁切，底部溢出视口，且压在信任清单上 |
| 双主题          | 日夜同一套灰发丝线                   | 链路图完全没有主题性格                                        |

「右侧内容完整显示」据此落为硬指标：**上游簇（含节点名）必须整块在内容盒内，
1024 起不裁切、不溢出、不进 `overflow-hidden` 的裁切区**。

---

## 二、叙事与构图

```
 提示词原文                    字节级直通              官方上游 · 聚合转发
 ─────────── // ── // ────────▶ ◇网关 ──┬──▶ ▤ Claude
                                        ├──▶ ▤ GPT
                                        ├──▶ ▤ Gemini
                                        └──▶ ▤ DeepSeek
```

- **左段 trunk**：一条发丝线 + 两组 `//` 字节符（沿用参考图语汇）
- **中枢 hub**：菱形/圆角芯片，唯一带 accent 的实体
- **右段 fan**：4 条三次贝塞尔曲线，水平出、水平入（S 形），扇向 4 个上游芯片
- **上游列**：右对齐块，每行 = 芯片 + 名称；块宽由最长名称决定，整体随容器流动

节点名取 `src/constants/home/models.ts` 的 `MODEL_NODES` 前 4 项（Claude / GPT /
Gemini / DeepSeek）—— 专有名词不进 i18n，且复用首页既有单一来源，不新建常量。

### 动画时序（6.4s 循环，语义对齐首页 Canvas 的请求/响应双色）

| 相位     | 时间       | 表现                                              |
| -------- | ---------- | ------------------------------------------------- |
| 请求上行 | 0 → 1.5s   | accent 光带沿 trunk 左→右                         |
| 网关脉冲 | 1.4 → 1.9s | hub 光环扩散一次                                  |
| 扇出     | 1.6 → 3.1s | 4 条支线 accent 短划出行，每条 stagger 0.12s      |
| 上游脉冲 | 到达时     | 对应芯片描边亮一次                                |
| 回程     | 3.2 → 4.7s | 4 条支线 `--glow` 短划回流（日草甸绿 / 夜薄荷绿） |
| 响应下行 | 4.6 → 6.0s | `--glow` 光带沿 trunk 右→左                       |
| 静息     | 6.0 → 6.4s | 留白呼吸                                          |

---

## 三、技术选型（含已排除方案）

| 方案                                                | 结论                                                                |
| --------------------------------------------------- | ------------------------------------------------------------------- |
| `offset-path` / `animateMotion`                     | ✗ 过度依赖新特性，且难对齐 HTML 标签                                |
| 整图 SVG（含文字）                                  | ✗ `preserveAspectRatio="none"` 会横向拉伸文字                       |
| **SVG 画线 + HTML 排版**（采用）                    | ✓ 文字用 HTML 保持清晰；线走 SVG 拿曲线                             |
| trunk 用 SVG dash 动画                              | ✗ `non-scaling-stroke` 与 `pathLength` 的 dash 单位在浏览器间不一致 |
| **trunk 用 `background-position` 渐变光带**（采用） | ✓ 只跑合成层，无 layout/paint 抖动，宽度自适应                      |
| fan 用 `stroke-dashoffset`（采用）                  | ✓ viewBox 内单位稳定，4 条线成本可忽略                              |

- fan 的 `<svg>` 用 `preserveAspectRatio="none"` 铺满容器；路径用归一化的
  `pathLength="100"`，让 dash 长度与动画时序不受 88×112 非等比拉伸影响
- 不使用 `feTurbulence`：滤镜挂在跑 dash 的路径上会每帧重算，且 Firefox 下
  `filter: url(#id)` 有样式表 URL 解析问题。改为由主题状态缩放贝塞尔控制点偏移，
  日间 wobble=1、夜间 wobble=0.3，几何本身随主题收敛

---

## 四、日夜风格分层（日：手绘为主 + 雅致；夜：雅致材质为主 + 手绘为辅）

| 元素       | 日 Desert Ledger                                                   | 夜 One Night                                     |
| ---------- | ------------------------------------------------------------------ | ------------------------------------------------ |
| trunk      | 墨线 + 极淡第二道「铅笔回描」                                      | 单一发丝线 + 金色微光                            |
| fan 导引线 | 贝塞尔控制点 wobble 1.0（明显手绘）                                | wobble 0.3（**手绘为辅**：几乎直，仍非机械直线） |
| 导引虚线   | 不匀 dash `5 3 2 4`                                                | 近实线 hairline `7 5`                            |
| hub 芯片   | `--sketch-border-radius-sm` 歪斜圆角 + 铅笔 offset 投影 + 朱砂印点 | uniform 8px + `--elevation-2` + 金色光环         |
| 上游芯片   | 1.5px 歪斜描边、纸面填充                                           | 1px 均匀描边、`--surface-tint-1` 填充            |
| 光带端头   | 方头（`butt`）像笔尖                                               | 圆头 + `drop-shadow` 金色光晕                    |
| 标签       | 衬线 `--font-display` + 宽字距                                     | 同结构，字重降一档（雅致轻字重）                 |

颜色、材质与控件形态沿用既有分叉机制：**只在 `tokens.css` 两个作用域给新令牌
不同值，组件不做主题 DOM 分支**；曲线几何由 `resolvedTheme` 只选择 wobble 倍率。

新增令牌（`--relay-*` 前缀，共 10 个，日夜各一套）：
`--relay-line`、`--relay-line-echo`、`--relay-guide-dash`、`--relay-chip-fill`、
`--relay-chip-border`、`--relay-chip-radius`、`--relay-chip-shadow`、
`--relay-packet-cap`、`--relay-packet-glow`、`--relay-label-weight`

---

## 五、布局修正

1. **统一右边缘**：三个内容块 + 新链路图共用 `--panel-measure`（`lg:34rem` /
   `xl:38rem`），消除 672/576/448 三档参差；链路图因此在 1024 也有余量
2. **竖向节奏**：`justify-between` → `mt-auto` + 视口高度响应的
   `clamp()` 间距；矮屏收紧、高屏保留编辑级呼吸，不再由剩余高度随机分配
3. **DotGlobe 归位**：移到右下角落（`-bottom-[16%] -right-[8%]`、宽 72%、
   高 58%、opacity 0.55），不再压信任清单，也不再被裁掉半个球
4. **左栏内边距**：`lg` 档 `px-12` → `px-10`，给 1024 的图多让 16px

`AuthLayout.vue` 的网格骨架、断点、表单列宽 **不动** —— 表单卡与移动端零回归。

---

## 六、文件改动

```
新建
  src/components/auth/AuthRelayFlow.vue          链路动画组件（~200 行）
  src/components/auth/__tests__/AuthRelayFlow.spec.ts   结构与降级测试

修改
  src/components/auth/AuthEditorialPanel.vue     内联链路图 → 组件；布局节奏；globe 归位
  src/styles/tokens.css                          + 10 个 --relay-* 令牌（日夜各一套）
  src/i18n/locales/{zh-CN,en}/auth.ts            + relay.fanout；英文短标签微调
```

i18n 只加 `relay.fanout`（「聚合转发」/「Aggregated relay」）；`relay.prompt` /
`relay.passthrough` / `relay.upstream` 三个既有键继续复用，不删改。

---

## 七、可访问性与性能

- 整图 `aria-hidden="true"`：纯装饰，品牌语义在 HTML 文案层（与现状一致）
- `prefers-reduced-motion: reduce`：**全部动画停止**，光带定格在中途、hub 光环
  定格一圈 —— 保留完整构图可读性，不退化成空图
- 动画只跑 `background-position` 与 `stroke-dashoffset`，无 layout/reflow
- 移动端 `< lg` 面板整体 `display:none`，组件 DOM 宽度为 0、Canvas 引擎不实例化
- 不新增网络请求、不新增图片资产、不新增依赖

---

## 八、验收结果

- [x] 1024 / 1280 / 1440 / 1920 四档：上游簇含名称完整可见，无裁切无横向溢出
- [x] 动画、标题块、脚注三个内容块右边缘对齐
- [x] 日间：手绘抖动线 + 歪斜芯片 + 朱砂点；夜间：近直线 + 金色光环 + elevation
- [x] 双主题实时切换（令牌驱动，无需重挂组件）
- [x] reduced-motion 下静态构图完整（定格请求光带、hub 环、四路包）
- [x] DotGlobe 收进右下角，不再压信任清单
- [x] 登录 / 注册 / 重置三页无横向或纵向溢出；移动端面板保持隐藏
- [x] 中英文标签无重叠，上游名称均来自 `MODEL_NODES`
- [x] `test:run` / `typecheck` / `lint` / `format:check` / `build` 全绿
