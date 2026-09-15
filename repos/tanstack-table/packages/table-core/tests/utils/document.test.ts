import {
  safelyAccessDocument,
  safelyAccessDocumentEvent,
} from '../../src/utils/document'
import { afterEach, beforeEach, expect, describe, test } from 'vitest'

const originalDocument = globalThis.document

export function getDocumentMock(): Document {
  return {} as Document
}

describe('safelyAccessDocument', () => {
  describe('global document', () => {
    const mockedDocument = getDocumentMock()
    const originalDocument = globalThis.document
    beforeEach(() => {
      if (typeof globalThis.document === 'undefined') {
        globalThis.document = mockedDocument
      }
    })
    afterEach(() => {
      if (typeof originalDocument === 'undefined') {
        // @ts-expect-error Just Typings
        delete globalThis.document
      }
    })

    test('get global document when no args are passed', () => {
      const contextDocument = safelyAccessDocument()
      expect(contextDocument).toEqual(mockedDocument)
    })
  })

  test('get document', () => {
    let givenDocument = {} as Document
    const contextDocument = safelyAccessDocument(givenDocument)

    expect(contextDocument).toEqual(givenDocument)
  })
})

describe('safelyAccessDocumentEvent', () => {
  test('get document by given event', () => {
    const fakeDocument = {}
    const event = new Event('mousedown')

    class FakeElement extends EventTarget {
      ownerDocument = fakeDocument
    }

    Object.defineProperty(event, 'target', { value: new FakeElement() })

    const document = safelyAccessDocumentEvent(event)
    expect(fakeDocument).toEqual(document)
  })
})
