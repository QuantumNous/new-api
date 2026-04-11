import { createFileRoute } from '@tanstack/react-router'
import { AppHeader, Main } from '@/components/layout'
import { Playground } from '@/features/playground'

export const Route = createFileRoute('/_authenticated/playground/')({
  component: PlaygroundPage,
})

function PlaygroundPage() {
  return (
    <>
      <AppHeader fixed />
      <Main fixed className='p-0'>
        <Playground />
      </Main>
    </>
  )
}
