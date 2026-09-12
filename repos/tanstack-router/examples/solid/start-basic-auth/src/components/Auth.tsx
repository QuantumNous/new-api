import type { JSX } from 'solid-js'

export function Auth({
  actionText,
  onSubmit,
  status,
  afterSubmit,
}: {
  actionText: string
  onSubmit: (e: HTMLFormElement) => void
  status: 'pending' | 'idle' | 'success' | 'error'
  afterSubmit?: JSX.Element
}) {
  return (
    <div class="fixed inset-0 bg-white dark:bg-black flex items-start justify-center p-8">
      <div class="bg-white dark:bg-gray-900 p-8 rounded-lg shadow-lg">
        <h1 class="text-2xl font-bold mb-4">{actionText}</h1>
        <form
          onSubmit={(e: any) => {
            e.preventDefault()
            onSubmit(e)
          }}
          class="space-y-4"
        >
          <div>
            <label for="email" class="block text-xs">
              Email
            </label>
            <input
              type="email"
              name="email"
              id="email"
              class="px-2 py-1 w-full rounded-sm border border-gray-500/20 bg-white dark:bg-gray-800"
            />
          </div>
          <div>
            <label for="password" class="block text-xs">
              Password
            </label>
            <input
              type="password"
              name="password"
              id="password"
              class="px-2 py-1 w-full rounded-sm border border-gray-500/20 bg-white dark:bg-gray-800"
            />
          </div>
          <button
            type="submit"
            class="w-full bg-cyan-600 text-white rounded-sm py-2 font-black uppercase"
            disabled={status === 'pending'}
          >
            {status === 'pending' ? '...' : actionText}
          </button>
          {afterSubmit ? afterSubmit : null}
        </form>
      </div>
    </div>
  )
}
