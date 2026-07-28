import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import BrandMark from '@/components/console/BrandMark.vue'
import { BRAND_LOGO_PATH } from '@/constants/branding'

describe('BrandMark', () => {
  it('renders the shared PNG logo as a decorative image', () => {
    const wrapper = mount(BrandMark)
    const image = wrapper.get('img')

    expect(image.attributes('src')).toBe(BRAND_LOGO_PATH)
    expect(image.attributes('alt')).toBe('')
    expect(image.attributes('aria-hidden')).toBe('true')
  })
})
