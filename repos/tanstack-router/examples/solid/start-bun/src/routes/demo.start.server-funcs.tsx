import fs from 'node:fs'
import { createSignal } from 'solid-js'
import { createFileRoute, useRouter } from '@tanstack/solid-router'
import { createServerFn } from '@tanstack/solid-start'

const filePath = 'todos.json'

async function readTodos() {
  return JSON.parse(
    await fs.promises.readFile(filePath, 'utf-8').catch(() =>
      JSON.stringify(
        [
          { id: 1, name: 'Get groceries' },
          { id: 2, name: 'Buy a new phone' },
        ],
        null,
        2,
      ),
    ),
  )
}

const getTodos = createServerFn({
  method: 'GET',
}).handler(async () => await readTodos())

const addTodo = createServerFn({ method: 'POST' })
  .validator((d: string) => d)
  .handler(async ({ data }) => {
    const todos = await readTodos()
    todos.push({ id: todos.length + 1, name: data })
    await fs.promises.writeFile(filePath, JSON.stringify(todos, null, 2))
    return todos
  })

export const Route = createFileRoute('/demo/start/server-funcs')({
  component: Home,
  loader: async () => await getTodos(),
})

function Home() {
  const router = useRouter()
  const todos = Route.useLoaderData()

  const [todo, setTodo] = createSignal('')

  const submitTodo = async () => {
    await addTodo({ data: todo() })
    setTodo('')
    await router.invalidate()
  }

  return (
    <div
      class="flex items-center justify-center min-h-screen bg-gradient-to-br from-zinc-800 to-black p-4 text-white"
      style={{
        'background-image':
          'radial-gradient(50% 50% at 20% 60%, #23272a 0%, #18181b 50%, #000000 100%)',
      }}
    >
      <div class="w-full max-w-2xl p-8 rounded-xl backdrop-blur-md bg-black/50 shadow-xl border-8 border-black/10">
        <h1 class="text-2xl mb-4">Start Server Functions - Todo Example</h1>
        <ul class="mb-4 space-y-2">
          {todos().map((t: any) => (
            <li class="bg-white/10 border border-white/20 rounded-lg p-3 backdrop-blur-sm shadow-md">
              <span class="text-lg text-white">{t.name}</span>
            </li>
          ))}
        </ul>
        <div class="flex flex-col gap-2">
          <input
            type="text"
            value={todo()}
            onChange={(e) => setTodo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                submitTodo()
              }
            }}
            placeholder="Enter a new todo..."
            class="w-full px-4 py-3 rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
          />
          <button
            disabled={todo().trim().length === 0}
            onClick={submitTodo}
            class="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors"
          >
            Add todo
          </button>
        </div>
      </div>
    </div>
  )
}
