import { expect, test } from 'bun:test'

import footerSource from '../src/components/layout/components/footer.tsx' with {
  type: 'text',
}

test('custom footer HTML is rendered through the shared sanitizer', () => {
  expect(footerSource).toContain('<HtmlContent')
  expect(footerSource).not.toContain(
    'dangerouslySetInnerHTML={{ __html: footerHtml }}'
  )
})
