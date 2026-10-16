import { createContext } from 'react'

// React context crosses portals; CSS inheritance alone does not.
// Undefined keeps the application's normal theme.
export const SurfaceThemeContext = createContext<'dark' | undefined>(undefined)
