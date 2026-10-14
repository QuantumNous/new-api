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
import { render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { describe, expect, test } from 'vitest'

import {
  WebPreview,
  WebPreviewBody,
  type WebPreviewBodyProps,
} from '../web-preview'

const SCRIPT_APP_SANDBOX =
  'allow-scripts allow-forms allow-popups allow-presentation'

describe('WebPreview iframe sandbox', () => {
  test.each([
    ['same-origin HTTP URL', `${window.location.origin}/preview`],
    ['cross-origin HTTPS URL', 'https://canvas.example.test/'],
    ['relative URL', '/preview'],
  ])('accepts %s without same-origin privileges', (_name, url) => {
    render(
      <WebPreview defaultUrl={url}>
        <WebPreviewBody />
      </WebPreview>
    )

    const iframe = screen.getByTitle('Preview')
    expect(iframe).toHaveAttribute('src', url)
    expect(iframe).toHaveAttribute('sandbox', SCRIPT_APP_SANDBOX)
  })

  test.each([
    ['blob URL', `blob:${window.location.origin}/preview-id`],
    ['data URL', 'data:text/html,<h1>unsafe</h1>'],
    ['JavaScript URL', 'javascript:alert(1)'],
    ['about URL', 'about:blank'],
    ['malformed URL', 'http://[invalid'],
  ])('blocks a %s', (_name, url) => {
    render(
      <WebPreview defaultUrl={url}>
        <WebPreviewBody />
      </WebPreview>
    )

    const iframe = screen.getByTitle('Preview')
    expect(iframe).not.toHaveAttribute('src')
    expect(iframe).toHaveAttribute('sandbox', SCRIPT_APP_SANDBOX)
  })

  test('ignores runtime srcDoc and sandbox overrides', () => {
    const unsafeProps = {
      sandbox: 'allow-same-origin allow-scripts',
      srcDoc: '<script>window.parent.document.body.remove()</script>',
    } as ComponentProps<'iframe'> as unknown as WebPreviewBodyProps

    render(
      <WebPreview defaultUrl='/preview'>
        <WebPreviewBody {...unsafeProps} />
      </WebPreview>
    )

    const iframe = screen.getByTitle('Preview')
    expect(iframe).toHaveAttribute('src', '/preview')
    expect(iframe).not.toHaveAttribute('srcdoc')
    expect(iframe).toHaveAttribute('sandbox', SCRIPT_APP_SANDBOX)
  })

  test('does not let a runtime src prop bypass blocked URL handling', () => {
    const unsafeProps = {
      src: 'data:text/html,<h1>unsafe</h1>',
    } as ComponentProps<'iframe'> as unknown as WebPreviewBodyProps

    render(
      <WebPreview defaultUrl='/preview'>
        <WebPreviewBody {...unsafeProps} />
      </WebPreview>
    )

    expect(screen.getByTitle('Preview')).not.toHaveAttribute('src')
  })

  test.each([
    ['lowercase', 'src'],
    ['uppercase', 'SRC'],
    ['mixed-case', 'Src'],
  ])('blocks a %s runtime src variant', (_case, propName) => {
    const unsafeProps = {
      [propName]: 'data:text/html,<h1>unsafe</h1>',
    } as unknown as WebPreviewBodyProps

    render(
      <WebPreview defaultUrl='data:text/html,<h1>blocked</h1>'>
        <WebPreviewBody {...unsafeProps} />
      </WebPreview>
    )

    expect(screen.getByTitle('Preview')).not.toHaveAttribute('src')
  })

  test.each([
    ['lowercase', 'srcdoc'],
    ['uppercase', 'SRCDOC'],
    ['mixed-case', 'SrcDoc'],
  ])('blocks a %s runtime srcdoc variant', (_case, propName) => {
    const unsafeProps = {
      [propName]: '<script>window.parent.document.body.remove()</script>',
    } as unknown as WebPreviewBodyProps

    render(
      <WebPreview defaultUrl='/preview'>
        <WebPreviewBody {...unsafeProps} />
      </WebPreview>
    )

    const iframe = screen.getByTitle('Preview')
    expect(iframe).toHaveAttribute('src', '/preview')
    expect(iframe).not.toHaveAttribute('srcdoc')
  })

  test.each([
    ['lowercase', 'sandbox'],
    ['uppercase', 'SANDBOX'],
    ['mixed-case', 'Sandbox'],
  ])('keeps the fixed sandbox for a %s runtime variant', (_case, propName) => {
    const unsafeProps = {
      [propName]: 'allow-same-origin allow-scripts',
    } as unknown as WebPreviewBodyProps

    render(
      <WebPreview defaultUrl='/preview'>
        <WebPreviewBody {...unsafeProps} />
      </WebPreview>
    )

    expect(screen.getByTitle('Preview')).toHaveAttribute(
      'sandbox',
      SCRIPT_APP_SANDBOX
    )
  })
})
