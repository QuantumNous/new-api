import { createFileRoute } from '@tanstack/react-router'
import { AppHeader } from '@/components/layout'
import { Playground } from '@/features/playground'

export const Route = createFileRoute('/_authenticated/playground/')({
  component: PlaygroundPage,
})

function PlaygroundPage() {
  return (
    <>
      <AppHeader fixed />
      <div className='flex h-[calc(100vh-80px)] w-full'>
        <Playground />
      </div>
    </>
  )
}
