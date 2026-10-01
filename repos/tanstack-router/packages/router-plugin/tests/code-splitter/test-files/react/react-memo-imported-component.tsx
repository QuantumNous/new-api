import React from 'react'
import { createFileRoute } from '@tanstack/react-router'

import { importedLoader, importedComponent } from '../../shared/imported'

export const Route = createFileRoute('/')({
  component: React.memo(importedComponent),
  loader: importedLoader,
})
