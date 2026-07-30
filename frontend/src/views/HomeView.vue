<template>
  <div
    class="landing-shell night-page-texture min-h-screen bg-[var(--page-background)] text-[var(--text-primary)]"
    data-handdrawn-scope="home"
  >
    <AppNavbar />
    <ScrollActivityIndicator />

    <!-- ===== 开屏 Hero ===== -->
    <section
      id="hero-immersive-stage"
      class="relative flex min-h-[100svh] items-center overflow-hidden pt-[calc(env(safe-area-inset-top)+5.5rem)] pb-[calc(env(safe-area-inset-bottom)+4.75rem)] [@media(max-height:843px)_and_(max-width:1023px)]:pb-[calc(env(safe-area-inset-bottom)+3.5rem)] lg:min-h-screen lg:pt-20 lg:pb-0"
    >
      <!-- 全屏背景：点阵世界地图 + 网关路由动画 -->
      <HeroWorldMap
        :immersive="immersive"
        @signal-change="signalSnapshot = $event"
      />

      <!-- 深度渐变叠层：聚光网关枢纽(左中)、压暗四周 -->
      <div
        class="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style="background: var(--hero-depth-overlay)"
      />
      <!-- 右侧文字可读性 scrim（桌面端压暗右栏底衬） -->
      <div
        class="pointer-events-none absolute inset-0 hidden lg:block"
        aria-hidden="true"
        style="background: var(--hero-copy-overlay)"
      />
      <!-- 暗角 -->
      <div
        class="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style="box-shadow: var(--hero-vignette)"
      />

      <!-- 左栏：与 Canvas 联动的 ASCII 网关信号账本 -->
      <HeroSignalConsole
        :snapshot="signalSnapshot"
        :class="{ 'is-immersive': immersive }"
      />

      <!-- 两栏内容（桌面：左图右文网格；移动：上舞台留白 + 下海报式直排） -->
      <div
        class="relative z-10 mx-auto flex w-full max-w-[100rem] flex-1 flex-col gap-6 self-stretch px-4 py-6 max-lg:gap-4 max-lg:py-4 [@media(max-height:700px)_and_(max-width:1023px)]:py-2 sm:px-6 lg:grid lg:grid-cols-[minmax(18rem,0.78fr)_minmax(34rem,1.22fr)] lg:items-center lg:gap-10 lg:px-8 lg:py-14 lg:pr-10 xl:gap-14 xl:py-16 xl:pr-12"
      >
        <!-- 左：留空（地图与网关枢纽由全屏背景层透出） -->
        <div class="order-1 hidden lg:order-none lg:block" aria-hidden="true" />
        <!-- 移动舞台：弹性填充把多余高度还给地图，内容自然沉底（各高度观感一致）；
             下滑手势区（进入全屏沉浸），引导胶囊置顶；矮屏保底舞台条高度 -->
        <div
          class="order-1 flex min-h-[8svh] flex-1 items-start justify-center pt-1 [touch-action:pan-x] [@media(max-height:843px)_and_(max-width:1023px)]:min-h-[6svh] [@media(max-height:700px)_and_(max-width:1023px)]:min-h-[36px] lg:hidden"
          @touchstart="onStageTouchStart"
          @touchmove="onStageTouchMove"
          @touchend="onStageTouchEnd"
          @touchcancel="onStageTouchEnd"
        >
          <button
            ref="stageButton"
            type="button"
            class="hero-stage-hint flex items-center gap-1.5 rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-1.5 text-[11px] tracking-[0.06em] text-[var(--text-secondary)] shadow-[0_6px_18px_var(--shadow-color)] backdrop-blur-[12px] backdrop-saturate-150 transition-all duration-500 [@media(max-height:700px)_and_(max-width:1023px)]:hidden"
            :class="
              showHint
                ? 'translate-y-0 opacity-100'
                : 'pointer-events-none translate-y-1.5 opacity-0'
            "
            data-hero-canvas-boundary
            :aria-expanded="immersive"
            aria-controls="hero-immersive-stage"
            :aria-label="t('hero.stageHint')"
            @click="enter"
          >
            <svg
              class="animate-bounce text-[var(--accent)]"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.4"
              aria-hidden="true"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
            <span>{{ t('hero.stageHint') }}</span>
          </button>
        </div>
        <!-- 右：文本与组件（无卡片，直接落在净底上；pan-y 保证竖滑滚动不被横滑转图劫持；沉浸态淡出） -->
        <div
          class="order-2 flex w-full justify-center [touch-action:pan-y_pinch-zoom] transition-all duration-300 ease-out lg:order-none lg:w-auto lg:justify-end"
          :class="{
            'pointer-events-none invisible translate-y-10 opacity-0': immersive,
          }"
        >
          <HeroContent :average-latency-ms="signalSnapshot.averageLatencyMs" />
        </div>
      </div>

      <!-- 沉浸模式召回钮（占据 Ticker 原位置） -->
      <Transition
        enter-from-class="translate-y-2 opacity-0"
        enter-active-class="transition-all duration-300"
        leave-to-class="translate-y-2 opacity-0"
        leave-active-class="transition-all duration-200"
      >
        <button
          v-if="immersive"
          type="button"
          class="hero-stage-hint absolute bottom-[max(20px,env(safe-area-inset-bottom))] left-1/2 z-[12] inline-flex -translate-x-1/2 animate-pulse-slow items-center gap-1.5 rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] px-4 py-2.5 text-xs font-semibold tracking-[0.04em] text-[var(--text-primary)] shadow-[0_8px_24px_var(--shadow-color)] backdrop-blur-[16px] backdrop-saturate-150 lg:hidden"
          data-hero-canvas-boundary
          :aria-label="t('hero.stageRecall')"
          @click="exitImmersive"
        >
          <svg
            class="text-[var(--accent)]"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.4"
            aria-hidden="true"
          >
            <path d="M18 15l-6-6-6 6" />
          </svg>
          <span>{{ t('hero.stageRecall') }}</span>
        </button>
      </Transition>

      <!-- 向下滚动提示 -->
      <div
        class="pointer-events-none absolute bottom-5 left-1/2 hidden -translate-x-1/2 lg:block"
        aria-hidden="true"
      >
        <div
          class="hero-scroll-cue flex h-9 w-5 items-start justify-center rounded-full border border-[var(--border-default)] p-1.5"
        >
          <span
            class="h-2 w-1 animate-bounce rounded-full bg-[var(--accent)]"
          />
        </div>
      </div>
    </section>

    <HomeShowcase />

    <AppFooter />
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppNavbar from '@/components/layout/AppNavbar.vue'
import AppFooter from '@/components/layout/AppFooter.vue'
import HeroWorldMap from '@/components/home/hero/HeroWorldMap.vue'
import HeroContent from '@/components/home/hero/HeroContent.vue'
import HeroSignalConsole from '@/components/home/hero/HeroSignalConsole.vue'
import ScrollActivityIndicator from '@/components/home/hero/ScrollActivityIndicator.vue'
import HomeShowcase from '@/components/home/showcase/HomeShowcase.vue'
import { useHeroScrollChrome } from '@/composables/useHeroScrollChrome'
import { useImmersiveStage } from '@/composables/useImmersiveStage'
import {
  INITIAL_SIGNAL_SNAPSHOT,
  type SignalConsoleSnapshot,
} from '@/constants/home/signalConsole'

const { t } = useI18n()

const signalSnapshot = ref<SignalConsoleSnapshot>({
  ...INITIAL_SIGNAL_SNAPSHOT,
})

const {
  immersive,
  showHint,
  enter,
  exit,
  onStageTouchStart,
  onStageTouchMove,
  onStageTouchEnd,
} = useImmersiveStage()

const stageButton = ref<HTMLButtonElement | null>(null)

function exitImmersive() {
  exit()
  nextTick(() => stageButton.value?.focus())
}

useHeroScrollChrome()
</script>
