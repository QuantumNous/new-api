import { createFileRoute } from '@tanstack/react-router'

import ImportedDefaultComponent, {
  importedErrorComponent,
} from '../../shared/imported'

export const Route = createFileRoute('/')({
  component: ImportedDefaultComponent,
  errorComponent: importedErrorComponent,
})
