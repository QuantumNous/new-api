import { createServerFn } from '@tanstack/react-start'
import { renderServerComponent } from '@tanstack/react-start/rsc'
import { RscClientPkgContent } from './RscClientPkgContent'

export const getNodeModuleClientServerComponent = createServerFn({
  method: 'GET',
}).handler(async () => {
  return renderServerComponent(<RscClientPkgContent />)
})
