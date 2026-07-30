import { describe, expect, test } from 'bun:test'
import { RecallApiError } from '../api'
import {
  getRecallLocalizationBlockers,
  handleRecallCampaignActionError,
} from './campaign-action-dialog'

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

  test('hands an activation blocker to the repair flow without a generic error', () => {
    const events: string[] = []
    const error = new RecallApiError('Translations are stale', {
      blockers: [{ stage_no: 2, locale: 'es', reason: 'stale' }],
    })

    handleRecallCampaignActionError('activate', error, {
      onLocalizationBlocked: () => events.push('blocked'),
      onClose: () => events.push('closed'),
      onError: () => events.push('error'),
    })

    expect(events).toEqual(['blocked', 'closed'])
  })

  test('shows the activation error when no localization repair handler exists', () => {
    const events: string[] = []
    const error = new RecallApiError('Translations are stale', {
      blockers: [{ stage_no: 2, locale: 'es', reason: 'stale' }],
    })

    handleRecallCampaignActionError('activate', error, {
      onClose: () => events.push('closed'),
      onError: (message) => events.push(message),
    })

    expect(events).toEqual(['Translations are stale'])
  })

  test('uses stable Activity SMTP action error codes before raw backend messages', () => {
    const events: string[] = []
    const error = new RecallApiError('raw backend SMTP detail', {
      code: 'activity_smtp_not_configured',
      message: 'raw backend SMTP detail',
    })

    handleRecallCampaignActionError('activate', error, {
      onClose: () => events.push('closed'),
      onError: (message) => events.push(message),
    })

    expect(events).toEqual([
      'Activity SMTP is not configured. Configure it before sending.',
    ])
  })
})
