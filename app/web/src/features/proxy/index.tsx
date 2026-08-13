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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Download, RefreshCw, Save } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ProxyNodeView } from './proxy-node-view'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { toast } from '@/hooks/use-toast'
import { api } from '@/lib/api'

type ApiResponse<T> = {
  success: boolean
  message?: string
  data: T
}

type OutboundType =
  | 'vless'
  | 'vmess'
  | 'trojan'
  | 'shadowsocks'
  | 'hysteria2'
  | 'socks5'
  | 'http'

type OutboundConfig = {
  type: string
  server: string
  server_port: number
  uuid: string
  password: string
  flow: string
  encryption: string
  tls_enabled: boolean
  tls_server_name: string
  network: string
  packet_encoding: string
  method: string
  masquerade: string
  obfs: string
  obfs_password: string
  hop_ports: string
  transport_type: string
  transport_path: string
  transport_host: string
  transport_service_name: string
}

type ProxyConfig = {
  outbound: OutboundConfig | null
  global_proxy_url: string
  enabled: boolean
}

type ProxyStatus = {
  running: boolean
  error?: string
}

type GenerateResponse = {
  config_json: string
}

type ReloadResponse = {
  success: boolean
  message: string
}

const PROTOCOL_OPTIONS: { value: OutboundType; label: string }[] = [
  { value: 'vless', label: 'VLESS' },
  { value: 'vmess', label: 'VMess' },
  { value: 'trojan', label: 'Trojan' },
  { value: 'shadowsocks', label: 'Shadowsocks' },
  { value: 'hysteria2', label: 'Hysteria2' },
  { value: 'socks5', label: 'SOCKS5' },
  { value: 'http', label: 'HTTP' },
]

const FLOW_OPTIONS = [
  { value: 'xtls-rprx-vision', label: 'xtls-rprx-vision' },
  { value: 'none', label: 'None' },
]

const ENCRYPTION_OPTIONS = [
  { value: 'aes-256-gcm', label: 'aes-256-gcm' },
  { value: 'chacha20-ietf-poly1305', label: 'chacha20-ietf-poly1305' },
  { value: 'none', label: 'None' },
]

const NETWORK_OPTIONS = [
  { value: 'tcp', label: 'tcp' },
  { value: 'udp', label: 'udp' },
]

const PACKET_ENCODING_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'xtls-rprx-vision', label: 'xtls-rprx-vision' },
  { value: 'xudp', label: 'xudp' },
]

const SS_METHOD_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'aes-256-gcm', label: 'aes-256-gcm' },
  { value: 'aes-128-gcm', label: 'aes-128-gcm' },
  { value: 'chacha20-ietf-poly1305', label: 'chacha20-ietf-poly1305' },
]

const OBFS_OPTIONS = [
  { value: 'none', label: 'none' },
  { value: 'salamander', label: 'salamander' },
]

const TRANSPORT_TYPE_OPTIONS = [
  { value: 'none', label: 'none' },
  { value: 'ws', label: 'ws' },
  { value: 'kcp', label: 'kcp' },
  { value: 'quic', label: 'quic' },
  { value: 'grpc', label: 'grpc' },
]

const DEFAULT_OUTBOUND: OutboundConfig = {
  type: 'vless',
  server: '',
  server_port: 443,
  uuid: '',
  password: '',
  flow: 'none',
  encryption: 'none',
  tls_enabled: false,
  tls_server_name: '',
  network: 'tcp',
  packet_encoding: '',
  method: '',
  masquerade: '',
  obfs: 'none',
  obfs_password: '',
  hop_ports: '',
  transport_type: 'none',
  transport_path: '',
  transport_host: '',
  transport_service_name: '',
}

const DEFAULT_CONFIG: ProxyConfig = {
  outbound: DEFAULT_OUTBOUND,
  global_proxy_url: '',
  enabled: false,
}

async function fetchProxyConfig(): Promise<ProxyConfig> {
  const res = await api.get<ApiResponse<ProxyConfig>>('/api/proxy/config')
  if (!res.data.success) {
    throw new Error(res.data.message || 'Failed to load proxy config')
  }
  return res.data.data
}

async function fetchProxyStatus(): Promise<ProxyStatus> {
  const res = await api.get<ApiResponse<ProxyStatus>>('/api/proxy/status')
  if (!res.data.success) {
    throw new Error(res.data.message || 'Failed to load proxy status')
  }
  return res.data.data
}

async function fetchProxyGenerate(): Promise<GenerateResponse> {
  const res = await api.get<ApiResponse<GenerateResponse>>(
    '/api/proxy/config/generate',
  )
  if (!res.data.success) {
    throw new Error(res.data.message || 'Failed to generate config')
  }
  return res.data.data
}

async function saveProxyConfig(payload: ProxyConfig): Promise<void> {
  const res = await api.put<ApiResponse<null>>('/api/proxy/config', payload)
  if (!res.data.success) {
    throw new Error(res.data.message || 'Failed to save')
  }
}

async function reloadProxy(): Promise<ReloadResponse> {
  const res = await api.post<ApiResponse<ReloadResponse>>('/api/proxy/reload')
  if (!res.data.success) {
    throw new Error(res.data.message || 'Failed to reload')
  }
  return res.data.data
}

function normalizeConfig(config: ProxyConfig): ProxyConfig {
  const outbound = config.outbound ?? DEFAULT_OUTBOUND
  return {
    enabled: !!config.enabled,
    global_proxy_url: config.global_proxy_url ?? '',
    outbound: {
      ...DEFAULT_OUTBOUND,
      ...outbound,
      flow: outbound.flow || 'none',
      encryption: outbound.encryption || 'none',
      network: outbound.network || 'tcp',
      obfs: outbound.obfs || 'none',
      transport_type: outbound.transport_type || 'none',
    },
  }
}

function toSavePayload(config: ProxyConfig): ProxyConfig {
  const outbound = config.outbound ?? DEFAULT_OUTBOUND
  return {
    ...config,
    outbound: {
      ...outbound,
      flow: outbound.flow === 'none' ? '' : outbound.flow,
      encryption:
        outbound.encryption === 'none' ? '' : outbound.encryption,
      network: outbound.network === 'tcp' ? '' : outbound.network,
      obfs: outbound.obfs === 'none' ? '' : outbound.obfs,
      transport_type:
        outbound.transport_type === 'none' ? '' : outbound.transport_type,
    },
  }
}


export function ProxyPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { copyToClipboard } = useCopyToClipboard()
  const [form, setForm] = useState<ProxyConfig>(DEFAULT_CONFIG)
  const [activeTab, setActiveTab] = useState('nodes')

  const configQuery = useQuery({
    queryKey: ['proxy', 'config'],
    queryFn: fetchProxyConfig,
    staleTime: 60 * 1000,
    retry: false,
  })

  const statusQuery = useQuery({
    queryKey: ['proxy', 'status'],
    queryFn: fetchProxyStatus,
    refetchInterval: 30_000,
    staleTime: 30_000,
    retry: false,
  })

  const generateQuery = useQuery({
    queryKey: ['proxy', 'generate'],
    queryFn: fetchProxyGenerate,
    staleTime: 60 * 1000,
    retry: false,
  })

  useEffect(() => {
    if (configQuery.data) {
      setForm(normalizeConfig(configQuery.data))
    }
  }, [configQuery.data])

  const saveMutation = useMutation({
    mutationFn: saveProxyConfig,
    onSuccess: () => {
      toast.success(t('Saved successfully'))
      queryClient.invalidateQueries({ queryKey: ['proxy', 'config'] })
      queryClient.invalidateQueries({ queryKey: ['proxy', 'status'] })
      queryClient.invalidateQueries({ queryKey: ['proxy', 'generate'] })
    },
    onError: (err: Error) => toast.error(err.message || t('Failed to save')),
  })

  const reloadMutation = useMutation({
    mutationFn: reloadProxy,
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message || t('Reloaded successfully'))
      } else {
        toast.error(data.message || t('Failed to reload'))
      }
      queryClient.invalidateQueries({ queryKey: ['proxy', 'status'] })
    },
    onError: (err: Error) => toast.error(err.message || t('Failed to reload')),
  })

  const outbound = form.outbound ?? DEFAULT_OUTBOUND
  const configJson = generateQuery.data?.config_json

  const updateOutbound = useCallback((patch: Partial<OutboundConfig>) => {
    setForm((current) => ({
      ...current,
      outbound: { ...(current.outbound ?? DEFAULT_OUTBOUND), ...patch },
    }))
  }, [])

  const handleDownload = useCallback(() => {
    if (!configJson) return
    const url = URL.createObjectURL(
      new Blob([configJson], { type: 'application/json' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = 'singbox-config.json'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }, [configJson])

  const handleCopy = useCallback(() => {
    if (configJson) void copyToClipboard(configJson)
  }, [configJson, copyToClipboard])

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        <span className='truncate'>{t('Proxy Config')}</span>
      </SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value='nodes'>{t('Proxy Nodes')}</TabsTrigger>
            <TabsTrigger value='config'>{t('sing-box Config')}</TabsTrigger>
          </TabsList>
          <TabsContent value='nodes'>
            <ProxyNodeView />
          </TabsContent>
          <TabsContent value='config'>
            <div className='space-y-4'>
              <Card>
            <CardHeader>
              <CardTitle className='text-base'>
                {t('Outbound Configuration')}
              </CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              {configQuery.isLoading ? (
                <div className='text-muted-foreground text-sm'>
                  {t('Loading...')}
                </div>
              ) : (
                <>
                  <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                    <div className='space-y-1.5'>
                      <Label>{t('Protocol Type')}</Label>
                      <Select
                        value={outbound.type}
                        onValueChange={(value) => {
                          if (value) updateOutbound({ type: value })
                        }}
                      >
                        <SelectTrigger className='w-full'>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {PROTOCOL_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className='space-y-1.5'>
                      <Label>{t('Network')}</Label>
                      <Select
                        value={outbound.network}
                        onValueChange={(value) => {
                          if (value) updateOutbound({ network: value })
                        }}
                      >
                        <SelectTrigger className='w-full'>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {NETWORK_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className='space-y-1.5'>
                      <Label>{t('Server')}</Label>
                      <Input
                        value={outbound.server}
                        onChange={(event) =>
                          updateOutbound({ server: event.target.value })
                        }
                        placeholder='example.com'
                      />
                    </div>

                    <div className='space-y-1.5'>
                      <Label>{t('Port')}</Label>
                      <Input
                        type='number'
                        min={1}
                        max={65535}
                        value={outbound.server_port || ''}
                        onChange={(event) =>
                          updateOutbound({
                            server_port: Number(event.target.value) || 0,
                          })
                        }
                      />
                    </div>

                    <div className='space-y-1.5'>
                      <Label>UUID</Label>
                      <Input
                        value={outbound.uuid}
                        onChange={(event) =>
                          updateOutbound({ uuid: event.target.value })
                        }
                        placeholder='00000000-0000-0000-0000-000000000000'
                      />
                    </div>

                    <div className='space-y-1.5'>
                      <Label>{t('Password')}</Label>
                      <Input
                        type='password'
                        value={outbound.password}
                        onChange={(event) =>
                          updateOutbound({ password: event.target.value })
                        }
                      />
                    </div>

                    <div className='space-y-1.5'>
                      <Label>Flow</Label>
                      <Select
                        value={outbound.flow}
                        onValueChange={(value) => {
                          if (value) updateOutbound({ flow: value })
                        }}
                      >
                        <SelectTrigger className='w-full'>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {FLOW_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className='space-y-1.5'>
                      <Label>{t('TLS Server Name')}</Label>
                      <Input
                        value={outbound.tls_server_name}
                        onChange={(event) =>
                          updateOutbound({ tls_server_name: event.target.value })
                        }
                        placeholder='example.com'
                      />
                    </div>

                    <div className='space-y-1.5'>
                      <Label>{t('Encryption')}</Label>
                      <Select
                        value={outbound.encryption}
                        onValueChange={(value) => {
                          if (value) updateOutbound({ encryption: value })
                        }}
                      >
                        <SelectTrigger className='w-full'>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {ENCRYPTION_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className='space-y-1.5'>
                      <Label>{t('Global Proxy URL')}</Label>
                      <Input
                        value={form.global_proxy_url}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            global_proxy_url: event.target.value,
                          }))
                        }
                        placeholder='socks5://127.0.0.1:1080'
                      />
                    </div>
                  </div>

                  <div className='flex flex-wrap items-center gap-6'>
                    <div className='flex items-center gap-2'>
                      <Checkbox
                        id='tls-enabled'
                        checked={outbound.tls_enabled}
                        onCheckedChange={(checked) =>
                          updateOutbound({ tls_enabled: checked === true })
                        }
                      />
                      <Label htmlFor='tls-enabled'>{t('Enable TLS')}</Label>
                    </div>

                    <div className='flex items-center gap-3'>
                      <Switch
                        checked={form.enabled}
                        onCheckedChange={(enabled) =>
                          setForm((current) => ({ ...current, enabled }))
                        }
                      />
                      <Label>{t('Enable Global Proxy')}</Label>
                    </div>
                  </div>

                  <Button
                    onClick={() => saveMutation.mutate(toSavePayload(form))}
                    disabled={saveMutation.isPending}
                  >
                    <Save className='mr-1 size-4' />
                    {saveMutation.isPending ? t('Saving...') : t('Save Settings')}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {['vless', 'vmess', 'trojan'].includes(outbound.type) && (
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>
                  {t('Transport Settings')}
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                  <div className='space-y-1.5'>
                    <Label>{t('Transport Type')}</Label>
                    <Select
                      value={outbound.transport_type}
                      onValueChange={(value) => {
                        if (value) updateOutbound({ transport_type: value })
                      }}
                    >
                      <SelectTrigger className='w-full'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {TRANSPORT_TYPE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>

                  {outbound.transport_type === 'ws' && (
                    <div className='space-y-1.5'>
                      <Label>{t('Path')}</Label>
                      <Input
                        value={outbound.transport_path}
                        onChange={(event) =>
                          updateOutbound({ transport_path: event.target.value })
                        }
                        placeholder='/ws'
                      />
                    </div>
                  )}

                  {outbound.transport_type === 'ws' && (
                    <div className='space-y-1.5'>
                      <Label>{t('Host')}</Label>
                      <Input
                        value={outbound.transport_host}
                        onChange={(event) =>
                          updateOutbound({ transport_host: event.target.value })
                        }
                        placeholder='example.com'
                      />
                    </div>
                  )}

                  {outbound.transport_type === 'grpc' && (
                    <div className='space-y-1.5'>
                      <Label>{t('Service Name')}</Label>
                      <Input
                        value={outbound.transport_service_name}
                        onChange={(event) =>
                          updateOutbound({
                            transport_service_name: event.target.value,
                          })
                        }
                        placeholder='example'
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {outbound.type === 'vless' && (
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>
                  {t('VLESS Settings')}
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                  <div className='space-y-1.5'>
                    <Label>{t('Packet Encoding')}</Label>
                    <Select
                      value={outbound.packet_encoding}
                      onValueChange={(value) => {
                        if (value) updateOutbound({ packet_encoding: value })
                      }}
                    >
                      <SelectTrigger className='w-full'>
                        <SelectValue placeholder={t('None')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {PACKET_ENCODING_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {outbound.type === 'shadowsocks' && (
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>
                  {t('Shadowsocks Settings')}
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                  <div className='space-y-1.5'>
                    <Label>{t('Method')}</Label>
                    <Select
                      value={outbound.method}
                      onValueChange={(value) => {
                        if (value) updateOutbound({ method: value })
                      }}
                    >
                      <SelectTrigger className='w-full'>
                        <SelectValue placeholder={t('None')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {SS_METHOD_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {outbound.type === 'hysteria2' && (
            <Card>
              <CardHeader>
                <CardTitle className='text-base'>
                  {t('Hysteria2 Settings')}
                </CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                  <div className='space-y-1.5'>
                    <Label>{t('Masquerade')}</Label>
                    <Input
                      value={outbound.masquerade}
                      onChange={(event) =>
                        updateOutbound({ masquerade: event.target.value })
                      }
                      placeholder='https://example.com'
                    />
                  </div>

                  <div className='space-y-1.5'>
                    <Label>{t('Obfs')}</Label>
                    <Select
                      value={outbound.obfs}
                      onValueChange={(value) => {
                        if (value) updateOutbound({ obfs: value })
                      }}
                    >
                      <SelectTrigger className='w-full'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {OBFS_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>

                  {outbound.obfs === 'salamander' && (
                    <div className='space-y-1.5'>
                      <Label>{t('Obfs Password')}</Label>
                      <Input
                        value={outbound.obfs_password}
                        onChange={(event) =>
                          updateOutbound({ obfs_password: event.target.value })
                        }
                      />
                    </div>
                  )}

                  <div className='space-y-1.5'>
                    <Label>{t('Hop Ports')}</Label>
                    <Input
                      value={outbound.hop_ports}
                      onChange={(event) =>
                        updateOutbound({ hop_ports: event.target.value })
                      }
                      placeholder='10000-20000'
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className='text-base'>{t('Status')}</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='flex items-center gap-3'>
                <span
                  className={`inline-block size-2.5 rounded-full ${
                    statusQuery.data?.running ? 'bg-green-500' : 'bg-red-500'
                  }`}
                />
                <span className='text-sm font-medium'>
                  {statusQuery.data?.running ? t('Running') : t('Not running')}
                </span>
                {statusQuery.data?.error && (
                  <span className='text-muted-foreground text-xs'>
                    ({statusQuery.data.error})
                  </span>
                )}
              </div>
              {form.global_proxy_url && (
                <div className='text-muted-foreground text-sm'>
                  <span className='font-medium'>{t('Global Proxy URL')}:</span>{' '}
                  <code className='bg-muted rounded px-1'>
                    {form.global_proxy_url}
                  </code>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className='text-base'>{t('Config Preview')}</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              <div className='flex flex-wrap items-center gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={handleDownload}
                  disabled={!configJson}
                >
                  <Download className='mr-1 size-4' />
                  {t('Download')}
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={handleCopy}
                  disabled={!configJson}
                >
                  <Copy className='mr-1 size-4' />
                  {t('Copy')}
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => reloadMutation.mutate()}
                  disabled={reloadMutation.isPending}
                >
                  <RefreshCw
                    className={`mr-1 size-4 ${reloadMutation.isPending ? 'animate-spin' : ''}`}
                  />
                  {t('Hot Reload')}
                </Button>
              </div>

              {generateQuery.isLoading && (
                <div className='text-muted-foreground text-sm'>
                  {t('Loading...')}
                </div>
              )}
              {generateQuery.error && (
                <div className='text-destructive text-sm'>
                  {(generateQuery.error as Error).message}
                </div>
              )}
              {configJson && (
                <pre className='bg-muted max-h-96 overflow-auto rounded-lg p-4 text-xs'>
                  {configJson}
                </pre>
              )}
            </CardContent>
          </Card>
            </div>
          </TabsContent>
        </Tabs>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
