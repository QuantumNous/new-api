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
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Check, Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { copyToClipboard } from '@/lib/copy-to-clipboard'
import { useSystemConfig } from '@/hooks/use-system-config'
import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// The public OpenAI-compatible API origin. Sourced from the server's configured
// ServerAddress (e.g. https://router.flatkey.ai in production) rather than the console
// origin — the API host differs from the console host, so window.location.origin would be
// wrong. Falls back to the canonical gateway when ServerAddress is unset.
const DEFAULT_API_ORIGIN = 'https://router.flatkey.ai'

function buildBaseUrl(serverAddress?: string): string {
  const origin = (serverAddress || DEFAULT_API_ORIGIN).replace(/\/+$/, '')
  return `${origin}/v1`
}

function CodeBlock({ code }: { code: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    const ok = await copyToClipboard(code)
    if (ok) {
      setCopied(true)
      toast.success(t('Copied to clipboard'))
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className='group relative'>
      <pre className='bg-muted/50 overflow-x-auto rounded-md border p-3 pr-12 font-mono text-xs leading-relaxed'>
        <code>{code}</code>
      </pre>
      <Button
        type='button'
        variant='ghost'
        size='icon-sm'
        className='absolute top-2 right-2'
        onClick={handleCopy}
      >
        {copied ? (
          <Check className='size-4 text-green-600' />
        ) : (
          <Copy className='size-4' />
        )}
        <span className='sr-only'>{t('Copy')}</span>
      </Button>
    </div>
  )
}

export function Quickstart() {
  const { t } = useTranslation()
  const { serverAddress } = useSystemConfig()
  const baseUrl = buildBaseUrl(serverAddress)

  const curlExample = `curl ${baseUrl}/chat/completions \\
  -H "Authorization: Bearer $FLATKEY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "claude-opus-4-8",
    "messages": [{ "role": "user", "content": "Hello!" }]
  }'`

  const pythonExample = `from openai import OpenAI

client = OpenAI(
    base_url="${baseUrl}",
    api_key="<FLATKEY_API_KEY>",
)

resp = client.chat.completions.create(
    model="claude-opus-4-8",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(resp.choices[0].message.content)`

  const tsExample = `import OpenAI from 'openai'

const client = new OpenAI({
  baseURL: '${baseUrl}',
  apiKey: process.env.FLATKEY_API_KEY,
})

const resp = await client.chat.completions.create({
  model: 'claude-opus-4-8',
  messages: [{ role: 'user', content: 'Hello!' }],
})
console.log(resp.choices[0].message.content)`

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Quickstart')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='mx-auto flex max-w-3xl flex-col gap-6'>
          <p className='text-muted-foreground text-sm'>
            {t('Make your first API call in under a minute.')}
          </p>

          <Card>
            <CardHeader>
              <CardTitle className='text-base'>{t('Base URL')}</CardTitle>
            </CardHeader>
            <CardContent className='flex flex-col gap-3'>
              <p className='text-muted-foreground text-sm'>
                {t(
                  'The API is OpenAI-compatible, so any OpenAI SDK works by just changing the base URL and API key.'
                )}
              </p>
              <CodeBlock code={baseUrl} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className='text-base'>
                {t('Make your first call')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue='curl'>
                <TabsList>
                  <TabsTrigger value='curl'>{t('cURL')}</TabsTrigger>
                  <TabsTrigger value='python'>{t('Python')}</TabsTrigger>
                  <TabsTrigger value='typescript'>
                    {t('TypeScript')}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value='curl' className='pt-3'>
                  <CodeBlock code={curlExample} />
                </TabsContent>
                <TabsContent value='python' className='pt-3'>
                  <CodeBlock code={pythonExample} />
                </TabsContent>
                <TabsContent value='typescript' className='pt-3'>
                  <CodeBlock code={tsExample} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <p className='text-muted-foreground text-sm'>
            {t('Need a key?')}{' '}
            <Link
              to='/keys'
              className='text-foreground font-medium underline underline-offset-3'
            >
              {t('Create an API key')}
            </Link>
          </p>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
