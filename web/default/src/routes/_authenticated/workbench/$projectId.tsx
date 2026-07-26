/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { createFileRoute, useParams } from '@tanstack/react-router'

import { WorkbenchEditor } from '@/features/workbench'

export const Route = createFileRoute('/_authenticated/workbench/$projectId')({
  component: WorkbenchProjectPage,
})

function WorkbenchProjectPage() {
  const { projectId } = useParams({
    from: '/_authenticated/workbench/$projectId',
  })
  return (
    <div className='h-[calc(100dvh-var(--app-header-height,3.5rem))]'>
      <WorkbenchEditor projectId={Number(projectId)} />
    </div>
  )
}
