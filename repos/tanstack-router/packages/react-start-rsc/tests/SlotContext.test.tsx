import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SlotProvider, useSlotContext } from '../src/SlotContext'

describe('SlotContext', () => {
  describe('SlotProvider', () => {
    it('should provide implementations to children', () => {
      function Consumer() {
        const ctx = useSlotContext()
        return <div data-testid="result">{JSON.stringify(ctx)}</div>
      }

      render(
        <SlotProvider implementations={{ foo: 'bar' }}>
          <Consumer />
        </SlotProvider>,
      )

      const result = screen.getByTestId('result')
      const ctx = JSON.parse(result.textContent!)
      expect(ctx.implementations).toEqual({ foo: 'bar' })
      expect(ctx.strict).toBe(false)
    })

    it('should support strict mode', () => {
      function Consumer() {
        const ctx = useSlotContext()
        return <div data-testid="strict">{String(ctx?.strict)}</div>
      }

      render(
        <SlotProvider implementations={{}} strict={true}>
          <Consumer />
        </SlotProvider>,
      )

      expect(screen.getByTestId('strict').textContent).toBe('true')
    })

    it('should default strict to false', () => {
      function Consumer() {
        const ctx = useSlotContext()
        return <div data-testid="strict">{String(ctx?.strict)}</div>
      }

      render(
        <SlotProvider implementations={{}}>
          <Consumer />
        </SlotProvider>,
      )

      expect(screen.getByTestId('strict').textContent).toBe('false')
    })

    it('should render children', () => {
      render(
        <SlotProvider implementations={{}}>
          <div data-testid="child">Child content</div>
        </SlotProvider>,
      )

      expect(screen.getByTestId('child').textContent).toBe('Child content')
    })
  })

  describe('useSlotContext', () => {
    it('should return null outside of SlotProvider', () => {
      function Consumer() {
        const ctx = useSlotContext()
        return (
          <div data-testid="ctx">{ctx === null ? 'null' : 'has value'}</div>
        )
      }

      render(<Consumer />)

      expect(screen.getByTestId('ctx').textContent).toBe('null')
    })

    it('should access nested implementations', () => {
      function Consumer() {
        const ctx = useSlotContext()
        const nested = ctx?.implementations.nested as { deep: string }
        return <div data-testid="deep">{nested?.deep}</div>
      }

      render(
        <SlotProvider implementations={{ nested: { deep: 'value' } }}>
          <Consumer />
        </SlotProvider>,
      )

      expect(screen.getByTestId('deep').textContent).toBe('value')
    })

    it('should access function implementations', () => {
      function Consumer() {
        const ctx = useSlotContext()
        const fn = ctx?.implementations.renderItem as (n: number) => string
        return <div data-testid="fn-result">{fn?.(42)}</div>
      }

      render(
        <SlotProvider
          implementations={{ renderItem: (n: number) => `Item ${n}` }}
        >
          <Consumer />
        </SlotProvider>,
      )

      expect(screen.getByTestId('fn-result').textContent).toBe('Item 42')
    })
  })
})
