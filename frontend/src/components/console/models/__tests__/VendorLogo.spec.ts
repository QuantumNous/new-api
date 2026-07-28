import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import VendorLogo from '@/components/console/models/VendorLogo.vue'

const vendorIcons = {
  OpenAI: '/models/openai.svg',
  Anthropic: '/models/claude-color.svg',
  Google: '/models/gemini-color.svg',
  DeepSeek: '/models/deepseek-color.svg',
  阿里通义: '/models/qwen-color.svg',
  xAI: '/models/grok.svg',
  Moonshot: '/models/kimi-color.svg',
  智谱AI: '/models/zhipu-color.svg',
}

describe('VendorLogo', () => {
  it.each(Object.entries(vendorIcons))(
    'renders the real icon for %s',
    (vendor, src) => {
      const wrapper = mount(VendorLogo, { props: { vendor } })

      expect(wrapper.get('img').attributes('src')).toBe(src)
    }
  )

  it('falls back to the vendor initial for unknown vendors', () => {
    const wrapper = mount(VendorLogo, { props: { vendor: 'Unknown' } })

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toBe('U')
  })

  it('falls back when an icon cannot be loaded', async () => {
    const wrapper = mount(VendorLogo, { props: { vendor: 'OpenAI' } })

    await wrapper.get('img').trigger('error')

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toBe('O')
  })
})
