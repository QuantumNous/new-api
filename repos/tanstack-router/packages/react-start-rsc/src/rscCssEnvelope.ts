import type React from 'react'

const RSC_CSS_ENVELOPE_MARKER = '__tanstackStartRscCssEnvelope'
const RSC_CSS_ENVELOPE_RESOURCES = '__tanstackStartRscCss'
const RSC_CSS_ENVELOPE_VALUE = '__tanstackStartRscValue'

export interface RscCssEnvelopeOptions {
  [RSC_CSS_ENVELOPE_RESOURCES]?: React.ReactNode
}

export function createRscCssEnvelope<TValue>(
  value: TValue,
  options?: RscCssEnvelopeOptions,
): TValue | Record<string, unknown> {
  const resources = options?.[RSC_CSS_ENVELOPE_RESOURCES]
  if (resources === undefined || resources === null || resources === false) {
    return value
  }

  return {
    [RSC_CSS_ENVELOPE_MARKER]: true,
    [RSC_CSS_ENVELOPE_RESOURCES]: resources,
    [RSC_CSS_ENVELOPE_VALUE]: value,
  }
}

export function unwrapRscCssEnvelope(value: unknown): unknown {
  if (!value || typeof value !== 'object') {
    return value
  }

  const maybeEnvelope = value as Record<string, unknown>
  if (maybeEnvelope[RSC_CSS_ENVELOPE_MARKER] !== true) {
    return value
  }

  return maybeEnvelope[RSC_CSS_ENVELOPE_VALUE]
}
