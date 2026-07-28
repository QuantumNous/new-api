<template>
  <component
    :is="docsLink ? 'a' : 'span'"
    :aria-label="tool.name"
    :href="docsLink || undefined"
    :target="docsLink ? '_blank' : undefined"
    :rel="docsLink ? 'noopener noreferrer' : undefined"
    :tabindex="clone || !docsLink ? -1 : 0"
    class="block shrink-0 overflow-visible"
  >
    <div
      class="hero-integration-chip group relative flex size-12 items-center justify-center rounded-full border transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
      :class="
        active
          ? 'chip-active z-10 -translate-y-0.5 scale-110 border-[var(--accent)] bg-[var(--accent-soft)] opacity-100'
          : 'border-[var(--border-subtle)] bg-transparent opacity-75 hover:border-[var(--border-strong)] hover:opacity-100'
      "
      :title="tool.name"
    >
      <span
        v-if="active"
        class="hero-integration-chip__halo"
        aria-hidden="true"
      />
      <img
        alt=""
        class="relative z-[1] size-7 object-contain transition-all duration-500"
        :class="
          active
            ? 'opacity-100 grayscale-0'
            : 'opacity-75 grayscale group-hover:opacity-100 group-hover:grayscale-0'
        "
        :src="tool.icon"
        loading="lazy"
      />
    </div>
  </component>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'

import type { Integration } from '@/constants/home/integrations'
import { useAppStore } from '@/stores'

const { docsLink } = storeToRefs(useAppStore())

defineProps<{
  tool: Integration
  /** 是否处于聚光灯位（随滚动切换点亮） */
  active?: boolean
  /** 跑马灯的第二组克隆，屏蔽键盘/读屏 */
  clone?: boolean
}>()
</script>

<style scoped>
.hero-integration-chip {
  isolation: isolate;
}
.hero-integration-chip__halo {
  position: absolute;
  z-index: 0;
  inset: -18px;
  border-radius: 999px;
  background: radial-gradient(
    circle,
    rgb(var(--accent-rgb) / 0.3) 0%,
    rgb(var(--accent-rgb) / 0.16) 38%,
    rgb(var(--accent-rgb) / 0) 72%
  );
  filter: blur(3px);
  pointer-events: none;
  animation: chip-halo 2.4s ease-in-out infinite;
}
/* 选中态：蜂蜜黄呼吸外发光（参考二狗 API 的满色高亮对比） */
.chip-active {
  animation: chip-breathe 2.4s ease-in-out infinite;
}
.chip-active::after {
  position: absolute;
  z-index: 2;
  inset: -6px;
  border: 1px solid rgb(var(--accent-rgb) / 0.45);
  border-radius: inherit;
  content: '';
  pointer-events: none;
  animation: chip-ring 2.4s ease-in-out infinite;
}
@keyframes chip-breathe {
  0%,
  100% {
    box-shadow:
      0 0 0 1px rgb(var(--accent-rgb) / 0.35),
      0 6px 18px -4px rgb(var(--accent-rgb) / 0.35);
  }
  50% {
    box-shadow:
      0 0 0 1px rgb(var(--accent-rgb) / 0.55),
      0 10px 26px -2px rgb(var(--accent-rgb) / 0.55);
  }
}
@keyframes chip-halo {
  0%,
  100% {
    opacity: 0.54;
    transform: scale(0.92);
  }
  50% {
    opacity: 1;
    transform: scale(1.08);
  }
}
@keyframes chip-ring {
  0%,
  100% {
    opacity: 0.42;
    transform: scale(0.96);
  }
  50% {
    opacity: 0.88;
    transform: scale(1.04);
  }
}
/* 移动端：光晕/描边环收敛（84px 光池 → 66px），不再溢出轨道渗入周边内容 */
@media (max-width: 1023px) {
  .hero-integration-chip__halo {
    inset: -9px;
    filter: blur(2px);
  }
  .chip-active::after {
    inset: -4px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .hero-integration-chip__halo,
  .chip-active::after {
    animation: none;
  }
  .chip-active {
    animation: none;
    box-shadow:
      0 0 0 1px rgb(var(--accent-rgb) / 0.4),
      0 6px 18px -4px rgb(var(--accent-rgb) / 0.4);
  }
}
</style>
