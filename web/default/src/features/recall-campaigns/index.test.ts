import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'

const source = readFileSync(join(import.meta.dir, 'index.tsx'), 'utf8')

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
})
