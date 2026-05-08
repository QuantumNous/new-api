import { createFileRoute } from '@tanstack/react-router'
import { Main } from '@/components/layout'
import { ImageWorkbench } from '@/features/image-workbench'

export const Route = createFileRoute('/_authenticated/image-workbench/')({
  component: ImageWorkbenchPage,
})

function ImageWorkbenchPage() {
  return (
    <Main className='p-0'>
      <ImageWorkbench />
    </Main>
  )
}
