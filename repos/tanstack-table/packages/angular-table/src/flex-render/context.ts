import { inject, InjectionToken } from '@angular/core'

export const FlexRenderComponentProps = new InjectionToken<
  NonNullable<unknown>
>('[@tanstack/angular-table] Flex render component context props')

export function injectFlexRenderContext<T extends NonNullable<unknown>>(): T {
  return inject<T>(FlexRenderComponentProps)
}
