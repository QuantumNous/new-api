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
import { type TFunction } from 'i18next'
import { filterSidebarGroups } from './use-sidebar-config'
import { buildSidebarData } from './use-sidebar-data'

const t = ((key: string) => key) as TFunction

describe('buildSidebarData', () => {
  test('places overview and playground in the get started group', () => {
    const getStartedGroup = buildSidebarData(t).navGroups.find(
      (group) => group.id === 'chat'
    )

    expect(getStartedGroup).toMatchObject({
      title: 'Get Started',
      items: [
        { title: 'Overview', url: '/dashboard/overview' },
        { title: 'Playground', url: '/playground' },
      ],
    })
  })

  test('orders the models group with analytics after task logs', () => {
    const generalGroup = buildSidebarData(t).navGroups.find(
      (group) => group.id === 'general'
    )

    expect(generalGroup?.items).toMatchObject([
      { title: 'Available Models', url: '/available-models' },
      { title: 'Usage Logs', url: '/usage-logs/common' },
      { title: 'Task Logs', url: '/usage-logs/task' },
      { title: 'Analytics', url: '/dashboard/models' },
    ])
  })

  test('groups onboarding, marketplace, and credentials like developer tools', () => {
    const sidebar = buildSidebarData(t)
    const toolsGroup = sidebar.navGroups.find((group) => group.id === 'tools')
    const credentialsGroup = sidebar.navGroups.find(
      (group) => group.id === 'credentials'
    )

    expect(toolsGroup?.items).toMatchObject([
      { title: 'Get Started', url: '/quickstart' },
      { title: 'Tool Marketplace', url: '/api-marketplace' },
    ])
    expect(credentialsGroup?.items).toMatchObject([
      { title: 'API Keys', url: '/keys' },
    ])
  })

  test('highlights the invitation entry with the configured badge', () => {
    const personalGroup = buildSidebarData(t, {
      inviteBadge: '+$10',
    }).navGroups.find((group) => group.id === 'personal')
    const inviteItem = personalGroup?.items.find(
      (item) => 'url' in item && item.url === '/invite'
    )

    expect(inviteItem).toMatchObject({
      title: 'Invite',
      badge: '+$10',
      badgeVariant: 'promotion',
    })
  })

  test('falls back to the generic promo text without a configured badge', () => {
    const personalGroup = buildSidebarData(t).navGroups.find(
      (group) => group.id === 'personal'
    )
    const inviteItem = personalGroup?.items.find(
      (item) => 'url' in item && item.url === '/invite'
    )

    expect(inviteItem?.badge).toBe('Earn More Credits!')
  })

  test('keeps the badge language independent of the title translation', () => {
    const translateToChinese = ((key: string) =>
      key === 'Invite' ? '邀请' : key) as TFunction
    const personalGroup = buildSidebarData(translateToChinese, {
      inviteBadge: '+$10',
    }).navGroups.find((group) => group.id === 'personal')
    const inviteItem = personalGroup?.items.find(
      (item) => 'url' in item && item.url === '/invite'
    )

    expect(inviteItem).toMatchObject({
      title: '邀请',
      badge: '+$10',
    })
  })

  test('places model health in the centrally role-gated admin group', () => {
    const sidebarData = buildSidebarData(t)
    const adminGroup = sidebarData.navGroups.find(
      (group) => group.id === 'admin'
    )
    const modelHealthItem = adminGroup?.items.find(
      (item) => 'url' in item && item.url === '/model-health'
    )

    expect(modelHealthItem).toMatchObject({
      title: 'Model Health',
      url: '/model-health',
    })
    expect(
      sidebarData.navGroups
        .filter((group) => group.id !== 'admin')
        .flatMap((group) => group.items)
        .some((item) => 'url' in item && item.url === '/model-health')
    ).toBe(false)
  })
  test('shows Activity Configuration by default', () => {
    const admin = buildSidebarData(t).navGroups.find(
      (group) => group.id === 'admin'
    )
    const item = admin?.items.find(
      (item) => 'url' in item && item.url === '/recall-campaigns'
    )

    expect(item).toMatchObject({
      title: 'Activity Configuration',
      url: '/recall-campaigns',
    })
  })

  test('does not expose legacy Recall Campaigns navigation copy', () => {
    const admin = buildSidebarData(t).navGroups.find(
      (group) => group.id === 'admin'
    )

    expect(admin?.items.some((item) => item.title === 'Recall Campaigns')).toBe(
      false
    )
  })

  test('hides Activity Configuration when the admin config disables it', () => {
    const groups = filterSidebarGroups(
      buildSidebarData(t).navGroups,
      JSON.stringify({ admin: { enabled: true, recall_campaigns: false } }),
      null
    )
    const admin = groups.find((group) => group.id === 'admin')
    expect(
      admin?.items.some(
        (item) => 'url' in item && item.url === '/recall-campaigns'
      )
    ).toBe(false)
  })

  test('allows the user config to narrow Activity Configuration visibility', () => {
    const groups = filterSidebarGroups(
      buildSidebarData(t).navGroups,
      null,
      JSON.stringify({ admin: { enabled: true, recall_campaigns: false } })
    )
    const admin = groups.find((group) => group.id === 'admin')
    expect(
      admin?.items.some(
        (item) => 'url' in item && item.url === '/recall-campaigns'
      )
    ).toBe(false)
  })
})
