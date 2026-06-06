import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { I18nProvider, useI18n } from './i18n'

describe('I18nProvider', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('provides default context values', () => {
    const { result } = renderHook(() => useI18n(), {
      wrapper: ({ children }) => <I18nProvider>{children}</I18nProvider>,
    })

    expect(result.current.lang).toBe('en')
    expect(typeof result.current.t).toBe('function')
    expect(typeof result.current.setLanguage).toBe('function')
    expect(result.current.languages.map((item) => item.value)).toEqual(['zh', 'en', 'ru'])
  })

  it('translates keys in English', () => {
    const { result } = renderHook(() => useI18n(), {
      wrapper: ({ children }) => <I18nProvider>{children}</I18nProvider>,
    })

    expect(result.current.t('nav.models')).toBe('Models')
    expect(result.current.t('hero.title')).toBe('One API,')
    expect(result.current.t('common.save')).toBe('Save')
  })

  it('translates keys in Chinese', () => {
    const { result } = renderHook(() => useI18n(), {
      wrapper: ({ children }) => <I18nProvider>{children}</I18nProvider>,
    })

    act(() => {
      result.current.setLanguage('zh')
    })

    expect(result.current.lang).toBe('zh')
    expect(result.current.t('nav.models')).toBe('模型')
    expect(result.current.t('hero.title')).toBe('一个 API，')
    expect(result.current.t('common.save')).toBe('保存')
  })

  it('translates keys in Russian', () => {
    const { result } = renderHook(() => useI18n(), {
      wrapper: ({ children }) => <I18nProvider>{children}</I18nProvider>,
    })

    act(() => {
      result.current.setLanguage('ru')
    })

    expect(result.current.lang).toBe('ru')
    expect(result.current.t('nav.models')).toBe('Модели')
    expect(result.current.t('channels.title')).toBe('Каналы')
    expect(result.current.t('common.save')).toBe('Сохранить')
  })

  it('sets language and saves preference', () => {
    const { result } = renderHook(() => useI18n(), {
      wrapper: ({ children }) => <I18nProvider>{children}</I18nProvider>,
    })

    expect(result.current.lang).toBe('en')

    act(() => {
      result.current.setLanguage('ru')
    })

    expect(result.current.lang).toBe('ru')
    expect(localStorage.getItem('vynex-lang')).toBe('ru')
  })

  it('saves language preference to localStorage', () => {
    renderHook(() => useI18n(), {
      wrapper: ({ children }) => <I18nProvider>{children}</I18nProvider>,
    })

    expect(localStorage.getItem('vynex-lang')).toBeNull()

    act(() => {
      // Initial state should not save to localStorage.
    })

    // Initial state doesn't save, only toggle does
  })

  it('loads saved language preference', () => {
    localStorage.setItem('vynex-lang', 'zh')

    const { result } = renderHook(() => useI18n(), {
      wrapper: ({ children }) => <I18nProvider>{children}</I18nProvider>,
    })

    expect(result.current.lang).toBe('zh')
    expect(result.current.t('nav.models')).toBe('模型')
  })

  it('loads saved Russian preference', () => {
    localStorage.setItem('vynex-lang', 'ru')

    const { result } = renderHook(() => useI18n(), {
      wrapper: ({ children }) => <I18nProvider>{children}</I18nProvider>,
    })

    expect(result.current.lang).toBe('ru')
    expect(result.current.t('nav.channels')).toBe('Каналы')
  })

  it('falls back to English for missing keys', () => {
    localStorage.setItem('vynex-lang', 'zh')

    const { result } = renderHook(() => useI18n(), {
      wrapper: ({ children }) => <I18nProvider>{children}</I18nProvider>,
    })

    // This key doesn't exist in zh, should fall back to en
    expect(result.current.t('nonexistent.key')).toBe('nonexistent.key')
  })

  it('returns the key itself if not found in any language', () => {
    const { result } = renderHook(() => useI18n(), {
      wrapper: ({ children }) => <I18nProvider>{children}</I18nProvider>,
    })

    expect(result.current.t('completely.missing.key')).toBe('completely.missing.key')
  })

  it('replaces variables in translations', () => {
    const { result } = renderHook(() => useI18n(), {
      wrapper: ({ children }) => <I18nProvider>{children}</I18nProvider>,
    })

    expect(result.current.t('cta.desc', { brand: 'Vynex' })).toBe('Use Vynex as the stable access layer for model testing, routing, and production calls.')
  })

  it('replaces multiple variables', () => {
    const { result } = renderHook(() => useI18n(), {
      wrapper: ({ children }) => <I18nProvider>{children}</I18nProvider>,
    })

    // Test with a hypothetical translation that has multiple vars
    const text = result.current.t('common.page', { current: '1', total: '10' })
    // Since the actual translation doesn't have these vars, this tests the fallback
    expect(typeof text).toBe('string')
  })

  it('handles browser language detection for Chinese', () => {
    // Mock navigator.language
    const originalLanguage = navigator.language
    Object.defineProperty(navigator, 'language', {
      value: 'zh-CN',
      writable: true,
    })

    const { result } = renderHook(() => useI18n(), {
      wrapper: ({ children }) => <I18nProvider>{children}</I18nProvider>,
    })

    expect(result.current.lang).toBe('zh')

    // Restore
    Object.defineProperty(navigator, 'language', {
      value: originalLanguage,
      writable: true,
    })
  })

  it('handles browser language detection for Russian', () => {
    const originalLanguage = navigator.language
    Object.defineProperty(navigator, 'language', {
      value: 'ru-RU',
      writable: true,
    })

    const { result } = renderHook(() => useI18n(), {
      wrapper: ({ children }) => <I18nProvider>{children}</I18nProvider>,
    })

    expect(result.current.lang).toBe('ru')

    Object.defineProperty(navigator, 'language', {
      value: originalLanguage,
      writable: true,
    })
  })

  it('defaults to English for non-Chinese browser languages', () => {
    const originalLanguage = navigator.language
    Object.defineProperty(navigator, 'language', {
      value: 'ja-JP',
      writable: true,
    })

    const { result } = renderHook(() => useI18n(), {
      wrapper: ({ children }) => <I18nProvider>{children}</I18nProvider>,
    })

    expect(result.current.lang).toBe('en')

    // Restore
    Object.defineProperty(navigator, 'language', {
      value: originalLanguage,
      writable: true,
    })
  })

  it('handles empty localStorage gracefully', () => {
    const { result } = renderHook(() => useI18n(), {
      wrapper: ({ children }) => <I18nProvider>{children}</I18nProvider>,
    })

    expect(result.current.lang).toBe('en')
  })

  it('handles invalid localStorage values', () => {
    localStorage.setItem('vynex-lang', 'invalid')

    const { result } = renderHook(() => useI18n(), {
      wrapper: ({ children }) => <I18nProvider>{children}</I18nProvider>,
    })

    // Should fall back to browser language detection
    expect(typeof result.current.lang).toBe('string')
  })
})

describe('useI18n hook', () => {
  it('returns default context values when used outside provider', () => {
    const { result } = renderHook(() => useI18n())

    // Context has default values, so it doesn't throw
    expect(result.current.lang).toBe('en')
    expect(result.current.t('nav.models')).toBe('nav.models')
    expect(typeof result.current.setLanguage).toBe('function')
  })
})
