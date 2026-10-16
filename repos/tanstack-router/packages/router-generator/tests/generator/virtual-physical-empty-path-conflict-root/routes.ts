import { physical, rootRoute } from '@tanstack/virtual-file-routes'

// This test verifies that a __root.tsx in a physical directory mounted at root
// produces a proper conflict error with the virtual root
export const routes = rootRoute('__root.tsx', [physical('', 'merged')])
