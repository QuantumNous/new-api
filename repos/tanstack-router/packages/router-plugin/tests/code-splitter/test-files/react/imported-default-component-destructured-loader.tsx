import { createFileRoute } from '@tanstack/react-router'

import importedComponent, { importedLoader } from '../../shared/imported'

export const Route = createFileRoute('/')({
  component: importedComponent,
  loader: importedLoader,
})
