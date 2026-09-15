import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ClientSlot } from '../src/ClientSlot'
import { SlotProvider } from '../src/SlotContext'

describe('ClientSlot', () => {
  describe('error handling', () => {
    it('should throw when rendered outside SlotProvider', () => {
      // Suppress React error boundary console output
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => {
        render(<ClientSlot slot="test" args={[]} />)
      }).toThrow('ClientSlot must be rendered within SlotProvider')

      spy.mockRestore()
    })
  })

  describe('missing implementations', () => {
    it('should return null for missing slot in non-strict mode', () => {
      render(
        <SlotProvider implementations={{}} strict={false}>
          <div data-testid="container">
            <ClientSlot slot="missing" args={[]} />
          </div>
        </SlotProvider>,
      )

      // Container should be empty (null rendered)
      expect(screen.getByTestId('container').children).toHaveLength(0)
    })

    it('should throw for missing slot in strict mode', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => {
        render(
          <SlotProvider implementations={{}} strict={true}>
            <ClientSlot slot="missing" args={[]} />
          </SlotProvider>,
        )
      }).toThrow('Missing slot implementation for "missing"')

      spy.mockRestore()
    })
  })

  describe('non-function implementations', () => {
    it('should render string directly', () => {
      render(
        <SlotProvider implementations={{ greeting: 'Hello World' }}>
          <div data-testid="slot">
            <ClientSlot slot="greeting" args={[]} />
          </div>
        </SlotProvider>,
      )

      expect(screen.getByTestId('slot').textContent).toBe('Hello World')
    })

    it('should render number directly', () => {
      render(
        <SlotProvider implementations={{ count: 42 }}>
          <div data-testid="slot">
            <ClientSlot slot="count" args={[]} />
          </div>
        </SlotProvider>,
      )

      expect(screen.getByTestId('slot').textContent).toBe('42')
    })

    it('should render React element directly', () => {
      render(
        <SlotProvider implementations={{ element: <span>Element</span> }}>
          <div data-testid="slot">
            <ClientSlot slot="element" args={[]} />
          </div>
        </SlotProvider>,
      )

      expect(screen.getByTestId('slot').textContent).toBe('Element')
    })

    it('should render children slot', () => {
      render(
        <SlotProvider implementations={{ children: <div>Child content</div> }}>
          <div data-testid="slot">
            <ClientSlot slot="children" args={[]} />
          </div>
        </SlotProvider>,
      )

      expect(screen.getByTestId('slot').textContent).toBe('Child content')
    })
  })

  describe('function implementations', () => {
    it('should call function with no args', () => {
      render(
        <SlotProvider implementations={{ render: () => 'No args result' }}>
          <div data-testid="slot">
            <ClientSlot slot="render" args={[]} />
          </div>
        </SlotProvider>,
      )

      expect(screen.getByTestId('slot').textContent).toBe('No args result')
    })

    it('should call function with single arg', () => {
      render(
        <SlotProvider
          implementations={{ render: (name: string) => `Hello ${name}` }}
        >
          <div data-testid="slot">
            <ClientSlot slot="render" args={['World']} />
          </div>
        </SlotProvider>,
      )

      expect(screen.getByTestId('slot').textContent).toBe('Hello World')
    })

    it('should call function with multiple args', () => {
      render(
        <SlotProvider
          implementations={{
            render: (a: number, b: number, c: number) => `Sum: ${a + b + c}`,
          }}
        >
          <div data-testid="slot">
            <ClientSlot slot="render" args={[1, 2, 3]} />
          </div>
        </SlotProvider>,
      )

      expect(screen.getByTestId('slot').textContent).toBe('Sum: 6')
    })

    it('should call function returning React element', () => {
      render(
        <SlotProvider
          implementations={{
            render: (item: { id: number; name: string }) => (
              <span key={item.id}>{item.name}</span>
            ),
          }}
        >
          <div data-testid="slot">
            <ClientSlot slot="render" args={[{ id: 1, name: 'Item One' }]} />
          </div>
        </SlotProvider>,
      )

      expect(screen.getByTestId('slot').textContent).toBe('Item One')
    })

    it('should handle function returning null', () => {
      render(
        <SlotProvider implementations={{ render: () => null }}>
          <div data-testid="slot">
            <ClientSlot slot="render" args={[]} />
          </div>
        </SlotProvider>,
      )

      expect(screen.getByTestId('slot').children).toHaveLength(0)
    })
  })

  describe('edge cases', () => {
    it('should handle undefined args gracefully', () => {
      render(
        <SlotProvider
          implementations={{
            render: (...args: Array<unknown>) => `Args: ${args.length}`,
          }}
        >
          <div data-testid="slot">
            <ClientSlot slot="render" args={[undefined, undefined]} />
          </div>
        </SlotProvider>,
      )

      expect(screen.getByTestId('slot').textContent).toBe('Args: 2')
    })

    it('should handle complex object args', () => {
      interface ComplexArg {
        nested: { deep: { value: string } }
      }

      render(
        <SlotProvider
          implementations={{
            render: (obj: ComplexArg) => obj.nested.deep.value,
          }}
        >
          <div data-testid="slot">
            <ClientSlot
              slot="render"
              args={[{ nested: { deep: { value: 'Deep value' } } }]}
            />
          </div>
        </SlotProvider>,
      )

      expect(screen.getByTestId('slot').textContent).toBe('Deep value')
    })
  })
})
