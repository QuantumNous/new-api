<script setup lang="ts">
// 登录页中转动画 v2：火车站场隐喻。
// 主干线：双轨 + 火车车厢从提示词侧驶向品牌中央站。
// 分支线：三条折线道岔，接驳车厢逐条发车至上游终点站。
// Hub 使用 BrandMark + app.systemName，与控制台侧边栏品牌完全对齐。
// 所有颜色走 --relay-* 语义令牌，双主题自动切换，无 DOM 分支。
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import BrandMark from '@/components/console/BrandMark.vue'
import { MODEL_NODES } from '@/constants/home/models'
import { useAppStore } from '@/stores'

const { t } = useI18n()
const app = useAppStore()

/** 3 条上游终点站 */
const UPSTREAM_COUNT = 3

/** 扇区 viewBox 尺寸（3 行 × 22px 芯片 + 2 × 12px 行距 = 90） */
const FAN_W = 88
const FAN_H = 90

/** 汇流竖直条出发 X 坐标 */
const BUS_X = 2

/** 汇流条 Y 出口（3 行，围绕中点 45 展开） */
const BUS_Y = [34, 45, 56] as const

/** 各终点行 Y 中心（FAN_H 三等分中点） */
const ROW_Y = [15, 45, 75] as const

/**
 * 折线道岔路径：出汇流点后斜向目标行，再水平延伸到扇区右缘。
 * 与贝塞尔不同，直线段让道岔有铁路分叉的几何感。
 */
function branchPath(index: number): string {
  const ox = BUS_X
  const oy = BUS_Y[index]
  const ty = ROW_Y[index]
  const jog = FAN_W * 0.36 // 道岔拐角 X 位置
  return `M ${ox} ${oy} L ${jog.toFixed(1)} ${ty} L ${FAN_W} ${ty}`
}

const branches = computed(() =>
  MODEL_NODES.slice(0, UPSTREAM_COUNT).map((node, index) => ({
    id: node.id,
    name: node.name,
    path: branchPath(index),
    /** 接驳车依次错开 0.14s 出站，读起来像逐条派发 */
    delay: `${(index * 0.14).toFixed(2)}s`,
  }))
)

const hubName = computed(() => app.systemName)
</script>

<template>
  <div class="relay" aria-hidden="true">
    <!-- ===== 主干线：双轨 + 字节符 + 往返车厢 ===== -->
    <div class="relay__trunk">
      <span class="relay__rail relay__rail--top" />
      <span class="relay__rail relay__rail--bottom" />
      <span class="relay__ties" />
      <!-- 字节符装饰，保留手账感 -->
      <span class="relay__glyphs">
        <svg width="46" height="26" viewBox="0 0 46 26" fill="none">
          <path
            d="M7 22 L14 4 M13 22 L20 4"
            stroke="currentColor"
            stroke-width="1"
          />
          <path
            d="M27 22 L34 4 M33 22 L40 4"
            stroke="currentColor"
            stroke-width="1"
            opacity="0.5"
          />
        </svg>
      </span>
      <!-- 请求车厢：琥珀金，左→右 -->
      <span class="relay__train relay__train--request" />
      <!-- 响应车厢：薄荷绿，右→左 -->
      <span class="relay__train relay__train--response" />
    </div>

    <!-- ===== Hub：品牌中央站 ===== -->
    <div class="relay__hub">
      <span class="relay__hub-ring" />
      <span class="relay__hub-chip">
        <BrandMark class="relay__hub-brand" />
      </span>
      <!-- 朱砂印点：日间手账落印，夜间熄灭 -->
      <span class="relay__seal" />
    </div>

    <!-- ===== 扇区：三条折线道岔 + 接驳车厢 ===== -->
    <svg
      class="relay__fan"
      :viewBox="`0 0 ${FAN_W} ${FAN_H}`"
      preserveAspectRatio="none"
      fill="none"
    >
      <!-- 网关出线：横向短接 + 竖直汇流条 -->
      <path class="relay__bus" :d="`M-8 ${FAN_H / 2} H${BUS_X}`" />
      <path class="relay__bus" :d="`M${BUS_X} ${BUS_Y[0]} V${BUS_Y[2]}`" />
      <g v-for="(branch, i) in branches" :key="branch.id">
        <!-- 折线轨道（虚线轨枕感） -->
        <path class="relay__guide" :d="branch.path" pathLength="100" />
        <!-- 接驳车厢：出程（琥珀金）-->
        <path
          class="relay__packet relay__packet--out"
          :d="branch.path"
          pathLength="100"
          :style="{ animationDelay: branch.delay }"
        />
        <!-- 接驳车厢：回程（薄荷绿）-->
        <path
          class="relay__packet relay__packet--back"
          :d="branch.path"
          pathLength="100"
          :style="{ animationDelay: branch.delay }"
        />
        <!-- 站台出口横线 -->
        <path :d="`M${FAN_W} ${ROW_Y[i]} h4`" class="relay__guide" />
      </g>
    </svg>

    <!-- ===== 终点站台列表 ===== -->
    <ul class="relay__upstream">
      <li v-for="branch in branches" :key="branch.id" class="relay__node">
        <span class="relay__chip" :style="{ animationDelay: branch.delay }">
          <svg width="11" height="14" viewBox="0 0 11 14" fill="none">
            <path
              d="M2 4.5h7M2 7.5h7M2 10.5h4.5"
              stroke="currentColor"
              stroke-width="1"
              opacity="0.65"
            />
          </svg>
        </span>
        <span class="relay__name">{{ branch.name }}</span>
      </li>
    </ul>

    <!-- ===== 标签行 ===== -->
    <p class="relay__label relay__label--trunk">{{ t('auth.relay.prompt') }}</p>
    <p class="relay__label relay__label--hub">{{ hubName }}</p>
    <p class="relay__label relay__label--fan">
      {{ t('auth.relay.upstream') }}<br />{{ t('auth.relay.fanout') }}
    </p>
  </div>
</template>

<style scoped>
/* 四列共享：trunk 弹性 / hub 定宽 / fan 定宽 / 终点 max-content。
   hub 列加宽至 36px：BrandMark 20px + 左右各 8px 留白。 */
.relay {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 36px 88px max-content;
  grid-template-rows: 90px auto;
  align-items: center;
  column-gap: 10px;
  /* 整体渐入：组件挂载时从 translateY(5px) opacity-0 升入 */
  animation: relay-appear 0.8s ease-out both;
}

@keyframes relay-appear {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ===== trunk：双轨 + 轨枕 + 往返车厢 ===== */
.relay__trunk {
  position: relative;
  grid-column: 1;
  grid-row: 1;
  height: 100%;
  display: flex;
  align-items: center;
  overflow: hidden;
}

/* 双轨：上下各一条 1px 线，间距 4px */
.relay__rail {
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--relay-line);
}

.relay__rail--top {
  top: calc(50% - 2px);
}

.relay__rail--bottom {
  top: calc(50% + 2px);
  /* 铅笔回描：日间主线下补一道淡痕；夜间令牌为 transparent */
  box-shadow: 0 1.5px 0 var(--relay-line-echo);
}

/* 轨枕：repeating-gradient 模拟，零额外 DOM */
.relay__ties {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(50% - 4px);
  height: 9px;
  background-image: repeating-linear-gradient(
    90deg,
    transparent 0px,
    transparent 8px,
    var(--relay-line) 8px,
    var(--relay-line) 10px
  );
  opacity: 0.25;
  pointer-events: none;
}

.relay__glyphs {
  position: absolute;
  left: 34%;
  color: var(--text-secondary);
  opacity: 0.8;
  display: flex;
  align-items: center;
}

/* 火车车厢：宽 28px 的扁平色块，中间段纯色、两端极短渐变收边，
   整体比光带（beam）更方正，有「矩形车厢」的形态感。
   用 background-position 驱动位移，无 transform，重绘成本可忽略。 */
.relay__train {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(50% - 5px);
  height: 10px;
  background-repeat: no-repeat;
  background-size: 28px 100%;
  filter: var(--relay-packet-glow);
  opacity: 0;
}

.relay__train--request {
  background-image: linear-gradient(
    90deg,
    transparent 0%,
    var(--accent) 12%,
    var(--accent) 88%,
    transparent 100%
  );
  animation: relay-train-out 6.4s linear infinite;
}

.relay__train--response {
  background-image: linear-gradient(
    90deg,
    transparent 0%,
    var(--glow) 12%,
    var(--glow) 88%,
    transparent 100%
  );
  animation: relay-train-back 6.4s linear infinite;
}

/* 出程车厢：0→23%（与原 beam-out 时序一致） */
@keyframes relay-train-out {
  0% {
    background-position: 0% 0;
    opacity: 0;
  }
  4% {
    opacity: 1;
  }
  19% {
    opacity: 1;
  }
  23% {
    background-position: 100% 0;
    opacity: 0;
  }
  100% {
    background-position: 100% 0;
    opacity: 0;
  }
}

/* 回程车厢：72→94%（与原 beam-back 时序一致） */
@keyframes relay-train-back {
  0%,
  72% {
    background-position: 100% 0;
    opacity: 0;
  }
  76% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  94%,
  100% {
    background-position: 0% 0;
    opacity: 0;
  }
}

/* ===== Hub：品牌中央站 ===== */
.relay__hub {
  position: relative;
  grid-column: 2;
  grid-row: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.relay__hub-chip {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  background: var(--relay-chip-fill);
  border: 1.5px solid var(--relay-chip-border);
  border-radius: var(--relay-chip-radius);
  box-shadow: var(--relay-chip-shadow);
  overflow: hidden;
}

/* BrandMark 缩放至 20px，与芯片留 5px 内边距 */
.relay__hub-brand {
  width: 20px;
  height: 20px;
  border-radius: 3px;
  flex-shrink: 0;
}

/* 到达脉冲环：形状跟随 hub-chip 圆角 */
.relay__hub-ring {
  position: absolute;
  width: 30px;
  height: 30px;
  border: 1px solid var(--accent);
  border-radius: var(--relay-chip-radius);
  opacity: 0;
  animation: relay-ring 6.4s ease-out infinite;
}

@keyframes relay-ring {
  0%,
  22% {
    transform: scale(0.85);
    opacity: 0;
  }
  25% {
    opacity: 0.55;
  }
  30% {
    transform: scale(1.75);
    opacity: 0;
  }
  100% {
    transform: scale(1.75);
    opacity: 0;
  }
}

/* 朱砂印点：日间手账落印；夜间 --dec-stamp 为 transparent 自动熄灭 */
.relay__seal {
  position: absolute;
  z-index: 2;
  top: -2px;
  right: -1px;
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background: var(--status-danger);
  opacity: 0.42;
}

html.dark .relay__seal {
  display: none;
}

/* ===== 扇区：折线道岔 ===== */
.relay__fan {
  grid-column: 3;
  grid-row: 1;
  width: 100%;
  height: 90px;
  overflow: visible;
}

/* 折线轨道虚线：间隔调大，枕木感更强 */
.relay__guide {
  stroke: var(--relay-line);
  stroke-width: 1;
  stroke-dasharray: var(--relay-guide-dash);
}

/* 汇流条为实线 */
.relay__bus {
  stroke: var(--relay-line);
  stroke-width: 1;
}

/* 接驳车厢：stroke 宽一档，方块感更强 */
.relay__packet {
  stroke-width: 2;
  stroke-linecap: var(--relay-packet-cap);
  stroke-dasharray: 11 100;
  stroke-dashoffset: 11;
  filter: var(--relay-packet-glow);
  opacity: 0;
}

.relay__packet--out {
  stroke: var(--accent);
  animation: relay-fan-out 6.4s linear infinite;
}

.relay__packet--back {
  stroke: var(--glow);
  animation: relay-fan-back 6.4s linear infinite;
}

@keyframes relay-fan-out {
  0%,
  25% {
    stroke-dashoffset: 11;
    opacity: 0;
  }
  28% {
    opacity: 1;
  }
  45% {
    opacity: 1;
  }
  48%,
  100% {
    stroke-dashoffset: -100;
    opacity: 0;
  }
}

@keyframes relay-fan-back {
  0%,
  50% {
    stroke-dashoffset: -100;
    opacity: 0;
  }
  53% {
    opacity: 1;
  }
  70% {
    opacity: 1;
  }
  73%,
  100% {
    stroke-dashoffset: 11;
    opacity: 0;
  }
}

/* ===== 终点站台列 ===== */
.relay__upstream {
  grid-column: 4;
  grid-row: 1;
  height: 90px;
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.relay__node {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 22px;
}

.relay__chip {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 17px;
  height: 22px;
  flex-shrink: 0;
  color: var(--text-secondary);
  background: var(--relay-chip-fill);
  border: 1px solid var(--relay-chip-border);
  border-radius: var(--relay-chip-radius);
  animation: relay-chip-pulse 6.4s ease-out infinite;
}

@keyframes relay-chip-pulse {
  0%,
  44% {
    border-color: var(--relay-chip-border);
  }
  49% {
    border-color: var(--accent);
  }
  58%,
  100% {
    border-color: var(--relay-chip-border);
  }
}

.relay__name {
  font-size: 11px;
  letter-spacing: 0.06em;
  white-space: nowrap;
  color: var(--text-secondary);
}

/* ===== 标签行 ===== */
.relay__label {
  grid-row: 2;
  margin: 10px 0 0;
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: var(--relay-label-weight);
  letter-spacing: 0.12em;
  color: var(--text-tertiary);
}

.relay__label--trunk {
  grid-column: 1;
  padding-right: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Hub 标签：显示 systemName，允许从两侧溢出（居中布局） */
.relay__label--hub {
  grid-column: 2;
  justify-self: center;
  white-space: nowrap;
  font-size: 9px;
  letter-spacing: 0.08em;
}

.relay__label--fan {
  grid-column: 3 / -1;
  justify-self: end;
  text-align: right;
  line-height: 1.5;
}

/* reduced-motion：关掉所有动画，定格在分支途中构图（三条支线各有接驳车） */
@media (prefers-reduced-motion: reduce) {
  .relay {
    animation: none;
  }

  .relay__train--request {
    background-position: 62% 0;
    opacity: 1;
  }

  .relay__train--response {
    opacity: 0;
  }

  .relay__hub-ring {
    transform: scale(1.4);
    opacity: 0.4;
  }

  .relay__packet--out {
    stroke-dashoffset: -42;
    opacity: 1;
  }

  .relay__packet--back {
    opacity: 0;
  }
}
</style>
