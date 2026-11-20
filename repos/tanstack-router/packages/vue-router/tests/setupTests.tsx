import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// For @testing-library to work properly with Vue tests
// global.IS_REACT_ACT_ENVIRONMENT = true

// Mock window.scrollTo to silence jsdom errors in tests
window.scrollTo = vi.fn()
