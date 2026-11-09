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
import { Label } from '@/components/ui/label'

import { setIQModels } from './config-schema'
import type { IQTarget } from './types'

export function IQTargetSelector(props: {
  catalog: IQTarget[]
  value: IQTarget[]
  onChange: (value: IQTarget[]) => void
}) {
  const { t } = useTranslation()
  const groups = [
    ...new Set([
      ...props.catalog.map((target) => target.group),
      ...props.value.map((target) => target.group),
    ]),
  ]
  return (
    <div className='max-h-80 space-y-4 overflow-y-auto rounded-lg border p-4'>
      {groups.length === 0 && <p>{t('No compatible targets available')}</p>}
      {groups.map((group) => {
        const available =
          props.catalog.find((target) => target.group === group)?.models ?? []
        const selected =
          props.value.find((target) => target.group === group)?.models ?? []
        const models = [...new Set([...available, ...selected])]
        return (
          <fieldset key={group} className='min-w-0 space-y-3'>
            <legend className='mb-2 max-w-full font-medium break-all'>
              {group}
            </legend>
            <Label className='flex items-center gap-2'>
              <Checkbox
                checked={
                  models.length > 0 &&
                  models.every((model) => selected.includes(model))
                }
                indeterminate={
                  selected.length > 0 &&
                  !models.every((model) => selected.includes(model))
                }
                onCheckedChange={(checked) =>
                  props.onChange(
                    setIQModels(props.value, group, checked ? available : [])
                  )
                }
              />
              {t('Select group models')}
            </Label>
            <div className='grid gap-3 pl-6 sm:grid-cols-2'>
              {models.map((model) => (
                <Label key={model} className='flex min-w-0 items-start gap-2'>
                  <Checkbox
                    checked={selected.includes(model)}
                    disabled={
                      !available.includes(model) && !selected.includes(model)
                    }
                    onCheckedChange={(checked) =>
                      props.onChange(
                        setIQModels(
                          props.value,
                          group,
                          checked
                            ? [...selected, model]
                            : selected.filter((name) => name !== model)
                        )
                      )
                    }
                  />
                  <span className='break-all'>
                    {model}
                    {!available.includes(model) && (
                      <> · {t('Model unavailable')}</>
                    )}
                  </span>
                </Label>
              ))}
            </div>
          </fieldset>
        )
      })}
    </div>
  )
}
