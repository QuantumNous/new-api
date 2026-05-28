/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

type PaddleEnvironment = 'sandbox' | 'production'

type PaddleCheckoutEventName =
  | 'checkout.opened'
  | 'checkout.closed'
  | 'checkout.completed'
  | 'checkout.customer.created'
  | 'checkout.customer.removed'
  | 'checkout.customer.updated'
  | 'checkout.discount.applied'
  | 'checkout.discount.removed'
  | 'checkout.error'
  | 'checkout.items.removed'
  | 'checkout.items.updated'
  | 'checkout.loaded'
  | 'checkout.payment.error'
  | 'checkout.payment.failed'
  | 'checkout.payment.initiated'
  | 'checkout.payment.selected'
  | 'checkout.updated'
  | 'checkout.upsell.canceled'
  | 'checkout.warning'

type PaddleCheckoutStatus =
  | 'draft'
  | 'ready'
  | 'billed'
  | 'paid'
  | 'completed'
  | 'canceled'
  | 'past_due'

type PaddleCheckoutEventError = {
  type?: string
  code?: string
  detail?: string
  message?: string
  [key: string]: unknown
}

export type PaddleCheckoutEvent = {
  name?: PaddleCheckoutEventName | string
  data?: {
    id?: string
    status?: PaddleCheckoutStatus | string
    transaction_id?: string
    type?: string
    code?: string
    detail?: string
    message?: string
    error?: PaddleCheckoutEventError | string
    [key: string]: unknown
  }
}

type PaddleCheckoutEventCallback = (
  event: PaddleCheckoutEvent
) => void | Promise<void>

export type OpenPaddleCheckoutOptions = {
  transactionId: string
  clientToken: string
  sandbox: boolean
  eventCallback?: PaddleCheckoutEventCallback
  onOpened?: PaddleCheckoutEventCallback
  onLoaded?: PaddleCheckoutEventCallback
  onClosed?: PaddleCheckoutEventCallback
  onCompleted?: PaddleCheckoutEventCallback
  onPaymentEvent?: PaddleCheckoutEventCallback
  onCheckoutError?: PaddleCheckoutEventCallback
  openTimeoutMs?: number
}

type PaddleInitializeOptions = {
  token: string
  eventCallback?: PaddleCheckoutEventCallback
}

type PaddleUpdateOptions = {
  eventCallback?: PaddleCheckoutEventCallback | null
}

type PaddleCheckoutOpenOptions = {
  transactionId: string
}

type PaddleGlobal = {
  Initialized?: boolean
  Status?: {
    libraryVersion?: string
  }
  Environment?: {
    set: (environment: PaddleEnvironment) => void
  }
  Initialize: (options: PaddleInitializeOptions) => void
  Update?: (options: PaddleUpdateOptions) => void
  Checkout?: {
    open: (options: PaddleCheckoutOpenOptions) => void | Promise<void>
  }
}

declare global {
  interface Window {
    Paddle?: PaddleGlobal
  }
}

const PADDLE_SCRIPT_URL = 'https://cdn.paddle.com/paddle/v2/paddle.js'
const PADDLE_SCRIPT_LOAD_TIMEOUT_MS = 15000
const PADDLE_CHECKOUT_LOAD_TIMEOUT_MS = 20000

let paddleScriptPromise: Promise<void> | null = null
let initializedContext: {
  token: string
  environment: PaddleEnvironment
} | null = null

function loadPaddleScript(): Promise<void> {
  if (window.Paddle) {
    return Promise.resolve()
  }

  if (paddleScriptPromise) {
    return paddleScriptPromise
  }

  paddleScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    let timeoutId: number | undefined

    const cleanup = (): void => {
      script.onload = null
      script.onerror = null
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId)
      }
    }

    const fail = (error: Error): void => {
      cleanup()
      paddleScriptPromise = null
      script.remove()
      reject(error)
    }

    script.src = PADDLE_SCRIPT_URL
    script.async = true
    script.onload = () => {
      cleanup()
      if (window.Paddle) {
        resolve()
        return
      }

      fail(new Error('Paddle.js loaded, but window.Paddle is not available'))
    }
    script.onerror = () => {
      fail(new Error(`Failed to load Paddle.js from ${PADDLE_SCRIPT_URL}`))
    }
    timeoutId = window.setTimeout(() => {
      fail(
        new Error(
          `Timed out loading Paddle.js from ${PADDLE_SCRIPT_URL} after ${PADDLE_SCRIPT_LOAD_TIMEOUT_MS}ms`
        )
      )
    }, PADDLE_SCRIPT_LOAD_TIMEOUT_MS)

    document.head.appendChild(script)
  })

  return paddleScriptPromise
}

function requirePaddle(): PaddleGlobal {
  const paddle = window.Paddle
  if (!paddle) {
    throw new Error('Paddle.js is not available')
  }

  if (!paddle.Initialize || !paddle.Checkout?.open) {
    throw new Error(
      `Paddle.js loaded without the required checkout APIs (${describePaddleRuntime(
        paddle
      )})`
    )
  }

  return paddle
}

function normalizeRequiredValue(value: string, label: string): string {
  const normalized = value.trim()
  if (!normalized) {
    throw new Error(`${label} is missing`)
  }

  return normalized
}

function getPaddleEnvironment(sandbox: boolean): PaddleEnvironment {
  if (sandbox) {
    return 'sandbox'
  }

  return 'production'
}

function configurePaddle(
  paddle: PaddleGlobal,
  token: string,
  environment: PaddleEnvironment,
  eventCallback: PaddleCheckoutEventCallback
): void {
  const nextContext = { token, environment }
  const alreadyInitialized = paddle.Initialized === true || !!initializedContext

  if (alreadyInitialized) {
    if (!initializedContext) {
      initializedContext = nextContext
    }

    if (
      initializedContext.token !== token ||
      initializedContext.environment !== environment
    ) {
      throw new Error(createInitializedContextMismatchMessage(nextContext))
    }

    updatePaddleEventCallback(paddle, eventCallback)
    return
  }

  setPaddleEnvironment(paddle, environment)

  try {
    paddle.Initialize({ token, eventCallback })
    initializedContext = nextContext
  } catch (error) {
    throw new Error(
      `Failed to initialize Paddle.js for ${environment}: ${describeUnknownError(
        error
      )}`
    )
  }
}

function setPaddleEnvironment(
  paddle: PaddleGlobal,
  environment: PaddleEnvironment
): void {
  if (environment === 'production') {
    return
  }

  if (!paddle.Environment?.set) {
    throw new Error('Paddle.js does not expose Environment.set() for sandbox')
  }

  try {
    paddle.Environment.set('sandbox')
  } catch (error) {
    throw new Error(
      `Failed to set Paddle.js environment to ${environment}: ${describeUnknownError(
        error
      )}`
    )
  }
}

function updatePaddleEventCallback(
  paddle: PaddleGlobal,
  eventCallback: PaddleCheckoutEventCallback
): void {
  if (!paddle.Update) {
    throw new Error(
      'Paddle.js is already initialized and cannot update checkout callbacks because Paddle.Update() is unavailable'
    )
  }

  try {
    paddle.Update({ eventCallback })
  } catch (error) {
    throw new Error(
      `Failed to update Paddle.js checkout callbacks: ${describeUnknownError(
        error
      )}`
    )
  }
}

function createInitializedContextMismatchMessage(nextContext: {
  token: string
  environment: PaddleEnvironment
}): string {
  if (!initializedContext) {
    return 'Paddle.js is already initialized by another flow on this page'
  }

  const differences: string[] = []
  if (initializedContext.environment !== nextContext.environment) {
    differences.push(
      `environment ${initializedContext.environment} -> ${nextContext.environment}`
    )
  }
  if (initializedContext.token !== nextContext.token) {
    differences.push('client-side token changed')
  }

  return `Paddle.js is already initialized (${differences.join(
    ', '
  )}). Reload the page after changing Paddle settings, because Paddle only allows one Initialize() call per page.`
}

function createEventBridge(
  options: OpenPaddleCheckoutOptions,
  confirmation: CheckoutLoadConfirmation
): PaddleCheckoutEventCallback {
  return (event) => {
    confirmation.handleEvent(event)
    logActionablePaddleEvent(event)

    runCheckoutCallback(options.eventCallback, event, 'eventCallback')

    if (isCompletedCheckoutEvent(event)) {
      runCheckoutCallback(options.onCompleted, event, 'onCompleted')
    } else if (event.name === 'checkout.closed') {
      runCheckoutCallback(options.onClosed, event, 'onClosed')
    }
    if (event.name === 'checkout.opened') {
      runCheckoutCallback(options.onOpened, event, 'onOpened')
    }
    if (event.name === 'checkout.loaded') {
      runCheckoutCallback(options.onLoaded, event, 'onLoaded')
    }
    if (isPaymentCheckoutEvent(event)) {
      runCheckoutCallback(options.onPaymentEvent, event, 'onPaymentEvent')
    }
    if (isCheckoutFailureEvent(event) || event.name === 'checkout.warning') {
      runCheckoutCallback(options.onCheckoutError, event, 'onCheckoutError')
    }
  }
}

type CheckoutLoadConfirmation = {
  promise: Promise<void>
  handleEvent: (event: PaddleCheckoutEvent) => void
  cancel: () => void
}

function createCheckoutLoadConfirmation(
  transactionId: string,
  timeoutMs: number | undefined
): CheckoutLoadConfirmation {
  let settled = false
  let timeoutId: number | undefined
  let resolvePromise: () => void = () => undefined
  let rejectPromise: (error: Error) => void = () => undefined

  const promise = new Promise<void>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })

  const clearTimer = (): void => {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId)
      timeoutId = undefined
    }
  }

  const resolveOnce = (): void => {
    if (settled) {
      return
    }

    settled = true
    clearTimer()
    resolvePromise()
  }

  const rejectOnce = (error: Error): void => {
    if (settled) {
      return
    }

    settled = true
    clearTimer()
    rejectPromise(error)
  }

  const effectiveTimeoutMs =
    timeoutMs === undefined ? PADDLE_CHECKOUT_LOAD_TIMEOUT_MS : timeoutMs
  if (effectiveTimeoutMs > 0) {
    timeoutId = window.setTimeout(() => {
      rejectOnce(
        new Error(
          `Paddle checkout did not emit checkout.loaded for transaction ${transactionId} within ${effectiveTimeoutMs}ms`
        )
      )
    }, effectiveTimeoutMs)
  }

  return {
    promise,
    handleEvent: (event) => {
      if (settled || !isMatchingTransactionEvent(event, transactionId)) {
        return
      }

      if (
        event.name === 'checkout.loaded' ||
        event.name === 'checkout.closed' ||
        event.name === 'checkout.completed'
      ) {
        resolveOnce()
        return
      }

      if (isCheckoutFailureEvent(event)) {
        rejectOnce(new Error(createCheckoutFailureMessage(event)))
      }
    },
    cancel: () => {
      resolveOnce()
    },
  }
}

function isMatchingTransactionEvent(
  event: PaddleCheckoutEvent,
  transactionId: string
): boolean {
  const eventTransactionId = event.data?.transaction_id
  if (!eventTransactionId) {
    return true
  }

  return eventTransactionId === transactionId
}

function isCompletedCheckoutEvent(event: PaddleCheckoutEvent): boolean {
  return (
    event.name === 'checkout.completed' ||
    event.data?.status === 'paid' ||
    event.data?.status === 'completed'
  )
}

function isPaymentCheckoutEvent(event: PaddleCheckoutEvent): boolean {
  return (
    event.name?.startsWith('checkout.payment.') === true ||
    event.data?.status === 'paid'
  )
}

function isCheckoutFailureEvent(event: PaddleCheckoutEvent): boolean {
  return (
    event.name === 'checkout.error' ||
    event.name === 'checkout.payment.error' ||
    event.name === 'checkout.payment.failed'
  )
}

function logActionablePaddleEvent(event: PaddleCheckoutEvent): void {
  if (isCheckoutFailureEvent(event)) {
    console.error(
      '[Paddle Checkout]',
      createCheckoutFailureMessage(event),
      event
    )
    return
  }

  if (event.name === 'checkout.warning') {
    console.warn(
      '[Paddle Checkout]',
      createCheckoutFailureMessage(event),
      event
    )
  }
}

function runCheckoutCallback(
  callback: PaddleCheckoutEventCallback | undefined,
  event: PaddleCheckoutEvent,
  label: string
): void {
  if (!callback) {
    return
  }

  try {
    const result = callback(event)
    if (isPromiseLike(result)) {
      result.catch((error: unknown) => {
        console.error(
          `[Paddle Checkout] ${label} failed: ${describeUnknownError(error)}`,
          error
        )
      })
    }
  } catch (error) {
    console.error(
      `[Paddle Checkout] ${label} failed: ${describeUnknownError(error)}`,
      error
    )
  }
}

function createCheckoutFailureMessage(event: PaddleCheckoutEvent): string {
  const details = collectEventDetails(event)
  if (!details.length) {
    return `Paddle checkout event ${event.name || 'unknown'}`
  }

  return `Paddle checkout event ${event.name || 'unknown'}: ${details.join(
    ' | '
  )}`
}

function collectEventDetails(event: PaddleCheckoutEvent): string[] {
  const details: string[] = []
  const data = event.data
  if (!data) {
    return details
  }

  addStringDetail(details, data.type)
  addStringDetail(details, data.code)
  addStringDetail(details, data.detail)
  addStringDetail(details, data.message)
  addStringDetail(details, data.status)
  addStringDetail(details, data.transaction_id)

  if (typeof data.error === 'string') {
    addStringDetail(details, data.error)
  } else if (data.error) {
    addStringDetail(details, data.error.type)
    addStringDetail(details, data.error.code)
    addStringDetail(details, data.error.detail)
    addStringDetail(details, data.error.message)
  }

  return details
}

function addStringDetail(details: string[], value: unknown): void {
  if (typeof value !== 'string') {
    return
  }

  const normalized = value.trim()
  if (normalized && !details.includes(normalized)) {
    details.push(normalized)
  }
}

function createOpenedEvent(transactionId: string): PaddleCheckoutEvent {
  return {
    name: 'checkout.opened',
    data: {
      transaction_id: transactionId,
    },
  }
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'then' in value &&
    typeof value.then === 'function'
  )
}

function describePaddleRuntime(paddle: PaddleGlobal): string {
  if (paddle.Status?.libraryVersion) {
    return `Paddle.js ${paddle.Status.libraryVersion}`
  }

  return 'Paddle.js version unknown'
}

function describeUnknownError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  if (typeof error === 'string' && error.trim()) {
    return error.trim()
  }

  try {
    return JSON.stringify(error)
  } catch (_jsonError) {
    return String(error)
  }
}

export async function openPaddleCheckoutForTransaction(
  options: OpenPaddleCheckoutOptions
): Promise<void> {
  const transactionId = normalizeRequiredValue(
    options.transactionId,
    'Paddle transaction ID'
  )
  const token = normalizeRequiredValue(
    options.clientToken,
    'Paddle client-side token'
  )
  const environment = getPaddleEnvironment(options.sandbox)

  await loadPaddleScript()

  const paddle = requirePaddle()
  const confirmation = createCheckoutLoadConfirmation(
    transactionId,
    options.openTimeoutMs
  )
  const eventCallback = createEventBridge(options, confirmation)

  try {
    configurePaddle(paddle, token, environment, eventCallback)
  } catch (error) {
    confirmation.cancel()
    throw error
  }

  try {
    const openResult = paddle.Checkout?.open({ transactionId })
    if (isPromiseLike(openResult)) {
      await openResult
    }
    eventCallback(createOpenedEvent(transactionId))
  } catch (error) {
    confirmation.cancel()
    throw new Error(
      `Failed to open Paddle checkout for transaction ${transactionId}: ${describeUnknownError(
        error
      )}`
    )
  }

  return confirmation.promise
}
