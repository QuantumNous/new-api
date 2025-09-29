import axios from 'axios'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'

// Infer server URL from current origin for same-origin API
const baseURL = ''

export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Cache-Control': 'no-store',
  },
})

// Deduplicate GET requests by URL+params (simple in-flight map)
const inFlightGet = new Map<string, Promise<any>>()
const originalGet = api.get.bind(api)
api.get = (url, config = {}) => {
  const disableDuplicate = (config as any)?.disableDuplicate
  if (disableDuplicate) return originalGet(url, config)
  const params = (config as any)?.params
    ? JSON.stringify((config as any).params)
    : '{}'
  const key = `${url}?${params}`
  if (inFlightGet.has(key)) return inFlightGet.get(key) as Promise<any>
  const req = originalGet(url, config).finally(() => inFlightGet.delete(key))
  inFlightGet.set(key, req)
  return req
}

api.interceptors.response.use(
  (response) => {
    const skipBusiness = (response.config as any)?.skipBusinessError
    // 统一业务判断：后端所有接口均返回 { success, message, data }
    if (
      !skipBusiness &&
      response &&
      response.data &&
      typeof response.data.success === 'boolean'
    ) {
      if (!response.data.success) {
        // 非 200 以外或 200 但 success=false 都按业务失败提示
        const msg = response.data.message || 'Request failed'
        toast.error(msg)
      }
    }
    return response
  },
  (error) => {
    const skip = error?.config?.skipErrorHandler
    if (!skip) {
      const status = error?.response?.status
      if (status === 401) {
        toast.error('Session expired!')
        try {
          useAuthStore.getState().auth.reset()
        } catch {}
      } else {
        // 非 401 的错误，尽量展示后端返回的 message
        const msg =
          error?.response?.data?.message || error?.message || 'Request error'
        toast.error(msg)
      }
    }
    return Promise.reject(error)
  }
)

// Attach New-Api-User header from localStorage uid for all requests
api.interceptors.request.use((config) => {
  try {
    if (typeof window !== 'undefined') {
      const uid = window.localStorage.getItem('uid')
      if (uid) {
        ;(config.headers as any)['New-Api-User'] = uid
      }
    }
  } catch {}
  return config
})
