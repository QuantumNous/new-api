import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import PageHero from '@/components/console/PageHero.vue'
import i18n from '@/i18n'

describe('PageHero accent rendering', () => {
  it('keeps the ampersand swash form for existing callers', () => {
    const wrapper = mount(PageHero, {
      props: { title: '订阅', titleAccent: '余额' },
      global: { plugins: [i18n] },
    })
    const heading = wrapper.get('h1')

    expect(heading.text()).toContain('&')
    expect(heading.classes()).toContain('gesture-mark')
    const accent = heading.get('span')
    expect(accent.classes()).toContain('brush-highlight')
    expect(accent.classes()).not.toContain('brush-highlight--underline')
  })

  it('renders a greeting with an underlined name and outside punctuation', () => {
    const wrapper = mount(PageHero, {
      props: {
        title: '该去吃饭了',
        titleAccent: '白日飞猪',
        titleSeparator: '，',
        titleAccentPrefix: '',
        titleSuffix: '。',
        accentVariant: 'underline',
      },
      global: { plugins: [i18n] },
    })
    const heading = wrapper.get('h1')

    expect(heading.text()).toBe('该去吃饭了，白日飞猪。')
    expect(heading.classes()).not.toContain('gesture-mark')
    expect(heading.attributes('data-accent-variant')).toBe('underline')

    const accent = heading.get('span')
    expect(accent.classes()).toContain('brush-highlight--underline')
    // The painted mark covers only the name: no separator, no period.
    expect(accent.text()).toBe('白日飞猪')
  })

  it('applies the accent markup to the right-aligned title too', () => {
    const wrapper = mount(PageHero, {
      props: {
        title: '钱包',
        titleAccent: '额度',
        titleSide: 'right',
        accentVariant: 'underline',
      },
      global: { plugins: [i18n] },
    })
    const heading = wrapper.get('h1')

    expect(heading.get('span').classes()).toContain(
      'brush-highlight--underline'
    )
  })
})
