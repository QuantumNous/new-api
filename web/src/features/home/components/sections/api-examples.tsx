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
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'

interface ApiExamplesProps {
  className?: string
}

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className='overflow-x-auto rounded-lg border border-border/30 bg-[#0d1117] p-4 text-[11px] leading-[1.7] text-[#e6edf3] dark:bg-[#0d1117] [&>code]:font-mono'>
      <code>{code}</code>
    </pre>
  )
}

const examples = [
  {
    key: 'speech',
    titleKey: 'Speech Recognition & Synthesis' as const,
    tabKey: 'Speech Models',
    description:
      'Convert speech to text with Whisper, or generate natural-sounding speech with TTS models through the OpenAI-compatible audio API.',
    curl: `curl https://api.example.com/v1/audio/transcriptions \\
  -H "Authorization: Bearer $API_KEY" \\
  -F file="@meeting.mp3" \\
  -F model="whisper-1" \\
  -F language="zh"

# Text-to-Speech
curl https://api.example.com/v1/audio/speech \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "tts-1",
    "input": "你好，欢迎使用三五数字AI平台",
    "voice": "nova"
  }'`,
  },
  {
    key: 'audio',
    titleKey: 'Audio Generation' as const,
    tabKey: 'Audio Models',
    description:
      'Generate music, sound effects, and audio content using advanced audio generation models. Specify duration, style, and instrumentation.',
    curl: `curl https://api.example.com/v1/audio/generations \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "audio-model-name",
    "input": "A calm piano melody with ambient nature sounds",
    "duration": 30,
    "format": "mp3"
  }'

# Audio understanding
curl https://api.example.com/v1/audio/transcriptions \\
  -H "Authorization: Bearer $API_KEY" \\
  -F file="@podcast.mp3" \\
  -F model="whisper-1" \\
  -F response_format="verbose_json"`,
  },
  {
    key: 'vision',
    titleKey: 'Vision & Image Understanding',
    tabKey: 'Vision Models',
    description:
      'Analyze images, diagrams, and screenshots using multimodal vision models. Supports both URL-based and base64-encoded images.',
    curl: `curl https://api.example.com/v1/chat/completions \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4o",
    "messages": [
      {
        "role": "user",
        "content": [
          { "type": "text", "text": "描述这张图片的内容" },
          { "type": "image_url",
            "image_url": {
              "url": "https://example.com/diagram.png"
            }
          }
        ]
      }
    ],
    "max_tokens": 1000
  }'`,
  },
]

export function ApiExamples(_props: ApiExamplesProps) {
  const { t } = useTranslation()

  return (
    <section className='relative z-10 overflow-hidden px-6 py-24 md:py-32'>
      {/* Background accent */}
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 -z-10 opacity-15 dark:opacity-[0.06]'
        style={{
          background:
            'radial-gradient(ellipse 45% 40% at 50% 40%, oklch(0.6 0.14 240 / 50%) 0%, transparent 70%)',
        }}
      />

      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-16 max-w-lg'>
          <p className='text-muted-foreground mb-3 text-sm font-medium tracking-widest uppercase'>
            {t('API Examples')}
          </p>
          <h2 className='text-3xl leading-tight font-bold tracking-tight md:text-4xl'>
            <span className='bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-500 bg-clip-text text-transparent'>
              {t('One API')}
            </span>
            <br />
            {t('for speech, audio, and vision')}
          </h2>
          <p className='text-muted-foreground/70 mt-3 max-w-md text-base leading-relaxed'>
            {t(
              'All models share the same OpenAI-compatible protocol. Switch endpoints and models without changing your integration code.'
            )}
          </p>
        </AnimateInView>

        <div className='space-y-6'>
          {examples.map((ex, i) => (
            <AnimateInView
              key={ex.key}
              delay={i * 100}
              animation='fade-up'
              className='group relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-b from-card/80 to-card/30 transition-all duration-300 hover:border-border hover:shadow-md dark:from-card/5 dark:to-card/0'
            >
              {/* Accent line */}
              <div
                aria-hidden
                className='absolute top-0 left-[10%] h-[2px] w-[80%] bg-gradient-to-r from-transparent via-cyan-500/15 to-transparent'
              />

              <div className='grid gap-0 md:grid-cols-5'>
                {/* Left: description */}
                <div className='flex flex-col justify-center p-6 md:col-span-2 md:p-8'>
                  <span className='border-border/40 bg-muted/30 mb-3 inline-flex w-fit rounded-md border px-2 py-0.5 text-xs font-medium text-muted-foreground'>
                    {t(ex.tabKey)}
                  </span>
                  <h3 className='mb-2 text-lg font-semibold'>
                    {t(ex.titleKey)}
                  </h3>
                  <p className='text-muted-foreground text-base leading-relaxed'>
                    {t(ex.description)}
                  </p>
                </div>

                {/* Right: code block */}
                <div className='md:col-span-3'>
                  <CodeBlock code={ex.curl} />
                </div>
              </div>
            </AnimateInView>
          ))}
        </div>

        {/* Bottom note */}
        <AnimateInView
          className='border-border/30 bg-muted/10 mx-auto mt-10 max-w-xl rounded-xl border p-4 text-center'
          animation='fade-in'
        >
          <p className='text-muted-foreground/70 text-sm leading-relaxed'>
            {t(
              'Replace api.example.com with your server address. All API calls use standard OpenAI request format — compatible with any OpenAI SDK.'
            )}
          </p>
        </AnimateInView>
      </div>
    </section>
  )
}
