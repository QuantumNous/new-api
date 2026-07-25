/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { describe, expect, test } from 'bun:test'
import type { UserModelAccess } from '@/features/available-models'
import type { ApiKeyFormData } from '../types'
import {
  getCreateDialogDeepLinkAction,
  getCreateDialogRequestTransition,
  getApiKeyModelPreviewPlacement,
  isApiKeyUpdateDetailReady,
  requestApiKeyModelAccessPreservation,
  requiresModelAccessForApiKeyMutation,
  resolveSafeCreateScope,
  shouldApplyResolvedCreateGroup,
  shouldReinitializeCreateForm,
} from './api-key-create-dialog'

function buildAccess(): UserModelAccess {
  return {
    scope_mode: 'selectable_group',
    identity_scope: 'identity',
    identity_model_ids: [],
    identity_model_ratios: {},
    identity_default_ratio: 1,
    create_default_scope: 'default',
    groups: [
      {
        id: 'default',
        label: 'Default',
        ratio: 1,
        model_ids: [],
        model_ratios: {},
      },
      {
        id: 'premium',
        label: 'Premium',
        ratio: 2,
        model_ids: [],
        model_ratios: {},
      },
    ],
    account_model_ids: [],
    account_model_ratios: {},
    account_default_ratio: null,
    models: [],
  }
}

describe('create dialog deep-link model access contract', () => {
  test('opens on an access error so the dialog can show Retry', () => {
    expect(
      getCreateDialogDeepLinkAction(true, undefined, false, 'premium')
    ).toEqual({ shouldOpen: false })
    expect(
      getCreateDialogDeepLinkAction(true, undefined, true, 'premium')
    ).toEqual({ shouldOpen: true })
  })

  test('resolves the requested group after Retry succeeds', () => {
    expect(
      getCreateDialogDeepLinkAction(true, buildAccess(), false, 'premium')
    ).toEqual({ shouldOpen: true, resolvedGroup: 'premium' })
    expect(
      getCreateDialogDeepLinkAction(true, buildAccess(), false, 'removed')
    ).toEqual({ shouldOpen: true, resolvedGroup: 'default' })
  })

  test('applies the resolved group only when the user has not selected one', () => {
    const base = {
      access: buildAccess(),
      groupDirty: false,
      initialized: true,
      isUpdate: false,
      open: true,
    }

    expect(shouldApplyResolvedCreateGroup(base)).toBeTrue()
    expect(
      shouldApplyResolvedCreateGroup({ ...base, groupDirty: true })
    ).toBeFalse()
    expect(shouldApplyResolvedCreateGroup({ ...base, open: false })).toBeFalse()
  })

  test('resets one-shot state when a deep link changes from group A to B', () => {
    const first = getCreateDialogRequestTransition(null, true, 'default')
    expect(first).toEqual({
      requestKey: 'create:default',
      shouldReset: true,
    })
    expect(
      getCreateDialogRequestTransition(first.requestKey, true, 'premium')
    ).toEqual({
      requestKey: 'create:premium',
      shouldReset: true,
    })
    expect(
      getCreateDialogRequestTransition('create:premium', true, 'premium')
    ).toEqual({
      requestKey: 'create:premium',
      shouldReset: false,
    })
  })

  test('allows only safe server-default creation without model access', () => {
    expect(requiresModelAccessForApiKeyMutation(false, {})).toBeTrue()
    const safeValues = {
      group: '',
      model_limits_enabled: false,
      model_limits: [],
      cross_group_retry: false,
    }
    expect(
      requiresModelAccessForApiKeyMutation(false, {}, safeValues)
    ).toBeFalse()
    expect(
      requiresModelAccessForApiKeyMutation(
        false,
        {},
        {
          ...safeValues,
          group: 'premium',
        }
      )
    ).toBeTrue()
    expect(
      requiresModelAccessForApiKeyMutation(
        false,
        {},
        {
          ...safeValues,
          model_limits_enabled: true,
        }
      )
    ).toBeTrue()
    expect(
      requiresModelAccessForApiKeyMutation(
        false,
        { cross_group_retry: true },
        safeValues
      )
    ).toBeTrue()
  })

  test('requires model access only for model-scope updates', () => {
    expect(requiresModelAccessForApiKeyMutation(true, {})).toBeFalse()
    expect(
      requiresModelAccessForApiKeyMutation(true, { name: true })
    ).toBeFalse()
    expect(
      requiresModelAccessForApiKeyMutation(true, {
        model_limits_enabled: true,
      })
    ).toBeTrue()
    expect(
      requiresModelAccessForApiKeyMutation(true, {
        cross_group_retry: true,
      })
    ).toBeTrue()
  })

  test('selects exactly one responsive model preview placement', () => {
    expect(getApiKeyModelPreviewPlacement(false)).toBe('mobile')
    expect(getApiKeyModelPreviewPlacement(true)).toBe('desktop')
  })

  test('requests atomic backend preservation for unrelated edits', () => {
    const payload = {
      name: 'renamed',
      group: 'accidental-default',
      model_limits_enabled: false,
      model_limits: '',
      cross_group_retry: false,
    } as ApiKeyFormData

    expect(requestApiKeyModelAccessPreservation(payload)).toEqual({
      ...payload,
      preserve_model_access: true,
    })
  })

  test('uses the safe server default only without a requested group', () => {
    expect(resolveSafeCreateScope(undefined, undefined)).toBeNull()
    expect(resolveSafeCreateScope(undefined, 'premium')).toBe('premium')
    expect(resolveSafeCreateScope(buildAccess(), 'premium')).toBe('premium')
  })

  test('reinitializes dirty request A when request B arrives', () => {
    const dirtyRequestA = {
      name: 'dirty A',
      group: 'premium',
    }
    const shouldReset = shouldReinitializeCreateForm({
      initializedRequestKey: 'create:A',
      nextRequestKey: 'create:B',
      open: true,
      isUpdate: false,
      scopeReady: true,
    })
    const requestB = shouldReset
      ? { name: '', group: 'default' }
      : dirtyRequestA

    expect(shouldReset).toBeTrue()
    expect(requestB).toEqual({ name: '', group: 'default' })
    expect(
      shouldReinitializeCreateForm({
        initializedRequestKey: 'create:B',
        nextRequestKey: 'create:B',
        open: true,
        isUpdate: false,
        scopeReady: true,
      })
    ).toBeFalse()
  })

  test('requires the matching key detail before enabling an update', () => {
    expect(isApiKeyUpdateDetailReady(false, undefined, undefined)).toBeTrue()
    expect(isApiKeyUpdateDetailReady(true, 42, undefined)).toBeFalse()
    expect(isApiKeyUpdateDetailReady(true, 42, 41)).toBeFalse()
    expect(isApiKeyUpdateDetailReady(true, 42, 42)).toBeTrue()
  })
})
