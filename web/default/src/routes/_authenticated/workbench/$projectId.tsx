/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { createFileRoute, useParams } from '@tanstack/react-router'
import { z } from 'zod'

import { WorkbenchEditor } from '@/features/workbench'

export const Route = createFileRoute('/_authenticated/workbench/$projectId')({
  validateSearch: z.object({
    inspiration: z.boolean().optional(),
  }),
  component: WorkbenchProjectPage,
})

function WorkbenchProjectPage() {
  const search = Route.useSearch()
  const { projectId } = useParams({
    from: '/_authenticated/workbench/$projectId',
  })
  return (
    <div className='h-[calc(100dvh-var(--app-header-height,3.5rem))]'>
      <WorkbenchEditor
        projectId={Number(projectId)}
        openInspiration={search.inspiration}
      />
    </div>
  )
}
