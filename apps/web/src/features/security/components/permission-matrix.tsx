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
import { useTranslation } from 'react-i18next'

import { Checkbox } from '@/components/ui/checkbox'

import type { AccessTokenResourceDef } from '../api'
import type { PermissionMatrixValue } from '../lib/access-token-catalog'

export interface PermissionMatrixGroup {
  key: string
  labelKey: string
  resources: AccessTokenResourceDef[]
}

interface PermissionMatrixProps {
  groups: PermissionMatrixGroup[]
  value: PermissionMatrixValue
  disabled?: boolean
  onChange: (value: PermissionMatrixValue) => void
}

export function PermissionMatrix(props: PermissionMatrixProps) {
  const { t } = useTranslation()

  const toggle = (
    resource: string,
    action: string,
    checked: boolean
  ): PermissionMatrixValue => ({
    ...props.value,
    [resource]: { ...props.value[resource], [action]: checked },
  })

  return (
    <div className='space-y-4'>
      {props.groups.map((group) => (
        <div key={group.key} className='space-y-2'>
          <p className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
            {t(group.labelKey)}
          </p>
          <div className='grid gap-2 sm:grid-cols-2'>
            {group.resources.map((resource) => (
              <div
                key={resource.resource}
                className='space-y-2 rounded-md border p-3'
              >
                <div className='text-sm font-medium'>
                  {t(resource.label_key)}
                </div>
                <div className='space-y-2'>
                  {resource.actions.map((option) => (
                    <label
                      key={option.action}
                      className='flex items-start gap-3'
                    >
                      <Checkbox
                        disabled={props.disabled}
                        checked={
                          props.value[resource.resource]?.[option.action] ===
                          true
                        }
                        onCheckedChange={(checked) => {
                          props.onChange(
                            toggle(
                              resource.resource,
                              option.action,
                              checked === true
                            )
                          )
                        }}
                      />
                      <span className='flex min-w-0 flex-col gap-0.5'>
                        <span className='text-sm font-medium'>
                          {t(option.label_key)}
                        </span>
                        {option.description ? (
                          <span className='text-muted-foreground text-xs'>
                            {option.description}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
