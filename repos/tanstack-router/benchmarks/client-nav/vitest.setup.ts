import { vi } from 'vitest'

// @ts-expect-error
global.IS_REACT_ACT_ENVIRONMENT = true

window.scrollTo = vi.fn()
