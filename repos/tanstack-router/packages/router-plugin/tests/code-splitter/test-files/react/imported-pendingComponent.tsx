import { createFileRoute } from '@tanstack/react-router'

import ImportedDefaultComponent, {
  importedPendingComponent,
} from '../../shared/imported'

export const Route = createFileRoute('/')({
  component: ImportedDefaultComponent,
  pendingComponent: importedPendingComponent,
})
