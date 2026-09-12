import { redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

export const throwRedirect = createServerFn()
  .validator(
    (opts: {
      target: 'internal' | 'external'
      reloadDocument?: boolean
      externalHost?: string
    }) => opts,
  )
  .handler((ctx) => {
    if (ctx.data.target === 'internal') {
      throw redirect({
        to: '/posts',
        reloadDocument: ctx.data.reloadDocument,
      })
    }
    const href = ctx.data.externalHost ?? 'http://example.com'
    throw redirect({
      href,
    })
  })
