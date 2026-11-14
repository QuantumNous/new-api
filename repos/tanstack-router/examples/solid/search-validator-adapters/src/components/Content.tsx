import type { JSX } from 'solid-js'

export interface ContentProps {
  readonly children: JSX.Element
}

export const Content = ({ children }: ContentProps) => {
  return <section class="my-2 flex flex-col gap-2">{children}</section>
}
