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
import { zodResolver } from '@hookform/resolvers/zod'
import {
  ClipboardPasteIcon,
  Copy01Icon,
  LinkSquare01Icon,
  Refresh01Icon,
  TestTubeIcon,
  Tick02Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import { toast } from 'sonner'

import { PasswordInput } from '@/components/password-input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'

import {
  applyChannelMonitorUpstreamGroup,
  fetchChannelMonitorSub2APIUpstreamVersion,
  listChannelMonitorUpstreamGroups,
  saveChannelMonitorUpstreamConfig,
  testChannelMonitorUpstreamConfig,
} from '../api'
import { formatMonitorRatio } from '../lib/format'
import {
  createUpstreamConfigSchema,
  MAX_BALANCE_WARNING_THRESHOLD,
  type UpstreamConfigFormValues,
} from '../lib/schema'
import type {
  ChannelMonitorItem,
  ChannelMonitorPolicyAction,
  ChannelMonitorUpstreamGroup,
  ChannelMonitorUpstreamRequest,
  NewAPIGroupRatioResult,
} from '../types'

type UpstreamConfigDialogProps = {
  channel: ChannelMonitorItem
  open: boolean
  onOpenChange: (open: boolean) => void
}

const SINGLE_CHANNEL_ACTION_OPTIONS = [
  { value: 'none', label: '仅记录' },
  { value: 'update_group_ratio', label: '更新分组倍率' },
  { value: 'disable_channel', label: '禁用此渠道' },
] satisfies Array<{ value: ChannelMonitorPolicyAction; label: string }>

const MULTIPLE_CHANNELS_ACTION_OPTIONS = [
  { value: 'none', label: '仅记录' },
  { value: 'update_group_ratio', label: '参与更新分组倍率' },
  { value: 'disable_channel', label: '禁用此渠道' },
] satisfies Array<{ value: ChannelMonitorPolicyAction; label: string }>

const SUB2API_ACCESS_TOKEN_COMMAND =
  "copy(localStorage.getItem('auth_token') || '')"

function createUpstreamRequest(
  values: UpstreamConfigFormValues
): ChannelMonitorUpstreamRequest {
  const userAuthentication =
    values.upstreamType === 'new_api' && values.authType === 'user'
  const sub2APITokenAuthentication =
    values.upstreamType === 'sub2api' && values.authType === 'token'
  return {
    type: values.upstreamType,
    base_url: values.baseUrl.trim(),
    group: values.group.trim(),
    auth_type: values.authType,
    user_id: userAuthentication ? values.userId : 0,
    access_token:
      userAuthentication || sub2APITokenAuthentication
        ? values.accessToken.trim()
        : '',
    single_channel_action: values.singleChannelAction,
    multiple_channels_action: values.multipleChannelsAction,
    balance_warning_threshold: values.balanceWarningThreshold,
    ratio_sync_enabled: values.ratioSyncEnabled,
    balance_sync_enabled: values.balanceSyncEnabled,
  }
}

export function UpstreamConfigDialog(props: UpstreamConfigDialogProps) {
  const queryClient = useQueryClient()
  const { copyToClipboard } = useCopyToClipboard({
    successMessage: '提取 Token 命令已复制',
    errorMessage: '复制提取命令失败',
  })
  const [testResult, setTestResult] = useState<NewAPIGroupRatioResult | null>(
    null
  )
  const [upstreamVersion, setUpstreamVersion] = useState<string | null>(null)
  const savedUpstream = props.channel.upstream
  const initialGroup = savedUpstream?.group || ''
  const [upstreamGroups, setUpstreamGroups] = useState<
    ChannelMonitorUpstreamGroup[]
  >([])
  const [groupInputValue, setGroupInputValue] = useState(initialGroup)
  const [groupComboboxOpen, setGroupComboboxOpen] = useState(false)
  const savedCredential: Parameters<typeof createUpstreamConfigSchema>[0] =
    savedUpstream
      ? {
          type: savedUpstream.type,
          authType: savedUpstream.auth_type,
          hasAccessToken: savedUpstream.has_access_token,
        }
      : null
  const schema = createUpstreamConfigSchema(savedCredential)
  const form = useForm<UpstreamConfigFormValues>({
    resolver: zodResolver(schema) as Resolver<UpstreamConfigFormValues>,
    defaultValues: {
      upstreamType: savedUpstream?.type || 'new_api',
      baseUrl: props.channel.upstream?.base_url || props.channel.base_url,
      group: initialGroup,
      authType: props.channel.upstream?.auth_type || 'public',
      userId: props.channel.upstream?.user_id || 0,
      accessToken: '',
      singleChannelAction: savedUpstream?.single_channel_action || 'none',
      multipleChannelsAction: savedUpstream?.multiple_channels_action || 'none',
      ratioSyncEnabled: savedUpstream?.ratio_sync_enabled ?? true,
      balanceSyncEnabled: savedUpstream?.balance_sync_enabled ?? true,
      balanceWarningThreshold: savedUpstream?.balance_warning_threshold ?? null,
    },
  })
  const upstreamType = useWatch({ control: form.control, name: 'upstreamType' })
  const baseUrl = useWatch({ control: form.control, name: 'baseUrl' })
  const authType = useWatch({ control: form.control, name: 'authType' })
  const accessToken = useWatch({ control: form.control, name: 'accessToken' })
  const ratioSyncEnabled = useWatch({
    control: form.control,
    name: 'ratioSyncEnabled',
  })
  const balanceSyncEnabled = useWatch({
    control: form.control,
    name: 'balanceSyncEnabled',
  })
  const needsUserAuthentication =
    upstreamType === 'new_api' && authType === 'user'
  const isSub2API = upstreamType === 'sub2api'
  const needsSub2APIToken = isSub2API && authType === 'token'
  const hasMatchingSavedAccessToken =
    savedCredential?.hasAccessToken === true &&
    savedCredential.type === upstreamType &&
    savedCredential.authType === authType
  const hasSub2APIToken =
    hasMatchingSavedAccessToken || accessToken.trim().length > 0
  const canApplyGroup =
    needsUserAuthentication || (needsSub2APIToken && hasSub2APIToken)
  const canLoadGroups = !isSub2API || (needsSub2APIToken && hasSub2APIToken)
  const authDescription =
    authType === 'public'
      ? '无需账号，读取公开分组倍率'
      : '读取指定用户的实际分组倍率'
  let applyGroupDescription =
    '应用分组会保存配置，并将当前渠道的全部上游令牌切换到该分组'
  if (!canApplyGroup) {
    applyGroupDescription = isSub2API
      ? '应用分组需要先填写旧版 Token'
      : '应用分组需要先选择用户认证'
  }
  let upstreamTypeDescription = '读取 New API 分组倍率'
  if (isSub2API) {
    upstreamTypeDescription =
      authType === 'api_key'
        ? '使用当前渠道 API Key 读取新版倍率和余额'
        : '使用旧版 Token 读取倍率、余额和分组'
  }
  let groupSourceDescription = '从 New API 获取可用分组，也可直接填写名称'
  if (isSub2API) {
    groupSourceDescription =
      authType === 'api_key'
        ? 'API Key 认证不提供分组列表，请直接填写分组名称或数字 ID'
        : '旧版 Token 可获取可用分组，也可直接填写分组名称或数字 ID'
  }
  const upstreamGroupByName = useMemo(
    () => new Map(upstreamGroups.map((group) => [group.name, group])),
    [upstreamGroups]
  )
  const upstreamGroupItems = useMemo(() => {
    const names = upstreamGroups.map((group) => group.name)
    const customGroup = groupInputValue.trim()
    if (customGroup && !names.includes(customGroup)) names.push(customGroup)
    return names
  }, [groupInputValue, upstreamGroups])

  const saveMutation = useMutation({
    mutationFn: saveChannelMonitorUpstreamConfig,
    onSuccess: () => {
      toast.success('上游配置已保存')
      queryClient.invalidateQueries({ queryKey: ['channel-monitor'] })
      props.onOpenChange(false)
    },
  })
  const testMutation = useMutation({
    mutationFn: testChannelMonitorUpstreamConfig,
    onSuccess: (response) => {
      setTestResult(response.data)
      toast.success('上游倍率获取成功')
    },
  })
  const versionMutation = useMutation({
    mutationFn: fetchChannelMonitorSub2APIUpstreamVersion,
    onSuccess: (response) => {
      setUpstreamVersion(response.data.version)
      toast.success(`上游版本：${response.data.version}`)
    },
  })
  const groupsMutation = useMutation({
    mutationFn: (values: UpstreamConfigFormValues) => {
      const config = createUpstreamRequest(values)
      return listChannelMonitorUpstreamGroups({
        channelId: props.channel.id,
        config,
      })
    },
    onSuccess: (response) => {
      setUpstreamGroups(response.data.groups)
      const appliedGroup = response.data.applied_group?.trim()
      if (appliedGroup) {
        form.setValue('group', appliedGroup, {
          shouldDirty: true,
          shouldValidate: true,
        })
        setGroupInputValue(appliedGroup)
      }
      toast.success(
        appliedGroup
          ? `已获取 ${response.data.groups.length} 个上游分组，并自动选中 ${appliedGroup}`
          : `已获取 ${response.data.groups.length} 个上游分组`
      )
      if (response.data.applied_group_error) {
        toast.warning(response.data.applied_group_error)
      }
    },
  })
  const applyGroupMutation = useMutation({
    mutationFn: async (values: UpstreamConfigFormValues) => {
      await saveChannelMonitorUpstreamConfig({
        channelId: props.channel.id,
        config: createUpstreamRequest(values),
      })
      try {
        const response = await applyChannelMonitorUpstreamGroup(
          props.channel.id
        )
        return { success: true as const, response }
      } catch (applyError) {
        return { success: false as const, applyError }
      }
    },
    onSuccess: (result, values) => {
      queryClient.invalidateQueries({ queryKey: ['channel-monitor'] })
      if (!result.success) {
        const errorMessage =
          result.applyError instanceof Error && result.applyError.message
            ? `：${result.applyError.message}`
            : ''
        toast.error(`上游配置已保存，但切换上游令牌分组失败${errorMessage}`)
        return
      }

      queryClient.invalidateQueries({
        queryKey: ['channel-monitor-history', props.channel.id],
      })
      toast.success(
        `已将 ${result.response.data.keys_updated} 个上游令牌切换到分组 ${values.group.trim()}，倍率 ${formatMonitorRatio(result.response.data.result.ratio)}`
      )
      props.onOpenChange(false)
    },
  })

  const requireGroup = (values: UpstreamConfigFormValues) => {
    if (values.group.trim()) return true
    form.setError('group', {
      type: 'manual',
      message: '请输入上游分组',
    })
    return false
  }

  const handleSave = form.handleSubmit((values) => {
    if (!requireGroup(values)) return
    saveMutation.mutate({
      channelId: props.channel.id,
      config: createUpstreamRequest(values),
    })
  })
  const handleTest = form.handleSubmit((values) => {
    if (!requireGroup(values)) return
    testMutation.mutate({
      channelId: props.channel.id,
      config: createUpstreamRequest(values),
    })
  })
  const handleLoadGroups = form.handleSubmit((values) => {
    groupsMutation.mutate(values)
  })
  const handleApplyGroup = form.handleSubmit((values) => {
    if (!requireGroup(values)) return
    applyGroupMutation.mutate(values)
  })
  const handleOpenSub2APILogin = () => {
    const value = form.getValues('baseUrl').trim()
    try {
      const loginUrl = new URL(value)
      if (loginUrl.protocol !== 'http:' && loginUrl.protocol !== 'https:') {
        throw new Error('invalid protocol')
      }
      let basePath = loginUrl.pathname.replace(/\/+$/, '')
      if (basePath.endsWith('/v1')) {
        basePath = basePath.slice(0, -3)
      }
      loginUrl.pathname = `${basePath}/login`
      loginUrl.search = ''
      loginUrl.hash = ''
      form.clearErrors('baseUrl')
      window.open(loginUrl.toString(), '_blank', 'noopener,noreferrer')
    } catch {
      form.setError('baseUrl', { message: '请输入有效的面板地址' })
    }
  }
  const handlePasteAccessToken = async () => {
    if (!navigator.clipboard?.readText) {
      toast.error('当前浏览器不支持读取剪贴板')
      return
    }
    try {
      const accessToken = (await navigator.clipboard.readText()).trim()
      if (!accessToken) {
        toast.error('剪贴板中没有访问令牌')
        return
      }
      form.setValue('accessToken', accessToken, {
        shouldDirty: true,
        shouldValidate: true,
      })
      toast.success('Token 已粘贴')
    } catch {
      toast.error('读取剪贴板失败，请手动粘贴')
    }
  }
  const handleFetchVersion = () => {
    const value = baseUrl.trim()
    if (!value) return
    setUpstreamVersion(null)
    versionMutation.mutate({ channelId: props.channel.id, baseUrl: value })
  }
  const pending =
    saveMutation.isPending ||
    testMutation.isPending ||
    groupsMutation.isPending ||
    applyGroupMutation.isPending ||
    versionMutation.isPending

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='flex max-h-[85dvh] flex-col overflow-hidden sm:max-w-3xl'>
        <DialogHeader className='shrink-0 pr-10'>
          <DialogTitle>上游配置与策略</DialogTitle>
          <DialogDescription>
            {props.channel.name} · ID {props.channel.id}
          </DialogDescription>
        </DialogHeader>
        <div className='min-h-0 min-w-0 flex-1 [scrollbar-gutter:stable] overflow-x-hidden overflow-y-auto overscroll-contain pr-2'>
          <Form {...form}>
            <form className='flex min-w-0 flex-col gap-5' onSubmit={handleSave}>
              <FormField
                control={form.control}
                name='upstreamType'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>上游类型</FormLabel>
                    <FormControl>
                      <ToggleGroup
                        value={[field.value]}
                        onValueChange={(values) => {
                          const nextValue = values.find(
                            (value) => value !== field.value
                          )
                          if (
                            nextValue !== 'new_api' &&
                            nextValue !== 'sub2api'
                          ) {
                            return
                          }
                          field.onChange(nextValue)
                          form.setValue(
                            'authType',
                            nextValue === 'sub2api' ? 'api_key' : 'public',
                            { shouldValidate: true }
                          )
                          form.setValue('accessToken', '')
                          setUpstreamGroups([])
                          setTestResult(null)
                          setUpstreamVersion(null)
                        }}
                        variant='outline'
                        spacing={2}
                        className='grid w-full grid-cols-2'
                      >
                        <ToggleGroupItem value='new_api' className='w-full'>
                          New API
                        </ToggleGroupItem>
                        <ToggleGroupItem value='sub2api' className='w-full'>
                          Sub2API
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </FormControl>
                    <FormDescription>{upstreamTypeDescription}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='baseUrl'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>面板地址</FormLabel>
                    <FormControl>
                      <Input
                        type='url'
                        placeholder='https://api.example.com'
                        autoComplete='url'
                        value={field.value}
                        onBlur={field.onBlur}
                        onChange={(event) => {
                          field.onChange(event)
                          setUpstreamGroups([])
                          setTestResult(null)
                          setUpstreamVersion(null)
                        }}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormDescription>
                      填写面板根地址，末尾的 /v1 会自动移除
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='group'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>上游分组</FormLabel>
                    <Combobox
                      items={upstreamGroupItems}
                      value={field.value}
                      inputValue={groupInputValue}
                      open={groupComboboxOpen}
                      onOpenChange={(open) => {
                        setGroupComboboxOpen(open)
                        setGroupInputValue(open ? '' : field.value)
                      }}
                      onInputValueChange={setGroupInputValue}
                      onValueChange={(value) => {
                        if (value === null) return
                        field.onChange(value)
                        setGroupInputValue(value)
                      }}
                    >
                      <div className='flex flex-wrap gap-2'>
                        <FormControl>
                          <ComboboxInput
                            className='min-w-0 flex-1 basis-48'
                            placeholder='选择或输入上游分组'
                            maxLength={64}
                            onBlur={() => {
                              const customGroup = groupInputValue.trim()
                              if (customGroup) {
                                field.onChange(customGroup)
                                setGroupInputValue(customGroup)
                              } else {
                                setGroupInputValue(field.value)
                              }
                              field.onBlur()
                            }}
                          />
                        </FormControl>
                        <Button
                          type='button'
                          variant='outline'
                          onClick={handleLoadGroups}
                          disabled={pending || !canLoadGroups}
                        >
                          {groupsMutation.isPending ? (
                            <Spinner data-icon='inline-start' />
                          ) : (
                            <HugeiconsIcon
                              icon={Refresh01Icon}
                              data-icon='inline-start'
                            />
                          )}
                          获取分组
                        </Button>
                        <Button
                          type='button'
                          variant='secondary'
                          onClick={handleApplyGroup}
                          disabled={pending || !canApplyGroup}
                        >
                          {applyGroupMutation.isPending ? (
                            <Spinner data-icon='inline-start' />
                          ) : (
                            <HugeiconsIcon
                              icon={Tick02Icon}
                              data-icon='inline-start'
                            />
                          )}
                          应用分组
                        </Button>
                      </div>
                      <ComboboxContent>
                        <ComboboxList>
                          <ComboboxCollection>
                            {(groupName: string) => {
                              const group = upstreamGroupByName.get(groupName)
                              return (
                                <ComboboxItem key={groupName} value={groupName}>
                                  <span className='flex min-w-0 flex-1 items-center justify-between gap-3'>
                                    <span className='truncate'>
                                      {group
                                        ? group.name
                                        : `使用“${groupName}”`}
                                    </span>
                                    {group && (
                                      <span className='text-muted-foreground shrink-0 font-mono text-xs'>
                                        × {formatMonitorRatio(group.ratio)}
                                      </span>
                                    )}
                                  </span>
                                </ComboboxItem>
                              )
                            }}
                          </ComboboxCollection>
                        </ComboboxList>
                        <ComboboxEmpty>没有可选分组，可直接输入</ComboboxEmpty>
                      </ComboboxContent>
                    </Combobox>
                    <FormDescription>
                      {groupSourceDescription}；{applyGroupDescription}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className='grid min-w-0 gap-4 sm:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='ratioSyncEnabled'
                  render={({ field }) => (
                    <FormItem className='flex items-center justify-between gap-4 rounded-lg border p-3'>
                      <div className='flex min-w-0 flex-col gap-1'>
                        <FormLabel>倍率同步</FormLabel>
                        <FormDescription>
                          关闭后，定时任务和渠道列表不再获取上游倍率
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          aria-label='开启上游倍率同步'
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='balanceSyncEnabled'
                  render={({ field }) => (
                    <FormItem className='flex items-center justify-between gap-4 rounded-lg border p-3'>
                      <div className='flex min-w-0 flex-col gap-1'>
                        <FormLabel>余额同步</FormLabel>
                        <FormDescription>
                          关闭后，定时任务和渠道列表不再获取上游余额
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          aria-label='开启上游余额同步'
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name='balanceWarningThreshold'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>余额预警值</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min={0}
                        max={MAX_BALANCE_WARNING_THRESHOLD}
                        step='any'
                        placeholder='留空关闭余额预警'
                        disabled={!balanceSyncEnabled}
                        value={field.value ?? ''}
                        onBlur={field.onBlur}
                        onChange={(event) => {
                          const value = event.target.value
                          field.onChange(value === '' ? null : Number(value))
                        }}
                        name={field.name}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormDescription>
                      {balanceSyncEnabled
                        ? '定时更新余额低于此值时标红；开启邮件通知后首次进入低余额状态会发送预警，余额恢复后可再次预警'
                        : '余额同步已关闭，不会请求上游余额或触发余额预警'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className='grid min-w-0 gap-4 sm:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='singleChannelAction'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>仅剩此渠道时</FormLabel>
                      <Select
                        items={SINGLE_CHANNEL_ACTION_OPTIONS}
                        value={field.value}
                        onValueChange={(value) =>
                          value !== null && field.onChange(value)
                        }
                      >
                        <FormControl>
                          <SelectTrigger className='w-full'>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent alignItemWithTrigger={false}>
                          <SelectGroup>
                            {SINGLE_CHANNEL_ACTION_OPTIONS.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        目标倍率高于当前分组倍率时执行
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='multipleChannelsAction'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>存在多个渠道时</FormLabel>
                      <Select
                        items={MULTIPLE_CHANNELS_ACTION_OPTIONS}
                        value={field.value}
                        onValueChange={(value) =>
                          value !== null && field.onChange(value)
                        }
                      >
                        <FormControl>
                          <SelectTrigger className='w-full'>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent alignItemWithTrigger={false}>
                          <SelectGroup>
                            {MULTIPLE_CHANNELS_ACTION_OPTIONS.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        更新时采用参与渠道中的最高目标倍率
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {upstreamType === 'new_api' ? (
                <FormField
                  control={form.control}
                  name='authType'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>认证方式</FormLabel>
                      <FormControl>
                        <ToggleGroup
                          value={[field.value]}
                          onValueChange={(values) => {
                            const nextValue = values.find(
                              (value) => value !== field.value
                            )
                            if (
                              nextValue === 'public' ||
                              nextValue === 'user'
                            ) {
                              field.onChange(nextValue)
                              form.setValue('accessToken', '')
                              setUpstreamGroups([])
                              setTestResult(null)
                            }
                          }}
                          variant='outline'
                          spacing={2}
                          className='grid w-full grid-cols-2'
                        >
                          <ToggleGroupItem value='public' className='w-full'>
                            公开接口
                          </ToggleGroupItem>
                          <ToggleGroupItem value='user' className='w-full'>
                            用户认证
                          </ToggleGroupItem>
                        </ToggleGroup>
                      </FormControl>
                      <FormDescription>{authDescription}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}

              {isSub2API ? (
                <FormField
                  control={form.control}
                  name='authType'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>认证方式</FormLabel>
                      <FormControl>
                        <ToggleGroup
                          value={[field.value]}
                          onValueChange={(values) => {
                            const nextValue = values.find(
                              (value) => value !== field.value
                            )
                            if (
                              nextValue !== 'api_key' &&
                              nextValue !== 'token'
                            ) {
                              return
                            }
                            field.onChange(nextValue)
                            form.setValue('accessToken', '')
                            setUpstreamGroups([])
                            setTestResult(null)
                            setUpstreamVersion(null)
                          }}
                          variant='outline'
                          spacing={2}
                          className='grid w-full grid-cols-2'
                        >
                          <ToggleGroupItem value='api_key' className='w-full'>
                            API Key（新版）
                          </ToggleGroupItem>
                          <ToggleGroupItem value='token' className='w-full'>
                            Token（旧版）
                          </ToggleGroupItem>
                        </ToggleGroup>
                      </FormControl>
                      <FormDescription>
                        {authType === 'api_key'
                          ? '使用当前渠道配置的 API Key 读取新版倍率和余额'
                          : '使用旧版 Token 读取倍率、余额和分组'}
                      </FormDescription>
                      <div className='flex flex-wrap items-center gap-2'>
                        <Button
                          type='button'
                          variant='outline'
                          size='sm'
                          onClick={handleFetchVersion}
                          disabled={pending || !baseUrl.trim()}
                        >
                          {versionMutation.isPending ? (
                            <Spinner data-icon='inline-start' />
                          ) : (
                            <HugeiconsIcon
                              icon={Refresh01Icon}
                              data-icon='inline-start'
                            />
                          )}
                          获取上游版本
                        </Button>
                        {needsSub2APIToken ? (
                          <>
                            <Button
                              type='button'
                              variant='outline'
                              size='sm'
                              onClick={handleOpenSub2APILogin}
                              disabled={pending || !baseUrl.trim()}
                            >
                              <HugeiconsIcon
                                icon={LinkSquare01Icon}
                                data-icon='inline-start'
                              />
                              打开上游登录
                            </Button>
                            <Button
                              type='button'
                              variant='outline'
                              size='sm'
                              onClick={() =>
                                void copyToClipboard(
                                  SUB2API_ACCESS_TOKEN_COMMAND
                                )
                              }
                              disabled={pending}
                            >
                              <HugeiconsIcon
                                icon={Copy01Icon}
                                data-icon='inline-start'
                              />
                              复制控制台命令
                            </Button>
                          </>
                        ) : null}
                        {upstreamVersion ? (
                          <span className='text-muted-foreground text-sm'>
                            当前版本：{upstreamVersion}
                          </span>
                        ) : null}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}

              {needsUserAuthentication ? (
                <div className='grid min-w-0 gap-4 sm:grid-cols-[8rem_minmax(0,1fr)]'>
                  <FormField
                    control={form.control}
                    name='userId'
                    render={({ field }) => (
                      <FormItem className='min-w-0'>
                        <FormLabel>上游用户 ID</FormLabel>
                        <FormControl>
                          <Input
                            type='number'
                            min={1}
                            step={1}
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
                    control={form.control}
                    name='accessToken'
                    render={({ field }) => (
                      <FormItem className='min-w-0'>
                        <FormLabel>管理面板访问令牌</FormLabel>
                        <FormControl>
                          <PasswordInput
                            className='w-full min-w-0'
                            placeholder={
                              hasMatchingSavedAccessToken
                                ? '留空保留原访问令牌'
                                : '输入管理面板访问令牌'
                            }
                            autoComplete='new-password'
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          不是 sk- 开头的渠道 API 密钥
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ) : null}

              {needsSub2APIToken ? (
                <FormField
                  control={form.control}
                  name='accessToken'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sub2API Token（旧版）</FormLabel>
                      <div className='flex min-w-0 gap-2'>
                        <FormControl>
                          <PasswordInput
                            className='min-w-0 flex-1'
                            placeholder={
                              hasMatchingSavedAccessToken
                                ? '留空保留原 Token'
                                : '输入旧版登录后的 JWT Token'
                            }
                            autoComplete='new-password'
                            {...field}
                          />
                        </FormControl>
                        <Button
                          type='button'
                          variant='outline'
                          onClick={() => void handlePasteAccessToken()}
                          disabled={pending}
                          className='shrink-0'
                        >
                          <HugeiconsIcon
                            icon={ClipboardPasteIcon}
                            data-icon='inline-start'
                          />
                          粘贴
                        </Button>
                      </div>
                      <FormDescription>
                        登录后执行已复制的控制台命令，再点击“粘贴”；该 JWT
                        用于读取倍率、余额和分组
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}

              {testResult && (
                <Alert>
                  <HugeiconsIcon icon={Tick02Icon} />
                  <AlertTitle>测试成功</AlertTitle>
                  <AlertDescription className='min-w-0 text-left break-all'>
                    倍率 {formatMonitorRatio(testResult.ratio)} ·{' '}
                    {testResult.endpoint}
                  </AlertDescription>
                </Alert>
              )}

              <div className='flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end'>
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => props.onOpenChange(false)}
                  disabled={pending}
                >
                  取消
                </Button>
                {(upstreamType === 'new_api' || isSub2API) &&
                ratioSyncEnabled ? (
                  <Button
                    type='button'
                    variant='secondary'
                    onClick={handleTest}
                    disabled={pending}
                  >
                    {testMutation.isPending ? (
                      <Spinner data-icon='inline-start' />
                    ) : (
                      <HugeiconsIcon
                        icon={TestTubeIcon}
                        data-icon='inline-start'
                      />
                    )}
                    测试获取
                  </Button>
                ) : null}
                <Button type='submit' disabled={pending}>
                  {saveMutation.isPending && (
                    <Spinner data-icon='inline-start' />
                  )}
                  保存
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
