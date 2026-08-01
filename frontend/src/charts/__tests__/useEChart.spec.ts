import { defineComponent, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const echartsMock = vi.hoisted(() => {
  const instances: Array<{
    setOption: ReturnType<typeof vi.fn>
    resize: ReturnType<typeof vi.fn>
    dispose: ReturnType<typeof vi.fn>
    dispatchAction: ReturnType<typeof vi.fn>
  }> = []
  return { instances }
})

vi.mock('echarts/core', () => ({
  use: vi.fn(),
  init: vi.fn(() => {
    const instance = {
      setOption: vi.fn(),
      resize: vi.fn(),
      dispose: vi.fn(),
      dispatchAction: vi.fn(),
    }
    echartsMock.instances.push(instance)
    return instance
  }),
}))

vi.mock('echarts/charts', () => ({
  BarChart: {},
  LineChart: {},
  PieChart: {},
}))
vi.mock('echarts/components', () => ({
  GraphicComponent: {},
  GridComponent: {},
  LegendComponent: {},
  TooltipComponent: {},
}))
vi.mock('echarts/renderers', () => ({ CanvasRenderer: {} }))

import { useEChart } from '@/charts/useEChart'

const Host = defineComponent({
  props: { loading: Boolean },
  setup() {
    const chartEl = ref<HTMLElement | null>(null)
    useEChart(chartEl, () => ({ series: [] }))
    return { chartEl }
  },
  template: '<div><div v-if="!loading" ref="chartEl" class="chart" /></div>',
})

beforeEach(() => echartsMock.instances.splice(0))

describe('useEChart', () => {
  it('disposes and reinitializes when a loading branch replaces the host DOM', async () => {
    const wrapper = mount(Host, { props: { loading: false } })
    await flushPromises()

    expect(echartsMock.instances).toHaveLength(1)
    const first = echartsMock.instances[0]!
    expect(first.setOption).toHaveBeenCalledOnce()

    await wrapper.setProps({ loading: true })
    await flushPromises()
    expect(first.dispose).toHaveBeenCalledOnce()

    await wrapper.setProps({ loading: false })
    await flushPromises()
    expect(echartsMock.instances).toHaveLength(2)
    expect(echartsMock.instances[1]!.setOption).toHaveBeenCalledOnce()

    wrapper.unmount()
    expect(echartsMock.instances[1]!.dispose).toHaveBeenCalledOnce()
  })
})
