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
  ArrowDown01Icon,
  ArrowUp01Icon,
  Delete02Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMemo } from 'react'
import type { UseFormReturn } from 'react-hook-form'

import { MultiSelect } from '@/components/multi-select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import {
  MAX_AUTO_UPDATE_INTERVAL_MINUTES,
  MAX_SMART_SCHEDULE_MIN_SAMPLES,
  type ChannelMonitorSettingsFormValues,
} from '../lib/schema'

const SCHEDULE_STRATEGY_OPTIONS = [
  {
    value: 'smart',
    label: '智能调度',
    description: '综合成本倍率、首字和 TPS',
  },
  {
    value: 'ratio',
    label: '按成本倍率',
    description: '倍率越低，调度得分越高',
  },
  {
    value: 'first_token',
    label: '按首字',
    description: '平均首字时间越低，调度得分越高',
  },
  {
    value: 'tps',
    label: '按 TPS',
    description: '平均 TPS 越高，调度得分越高',
  },
] as const

const APPLY_MODE_OPTIONS = [
  {
    value: 'weight',
    label: '只调整权重',
    description: '保留现有优先级，只在同优先级内调整流量',
  },
  {
    value: 'priority_weight',
    label: '优先级分层 + 权重',
    description: '按得分分为 100、90、80 三档，再调整权重',
  },
] as const

const PERFORMANCE_RANGE_OPTIONS = [
  { value: '15', label: '近 15 分钟' },
  { value: '60', label: '近 1 小时' },
  { value: '360', label: '近 6 小时' },
  { value: '1440', label: '近 24 小时' },
]

type ChannelMonitorSmartScheduleFieldsProps = {
  form: UseFormReturn<ChannelMonitorSettingsFormValues>
  modelOptions: string[]
}

function reorderSmartScheduleModels(
  models: string[],
  sourceIndex: number,
  offset: -1 | 1
) {
  const targetIndex = sourceIndex + offset
  if (targetIndex < 0 || targetIndex >= models.length) return models
  const nextModels = [...models]
  const [modelName] = nextModels.splice(sourceIndex, 1)
  if (modelName === undefined) return models
  nextModels.splice(targetIndex, 0, modelName)
  return nextModels
}

export function ChannelMonitorSmartScheduleFields(
  props: ChannelMonitorSmartScheduleFieldsProps
) {
  const modelOptions = useMemo(
    () => props.modelOptions.map((model) => ({ value: model, label: model })),
    [props.modelOptions]
  )

  return (
    <div className='flex flex-col gap-5'>
      <FormField
        control={props.form.control}
        name='smartScheduleEnabled'
        render={({ field }) => (
          <FormItem className='flex items-center justify-between gap-4'>
            <div className='flex flex-col gap-1'>
              <FormLabel>智能调度</FormLabel>
              <FormDescription>
                定时按照统一调度方式调整参与渠道的优先级、权重
              </FormDescription>
            </div>
            <FormControl>
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
                aria-label='开启智能调度'
              />
            </FormControl>
          </FormItem>
        )}
      />

      <FormField
        control={props.form.control}
        name='smartScheduleStrategy'
        render={({ field }) => (
          <FormItem>
            <FormLabel>调度方式</FormLabel>
            <Select
              items={SCHEDULE_STRATEGY_OPTIONS}
              value={field.value}
              onValueChange={(value) => value !== null && field.onChange(value)}
            >
              <FormControl>
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent alignItemWithTrigger={false}>
                <SelectGroup>
                  {SCHEDULE_STRATEGY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FormDescription>
              {
                SCHEDULE_STRATEGY_OPTIONS.find(
                  (option) => option.value === field.value
                )?.description
              }
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={props.form.control}
        name='smartScheduleStabilityEnabled'
        render={({ field }) => (
          <FormItem className='flex items-center justify-between gap-4'>
            <div className='flex flex-col gap-1'>
              <FormLabel>按稳定性</FormLabel>
              <FormDescription>成功率越高，调度得分越高</FormDescription>
            </div>
            <FormControl>
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
                aria-label='按稳定性'
              />
            </FormControl>
          </FormItem>
        )}
      />

      <FormField
        control={props.form.control}
        name='smartScheduleIntervalMinutes'
        render={({ field }) => (
          <FormItem>
            <FormLabel>调度间隔</FormLabel>
            <FormControl>
              <InputGroup>
                <InputGroupInput
                  type='number'
                  min={1}
                  max={MAX_AUTO_UPDATE_INTERVAL_MINUTES}
                  step={1}
                  inputMode='numeric'
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                  name={field.name}
                  ref={field.ref}
                  aria-invalid={Boolean(
                    props.form.formState.errors.smartScheduleIntervalMinutes
                  )}
                />
                <InputGroupAddon align='inline-end'>分钟</InputGroupAddon>
              </InputGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={props.form.control}
        name='smartScheduleApplyMode'
        render={({ field }) => (
          <FormItem>
            <FormLabel>调整方式</FormLabel>
            <Select
              items={APPLY_MODE_OPTIONS}
              value={field.value}
              onValueChange={(value) => value !== null && field.onChange(value)}
            >
              <FormControl>
                <SelectTrigger className='w-full'>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent alignItemWithTrigger={false}>
                <SelectGroup>
                  {APPLY_MODE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FormDescription>
              {
                APPLY_MODE_OPTIONS.find(
                  (option) => option.value === field.value
                )?.description
              }
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={props.form.control}
        name='smartScheduleForceReset'
        render={({ field }) => (
          <FormItem className='flex items-start gap-3 rounded-lg border p-3'>
            <FormControl>
              <Checkbox
                id='channel-monitor-force-smart-schedule-reset'
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                aria-label='强制重置优先级和权重'
              />
            </FormControl>
            <div className='flex flex-col gap-1'>
              <FormLabel htmlFor='channel-monitor-force-smart-schedule-reset'>
                强制重置优先级和权重
              </FormLabel>
              <FormDescription>
                保存后，根据当前日志重新计算所有符合条件的参与渠道，并立即应用优先级和权重。此操作仅执行一次。
              </FormDescription>
            </div>
          </FormItem>
        )}
      />

      <div className='grid gap-4 sm:grid-cols-2'>
        <FormField
          control={props.form.control}
          name='smartSchedulePerformanceMinutes'
          render={({ field }) => (
            <FormItem>
              <FormLabel>统计范围</FormLabel>
              <Select
                items={PERFORMANCE_RANGE_OPTIONS}
                value={String(field.value)}
                onValueChange={(value) => {
                  if (value !== null) field.onChange(Number(value))
                }}
              >
                <FormControl>
                  <SelectTrigger className='w-full'>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    {PERFORMANCE_RANGE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={props.form.control}
          name='smartScheduleMinSamples'
          render={({ field }) => (
            <FormItem>
              <FormLabel>最少样本</FormLabel>
              <FormControl>
                <InputGroup>
                  <InputGroupInput
                    type='number'
                    min={1}
                    max={MAX_SMART_SCHEDULE_MIN_SAMPLES}
                    step={1}
                    inputMode='numeric'
                    value={field.value}
                    onBlur={field.onBlur}
                    onChange={field.onChange}
                    name={field.name}
                    ref={field.ref}
                    aria-invalid={Boolean(
                      props.form.formState.errors.smartScheduleMinSamples
                    )}
                  />
                  <InputGroupAddon align='inline-end'>次</InputGroupAddon>
                </InputGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={props.form.control}
        name='smartScheduleModels'
        render={({ field }) => (
          <FormItem className='min-w-0'>
            <FormLabel>基准模型优先级</FormLabel>
            <FormControl>
              <MultiSelect
                options={modelOptions}
                selected={field.value}
                onChange={field.onChange}
                placeholder='搜索并选择基准模型'
                emptyText='没有匹配的模型'
                maxVisibleChips={4}
              />
            </FormControl>
            <FormDescription>
              每个渠道按下列顺序使用其支持的第一个模型；未选择时汇总全部模型
            </FormDescription>
            {field.value.length > 0 && (
              <ol className='divide-border overflow-hidden rounded-md border'>
                {field.value.map((modelName, index) => (
                  <li
                    key={modelName}
                    className='flex min-w-0 items-center gap-2 border-b p-2 last:border-b-0'
                  >
                    <span className='bg-muted text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-sm text-xs font-medium tabular-nums'>
                      {index + 1}
                    </span>
                    <span
                      className='min-w-0 flex-1 truncate text-sm'
                      title={modelName}
                    >
                      {modelName}
                    </span>
                    <div className='flex shrink-0 items-center gap-1'>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              type='button'
                              variant='ghost'
                              size='icon-sm'
                              disabled={index === 0}
                              onClick={() =>
                                field.onChange(
                                  reorderSmartScheduleModels(
                                    field.value,
                                    index,
                                    -1
                                  )
                                )
                              }
                              aria-label={`上移模型 ${modelName}`}
                            >
                              <HugeiconsIcon icon={ArrowUp01Icon} />
                            </Button>
                          }
                        />
                        <TooltipContent>上移</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              type='button'
                              variant='ghost'
                              size='icon-sm'
                              disabled={index === field.value.length - 1}
                              onClick={() =>
                                field.onChange(
                                  reorderSmartScheduleModels(
                                    field.value,
                                    index,
                                    1
                                  )
                                )
                              }
                              aria-label={`下移模型 ${modelName}`}
                            >
                              <HugeiconsIcon icon={ArrowDown01Icon} />
                            </Button>
                          }
                        />
                        <TooltipContent>下移</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              type='button'
                              variant='ghost'
                              size='icon-sm'
                              onClick={() =>
                                field.onChange(
                                  field.value.filter(
                                    (_, modelIndex) => modelIndex !== index
                                  )
                                )
                              }
                              aria-label={`移除模型 ${modelName}`}
                            >
                              <HugeiconsIcon icon={Delete02Icon} />
                            </Button>
                          }
                        />
                        <TooltipContent>移除</TooltipContent>
                      </Tooltip>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <FormMessage />
          </FormItem>
        )}
      />

      <Alert>
        <AlertTitle>调度规则</AlertTitle>
        <AlertDescription>
          启用的调度指标等权计算；开启按稳定性后，还要求稳定性达到最少样本。关闭总开关后保留当前优先级和权重。稳定性按成功调用数
          ÷（成功调用数 +
          渠道错误数）计算，重试中的渠道错误也会计入；需要同时开启消费日志和
          ERROR_LOG_ENABLED。
        </AlertDescription>
      </Alert>
    </div>
  )
}
