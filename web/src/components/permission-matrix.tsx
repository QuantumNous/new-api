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
import { Check, ChevronDown, Info } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Toggle } from '@/components/ui/toggle'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type {
  AdminPermissionMatrix,
  PermissionResourceDef,
} from '@/lib/admin-permissions'
import { cn } from '@/lib/utils'

export type PermissionMatrixGroup = {
  key: string
  labelKey: string
  resources: PermissionResourceDef[]
}

type PermissionMatrixProps = {
  value: AdminPermissionMatrix
  onChange: (value: AdminPermissionMatrix) => void
  disabled?: boolean
} & (
  | { resources: PermissionResourceDef[] }
  // Groups render as collapsible sections with a selection count and a
  // select-all action.
  | { groups: PermissionMatrixGroup[] }
)

type PermissionResourceRowProps = {
  idPrefix: string
  resource: PermissionResourceDef
  value: AdminPermissionMatrix
  onChange: (value: AdminPermissionMatrix) => void
  disabled?: boolean
  className: string
}

// PermissionMatrix renders one toggle per resource action of a permission
// catalog. Each resource lists its action descriptions in a tooltip, and the
// toggles announce them as their descriptions.
export function PermissionMatrix(props: PermissionMatrixProps) {
  const { t } = useTranslation()
  const idPrefix = useId()
  if (!('groups' in props)) {
    return (
      <div className='divide-y rounded-md border'>
        {props.resources.map((resource) => (
          <PermissionResourceRow
            key={resource.resource}
            idPrefix={idPrefix}
            resource={resource}
            value={props.value}
            onChange={props.onChange}
            disabled={props.disabled}
            className='px-3'
          />
        ))}
      </div>
    )
  }
  return (
    <div className='divide-y rounded-md border'>
      {props.groups.map((group) => {
        const label = t(group.labelKey)
        const cells = group.resources.flatMap((resource) =>
          resource.actions.map(
            (option) => props.value[resource.resource]?.[option.action] === true
          )
        )
        const selected = cells.filter(Boolean).length
        const allSelected = selected === cells.length
        return (
          <section key={group.key} aria-label={label}>
            <Collapsible defaultOpen>
              <div className='flex items-center gap-2 px-3 py-2'>
                <CollapsibleTrigger className='group/trigger flex flex-1 items-center gap-2 text-left text-sm font-medium'>
                  <ChevronDown
                    className='text-muted-foreground size-4 -rotate-90 transition-transform group-data-[panel-open]/trigger:rotate-0'
                    aria-hidden='true'
                  />
                  {label}
                  <Badge variant='secondary' className='tabular-nums'>
                    {t('Selected {{selected}} / {{total}}', {
                      selected,
                      total: cells.length,
                    })}
                  </Badge>
                </CollapsibleTrigger>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  className='h-7 text-xs'
                  disabled={props.disabled}
                  onClick={() => {
                    const next = { ...props.value }
                    for (const resource of group.resources) {
                      const actions = { ...next[resource.resource] }
                      for (const option of resource.actions) {
                        actions[option.action] = !allSelected
                      }
                      next[resource.resource] = actions
                    }
                    props.onChange(next)
                  }}
                >
                  {allSelected ? t('Clear') : t('Select all')}
                </Button>
              </div>
              <CollapsibleContent>
                <div className='divide-y border-t'>
                  {group.resources.map((resource) => (
                    <PermissionResourceRow
                      key={resource.resource}
                      idPrefix={idPrefix}
                      resource={resource}
                      value={props.value}
                      onChange={props.onChange}
                      disabled={props.disabled}
                      className='pr-3 pl-9'
                    />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </section>
        )
      })}
    </div>
  )
}

function PermissionResourceRow(props: PermissionResourceRowProps) {
  const { t } = useTranslation()
  const resource = props.resource
  const label = t(resource.label_key)
  return (
    <div
      role='group'
      aria-label={label}
      className={cn('flex items-start gap-3 py-2', props.className)}
    >
      <div className='flex w-32 shrink-0 items-center gap-1.5 pt-1 text-sm'>
        {label}
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type='button'
                className='text-muted-foreground hover:text-foreground inline-flex'
                aria-label={t('Details')}
              />
            }
          >
            <Info className='size-3.5' aria-hidden='true' />
          </TooltipTrigger>
          <TooltipContent className='block max-w-sm py-2 text-left'>
            <dl className='space-y-1.5'>
              {resource.actions.map((option) => (
                <div key={option.action}>
                  <dt className='font-medium'>{t(option.label_key)}</dt>
                  <dd className='opacity-80'>{t(option.description_key)}</dd>
                </div>
              ))}
            </dl>
          </TooltipContent>
        </Tooltip>
      </div>
      <div className='flex min-w-0 flex-1 flex-wrap gap-1.5'>
        {resource.actions.map((option) => {
          const pressed =
            props.value[resource.resource]?.[option.action] === true
          const descriptionId = `${props.idPrefix}-${resource.resource}-${option.action}`
          return (
            <Toggle
              key={option.action}
              variant='outline'
              size='sm'
              pressed={pressed}
              disabled={props.disabled}
              aria-describedby={descriptionId}
              onPressedChange={(next) => {
                props.onChange({
                  ...props.value,
                  [resource.resource]: {
                    ...props.value[resource.resource],
                    [option.action]: next,
                  },
                })
              }}
              className={cn(
                'h-auto min-h-7 max-w-full font-normal whitespace-normal',
                pressed &&
                  'border-primary bg-primary/10! text-primary hover:bg-primary/15'
              )}
            >
              {pressed && <Check aria-hidden='true' />}
              {t(option.label_key)}
              <span id={descriptionId} hidden>
                {t(option.description_key)}
              </span>
            </Toggle>
          )
        })}
      </div>
    </div>
  )
}
