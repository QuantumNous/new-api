import * as React from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import {
  createCompositeComponent,
  CompositeComponent,
} from '@tanstack/react-start/rsc'
import {
  serverBox,
  serverBadge,
  serverHeader,
  timestamp,
} from '~/utils/serverStyles'
import { pageStyles, clientStyles, formatTime } from '~/utils/styles'

// ============================================================================
// Server Component Definitions
// ============================================================================

// In-memory todo storage (persists across requests in dev)
const todoStore: Array<{ id: string; text: string; completed: boolean }> = [
  { id: 'todo_1', text: 'Learn React Server Components', completed: true },
  { id: 'todo_2', text: 'Build an RSC application', completed: false },
  { id: 'todo_3', text: 'Test RSC with forms', completed: false },
]

const addTodo = createServerFn({ method: 'POST' })
  .validator((data: { text: string }) => data)
  .handler(async ({ data }) => {
    const newTodo = {
      id: `todo_${Date.now()}`,
      text: data.text,
      completed: false,
    }
    todoStore.push(newTodo)
    return newTodo
  })

const toggleTodo = createServerFn({ method: 'POST' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const todo = todoStore.find((t) => t.id === data.id)
    if (todo) {
      todo.completed = !todo.completed
    }
    return todo
  })

const deleteTodo = createServerFn({ method: 'POST' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const index = todoStore.findIndex((t) => t.id === data.id)
    if (index !== -1) {
      todoStore.splice(index, 1)
    }
    return { success: true }
  })

const getTodoListServerComponent = createServerFn({
  method: 'GET',
}).handler(async () => {
  const serverTimestamp = Date.now()

  // Return a copy of todos at this moment
  const todos = [...todoStore]

  return createCompositeComponent(
    (props: { renderActions?: (todoId: string) => React.ReactNode }) => {
      const completedCount = todos.filter((t) => t.completed).length

      return (
        <div style={serverBox} data-testid="rsc-todo-list">
          <div style={serverHeader}>
            <span style={serverBadge}>TODO LIST (SERVER STATE)</span>
            <span style={timestamp} data-testid="rsc-todo-timestamp">
              {new Date(serverTimestamp).toLocaleTimeString()}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
            }}
          >
            <h3 style={{ margin: 0, color: '#0c4a6e' }}>My Tasks</h3>
            <span
              style={{ fontSize: '13px', color: '#64748b' }}
              data-testid="rsc-todo-count"
            >
              {completedCount}/{todos.length} completed
            </span>
          </div>

          {todos.length === 0 ? (
            <div
              style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}
              data-testid="rsc-todo-empty"
            >
              No todos yet. Add one above!
            </div>
          ) : (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
            >
              {todos.map((todo) => (
                <div
                  key={todo.id}
                  style={{
                    padding: '12px',
                    backgroundColor: todo.completed ? '#f0fdf4' : 'white',
                    borderRadius: '6px',
                    border: `1px solid ${todo.completed ? '#bbf7d0' : '#bae6fd'}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                  data-testid={`todo-${todo.id}`}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '18px',
                      }}
                    >
                      {todo.completed ? '✅' : '⬜'}
                    </span>
                    <span
                      style={{
                        color: todo.completed ? '#16a34a' : '#0c4a6e',
                        textDecoration: todo.completed
                          ? 'line-through'
                          : 'none',
                      }}
                      data-testid={`todo-text-${todo.id}`}
                    >
                      {todo.text}
                    </span>
                  </div>
                  {props.renderActions?.(todo.id)}
                </div>
              ))}
            </div>
          )}
        </div>
      )
    },
  )
})

export const Route = createFileRoute('/rsc-forms')({
  loader: async () => {
    const TodoList = await getTodoListServerComponent()
    return {
      TodoList,
      loaderTimestamp: Date.now(),
    }
  },
  component: RscFormsComponent,
})

function RscFormsComponent() {
  const { TodoList, loaderTimestamp } = Route.useLoaderData()
  const router = useRouter()
  const [newTodoText, setNewTodoText] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTodoText.trim()) return

    setIsSubmitting(true)
    try {
      await addTodo({ data: { text: newTodoText.trim() } })
      setNewTodoText('')
      // Invalidate the route to refetch the RSC
      router.invalidate()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggle = async (id: string) => {
    await toggleTodo({ data: { id } })
    router.invalidate()
  }

  const handleDelete = async (id: string) => {
    await deleteTodo({ data: { id } })
    router.invalidate()
  }

  return (
    <div style={pageStyles.container}>
      <h1 data-testid="rsc-forms-title" style={pageStyles.title}>
        Todo List - RSC with Forms
      </h1>
      <p style={pageStyles.description}>
        This example tests RSC interaction with server mutations. Add, toggle,
        or delete todos - the form submits to server functions, then the RSC
        refetches to show updated data. Watch the timestamp change after each
        mutation.
      </p>

      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
        <span data-testid="loader-timestamp" style={{ display: 'none' }}>
          {loaderTimestamp}
        </span>
        Route loaded at: {formatTime(loaderTimestamp)}
      </div>

      {/* Add Todo Form */}
      <div style={clientStyles.container} data-testid="todo-form">
        <div style={clientStyles.header}>
          <span style={clientStyles.badge}>ADD NEW TODO</span>
        </div>

        <form onSubmit={handleAddTodo} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={newTodoText}
            onChange={(e) => setNewTodoText(e.target.value)}
            placeholder="What needs to be done?"
            data-testid="todo-input"
            disabled={isSubmitting}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              fontSize: '14px',
              opacity: isSubmitting ? 0.7 : 1,
            }}
          />
          <button
            type="submit"
            data-testid="add-todo-btn"
            disabled={isSubmitting || !newTodoText.trim()}
            style={{
              ...clientStyles.button,
              ...clientStyles.primaryButton,
              opacity: isSubmitting || !newTodoText.trim() ? 0.7 : 1,
            }}
          >
            {isSubmitting ? 'Adding...' : 'Add Todo'}
          </button>
        </form>
      </div>

      {/* Todo List RSC with client action render props */}
      <CompositeComponent
        src={TodoList}
        renderActions={(todoId: string) => (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              data-testid={`toggle-${todoId}`}
              onClick={() => handleToggle(todoId)}
              style={{
                padding: '4px 12px',
                borderRadius: '4px',
                border: 'none',
                fontSize: '12px',
                cursor: 'pointer',
                backgroundColor: '#e0f2fe',
                color: '#0284c7',
              }}
            >
              Toggle
            </button>
            <button
              data-testid={`delete-${todoId}`}
              onClick={() => handleDelete(todoId)}
              style={{
                padding: '4px 12px',
                borderRadius: '4px',
                border: 'none',
                fontSize: '12px',
                cursor: 'pointer',
                backgroundColor: '#fef2f2',
                color: '#dc2626',
              }}
            >
              Delete
            </button>
          </div>
        )}
      />

      <div
        style={{
          marginTop: '20px',
          padding: '16px',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          fontSize: '13px',
          color: '#64748b',
        }}
      >
        <strong>Key Points:</strong>
        <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
          <li>
            Form submission calls server functions (addTodo, toggleTodo,
            deleteTodo)
          </li>
          <li>After mutation, router.invalidate() refetches the RSC</li>
          <li>New data appears with a new server timestamp</li>
          <li>Client actions are passed as render props to the RSC</li>
        </ul>
      </div>
    </div>
  )
}
