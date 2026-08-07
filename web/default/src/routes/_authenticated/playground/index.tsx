/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect } from 'react'
import { isSidebarModuleEnabled } from '@/lib/nav-modules'
import { Main } from '@/components/layout'
import { Playground } from '@/features/playground'
import { MODEL_GENERATOR_DRAFT_CLEANUP_KEY } from '@/features/playground/constants'

export function validatePlaygroundSearch(
  search: Record<string, unknown>
): {
  first?: 1
  prompt?: string
  generate?: 'image' | 'video'
  model?: string
  draft?: string
} {
  // `?first=1` marks the post-registration first-run onboarding experience.
  // Keep the serialized URL stable as `first=1`; boolean values serialize as
  // `first=true`, while string values serialize with quotes.
  const first = search.first
  const isFirstRun =
    first === '1' || first === 1 || first === true || first === 'true'
  const prompt = typeof search.prompt === 'string' ? search.prompt.trim() : ''
  const generate =
    search.generate === 'image' || search.generate === 'video'
      ? search.generate
      : undefined
  const model = typeof search.model === 'string' ? search.model.trim() : ''
  const draft =
    typeof search.draft === 'string' && search.draft.length <= 12000
      ? search.draft
      : ''
  return {
    ...(isFirstRun ? { first: 1 } : {}),
    ...(prompt ? { prompt } : {}),
    ...(generate ? { generate } : {}),
    ...(model ? { model } : {}),
    ...(draft ? { draft } : {}),
  }
}

export const Route = createFileRoute('/_authenticated/playground/')({
  validateSearch: validatePlaygroundSearch,
  beforeLoad: () => {
    if (!isSidebarModuleEnabled('chat', 'playground')) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: PlaygroundPage,
})

function PlaygroundPage() {
  const { first, generate, model, prompt, draft } = Route.useSearch()
  const navigate = Route.useNavigate()

  useEffect(() => {
    if (!draft) return
    try {
      const parsed = JSON.parse(draft) as {
        storageKey?: unknown
        request?: unknown
      }
      const storageKey =
        typeof parsed.storageKey === 'string' && parsed.storageKey
          ? parsed.storageKey
          : 'flatkey:model-generator-draft'
      window.localStorage.setItem(storageKey, JSON.stringify(parsed))
      window.localStorage.setItem(MODEL_GENERATOR_DRAFT_CLEANUP_KEY, storageKey)
      navigate({
        to: '/playground',
        search: {
          ...(first === 1 ? { first: 1 as const } : {}),
          ...(generate ? { generate } : {}),
          ...(model ? { model } : {}),
          ...(prompt ? { prompt } : {}),
        },
        replace: true,
      })
    } catch {
      navigate({
        to: '/playground',
        search: {
          ...(first === 1 ? { first: 1 as const } : {}),
          ...(generate ? { generate } : {}),
          ...(model ? { model } : {}),
          ...(prompt ? { prompt } : {}),
        },
        replace: true,
      })
    }
  }, [draft, first, generate, model, navigate, prompt])

  return (
    <Main className='p-0'>
      <Playground
        firstRun={first === 1}
        initialGenerate={generate}
        initialModel={model}
        initialPrompt={prompt}
      />
    </Main>
  )
}
