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
import { useParams } from '@tanstack/react-router'
import { ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

export type ToolDef = {
  id: string
  name: string
  description: string
  url: string
  port: number
}

export const TOOLS: ToolDef[] = [
  {
    id: 'openai-pool',
    name: 'OpenAI Pool V6',
    description: '账号池编排器 — 多线程自动注册、Sub2Api 同步、代理池管理',
    url: 'http://127.0.0.1:18421',
    port: 18421,
  },
  {
    id: 'codex-register',
    name: 'Codex Register',
    description: 'ChatGPT/Codex 批量注册管理面板 — 任务控制、账号管理、CPA 同步',
    url: 'http://127.0.0.1:5020',
    port: 5020,
  },
  {
    id: 'gpt-register',
    name: 'GPT Register',
    description: 'ChatGPT 账号批量注册 WebUI — 实时日志、多驱动、Codex OAuth',
    url: 'http://127.0.0.1:5010',
    port: 5010,
  },
  {
    id: 'gpt-duckmail',
    name: 'GPT + DuckMail',
    description: 'GPT 注册 + DuckMail + CPA + Sub2Api 一体化管理',
    url: 'http://127.0.0.1:18422',
    port: 18422,
  },
  {
    id: 'team-all-in-one',
    name: 'Team All-in-One',
    description: 'ChatGPT 批量注册 + Teams 邀请子号一体化',
    url: 'http://127.0.0.1:5030',
    port: 5030,
  },
  {
    id: 'ob1-gateway',
    name: 'OB-1 Gateway',
    description: 'OB-1 账号池转 OpenAI 兼容 API 网关 — API Key 管理、WorkOS 授权',
    url: 'http://127.0.0.1:8081/static/login.html',
    port: 8081,
  },
  {
    id: 'mail-forge',
    name: 'Mail Forge',
    description: 'Cloudflare 邮件路由批量管理 — 跨域名批量创建、启停、删除规则',
    url: 'http://127.0.0.1:3042',
    port: 3042,
  },
  {
    id: 'cloud-mail',
    name: 'Cloud Mail',
    description: '临时邮箱服务 — 多域名邮件接收、管理后台',
    url: 'http://127.0.0.1:8787',
    port: 8787,
  },
]

export function ToolsPage() {
  const { t } = useTranslation()
  const { tool } = useParams({ from: '/_authenticated/tools/$tool' })
  const current = TOOLS.find((x) => x.id === tool) ?? TOOLS[0]

  return (
    <div className='flex h-full flex-col'>
      {/* Header */}
      <div className='flex items-center justify-between border-b px-4 py-3 sm:px-6'>
        <div>
          <h1 className='text-base font-semibold'>{current.name}</h1>
          <p className='text-muted-foreground text-xs'>{current.description}</p>
        </div>
        <Button
          variant='outline'
          size='sm'
          onClick={() => window.open(current.url, '_blank', 'noopener,noreferrer')}
        >
          <ExternalLink className='mr-1.5 size-3.5' />
          {t('Open in new tab')}
        </Button>
      </div>

      {/* iframe */}
      <iframe
        key={current.id}
        src={current.url}
        title={current.name}
        className='flex-1 w-full border-0'
        // sandbox is intentionally permissive for local trusted tools
        // eslint-disable-next-line react/iframe-missing-sandbox
      />
    </div>
  )
}
