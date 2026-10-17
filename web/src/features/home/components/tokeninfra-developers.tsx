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
import { ArrowRight, Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

export const TOKENINFRA_PYTHON_EXAMPLE = `from openai import OpenAI
import os

client = OpenAI(
    api_key=os.environ["TOKENINFRA_API_KEY"],
    base_url="https://tokeninfra.com.cn/v1",
)

response = client.chat.completions.create(
    model="deepseek-chat",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(response.choices[0].message.content)`

export function TokenInfraDevelopers() {
  const { t } = useTranslation()
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>(
    'idle'
  )
  const steps = [
    {
      title: t('Configure'),
      text: t(
        'Add your API keys, set up channels and configure access permissions'
      ),
    },
    {
      title: t('Connect'),
      text: t(
        'Connect through OpenAI, Claude, Gemini, and other compatible API routes'
      ),
    },
    {
      title: t('Monitor'),
      text: t('Track usage, costs and performance with real-time analytics'),
    },
  ]

  async function copyExample() {
    try {
      await navigator.clipboard.writeText(TOKENINFRA_PYTHON_EXAMPLE)
      setCopyState('copied')
    } catch {
      setCopyState('error')
    }
  }

  return (
    <section
      className='ti-section ti-developers'
      id='developers'
      aria-labelledby='ti-developer-title'
    >
      <div>
        <p className='ti-eyebrow'>03 / {t('For developers')}</p>
        <h2 id='ti-developer-title'>{t('Less integration. More creation.')}</h2>
        <p className='ti-section-intro'>
          {t('Keep the SDK you know. Connect to the models you need.')}
        </p>
        <ol className='ti-steps'>
          {steps.map((step, index) => (
            <li key={step.title}>
              <span className='ti-step-number'>0{index + 1}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
              <ArrowRight size={16} aria-hidden='true' />
            </li>
          ))}
        </ol>
      </div>
      <div className='ti-code-panel'>
        <div className='ti-code-toolbar'>
          <span>
            <i />
            <i />
            <i />
          </span>
          <span>quickstart.py</span>
          <Button
            variant='ghost'
            size='icon'
            onClick={copyExample}
            aria-label={t('Copy code')}
          >
            {copyState === 'copied' ? <Check size={16} /> : <Copy size={16} />}
          </Button>
        </div>
        <pre tabIndex={0} aria-label={t('API example')}>
          <code>{TOKENINFRA_PYTHON_EXAMPLE}</code>
        </pre>
        <div className='ti-code-footnote'>
          <span>
            {t('Set your API base URL and choose an available model.')}
          </span>
          <span role='status'>
            {copyState === 'copied' && t('Copied')}
            {copyState === 'error' &&
              t('Copy failed. Select and copy the code manually.')}
          </span>
        </div>
      </div>
    </section>
  )
}
