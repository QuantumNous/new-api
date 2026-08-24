/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or (at your
option) any later version.
*/
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  filterAndSortModels,
  formatInteger,
  formatMetric,
  formatPercent,
} from '../lib'
import type {
  ModelHealthFilter,
  ModelHealthModel,
  ModelHealthSortKey,
  SortDirection,
} from '../types'
import { HealthBadge } from './health-badge'

const COLUMNS: Array<{ key: ModelHealthSortKey; label: string }> = [
  { key: 'health', label: 'Health status' },
  { key: 'model_name', label: 'Model' },
  { key: 'request_count', label: 'Final requests' },
  { key: 'success_rate', label: 'Observed success' },
  { key: 'avg_ttft_ms', label: 'Average TTFT' },
  { key: 'avg_latency_ms', label: 'Average duration' },
  { key: 'avg_tps', label: 'TPS' },
]

function SortableHead(props: {
  label: string
  column: ModelHealthSortKey
  sortKey: ModelHealthSortKey
  direction: SortDirection
  onSort: (key: ModelHealthSortKey) => void
}) {
  const { t } = useTranslation()
  const active = props.column === props.sortKey

  const ariaSort = () => {
    if (!active) return 'none' as const
    if (props.direction === 'asc') return 'ascending' as const
    return 'descending' as const
  }

  return (
    <TableHead aria-sort={ariaSort()}>
      <Button
        size='xs'
        variant='ghost'
        aria-label={t('Sort by {{column}}', { column: t(props.label) })}
        onClick={() => props.onSort(props.column)}
      >
        {t(props.label)}
        {active && (
          <span aria-hidden='true'>
            {props.direction === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </Button>
    </TableHead>
  )
}

export function FleetTable(props: {
  models: ModelHealthModel[]
  onSelectModel: (model: string) => void
}) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ModelHealthFilter>('all')
  const [sortKey, setSortKey] = useState<ModelHealthSortKey>('health')
  const [direction, setDirection] = useState<SortDirection>('asc')
  const filterItems = [
    { value: 'all', label: t('All states') },
    { value: 'degraded', label: t('Degraded') },
    { value: 'watch', label: t('Watch') },
    { value: 'insufficient', label: t('Insufficient data') },
    { value: 'healthy', label: t('Healthy') },
  ]
  const visibleModels = useMemo(
    () =>
      filterAndSortModels({
        models: props.models,
        search,
        filter,
        sortKey,
        direction,
      }),
    [direction, filter, props.models, search, sortKey]
  )

  const handleSort = (key: ModelHealthSortKey) => {
    if (key === sortKey) {
      setDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setDirection(key === 'health' || key === 'model_name' ? 'asc' : 'desc')
  }

  return (
    <section className='bg-card overflow-hidden rounded-xl border shadow-xs'>
      <div className='flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-end sm:justify-between'>
        <Field className='sm:max-w-sm'>
          <FieldLabel className='sr-only' htmlFor='model-health-search'>
            {t('Search models')}
          </FieldLabel>
          <Input
            id='model-health-search'
            value={search}
            placeholder={t('Search models')}
            onChange={(event) => setSearch(event.target.value)}
          />
        </Field>
        <Field className='sm:w-48'>
          <FieldLabel className='sr-only' htmlFor='model-health-state'>
            {t('Filter by health state')}
          </FieldLabel>
          <Select
            items={filterItems}
            value={filter}
            onValueChange={(value) =>
              value !== null && setFilter(value as ModelHealthFilter)
            }
          >
            <SelectTrigger id='model-health-state' className='w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                {filterItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </div>

      {visibleModels.length === 0 ? (
        <Empty className='py-10'>
          <EmptyHeader>
            <EmptyTitle>{t('No models match the current filters')}</EmptyTitle>
            <EmptyDescription>
              {t(
                'Adjust the search or health-state filter to see more models.'
              )}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table className='min-w-[58rem]'>
          <TableHeader>
            <TableRow>
              {COLUMNS.map((column) => (
                <SortableHead
                  key={column.key}
                  label={column.label}
                  column={column.key}
                  sortKey={sortKey}
                  direction={direction}
                  onSort={handleSort}
                />
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleModels.map((model) => (
              <TableRow
                key={model.model_name}
                className='cursor-pointer'
                onClick={() => props.onSelectModel(model.model_name)}
              >
                <TableCell>
                  <HealthBadge state={model.health} />
                </TableCell>
                <TableCell>
                  <Button
                    size='sm'
                    variant='link'
                    className='max-w-72 justify-start px-0'
                    aria-label={t('Open health details for {{model}}', {
                      model: model.model_name,
                    })}
                    onClick={(event) => {
                      event.stopPropagation()
                      props.onSelectModel(model.model_name)
                    }}
                  >
                    <span className='truncate font-mono'>
                      {model.model_name}
                    </span>
                  </Button>
                </TableCell>
                <TableCell>{formatInteger(model.request_count)}</TableCell>
                <TableCell>
                  {t('{{value}}%', {
                    value: formatPercent(model.success_rate),
                  })}
                </TableCell>
                <TableCell>
                  {model.avg_ttft_ms === null
                    ? '—'
                    : t('{{value}} ms', {
                        value: formatMetric(model.avg_ttft_ms),
                      })}
                </TableCell>
                <TableCell>
                  {t('{{value}} ms', {
                    value: formatMetric(model.avg_latency_ms),
                  })}
                </TableCell>
                <TableCell>{formatMetric(model.avg_tps, 2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
