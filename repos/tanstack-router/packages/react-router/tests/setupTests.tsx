import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// @ts-expect-error
global.IS_REACT_ACT_ENVIRONMENT = true

// Mock window.scrollTo to silence errors in tests
window.scrollTo = vi.fn()
