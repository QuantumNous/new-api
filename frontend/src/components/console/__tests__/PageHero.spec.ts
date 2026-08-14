import { shallowMount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import PageHero from '@/components/console/PageHero.vue'

describe('PageHero', () => {
  it('keeps the default title and accent rendering', () => {
    const wrapper = shallowMount(PageHero, {
      props: { title: 'Wallet', titleAccent: 'Top-up' },
    })

    const heading = wrapper.get('h1')
    expect(heading.text()).toContain('Wallet')
    expect(heading.text()).toContain('&')
    expect(heading.text()).toContain('Top-up')
    expect(heading.get('.brush-highlight').text()).toContain('Top-up')
  })

  it('renders a custom title without leaking the fallback title', () => {
    const wrapper = shallowMount(PageHero, {
      props: { title: 'Fallback title' },
      slots: {
        title: '<span data-custom-title>Custom title</span>',
      },
    })

    const heading = wrapper.get('h1')
    expect(heading.get('[data-custom-title]').text()).toBe('Custom title')
    expect(heading.text()).not.toContain('Fallback title')
  })
})
