/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or (at your
option) any later version.
*/
import { createElement } from 'react'
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { buildGoogleOneTapLoginUri } from '../lib/google-one-tap'
import { GoogleOneTap } from './google-one-tap'

describe('GoogleOneTap', () => {
  test('renders the signup context with the configured client and redirect', () => {
    const markup = renderToStaticMarkup(
      createElement(GoogleOneTap, {
        clientId: 'google-client-id',
        context: 'signup',
        enabled: true,
        returnTo: '/keys',
      })
    )

    expect(markup).toContain('data-context="signup"')
    expect(markup).toContain('data-client_id="google-client-id"')
    expect(markup).toContain(
      'data-login_uri="/api/oauth/google/one-tap?return_to=%2Fkeys"'
    )
  })
})

describe('buildGoogleOneTapLoginUri', () => {
  test('falls back to the dashboard when no redirect is provided', () => {
    expect(buildGoogleOneTapLoginUri()).toBe(
      '/api/oauth/google/one-tap?return_to=%2Fdashboard'
    )
  })

  test('preserves a safe console redirect', () => {
    expect(buildGoogleOneTapLoginUri('/dashboard?tab=usage')).toBe(
      '/api/oauth/google/one-tap?return_to=%2Fdashboard%3Ftab%3Dusage'
    )
  })

  test('rejects external and protocol-relative redirects', () => {
    expect(buildGoogleOneTapLoginUri('https://example.com')).toBe(
      '/api/oauth/google/one-tap?return_to=%2Fdashboard'
    )
    expect(buildGoogleOneTapLoginUri('//example.com')).toBe(
      '/api/oauth/google/one-tap?return_to=%2Fdashboard'
    )
  })
})
