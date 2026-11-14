import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import ResizeObserver from 'resize-observer-polyfill'

// https://testing-library.com/docs/react-testing-library/api#cleanup
afterEach(() => cleanup())

global.ResizeObserver = ResizeObserver
