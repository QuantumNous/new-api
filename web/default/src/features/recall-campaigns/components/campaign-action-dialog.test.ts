import { describe, expect, test } from 'bun:test'
import { RecallApiError } from '../api'
import { getRecallLocalizationBlockers } from './campaign-action-dialog'

describe('CampaignActionDialog localization blockers', () => {
  test('extracts structured activation blockers from the API error data', () => {
    const error = new RecallApiError('Translations are stale', {
      blockers: [
        { stage_no: 2, locale: 'es', reason: 'stale' },
        { stage_no: 2, locale: 'fr', reason: 'missing' },
      ],
    })

    expect(getRecallLocalizationBlockers(error)).toEqual([
      { stage_no: 2, locale: 'es', reason: 'stale' },
      { stage_no: 2, locale: 'fr', reason: 'missing' },
    ])
  })

  test('ignores malformed error data', () => {
    expect(getRecallLocalizationBlockers(new Error('No data'))).toEqual([])
    expect(
      getRecallLocalizationBlockers(
        new RecallApiError('Bad data', { blockers: [{ locale: 'es' }] })
      )
    ).toEqual([])
  })
})
