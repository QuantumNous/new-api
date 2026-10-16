import { createFileRoute } from '@tanstack/react-router'
import * as fs from 'node:fs'
import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'
import { useState } from 'react'

export const Route = createFileRoute('/dead-code-preserve')({
  component: RouteComponent,
})

// by using this we make sure DCE still works - this errors when imported on the client

const filePath = 'count-effect.txt'

async function readCount() {
  return parseInt(
    await fs.promises.readFile(filePath, 'utf-8').catch(() => '0'),
  )
}

async function updateCount() {
  const count = await readCount()
  await fs.promises.writeFile(filePath, `${count + 1}`)
  return true
}

const writeFileServerFn = createServerFn().handler(async () => {
  // eslint-disable-next-line unused-imports/no-unused-vars
  const test = await updateCount()
  return getRequestHeader('X-Test')
})

const readFileServerFn = createServerFn().handler(async () => {
  const data = await readCount()
  return data
})

function RouteComponent() {
  const [serverFnOutput, setServerFnOutput] = useState<number>()
  return (
    <div className="p-2 m-2 grid gap-2">
      <h3>Dead code test</h3>
      <p>
        This server function writes to a file as a side effect, then reads it.
      </p>
      <button
        className="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
        data-testid="test-dead-code-fn-call-btn"
        onClick={async () => {
          await writeFileServerFn({ headers: { 'X-Test': 'test' } })
          setServerFnOutput(await readFileServerFn())
        }}
      >
        Call Dead Code Fn
      </button>
      <h4>Server output</h4>
      <pre data-testid="dead-code-fn-call-response">{serverFnOutput}</pre>
    </div>
  )
}
