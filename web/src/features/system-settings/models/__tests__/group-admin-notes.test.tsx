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
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { describe, expect, it } from 'vitest'

import { SettingsPageProvider } from '../../components/settings-page-context'
import { GroupRatioForm } from '../group-ratio-form'

const defaults = {
  GroupRatio: '{"default":1,"vip":0.8,"internal":1}',
  TopupGroupRatio: '{"vip":1.2}',
  UserUsableGroups: '{"default":"Standard access","vip":"Premium access"}',
  GroupAdminNotes: '{"internal":"Staff only"}',
  GroupGroupRatio: '{}',
  AutoGroups: '["default"]',
  MaxTokenAutoGroups: 5,
  DefaultUseAutoGroup: false,
  GroupSpecialUsableGroup: '{}',
}

type Values = typeof defaults

let current: Values

function Fixture(props: { initial?: Partial<Values> }) {
  const [actions, setActions] = useState<HTMLDivElement | null>(null)
  const form = useForm({ defaultValues: { ...defaults, ...props.initial } })
  current = form.watch()
  return (
    <SettingsPageProvider actionsContainer={actions}>
      <div ref={setActions} />
      <GroupRatioForm form={form} onSave={async () => {}} isSaving={false} />
    </SettingsPageProvider>
  )
}

function groupNames() {
  return screen
    .getAllByRole<HTMLInputElement>('textbox', { name: 'Group name' })
    .map((input) => input.value)
}

function selectableCheckbox(group: string) {
  return screen.getAllByRole('checkbox', { name: 'User selectable' })[
    groupNames().indexOf(group)
  ]
}

function saved(field: 'UserUsableGroups' | 'GroupAdminNotes' | 'GroupRatio') {
  return JSON.parse(current[field])
}

describe('group admin notes', () => {
  it('shows the stored note of a non-selectable group in an editable field', async () => {
    const user = userEvent.setup()
    render(<Fixture />)

    const note = screen.getByRole('textbox', {
      name: 'Admin note (not shown to users)',
    })
    expect(note).toHaveValue('Staff only')
    await user.type(note, ' group')

    expect(saved('GroupAdminNotes')).toEqual({ internal: 'Staff only group' })
    expect(saved('UserUsableGroups')).toEqual({
      default: 'Standard access',
      vip: 'Premium access',
    })
  })

  it('moves the description into admin notes when a group stops being selectable', async () => {
    const user = userEvent.setup()
    render(<Fixture />)

    await user.click(selectableCheckbox('vip'))

    expect(saved('UserUsableGroups')).toEqual({ default: 'Standard access' })
    expect(saved('GroupAdminNotes')).toEqual({
      vip: 'Premium access',
      internal: 'Staff only',
    })
    expect(
      screen.getAllByRole('textbox', {
        name: 'Admin note (not shown to users)',
      })[0]
    ).toHaveValue('Premium access')
  })

  it('restores the description after a save and reload when the group is made selectable again', async () => {
    const user = userEvent.setup()
    render(<Fixture />)
    await user.click(selectableCheckbox('vip'))
    const reloaded = { ...current }
    cleanup()

    render(<Fixture initial={reloaded} />)
    await user.click(selectableCheckbox('vip'))

    expect(saved('UserUsableGroups')).toEqual({
      default: 'Standard access',
      vip: 'Premium access',
    })
    expect(saved('GroupAdminNotes')).toEqual({ internal: 'Staff only' })
    expect(
      screen.getAllByRole('textbox', { name: 'Group description' })[1]
    ).toHaveValue('Premium access')
  })

  it('renames the note with its group and removes it when the group is deleted', async () => {
    const user = userEvent.setup()
    render(
      <Fixture
        initial={{
          GroupAdminNotes: '{"internal":"Staff only","retired":"Old"}',
        }}
      />
    )

    fireEvent.change(
      screen.getAllByRole('textbox', { name: 'Group name' })[
        groupNames().indexOf('internal')
      ],
      { target: { value: 'staff' } }
    )
    expect(saved('GroupAdminNotes')).toEqual({ staff: 'Staff only' })
    expect(saved('GroupRatio')).toEqual({ default: 1, vip: 0.8, staff: 1 })

    await user.click(
      screen.getAllByRole('button', { name: 'Delete' })[
        groupNames().indexOf('staff')
      ]
    )
    expect(saved('GroupAdminNotes')).toEqual({})
  })

  it('leaves the options of selectable groups byte-identical when no group has a note', async () => {
    const user = userEvent.setup()
    render(
      <Fixture
        initial={{
          GroupRatio: '{"default":1,"vip":0.8}',
          GroupAdminNotes: '{}',
        }}
      />
    )

    await user.type(
      screen.getAllByRole('textbox', { name: 'Group description' })[1],
      '!'
    )

    expect(current.GroupRatio).toBe('{\n  "default": 1,\n  "vip": 0.8\n}')
    expect(current.UserUsableGroups).toBe(
      '{\n  "default": "Standard access",\n  "vip": "Premium access!"\n}'
    )
    expect(current.TopupGroupRatio).toBe('{\n  "vip": 1.2\n}')
    expect(current.GroupAdminNotes).toBe('{}')
  })

  it('shows the admin note in the details of a non-selectable group', async () => {
    const user = userEvent.setup()
    render(<Fixture />)

    await user.click(
      screen.getAllByRole('button', { name: 'Details' })[
        groupNames().indexOf('internal')
      ]
    )

    const details = screen.getByRole('dialog')
    expect(within(details).getByText('Admin note')).toBeVisible()
    expect(within(details).getByText('Staff only')).toBeVisible()
  })

  it('shares admin notes between the JSON and visual editors', async () => {
    const user = userEvent.setup()
    render(<Fixture />)

    await user.click(screen.getByRole('button', { name: 'Switch to JSON' }))
    const editor = screen.getByRole('textbox', { name: 'Group admin notes' })
    expect(JSON.parse((editor as HTMLTextAreaElement).value)).toEqual({
      internal: 'Staff only',
    })
    fireEvent.input(editor, {
      target: { value: '{"internal":"Edited as JSON"}' },
    })
    await user.click(screen.getByRole('button', { name: 'Switch to Visual' }))

    expect(
      screen.getByRole('textbox', { name: 'Admin note (not shown to users)' })
    ).toHaveValue('Edited as JSON')
  })
})
