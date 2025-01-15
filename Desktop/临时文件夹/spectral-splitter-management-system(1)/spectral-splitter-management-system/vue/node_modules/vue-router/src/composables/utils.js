import { getCurrentInstance } from 'vue'

// dev only warn if no current instance

export function throwNoCurrentInstance (method) {
  if (!getCurrentInstance()) {
    throw new Error(
      `[vue-router]: Missing current instance. ${method}() must be called inside <script setup> or setup().`
    )
  }
}
