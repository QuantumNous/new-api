/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import assert from 'node:assert/strict'
import { after, describe, test } from 'node:test'

import { Window } from 'happy-dom'
import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'

import { CodeBlockEditor } from '../code-block'

const domWindow = new Window()
const domGlobals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'HTMLButtonElement',
  'Node',
  'Element',
  'Event',
  'KeyboardEvent',
  'MouseEvent',
  'MutationObserver',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'getComputedStyle',
] as const

for (const key of domGlobals) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: domWindow[key],
  })
}

const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

function RerenderingEditor({
  onHandledVersion,
}: {
  onHandledVersion: (version: number) => void
}) {
  const [version, setVersion] = useState(0)
  const handleKeyDown = () => onHandledVersion(version)

  return (
    <>
      <button type='button' onClick={() => setVersion((value) => value + 1)}>
        rerender
      </button>
      <CodeBlockEditor
        ariaLabel='Edit'
        language='markdown'
        onChange={() => undefined}
        onKeyDown={handleKeyDown}
        title='Edit'
        value='hello'
      />
    </>
  )
}

describe('CodeBlockEditor component', () => {
  after(() => {
    domWindow.close()
  })

  test('keeps the CodeMirror view mounted when parent rerenders with a new keydown callback', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    const handledVersions: number[] = []
    await act(async () => {
      root.render(
        <RerenderingEditor
          onHandledVersion={(version) => handledVersions.push(version)}
        />
      )
    })

    const editor = container.querySelector('.cm-editor')
    const button = container.querySelector('button')
    assert.ok(editor)
    assert.ok(button)

    await act(async () => {
      button.click()
    })

    assert.equal(container.querySelector('.cm-editor'), editor)
    const content = container.querySelector('.cm-content')
    assert.ok(content)

    await act(async () => {
      content.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }))
    })
    assert.deepEqual(handledVersions, [1])

    await act(async () => root.unmount())
    container.remove()
  })
})
