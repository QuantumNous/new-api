import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const source = readFileSync(join(import.meta.dir, 'index.tsx'), 'utf8')

function expectClassTokens(className: string, tokens: string[]) {
  const classes = className.split(/\s+/)
  for (const token of tokens) {
    expect(classes).toContain(token)
  }
}

describe('RecallCampaigns index wiring', () => {
  test('renders dedicated SMTP settings before the campaign table', () => {
    const smtpIndex = source.indexOf('<CampaignSMTPSettings />')
    const tableIndex = source.indexOf('<CampaignTable />')

    expect(smtpIndex).toBeGreaterThanOrEqual(0)
    expect(tableIndex).toBeGreaterThanOrEqual(0)
    expect(smtpIndex).toBeLessThan(tableIndex)
  })

  test('removes the legacy Activity email sender alias selector', () => {
    const legacyComponent = ['Campaign', 'Email', 'Sender', 'Control'].join('')
    const legacyModule = ['campaign', 'email', 'sender', 'control'].join('-')

    expect(source).not.toContain(legacyComponent)
    expect(source).not.toContain(legacyModule)
    expect(source).toContain('<CampaignEmailHourlyLimitControl />')
  })

  test('keeps the create dialog content and header shrinkable at narrow widths', () => {
    const contentClass = source.match(/<DialogContent className='([^']+)'/)?.[1]
    const headerClass = source.match(/<DialogHeader className='([^']+)'/)?.[1]

    expect(contentClass).toBeTruthy()
    expect(headerClass).toBeTruthy()
    expectClassTokens(contentClass ?? '', [
      'min-w-0',
      'w-full',
      'max-h-[92vh]',
      'overflow-x-hidden',
      'overflow-y-auto',
      'sm:max-w-5xl',
    ])
    expectClassTokens(headerClass ?? '', ['min-w-0', 'w-full'])
  })
})
