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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'

import {
  applyChannelMonitorUpstreamGroup,
  listChannelMonitorUpstreamGroups,
  saveChannelMonitorUpstreamConfig,
  testChannelMonitorUpstreamConfig,
} from '../api'
import { formatMonitorRatio } from '../lib/format'
import {
  createUpstreamConfigSchema,
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

const SUB2API_REFRESH_TOKEN_COMMAND =
  "copy(localStorage.getItem('refresh_token') || '')"

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

function createUpstreamRequest(
  values: UpstreamConfigFormValues
): ChannelMonitorUpstreamRequest {
  const userAuthentication =
    values.upstreamType === 'new_api' && values.authType === 'user'
  const refreshTokenAuthentication = values.upstreamType === 'sub2api'
  return {
    type: values.upstreamType,
    base_url: values.baseUrl.trim(),
    group: values.group.trim(),
    auth_type: values.authType,
    user_id: userAuthentication ? values.userId : 0,
    access_token: userAuthentication ? values.accessToken.trim() : '',
    refresh_token: refreshTokenAuthentication ? values.refreshToken.trim() : '',
    single_channel_action: values.singleChannelAction,
    multiple_channels_action: values.multipleChannelsAction,
  }
}

export function UpstreamConfigDialog(props: UpstreamConfigDialogProps) {
  const queryClient = useQueryClient()
  const { copyToClipboard } = useCopyToClipboard({
    successMessage: '提取命令已复制',
    errorMessage: '复制提取命令失败',
  })
  const [testResult, setTestResult] = useState<NewAPIGroupRatioResult | null>(
    null
  )
  const savedUpstream = props.channel.upstream
  const initialGroup =
    savedUpstream?.group || props.channel.groups[0] || 'default'
  const [upstreamGroups, setUpstreamGroups] = useState<
    ChannelMonitorUpstreamGroup[]
  >([])
  const [groupInputValue, setGroupInputValue] = useState(initialGroup)
  const [groupComboboxOpen, setGroupComboboxOpen] = useState(false)
  const schema = createUpstreamConfigSchema(
    savedUpstream
      ? {
          type: savedUpstream.type,
          authType:
            savedUpstream.type === 'sub2api'
              ? 'refresh_token'
              : savedUpstream.auth_type,
          hasAccessToken: savedUpstream.has_access_token,
          hasRefreshToken: savedUpstream.has_refresh_token,
        }
      : null
  )
  const form = useForm<UpstreamConfigFormValues>({
    resolver: zodResolver(schema) as Resolver<UpstreamConfigFormValues>,
    defaultValues: {
      upstreamType: savedUpstream?.type || 'new_api',
      baseUrl: props.channel.upstream?.base_url || props.channel.base_url,
      group: initialGroup,
      authType:
        props.channel.upstream?.type === 'sub2api'
          ? 'refresh_token'
          : props.channel.upstream?.auth_type || 'public',
      userId: props.channel.upstream?.user_id || 0,
      accessToken: '',
      refreshToken: '',
      singleChannelAction: savedUpstream?.single_channel_action || 'none',
      multipleChannelsAction: savedUpstream?.multiple_channels_action || 'none',
    },
  })
  const upstreamType = useWatch({ control: form.control, name: 'upstreamType' })
  const authType = useWatch({ control: form.control, name: 'authType' })
  const needsUserAuthentication =
    upstreamType === 'new_api' && authType === 'user'
  const needsSub2APIRefreshToken = upstreamType === 'sub2api'
  const canApplyGroup = needsUserAuthentication || needsSub2APIRefreshToken
  const hasMatchingSavedAccessToken =
    savedUpstream?.has_access_token === true &&
    savedUpstream.type === upstreamType &&
    savedUpstream.auth_type === authType
  const hasMatchingSavedRefreshToken =
    savedUpstream?.has_refresh_token === true &&
    savedUpstream.type === 'sub2api'
  const authDescription =
    authType === 'public'
      ? '无需账号，读取公开分组倍率'
      : '读取指定用户的实际分组倍率'
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
  const groupsMutation = useMutation({
    mutationFn: listChannelMonitorUpstreamGroups,
    onSuccess: (response) => {
      setUpstreamGroups(response.data.groups)
      toast.success(`已获取 ${response.data.groups.length} 个上游分组`)
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

  const handleSave = form.handleSubmit((values) => {
    saveMutation.mutate({
      channelId: props.channel.id,
      config: createUpstreamRequest(values),
    })
  })
  const handleTest = form.handleSubmit((values) => {
    testMutation.mutate({
      channelId: props.channel.id,
      config: createUpstreamRequest(values),
    })
  })
  const handleLoadGroups = form.handleSubmit((values) => {
    groupsMutation.mutate({
      channelId: props.channel.id,
      config: createUpstreamRequest(values),
    })
  })
  const handleApplyGroup = form.handleSubmit((values) => {
    applyGroupMutation.mutate(values)
  })
  const handleOpenSub2APILogin = () => {
    const baseUrl = form.getValues('baseUrl').trim()
    try {
      const loginUrl = new URL(baseUrl)
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
  const handlePasteRefreshToken = async () => {
    if (!navigator.clipboard?.readText) {
      toast.error('当前浏览器不支持读取剪贴板')
      return
    }
    try {
      const refreshToken = (await navigator.clipboard.readText()).trim()
      if (!refreshToken) {
        toast.error('剪贴板中没有 Refresh Token')
        return
      }
      form.setValue('refreshToken', refreshToken, {
        shouldDirty: true,
        shouldValidate: true,
      })
      toast.success('Refresh Token 已粘贴')
    } catch {
      toast.error('读取剪贴板失败，请手动粘贴')
    }
  }
  const pending =
    saveMutation.isPending ||
    testMutation.isPending ||
    groupsMutation.isPending ||
    applyGroupMutation.isPending

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='max-h-[85dvh] overflow-hidden sm:max-w-3xl'>
        <DialogHeader className='pr-10'>
          <DialogTitle>上游配置与策略</DialogTitle>
          <DialogDescription>
            {props.channel.name} · ID {props.channel.id}
          </DialogDescription>
        </DialogHeader>
        <div className='min-h-0 min-w-0 overflow-x-hidden overflow-y-auto pr-1'>
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
                            nextValue === 'sub2api'
                              ? 'refresh_token'
                              : 'public',
                            { shouldValidate: true }
                          )
                          form.setValue('accessToken', '')
                          form.setValue('refreshToken', '')
                          setUpstreamGroups([])
                          setTestResult(null)
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
                    <FormDescription>
                      {upstreamType === 'sub2api'
                        ? '使用登录会话的 Refresh Token 读取实际分组倍率'
                        : '读取 New API 分组倍率'}
                    </FormDescription>
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
                          disabled={pending}
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
                      {upstreamType === 'sub2api'
                        ? 'Sub2API 首次配置需保存后再获取，也可填写分组名称或数字 ID'
                        : '从 New API 获取可用分组，也可直接填写名称'}
                      ；
                      {canApplyGroup
                        ? '应用分组会保存配置，并将当前渠道的全部上游令牌切换到该分组'
                        : '应用分组需要先选择用户认证'}
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

              {needsSub2APIRefreshToken ? (
                <div className='flex flex-col gap-4'>
                  <div className='flex flex-wrap gap-2'>
                    <Button
                      type='button'
                      variant='outline'
                      onClick={handleOpenSub2APILogin}
                    >
                      <HugeiconsIcon
                        icon={LinkSquare01Icon}
                        data-icon='inline-start'
                      />
                      打开 Sub2API 登录
                    </Button>
                    <Button
                      type='button'
                      variant='outline'
                      onClick={() =>
                        void copyToClipboard(SUB2API_REFRESH_TOKEN_COMMAND)
                      }
                    >
                      <HugeiconsIcon
                        icon={Copy01Icon}
                        data-icon='inline-start'
                      />
                      复制提取命令
                    </Button>
                  </div>
                  <FormField
                    control={form.control}
                    name='refreshToken'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sub2API Refresh Token</FormLabel>
                        <FormControl>
                          <div className='flex min-w-0 gap-2'>
                            <PasswordInput
                              className='min-w-0 flex-1'
                              placeholder={
                                hasMatchingSavedRefreshToken
                                  ? '留空保留原 Token'
                                  : '粘贴 refresh_token'
                              }
                              autoComplete='new-password'
                              {...field}
                            />
                            <Button
                              type='button'
                              variant='outline'
                              onClick={() => void handlePasteRefreshToken()}
                              className='shrink-0'
                            >
                              <HugeiconsIcon
                                icon={ClipboardPasteIcon}
                                data-icon='inline-start'
                              />
                              粘贴
                            </Button>
                          </div>
                        </FormControl>
                        <FormDescription>
                          {hasMatchingSavedRefreshToken
                            ? '已保存 Token，留空不会覆盖；获取倍率后 Token 会自动轮换'
                            : '登录后按 F12 运行提取命令，再粘贴；获取倍率后 Token 会自动轮换'}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
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
                {upstreamType === 'new_api' ? (
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
