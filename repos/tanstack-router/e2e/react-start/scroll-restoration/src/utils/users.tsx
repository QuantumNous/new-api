export type User = {
  id: number
  name: string
  email: string
}

const PORT =
  import.meta.env.VITE_SERVER_PORT || process.env.VITE_SERVER_PORT || 3000

export const DEPLOY_URL = `http://localhost:${PORT}`
