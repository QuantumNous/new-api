import {
  onBeforeUnmount,
  onMounted,
  watch,
  type Ref,
  type WatchSource,
} from 'vue'

import { BarChart, LineChart, PieChart } from 'echarts/charts'
import {
  GraphicComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsCoreOption } from 'echarts/core'

import { chartPalette, type ChartPalette } from './palette'

echarts.use([
  LineChart,
  PieChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  GraphicComponent,
  CanvasRenderer,
])

export type OptionBuilder = (palette: ChartPalette) => EChartsCoreOption

/**
 * Binds an ECharts instance to an element. The option is built from the
 * live semantic palette and rebuilt whenever the resolved theme flips
 * (html[data-theme], written by useTheme) or any of `watchSources` changes
 * (async data / interactive toggles). Sources are watched shallowly — pass
 * wholesale-replaced refs/computeds/getters, not in-place-mutated arrays.
 */
export function useEChart(
  el: Ref<HTMLElement | null>,
  buildOption: OptionBuilder,
  watchSources?: WatchSource | WatchSource[]
) {
  let chart: echarts.ECharts | null = null
  let resizeObserver: ResizeObserver | null = null
  let themeObserver: MutationObserver | null = null

  function render() {
    if (!chart) return
    const option = buildOption(chartPalette())
    chart.setOption(
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? { ...option, animation: false }
        : option,
      true
    )
  }

  /**
   * Forwards an action to the chart, e.g. highlighting a slice when the row it
   * corresponds to is hovered. No-ops before mount and after dispose.
   */
  function dispatch(action: Parameters<echarts.ECharts['dispatchAction']>[0]) {
    chart?.dispatchAction(action)
  }

  if (watchSources) {
    // Shallow on purpose: every call site replaces its source wholesale, and a
    // deep walk over full chart datasets on each change is wasted work.
    watch(watchSources, () => render())
  }

  function attach(target: HTMLElement) {
    if (chart) return
    chart = echarts.init(target)
    render()

    resizeObserver = new ResizeObserver(() => chart?.resize())
    resizeObserver.observe(target)

    // data-theme changes only on light/dark flips (useTheme), unlike `class`,
    // which any route/overlay toggle can touch — observing it avoids full
    // chart rebuilds on unrelated class churn.
    themeObserver = new MutationObserver(() => render())
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
  }

  onMounted(() => {
    if (el.value) attach(el.value)
  })

  // Charts behind a v-if loading skeleton mount without an element; pick it up
  // as soon as the real container renders.
  watch(el, (target) => {
    if (target) attach(target)
  })

  onBeforeUnmount(() => {
    resizeObserver?.disconnect()
    themeObserver?.disconnect()
    chart?.dispose()
    chart = null
  })

  return { refresh: render, dispatch }
}
