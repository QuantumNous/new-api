import { createFileRoute } from '@tanstack/react-router'

import { importedComponent, importedLoader } from '../../shared'

export const Route = createFileRoute('/')({
  component: importedComponent,
  loader: importedLoader,
})
