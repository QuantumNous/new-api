import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import type { ModelCategory } from '../types'

export function ModelCard({ category }: { category: ModelCategory }) {
  return (
    <Card className='border-white/10 bg-[#111827]/70 backdrop-blur'>
      <CardHeader>
        <CardTitle className='text-lg text-foreground'>{category.title}</CardTitle>
        <p className='mt-2 text-sm text-[#94A3B8]'>{category.description}</p>
      </CardHeader>
      <CardContent>
        <div className='space-y-4'>
          {category.models.map((m) => (
            <div key={m.name} className='rounded-xl border border-white/5 bg-[#0B0F1A] p-4'>
              <div className='flex flex-wrap items-center gap-2'>
                <span className='font-medium text-foreground'>{m.name}</span>
                {m.capabilityTags.map((tag) => (
                  <span
                    key={tag}
                    className='rounded-full bg-[#22D3EE]/10 px-2 py-0.5 text-xs text-[#22D3EE]'
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <p className='mt-1 text-xs text-[#94A3B8]'>{m.note}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
