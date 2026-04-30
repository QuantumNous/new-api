import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { AppHeader, Main } from '@/components/layout'
import { ModelDetails } from '@/features/pricing/components/model-details'

const modelSquareDetailsSearchSchema = z.object({
  search: z.string().optional(),
  sort: z.string().optional(),
  vendor: z.string().optional(),
  group: z.string().optional(),
  quotaType: z.string().optional(),
  endpointType: z.string().optional(),
  tag: z.string().optional(),
  tokenUnit: z.enum(['M', 'K']).optional(),
  rechargePrice: z.boolean().optional(),
})

export const Route = createFileRoute('/_authenticated/model-square/$modelId/')({
  validateSearch: modelSquareDetailsSearchSchema,
  component: ModelSquareDetails,
})

function ModelSquareDetails() {
  return (
    <>
      <AppHeader />
      <Main className='overflow-auto py-6'>
        <ModelDetails
          embedded
          routeFrom='/_authenticated/model-square/$modelId/'
          backPath='/model-square'
        />
      </Main>
    </>
  )
}
