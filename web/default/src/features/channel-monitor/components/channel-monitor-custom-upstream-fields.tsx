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
import { useWatch, type UseFormReturn } from 'react-hook-form'

import { FieldLegend, FieldSet } from '@/components/ui/field'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

import {
  MAX_CUSTOM_UPSTREAM_BALANCE,
  type UpstreamConfigFormValues,
} from '../lib/schema'
import { ChannelMonitorCustomKeyValueEditor } from './channel-monitor-custom-key-value-editor'

type CustomMetricName = 'ratio' | 'balance'

type ChannelMonitorCustomUpstreamFieldsProps = {
  form: UseFormReturn<UpstreamConfigFormValues>
}

type CustomMetricFieldsProps = ChannelMonitorCustomUpstreamFieldsProps & {
  metric: CustomMetricName
  reuseRequest: boolean
}

type CustomRequestFieldsProps = ChannelMonitorCustomUpstreamFieldsProps & {
  metric: CustomMetricName
  showRequest: boolean
}

function CustomRequestFields(props: CustomRequestFieldsProps) {
  const prefix = `customConfig.${props.metric}` as const
  const method = useWatch({
    control: props.form.control,
    name: `${prefix}.request.method`,
  })
  const bodyType = useWatch({
    control: props.form.control,
    name: `${prefix}.request.bodyType`,
  })
  const responseType = useWatch({
    control: props.form.control,
    name: `${prefix}.result.responseType`,
  })
  const bodySecret = useWatch({
    control: props.form.control,
    name: `${prefix}.request.bodySecret`,
  })
  const hasBody = props.form.getValues(`${prefix}.request.hasBody`)

  return (
    <div className='flex min-w-0 flex-col gap-4'>
      {props.showRequest ? (
        <>
          <div className='grid min-w-0 gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]'>
            <FormField
              control={props.form.control}
              name={`${prefix}.request.method`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>请求方式</FormLabel>
                  <FormControl>
                    <ToggleGroup
                      value={[field.value]}
                      onValueChange={(values) => {
                        const value = values.find(
                          (item) => item !== field.value
                        )
                        if (value !== 'GET' && value !== 'POST') return
                        field.onChange(value)
                        if (value === 'GET') {
                          props.form.setValue(
                            `${prefix}.request.bodyType`,
                            'none',
                            { shouldValidate: true }
                          )
                        }
                      }}
                      variant='outline'
                      spacing={2}
                      className='grid w-full grid-cols-2'
                    >
                      <ToggleGroupItem value='GET' className='w-full'>
                        GET
                      </ToggleGroupItem>
                      <ToggleGroupItem value='POST' className='w-full'>
                        POST
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={props.form.control}
              name={`${prefix}.request.path`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>接口路径</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='/api/account'
                      value={field.value}
                      onBlur={field.onBlur}
                      onChange={field.onChange}
                      name={field.name}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <ChannelMonitorCustomKeyValueEditor
            form={props.form}
            name={`${prefix}.request.query`}
            label='查询参数'
          />
          <ChannelMonitorCustomKeyValueEditor
            form={props.form}
            name={`${prefix}.request.headers`}
            label='请求头'
          />

          {method === 'POST' ? (
            <>
              <FormField
                control={props.form.control}
                name={`${prefix}.request.bodyType`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>请求体</FormLabel>
                    <FormControl>
                      <ToggleGroup
                        value={[field.value]}
                        onValueChange={(values) => {
                          const value = values.find(
                            (item) => item !== field.value
                          )
                          if (
                            value !== 'none' &&
                            value !== 'json' &&
                            value !== 'form'
                          ) {
                            return
                          }
                          field.onChange(value)
                        }}
                        variant='outline'
                        spacing={2}
                        className='grid w-full grid-cols-3'
                      >
                        <ToggleGroupItem value='none' className='w-full'>
                          无
                        </ToggleGroupItem>
                        <ToggleGroupItem value='json' className='w-full'>
                          JSON
                        </ToggleGroupItem>
                        <ToggleGroupItem value='form' className='w-full'>
                          表单
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {bodyType === 'json' ? (
                <div className='flex min-w-0 flex-col gap-2'>
                  <FormField
                    control={props.form.control}
                    name={`${prefix}.request.body`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>JSON 内容</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={5}
                            className='font-mono text-xs'
                            placeholder={
                              bodySecret && hasBody
                                ? '已配置，留空保持不变'
                                : '{\n  "group": "vip"\n}'
                            }
                            value={field.value}
                            onBlur={field.onBlur}
                            onChange={field.onChange}
                            name={field.name}
                            ref={field.ref}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={props.form.control}
                    name={`${prefix}.request.bodySecret`}
                    render={({ field }) => (
                      <FormItem className='flex items-center gap-2'>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            aria-label='将 JSON 请求体作为敏感信息保存'
                          />
                        </FormControl>
                        <FormLabel className='font-normal'>
                          敏感请求体
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
              ) : null}
              {bodyType === 'form' ? (
                <ChannelMonitorCustomKeyValueEditor
                  form={props.form}
                  name={`${prefix}.request.form`}
                  label='表单参数'
                />
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      <div className='grid min-w-0 gap-4 sm:grid-cols-[10rem_minmax(0,1fr)_10rem]'>
        <FormField
          control={props.form.control}
          name={`${prefix}.result.responseType`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>响应格式</FormLabel>
              <FormControl>
                <ToggleGroup
                  value={[field.value]}
                  onValueChange={(values) => {
                    const value = values.find((item) => item !== field.value)
                    if (value !== 'json' && value !== 'text') return
                    field.onChange(value)
                  }}
                  variant='outline'
                  spacing={2}
                  className='grid w-full grid-cols-2'
                >
                  <ToggleGroupItem value='json' className='w-full'>
                    JSON
                  </ToggleGroupItem>
                  <ToggleGroupItem value='text' className='w-full'>
                    文本
                  </ToggleGroupItem>
                </ToggleGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={props.form.control}
          name={`${prefix}.result.valuePath`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>JSON 取值路径</FormLabel>
              <FormControl>
                <Input
                  placeholder='data.ratio'
                  disabled={responseType === 'text'}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                  name={field.name}
                  ref={field.ref}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={props.form.control}
          name={`${prefix}.result.multiplier`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>结果乘数</FormLabel>
              <FormControl>
                <InputGroup>
                  <InputGroupAddon>×</InputGroupAddon>
                  <InputGroupInput
                    type='number'
                    min={0}
                    max={1_000_000}
                    step='any'
                    inputMode='decimal'
                    value={field.value}
                    onBlur={field.onBlur}
                    onChange={field.onChange}
                    name={field.name}
                    ref={field.ref}
                  />
                </InputGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  )
}

function CustomMetricFields(props: CustomMetricFieldsProps) {
  const prefix = `customConfig.${props.metric}` as const
  const source = useWatch({
    control: props.form.control,
    name: `${prefix}.source`,
  })
  const isRatio = props.metric === 'ratio'

  return (
    <FieldSet className='min-w-0 rounded-md border p-4'>
      <FieldLegend variant='label' className='px-1'>
        {isRatio ? '上游倍率来源' : '上游余额来源'}
      </FieldLegend>
      <FormField
        control={props.form.control}
        name={`${prefix}.source`}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <ToggleGroup
                value={[field.value]}
                onValueChange={(values) => {
                  const value = values.find((item) => item !== field.value)
                  if (value !== 'fixed' && value !== 'http') return
                  field.onChange(value)
                  if (value === 'fixed') {
                    props.form.setValue(
                      'customConfig.balanceReuseRatioRequest',
                      false,
                      { shouldValidate: true }
                    )
                  }
                }}
                variant='outline'
                spacing={2}
                className='grid w-full grid-cols-2'
              >
                <ToggleGroupItem value='fixed' className='w-full'>
                  固定输入
                </ToggleGroupItem>
                <ToggleGroupItem value='http' className='w-full'>
                  接口查询
                </ToggleGroupItem>
              </ToggleGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {source === 'fixed' ? (
        <FormField
          control={props.form.control}
          name={`${prefix}.fixedValue`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{isRatio ? '固定倍率' : '固定余额'}</FormLabel>
              <FormControl>
                <Input
                  type='number'
                  min={isRatio ? 0 : -MAX_CUSTOM_UPSTREAM_BALANCE}
                  max={isRatio ? 1_000_000 : MAX_CUSTOM_UPSTREAM_BALANCE}
                  step='any'
                  inputMode='decimal'
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                  name={field.name}
                  ref={field.ref}
                />
              </FormControl>
              <FormDescription>保存后立即写入渠道监控。</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      ) : (
        <CustomRequestFields
          form={props.form}
          metric={props.metric}
          showRequest={!props.reuseRequest}
        />
      )}
    </FieldSet>
  )
}

export function ChannelMonitorCustomUpstreamFields(
  props: ChannelMonitorCustomUpstreamFieldsProps
) {
  const ratioSource = useWatch({
    control: props.form.control,
    name: 'customConfig.ratio.source',
  })
  const balanceSource = useWatch({
    control: props.form.control,
    name: 'customConfig.balance.source',
  })
  const reuseRequest = useWatch({
    control: props.form.control,
    name: 'customConfig.balanceReuseRatioRequest',
  })
  const canReuseRequest = ratioSource === 'http' && balanceSource === 'http'

  return (
    <div className='flex min-w-0 flex-col gap-4'>
      <CustomMetricFields
        form={props.form}
        metric='ratio'
        reuseRequest={false}
      />
      {canReuseRequest ? (
        <FormField
          control={props.form.control}
          name='customConfig.balanceReuseRatioRequest'
          render={({ field }) => (
            <FormItem className='flex items-center justify-between gap-4 rounded-md border px-4 py-3'>
              <div className='flex min-w-0 flex-col gap-1'>
                <FormLabel>余额复用倍率接口</FormLabel>
                <FormDescription>
                  只发送一次请求，余额使用独立的取值路径和结果乘数。
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  aria-label='余额复用倍率接口'
                />
              </FormControl>
            </FormItem>
          )}
        />
      ) : null}
      <CustomMetricFields
        form={props.form}
        metric='balance'
        reuseRequest={reuseRequest && canReuseRequest}
      />
    </div>
  )
}
