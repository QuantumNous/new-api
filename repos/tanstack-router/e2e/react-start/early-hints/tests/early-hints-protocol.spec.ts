import { expect, test } from '@playwright/test'
import { connect } from 'node:http2'
import { getTestServerPort } from '@tanstack/router-e2e-utils'
import packageJson from '../package.json' with { type: 'json' }
import type { IncomingHttpHeaders } from 'node:http2'

type Http2Response = {
  earlyHints: Array<IncomingHttpHeaders>
  finalHeaders: IncomingHttpHeaders
  body: string
}

function makeRequest(baseURL: string, path: string): Promise<Http2Response> {
  return new Promise((resolve, reject) => {
    const client = connect(baseURL, { rejectUnauthorized: false })
    const request = client.request({ ':path': path })
    const earlyHints: Array<IncomingHttpHeaders> = []
    const chunks: Array<Buffer> = []
    let finalHeaders: IncomingHttpHeaders | undefined

    client.on('error', reject)
    request.on('headers', (headers) => {
      if (headers[':status'] === 103) {
        earlyHints.push(headers)
      }
    })
    request.on('response', (headers) => {
      finalHeaders = headers
    })
    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('error', reject)
    request.on('end', () => {
      client.close()
      resolve({
        earlyHints,
        finalHeaders: finalHeaders!,
        body: Buffer.concat(chunks).toString('utf8'),
      })
    })
    request.end()
  })
}

function linkHeader(headers: IncomingHttpHeaders): string {
  const link = headers.link
  return Array.isArray(link) ? link.join(', ') : (link ?? '')
}

function earlyHintsLinkHeader(response: Http2Response): string {
  expect(response.earlyHints.length).toBe(1)
  return linkHeader(response.earlyHints[0]!)
}

test.describe('Early Hints - HTTP/2 Protocol', () => {
  let baseURL: string

  test.beforeAll(async () => {
    const PORT = await getTestServerPort(packageJson.name)
    baseURL = `https://localhost:${PORT}`
  })

  test('server sends HTTP 103 Early Hints for index route', async () => {
    const response = await makeRequest(baseURL, '/')

    expect(response.earlyHints.length).toBe(1)
    expect(response.finalHeaders[':status']).toBe(200)

    const link = earlyHintsLinkHeader(response)
    expect(link).toContain('rel=modulepreload; as=script')
    expect(link).toMatch(/index-[^.]+\.js/)
  })

  test('server sends route-specific hints for nested route', async () => {
    const response = await makeRequest(baseURL, '/parent/child/grandchild')

    expect(response.earlyHints.length).toBe(1)

    const link = earlyHintsLinkHeader(response)
    expect(link).toContain('parent')
    expect(link).toContain('child')
    expect(link).toContain('grandchild')
  })

  test('different routes get different hints', async () => {
    const [parentResponse, otherResponse] = await Promise.all([
      makeRequest(baseURL, '/parent/child/grandchild'),
      makeRequest(baseURL, '/other/nested'),
    ])

    const parentLinks = earlyHintsLinkHeader(parentResponse)
    const otherLinks = earlyHintsLinkHeader(otherResponse)

    expect(parentLinks).toContain('parent')
    expect(parentLinks).toContain('grandchild')
    expect(parentLinks).not.toContain('other')
    expect(parentLinks).not.toContain('nested')

    expect(otherLinks).toContain('other')
    expect(otherLinks).toContain('nested')
    expect(otherLinks).not.toContain('parent')
    expect(otherLinks).not.toContain('grandchild')
  })

  test('103 response includes proper Link header format', async () => {
    const response = await makeRequest(baseURL, '/')
    const link = earlyHintsLinkHeader(response)

    expect(link).toMatch(/<[^>]+>;\s*rel=modulepreload;\s*as=script/)
  })

  test('CSS module assets are included in early hints', async () => {
    const response = await makeRequest(baseURL, '/parent/child/grandchild')
    const link = earlyHintsLinkHeader(response)

    expect(link).toContain('.css')
    expect(link).toContain('rel=preload')
    expect(link).toContain('as=style')
    expect(link).toMatch(/parent-[^.]+\.css/)
    expect(link).toMatch(/child-[^.]+\.css/)
    expect(link).toMatch(/grandchild-[^.]+\.css/)
  })

  test('hints include both JS and CSS assets', async () => {
    const response = await makeRequest(baseURL, '/other/nested')
    const link = earlyHintsLinkHeader(response)

    expect(link).toContain('rel=modulepreload; as=script')
    expect(link).toMatch(/other-[^.]+\.js/)
    expect(link).toMatch(/nested-[^.]+\.js/)
    expect(link).toContain('rel=preload; as=style')
    expect(link).toMatch(/other-[^.]+\.css/)
    expect(link).toMatch(/nested-[^.]+\.css/)
  })

  test('static and dynamic links are coalesced into one Early Hints response', async () => {
    const response = await makeRequest(baseURL, '/')

    expect(response.earlyHints.length).toBe(1)

    const link = linkHeader(response.earlyHints[0]!)

    expect(link).toContain('rel=modulepreload; as=script')
    expect(link).toContain('<https://early-hints.test>; rel=preconnect')
  })

  test('response Link header includes static and dynamic links', async () => {
    const response = await makeRequest(baseURL, '/')
    const link = linkHeader(response.finalHeaders)

    expect(link).toContain('rel=modulepreload; as=script')
    expect(link).toContain('<https://early-hints.test>; rel=preconnect')
  })

  test('coalesced hints are skipped for redirects', async () => {
    const response = await makeRequest(baseURL, '/redirect')

    expect(response.earlyHints.length).toBe(0)
    expect(response.finalHeaders[':status']).toBe(307)
    expect(linkHeader(response.finalHeaders)).toBe('')
  })
})
