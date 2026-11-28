import { describe, expect, test } from 'vitest'
import { getNormalizedURL } from '../src/ssr/ssr-server'

describe('getNormalizedURL', () => {
  test('should return URL that is in standardized format', () => {
    const url1 = 'https://example.com/%EB%8C%80%7C/path?query=%EB%8C%80|#hash'
    const url2 = 'https://example.com/%EB%8C%80|/path?query=%EB%8C%80%7C#hash'

    const normalizedUrl1 = getNormalizedURL(url1)
    const normalizedUrl2 = getNormalizedURL(url2)

    expect(normalizedUrl1.url.pathname).toBe('/%EB%8C%80|/path')
    expect(normalizedUrl1.url.pathname).toBe(normalizedUrl2.url.pathname)
    expect(new URL(url1).pathname).not.toBe(new URL(url2).pathname)

    expect(normalizedUrl1.url.search).toBe(`?query=%EB%8C%80%7C`)
    expect(normalizedUrl1.url.search).toBe(normalizedUrl2.url.search)
    expect(new URL(url1).search).not.toBe(new URL(url2).search)
  })

  const testCases = [
    {
      url: 'https://example.com/%3Fstart?query=value',
      expectedPathName: '/%3Fstart',
      expectedSearchParams: '?query=value',
      expectedHash: '',
    },
    {
      url: 'https://example.com/end%3F?query=value',
      expectedPathName: '/end%3F',
      expectedSearchParams: '?query=value',
      expectedHash: '',
    },
    {
      url: 'https://example.com/%23?query=value',
      expectedPathName: '/%23',
      expectedSearchParams: '?query=value',
      expectedHash: '',
    },
    {
      url: 'https://example.com/a%3Fb%3Fc%23d?query=value',
      expectedPathName: '/a%3Fb%3Fc%23d',
      expectedSearchParams: '?query=value',
      expectedHash: '',
    },
    {
      url: 'https://example.com/path?query=value#section%3Fpart',
      expectedPathName: '/path',
      expectedSearchParams: '?query=value',
      expectedHash: '#section%3Fpart',
    },
    {
      url: 'https://example.com/start%3Fmiddle%23end?key=value%23part&other=%3Fdata#section%3Fpart',
      expectedPathName: '/start%3Fmiddle%23end',
      expectedSearchParams: '?key=value%23part&other=%3Fdata',
      expectedHash: '#section%3Fpart',
    },
    {
      url: 'https://example.com/%E0%A4',
      expectedPathName: '/%E0%A4',
      expectedSearchParams: '',
      expectedHash: '',
    },
    {
      url: 'https://example.com/%ZZ',
      expectedPathName: '/%ZZ',
      expectedSearchParams: '',
      expectedHash: '',
    },
    {
      url: 'https://example.com/path?a=1&a=2',
      expectedPathName: '/path',
      expectedSearchParams: '?a=1&a=2',
      expectedHash: '',
    },
    {
      url: 'https://example.com/path+a',
      expectedPathName: '/path+a',
      expectedSearchParams: '',
      expectedHash: '',
    },
    {
      url: 'https://example.com/path a',
      expectedPathName: '/path%20a',
      expectedSearchParams: '',
      expectedHash: '',
    },
    {
      url: 'https://example.com/path%20a',
      expectedPathName: '/path%20a',
      expectedSearchParams: '',
      expectedHash: '',
    },
    {
      url: 'https://example.com/path%25a',
      expectedPathName: '/path%25a',
      expectedSearchParams: '',
      expectedHash: '',
    },
    {
      url: 'https://example.com/path%25a',
      expectedPathName: '/path%25a',
      expectedSearchParams: '',
      expectedHash: '',
    },
    {
      url: 'https://example.com/path\\a',
      expectedPathName: '/path%5Ca',
      expectedSearchParams: '',
      expectedHash: '',
    },
    {
      url: 'https://example.com/path%5Ca',
      expectedPathName: '/path%5Ca',
      expectedSearchParams: '',
      expectedHash: '',
    },
  ]
  test.each(testCases)(
    'should treat encoded URL specific characters correctly',
    ({ url, expectedPathName, expectedHash, expectedSearchParams }) => {
      const normalizedUrl = getNormalizedURL(url)
      expect(normalizedUrl.url.pathname).toBe(expectedPathName)
      expect(normalizedUrl.url.search).toBe(expectedSearchParams)
      expect(normalizedUrl.url.hash).toBe(expectedHash)
    },
  )
})
