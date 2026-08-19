import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import MiniSparkline from '@/components/console/dashboard/MiniSparkline.vue'

describe('MiniSparkline', () => {
  it('keeps smoothed control points inside the projected value range', () => {
    const wrapper = mount(MiniSparkline, {
      props: { points: [0, 100, 100, 100], height: 32 },
    })
    const path = wrapper.find('path[fill="none"]').attributes('d') ?? ''
    const coordinates = path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
    const yCoordinates = coordinates.filter((_, index) => index % 2 === 1)

    expect(path).toContain('C')
    expect(Math.min(...yCoordinates)).toBeGreaterThanOrEqual(2)
    expect(Math.max(...yCoordinates)).toBeLessThanOrEqual(30)
  })
})
