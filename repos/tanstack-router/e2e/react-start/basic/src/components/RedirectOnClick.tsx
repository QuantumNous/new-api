import { useServerFn } from '@tanstack/react-start'
import { throwRedirect } from './throwRedirect'

interface RedirectOnClickProps {
  target: 'internal' | 'external'
  reloadDocument?: boolean
  externalHost?: string
}

export function RedirectOnClick({
  target,
  reloadDocument,
  externalHost,
}: RedirectOnClickProps) {
  const execute = useServerFn(throwRedirect)
  return (
    <button
      data-testid="redirect-on-click"
      onClick={() =>
        execute({ data: { target, reloadDocument, externalHost } })
      }
    >
      click me
    </button>
  )
}
