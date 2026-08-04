// @ts-nocheck
import { expect, test } from 'bun:test'
import { getAnalysisTableDimensions } from './analysisColumns'

test('table columns follow returned dimensions and do not render dead admin fields', () => {
  expect(getAnalysisTableDimensions(true, ['period', 'model_name'])).toEqual([
    'period',
    'model_name',
  ])
  expect(
    getAnalysisTableDimensions(true, [
      'period',
      'username',
      'model_name',
      'token_name',
      'group',
      'channel',
    ])
  ).toEqual([
    'period',
    'username',
    'model_name',
    'token_name',
    'group',
    'channel',
  ])
})

test('user tables cannot expose admin-only dimensions even if a response is malformed', () => {
  expect(
    getAnalysisTableDimensions(true, ['period', 'username', 'channel'])
  ).toEqual(['period', 'username', 'channel'])
  expect(
    getAnalysisTableDimensions(false, [
      'period',
      'username',
      'model_name',
      'channel',
    ])
  ).toEqual(['period', 'model_name'])
})
