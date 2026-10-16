import { createServerFn } from '@tanstack/react-start'
import { renderServerComponent } from '@tanstack/react-start/rsc'
import { CssModulesContent } from './CssModulesContent'

export const getNoLoaderCssServerComponent = createServerFn({
  method: 'GET',
})
  .validator((data: { title?: string; delayMs?: number }) => data)
  .handler(async ({ data }) => {
    await new Promise((resolve) => setTimeout(resolve, data.delayMs ?? 150))

    return renderServerComponent(
      <>
        {import.meta.viteRsc.loadCss()}
        <CssModulesContent data={{ title: data.title }} />
      </>,
    )
  })
