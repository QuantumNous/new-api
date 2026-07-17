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
import { Copy01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDocsBaseUrl } from '@/features/docs/hooks/use-docs-base-url'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'

import { SectionHeading } from './section-heading'

type CodeLanguage = 'python' | 'node' | 'curl'

function getRequestCode(language: CodeLanguage, baseUrl: string): string {
  if (language === 'node') {
    return `import OpenAI from "openai"

const client = new OpenAI({
  baseURL: "${baseUrl}/v1",
  apiKey: "YOUR_API_KEY"
})

const result = await client.responses.create({
  model: "YOUR_MODEL",
  input: "Hello"
})`
  }

  if (language === 'curl') {
    return `curl "${baseUrl}/v1/responses" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"YOUR_MODEL","input":"Hello"}'`
  }

  return `from openai import OpenAI

client = OpenAI(
  base_url="${baseUrl}/v1",
  api_key="YOUR_API_KEY"
)

result = client.responses.create(
  model="YOUR_MODEL",
  input="Hello"
)`
}

const RESPONSE_CODE = `{
  "status": "completed",
  "output": [ ... ],
  "usage": {
    "input_tokens": 12,
    "output_tokens": 36
  }
}`

export function SdkWorkbenchSection() {
  const { t } = useTranslation()
  const baseUrl = useDocsBaseUrl()
  const [language, setLanguage] = useState<CodeLanguage>('python')
  const { copiedText, copyToClipboard } = useCopyToClipboard()
  const requestCode = getRequestCode(language, baseUrl)

  const handleLanguageChange = (value: string) => {
    if (value === 'python' || value === 'node' || value === 'curl') {
      setLanguage(value)
    }
  }

  return (
    <section className='bg-[var(--landing-code)] px-4 py-20 text-[var(--landing-code-foreground)] sm:px-6 sm:py-24 lg:py-28'>
      <div className='mx-auto w-full max-w-6xl'>
        <div className='[&_h2]:text-[var(--landing-code-foreground)] [&_p]:text-[var(--landing-code-muted)]'>
          <SectionHeading
            eyebrow={t('Developer first')}
            title={t('Send your first request in a familiar language.')}
            description={t(
              'Keep one integration setup across cURL and common SDKs, with a clear response.'
            )}
          />
        </div>

        <Tabs
          value={language}
          onValueChange={handleLanguageChange}
          className='gap-0 overflow-hidden rounded-lg border border-[var(--landing-code-border)] bg-[var(--landing-code-panel)]'
        >
          <div className='flex min-h-13 flex-col gap-3 border-b border-[var(--landing-code-border)] px-3 py-2 sm:flex-row sm:items-center sm:justify-between'>
            <TabsList variant='line' className='bg-transparent'>
              <TabsTrigger
                value='python'
                className='text-[var(--landing-code-muted)] data-active:bg-[var(--landing-code-active)] data-active:text-[var(--landing-code-foreground)]'
              >
                Python
              </TabsTrigger>
              <TabsTrigger
                value='node'
                className='text-[var(--landing-code-muted)] data-active:bg-[var(--landing-code-active)] data-active:text-[var(--landing-code-foreground)]'
              >
                Node.js
              </TabsTrigger>
              <TabsTrigger
                value='curl'
                className='text-[var(--landing-code-muted)] data-active:bg-[var(--landing-code-active)] data-active:text-[var(--landing-code-foreground)]'
              >
                cURL
              </TabsTrigger>
            </TabsList>
            <span className='font-mono text-xs text-[var(--landing-code-muted)]'>
              POST /v1/responses
            </span>
          </div>

          {(['python', 'node', 'curl'] as const).map((tab) => (
            <TabsContent key={tab} value={tab} className='m-0'>
              <div className='grid min-h-96 lg:grid-cols-[1.15fr_0.85fr]'>
                <section className='border-b border-[var(--landing-code-border)] p-5 sm:p-7 lg:border-e lg:border-b-0'>
                  <header className='flex items-center justify-between gap-4'>
                    <span className='text-xs font-semibold text-[var(--landing-code-muted)] uppercase'>
                      {t('Request')}
                    </span>
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      className='text-[var(--landing-code-muted)] hover:bg-[var(--landing-code-active)] hover:text-[var(--landing-code-foreground)]'
                      onClick={() => copyToClipboard(requestCode)}
                    >
                      <HugeiconsIcon
                        icon={Copy01Icon}
                        data-icon='inline-start'
                      />
                      {copiedText === requestCode ? t('Copied') : t('Copy')}
                    </Button>
                  </header>
                  <pre className='mt-5 overflow-x-auto font-mono text-xs leading-6 text-[var(--landing-code-foreground)] sm:text-sm'>
                    {requestCode}
                  </pre>
                </section>

                <section className='p-5 sm:p-7'>
                  <header className='flex items-center justify-between gap-4 text-xs text-[var(--landing-code-muted)]'>
                    <span className='font-semibold uppercase'>
                      {t('Response')}
                    </span>
                    <span>200 OK</span>
                  </header>
                  <pre className='mt-5 overflow-x-auto font-mono text-xs leading-6 text-[var(--landing-code-foreground)] sm:text-sm'>
                    {RESPONSE_CODE}
                  </pre>
                </section>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  )
}
