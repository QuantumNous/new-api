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
import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { resolveModelRatioContext } from '../lib/model-access'
import {
  ALL_MODEL_VENDORS,
  createModelVendorFilterState,
  filterModelAccessModels,
  getCreateKeySearch,
  getModelAccessScopeModelCounts,
  getModelAccessScopeModels,
  getModelAccessUnavailableScopeModels,
  getModelVendorFilters,
  isFixedModelAccessView,
  reconcileModelVendorFilterState,
  resolveModelAccessScope,
  UNLABELLED_MODEL_VENDOR,
  type ModelVendorFilter,
} from '../lib/model-access-browser'
import type { UserModelAccess } from '../types'
import { ModelAccessList } from './model-access-list'
import { ModelAccessScopeRail } from './model-access-scope-rail'

type ModelAccessBrowserProps = {
  access: UserModelAccess
}

export function ModelAccessBrowser({ access }: ModelAccessBrowserProps) {
  const { t } = useTranslation()
  const fixedView = isFixedModelAccessView(access)
  const [selectedScopeId, setSelectedScopeId] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const activeScopeId = resolveModelAccessScope(access, selectedScopeId)
  const ratioContext = resolveModelRatioContext(access, activeScopeId)

  const scopeModels = useMemo(
    () => getModelAccessScopeModels(access, activeScopeId),
    [access, activeScopeId]
  )
  const unavailableScopeModels = useMemo(
    () => getModelAccessUnavailableScopeModels(access, activeScopeId),
    [access, activeScopeId]
  )
  const vendorFilters = useMemo(
    () => getModelVendorFilters([...scopeModels, ...unavailableScopeModels]),
    [scopeModels, unavailableScopeModels]
  )
  const [vendorState, setVendorState] = useState(() =>
    createModelVendorFilterState(vendorFilters, activeScopeId)
  )
  const scopeModelCounts = useMemo(
    () => getModelAccessScopeModelCounts(access),
    [access]
  )

  const reconciledVendorState = reconcileModelVendorFilterState(
    vendorFilters,
    activeScopeId,
    vendorState
  )
  if (reconciledVendorState !== vendorState) {
    setVendorState(reconciledVendorState)
  }
  const activeVendor = reconciledVendorState.value

  const visibleModels = useMemo(
    () => filterModelAccessModels(scopeModels, query, activeVendor),
    [activeVendor, query, scopeModels]
  )
  const visibleUnavailableModels = useMemo(
    () => filterModelAccessModels(unavailableScopeModels, query, activeVendor),
    [activeVendor, query, unavailableScopeModels]
  )
  const selectedScope = access.groups.find(
    (scope) => scope.id === activeScopeId
  )
  const description = fixedView
    ? t('View models and compatible endpoints available to your account.')
    : t('View models supported by each access group and compatible endpoint.')

  const clearFilters = () => {
    setQuery('')
    setVendorState(createModelVendorFilterState(vendorFilters, activeScopeId))
  }

  const handleScopeChange = (scopeId: string) => {
    setSelectedScopeId(scopeId)
  }

  const catalog = (
    <div className='flex min-w-0 flex-col gap-3'>
      {fixedView && (
        <Card size='sm'>
          <CardHeader>
            <CardTitle>{t('Current account scope')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-muted-foreground text-sm' aria-live='polite'>
              {t('{{count}} models available', { count: scopeModels.length })}
            </p>
          </CardContent>
          <CardFooter>
            <Button
              size='sm'
              className='w-full justify-between sm:w-auto'
              render={<Link to='/keys' search={getCreateKeySearch()} />}
            >
              {t('Create API Key')}
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                strokeWidth={2}
                data-icon='inline-end'
                aria-hidden='true'
              />
            </Button>
          </CardFooter>
        </Card>
      )}

      {!fixedView && (
        <div className='flex flex-col gap-2 lg:hidden'>
          <NativeSelect
            className='w-full'
            value={activeScopeId ?? ''}
            aria-label={t('Access groups')}
            onChange={(event) => handleScopeChange(event.target.value)}
          >
            {access.groups.map((scope) => (
              <NativeSelectOption key={scope.id} value={scope.id}>
                {scope.label} ·{' '}
                {t('{{count}} models available', {
                  count: scopeModelCounts.get(scope.id) ?? 0,
                })}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {selectedScope && (
            <Card size='sm'>
              <CardHeader>
                <CardTitle>{selectedScope.label}</CardTitle>
              </CardHeader>
              <CardContent className='flex flex-col gap-2'>
                {selectedScope.description && (
                  <p className='text-muted-foreground text-xs'>
                    {selectedScope.description}
                  </p>
                )}
                <div className='flex flex-wrap gap-1.5'>
                  <Badge variant='secondary'>
                    {t('{{count}} models available', {
                      count: scopeModelCounts.get(selectedScope.id) ?? 0,
                    })}
                  </Badge>
                  {selectedScope.ratio !== null && (
                    <Badge variant='outline'>
                      {t('Group default ratio {{ratio}}×', {
                        ratio: selectedScope.ratio,
                      })}
                    </Badge>
                  )}
                </div>
                {selectedScope.ratio !== null && (
                  <p className='text-muted-foreground text-xs'>
                    {t('Applies to models without an exclusive ratio.')}
                  </p>
                )}
              </CardContent>
              <CardFooter>
                <Button
                  size='sm'
                  variant='outline'
                  className='w-full justify-between'
                  render={
                    <Link
                      to='/keys'
                      search={getCreateKeySearch(selectedScope.id)}
                    />
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
          )}
        </div>
      )}

      <div className='bg-card flex flex-col gap-2.5 rounded-xl border p-3 sm:p-4'>
        <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
          <div className='min-w-0'>
            {!fixedView && (
              <h3 className='truncate text-sm font-semibold'>
                {selectedScope?.label}
              </h3>
            )}
            <p className='text-muted-foreground text-xs' aria-live='polite'>
              {t('{{count}} models available', {
                count: `${visibleModels.length} / ${scopeModels.length}`,
              })}
            </p>
          </div>
          <Input
            className='w-full sm:w-64'
            value={query}
            aria-label={t('Search models')}
            placeholder={t('Search models')}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className='flex flex-col gap-1.5'>
          <span className='text-muted-foreground text-xs font-medium'>
            {t('Model vendors')}
          </span>
          <div className='overflow-x-auto pb-0.5'>
            <ToggleGroup
              value={[activeVendor]}
              variant='outline'
              size='sm'
              aria-label={t('Model vendors')}
              onValueChange={(values) => {
                if (values[0]) {
                  setVendorState(
                    createModelVendorFilterState(
                      vendorFilters,
                      activeScopeId,
                      values[0] as ModelVendorFilter
                    )
                  )
                }
              }}
            >
              {vendorFilters.map((option) => (
                <ToggleGroupItem key={option.value} value={option.value}>
                  {option.value === ALL_MODEL_VENDORS
                    ? t('All')
                    : option.value === UNLABELLED_MODEL_VENDOR
                      ? t('Unlabelled vendor')
                      : option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>
      </div>

      <ModelAccessList
        defaultRatio={ratioContext.defaultRatio}
        modelRatios={ratioContext.modelRatios}
        models={visibleModels}
        scopeIsEmpty={scopeModels.length === 0}
        onClearFilters={clearFilters}
      />

      {unavailableScopeModels.length > 0 && (
        <section className='flex flex-col gap-2.5'>
          <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
            <div className='min-w-0'>
              <h3 className='text-sm font-semibold'>
                {t('Unavailable models')}
              </h3>
              <p className='text-muted-foreground text-xs'>
                {t(
                  'These models cannot be called because upstreams no longer support them.'
                )}
              </p>
            </div>
            <Badge variant='destructive' className='shrink-0'>
              {t('{{count}} unavailable models', {
                count: unavailableScopeModels.length,
              })}
            </Badge>
          </div>
          <ModelAccessList
            defaultRatio={ratioContext.defaultRatio}
            modelRatios={ratioContext.modelRatios}
            models={visibleUnavailableModels}
            scopeIsEmpty={false}
            onClearFilters={clearFilters}
          />
        </section>
      )}
    </div>
  )

  return (
    <div className='mx-auto flex w-full max-w-7xl flex-col gap-4'>
      <p className='text-muted-foreground max-w-3xl text-sm'>{description}</p>
      {fixedView ? (
        catalog
      ) : (
        <div className='grid min-w-0 gap-4 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start'>
          <aside className='hover-scrollbar hidden lg:sticky lg:top-4 lg:block lg:max-h-[calc(100dvh-2rem)] lg:self-start lg:overflow-y-auto lg:overscroll-contain lg:pr-2'>
            <ModelAccessScopeRail
              scopes={access.groups}
              modelCounts={scopeModelCounts}
              selectedScopeId={activeScopeId}
              onScopeChange={handleScopeChange}
            />
          </aside>
          {catalog}
        </div>
      )}
    </div>
  )
}
