import {
  Component,
  ViewChild,
  input,
  type TemplateRef,
  effect,
} from '@angular/core'
import { TestBed, type ComponentFixture } from '@angular/core/testing'
import { createColumnHelper } from '@tanstack/table-core'
import { describe, expect, test } from 'vitest'
import {
  FlexRenderDirective,
  injectFlexRenderContext,
} from '../src/flex-render'
import { setFixtureSignalInput, setFixtureSignalInputs } from './test-utils'
import {
  flexRenderComponent,
  FlexRenderComponent,
} from '../src/flex-render/flex-render-component'

interface Data {
  id: string
  title: string
  description: string
  status: 'success' | 'failed' | 'pending'
  favorite?: boolean
}

describe('FlexRenderDirective', () => {
  const helper = createColumnHelper<Data>()

  test('should render primitives', async () => {
    const fixture = TestBed.createComponent(TestRenderComponent)

    // Null
    setFixtureSignalInputs(fixture, {
      content: () => null,
      context: {},
    })
    expect((fixture.nativeElement as HTMLElement).matches(':empty')).toBe(true)

    // Undefined
    setFixtureSignalInputs(fixture, {
      content: () => undefined,
      context: {},
    })
    expect((fixture.nativeElement as HTMLElement).matches(':empty')).toBe(true)

    // String
    setFixtureSignalInputs(fixture, {
      content: 'My value',
      context: {},
    })
    expectPrimitiveValueIs(fixture, 'My value')

    // Numbers
    setFixtureSignalInputs(fixture, {
      content: 0,
      context: {},
    })
    expectPrimitiveValueIs(fixture, '0')

    // Functions that returns primitives
    setFixtureSignalInputs(fixture, {
      content: () => 'My value 2',
      context: {},
    })
    expectPrimitiveValueIs(fixture, 'My value 2')

    // Set again to null to be sure content has been destroyed
    setFixtureSignalInputs(fixture, {
      content: () => null,
      context: {},
    })
    expect((fixture.nativeElement as HTMLElement).matches(':empty')).toBe(true)
  })

  test('should render TemplateRef', () => {
    @Component({
      template: `
        <ng-template #template let-context>{{ context.property }}</ng-template>
      `,
      standalone: true,
    })
    class FakeTemplateRefComponent {
      @ViewChild('template', { static: true })
      templateRef!: TemplateRef<any>
    }

    const templateRef = TestBed.createComponent(FakeTemplateRefComponent)
      .componentInstance.templateRef

    const fixture = TestBed.createComponent(TestRenderComponent)
    setFixtureSignalInputs(fixture, {
      content: () => templateRef,
      context: {
        property: 'Property context value',
      },
    })

    expect(fixture.nativeElement.textContent).toEqual('Property context value')

    setFixtureSignalInput(fixture, 'context', { property: 'Updated value' })
    fixture.detectChanges()

    expect(fixture.nativeElement.textContent).toEqual('Updated value')
  })

  test('should render components', () => {
    @Component({
      template: `{{ context.property }}`,
      standalone: true,
    })
    class FakeComponent {
      context = injectFlexRenderContext<{ property: string }>()
    }

    const fixture = TestBed.createComponent(TestRenderComponent)
    setFixtureSignalInputs(fixture, {
      content: () => flexRenderComponent(FakeComponent),
      context: {
        property: 'Context value',
      },
    })

    expect(fixture.nativeElement.textContent).toEqual('Context value')

    setFixtureSignalInput(fixture, 'context', { property: 'Updated value' })
    fixture.detectChanges()

    expect(fixture.nativeElement.textContent).toEqual('Updated value')
  })

  // Skip for now, test framework (using ComponentRef.setInput) cannot recognize signal inputs
  // as component inputs
  test('should render custom components', () => {
    @Component({
      template: `{{ row().property }}`,
      standalone: true,
    })
    class FakeComponent {
      row = input.required<{ property: string }>()

      constructor() {}
    }

    const fixture = TestBed.createComponent(TestRenderComponent)
    setFixtureSignalInputs(fixture, {
      content: () => FakeComponent,
      context: {
        row: {
          property: 'Row value',
        },
      },
    })

    expect(fixture.nativeElement.textContent).toEqual('Row value')

    setFixtureSignalInput(fixture, 'context', {
      row: { property: 'Updated value' },
    })
    fixture.detectChanges()

    expect(fixture.nativeElement.textContent).toEqual('Updated value')
  })
})

@Component({
  selector: 'app-test-render',
  template: `
    <ng-container *flexRender="content(); props: context(); let renderValue">
      <span [innerHTML]="renderValue"></span>
    </ng-container>
  `,
  standalone: true,
  imports: [FlexRenderDirective],
})
class TestRenderComponent {
  readonly content = input.required<FlexRenderDirectiveAllowedContent>()

  readonly context = input.required<Record<string, unknown>>()
}

type FlexRenderDirectiveAllowedContent = FlexRenderDirective<
  NonNullable<unknown>
>['content']

function expectPrimitiveValueIs(
  fixture: ComponentFixture<unknown>,
  value: unknown
) {
  expect(fixture.nativeElement.matches(':empty')).toBe(false)
  const span = fixture.nativeElement.querySelector('span')
  expect(span).toBeDefined()
  expect(span.innerHTML).toEqual(value)
}
