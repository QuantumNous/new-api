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
import { Link } from '@tanstack/react-router'
import { ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { getCreateKeySearch } from '../lib/model-access-browser'
import type { ModelAccessScope } from '../types'

type ModelAccessScopeRailProps = {
  scopes: ModelAccessScope[]
  modelCounts: ReadonlyMap<string, number>
  selectedScopeId: string | null
  onScopeChange: (scopeId: string) => void
}

export function ModelAccessScopeRail({
  scopes,
  modelCounts,
  selectedScopeId,
  onScopeChange,
}: ModelAccessScopeRailProps) {
  const { t } = useTranslation()

  return (
    <div className='flex flex-col gap-2.5'>
      <div className='text-muted-foreground px-1 text-xs font-medium tracking-wide uppercase'>
        {t('Access groups')}
      </div>
      <RadioGroup
        value={selectedScopeId ?? undefined}
        aria-label={t('Access groups')}
        onValueChange={onScopeChange}
      >
        {scopes.map((scope, index) => {
          const selected = scope.id === selectedScopeId
          const inputId = `model-access-scope-${index}`
          return (
            <Card
              key={scope.id}
              size='sm'
              className={cn(selected && 'ring-primary/60 ring-2')}
            >
              <Label
                htmlFor={inputId}
                className='flex cursor-pointer flex-col gap-3 text-left'
              >
                <CardHeader className='w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-3'>
                  <CardTitle className='min-w-0 [overflow-wrap:anywhere] break-words whitespace-normal'>
                    {scope.label}
                  </CardTitle>
                  <CardAction className='shrink-0'>
                    <RadioGroupItem
                      id={inputId}
                      value={scope.id}
                      aria-label={scope.label}
                    />
                  </CardAction>
                </CardHeader>
                <CardContent className='flex flex-col gap-2'>
                  {scope.description && (
                    <p className='text-muted-foreground line-clamp-2 text-xs'>
                      {scope.description}
                    </p>
                  )}
                  <div className='flex flex-wrap gap-1.5'>
                    <Badge variant='secondary'>
                      {t('{{count}} models available', {
                        count: modelCounts.get(scope.id) ?? 0,
                      })}
                    </Badge>
                    {scope.ratio !== null && (
                      <Badge variant='outline'>
                        {t('Group default ratio {{ratio}}×', {
                          ratio: scope.ratio,
                        })}
                      </Badge>
                    )}
                  </div>
                  {scope.ratio !== null && (
                    <p className='text-muted-foreground text-xs'>
                      {t('Applies to models without an exclusive ratio.')}
                    </p>
                  )}
                </CardContent>
              </Label>
              <CardFooter>
                <Button
                  size='sm'
                  variant='ghost'
                  className='w-full justify-between'
                  render={
                    <Link to='/keys' search={getCreateKeySearch(scope.id)} />
                  }
                >
                  {t('Use this group to create an API key')}
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    strokeWidth={2}
                    data-icon='inline-end'
                    aria-hidden='true'
                  />
                </Button>
              </CardFooter>
            </Card>
          )
        })}
      </RadioGroup>
    </div>
  )
}
