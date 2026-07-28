export interface RequestGateInput {
  activeRequests: number
  maxActiveRequests: number
  origin: 'auto' | 'pointer'
  nowMs: number
  lastPointerRequestAt: number
  pointerCooldownMs: number
}

export function canStartCanvasRequest(input: RequestGateInput): boolean {
  if (input.activeRequests >= input.maxActiveRequests) return false
  return (
    input.origin !== 'pointer' ||
    input.nowMs - input.lastPointerRequestAt >= input.pointerCooldownMs
  )
}
