import { createFileRoute } from '@tanstack/react-router'
import { Main } from '@/components/layout'
import { Playground } from '@/features/playground'

export const Route = createFileRoute('/_authenticated/playground/')({
  component: PlaygroundPage,
})

function PlaygroundPage() {
  return (
    <Main className='p-0'>
      <Playground />
    </Main>
  )
}
