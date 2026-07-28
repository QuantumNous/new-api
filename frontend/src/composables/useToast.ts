import { reactive } from 'vue'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastItem {
  id: number
  type: ToastType
  message: string
}

const state = reactive({
  toasts: [] as ToastItem[],
})

let nextId = 1

export function useToast() {
  function push(type: ToastType, message: string, duration = 3200) {
    const id = nextId++
    state.toasts.push({ id, type, message })
    window.setTimeout(() => dismiss(id), duration)
  }

  function dismiss(id: number) {
    const idx = state.toasts.findIndex((t) => t.id === id)
    if (idx >= 0) state.toasts.splice(idx, 1)
  }

  return {
    toasts: state.toasts,
    push,
    dismiss,
    success: (m: string) => push('success', m),
    error: (m: string) => push('error', m, 4200),
    info: (m: string) => push('info', m),
    warning: (m: string) => push('warning', m),
  }
}
