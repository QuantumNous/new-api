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
  CodeBlock,
  CodeBlockCopyButton,
} from '@/components/ai-elements/code-block'
import { PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

import { KEY_PLACEHOLDER, OPENAI_BASE_URL } from '../docs-tool-guides'
import { useHwLanguage } from '../texts'
import {
  useVibeText,
  VIBE_FILMS,
  type VibeFilmFiles,
  type VibeTextKey,
} from '../vibe-texts'
import { VibeDiagram } from './vibe-diagram'
import {
  BulletList,
  NewTabLink,
  Paragraph,
  Section,
  type VibeTranslate,
} from './vibe-parts'
import { AiHelp, Fit, Tools } from './vibe-tools'

/** Same key, two models: only the `model` field changes between the requests. */
const TWO_MODELS_EXAMPLE = ['claude-opus-5-5', 'claude-sonnet-5-5']
  .map(
    (model) => `curl ${OPENAI_BASE_URL}/chat/completions \
  -H "Authorization: Bearer ${KEY_PLACEHOLDER}" \
  -H "Content-Type: application/json" \
  -d '{"model": "${model}", "messages": [{"role": "user", "content": "Merhaba"}]}'`
  )
  .join('\n\n')

const EXPERT_KEYS: VibeTextKey[] = [
  'expertItem1',
  'expertItem2',
  'expertItem3',
  'expertItem4',
]
const WORK_KEYS: VibeTextKey[] = [
  'workItem1',
  'workItem2',
  'workItem3',
  'workItem4',
]
const CACHE_KEYS: VibeTextKey[] = [
  'cacheTip1',
  'cacheTip2',
  'cacheTip3',
  'cacheTip4',
  'cacheTip5',
]

const BUTTON_LINK = { target: '_blank', rel: 'noopener noreferrer' } as const

function Layers(props: { text: VibeTranslate }) {
  const text = props.text
  return (
    <div className='grid gap-3 sm:grid-cols-2'>
      <div className='space-y-2 rounded-lg border p-4'>
        <h3 className='text-base font-semibold'>{text('expertTitle')}</h3>
        <Paragraph>{text('expertBody')}</Paragraph>
        <BulletList text={text} keys={EXPERT_KEYS} />
      </div>
      <div className='space-y-2 rounded-lg border p-4'>
        <h3 className='text-base font-semibold'>{text('workTitle')}</h3>
        <Paragraph>{text('workBody')}</Paragraph>
        <BulletList text={text} keys={WORK_KEYS} />
      </div>
    </div>
  )
}

/** Renders nothing while there is no film, so the page has no empty box. */
export function VibeFilm(props: {
  film?: VibeFilmFiles
  title: string
  caption?: string
  label: string
}) {
  if (!props.film) return null
  return (
    <Section title={props.title}>
      {props.caption ? <Paragraph>{props.caption}</Paragraph> : null}
      <div className='overflow-hidden rounded-xl border bg-black'>
        <video
          key={props.film.src}
          controls
          playsInline
          preload='metadata'
          poster={props.film.poster}
          src={props.film.src}
          aria-label={props.label}
          className='block aspect-video w-full'
        />
      </div>
    </Section>
  )
}

/** `/vibe-kodlama`: how a beginner splits the work between subscription and key. */
export function VibePage() {
  const text = useVibeText()
  const language = useHwLanguage()

  return (
    <PublicLayout showMainContainer={false}>
      <PageTransition className='container mx-auto max-w-3xl space-y-6 px-4 pt-24 pb-12'>
        <header className='space-y-2'>
          <h1 className='text-3xl font-semibold tracking-tight'>
            {text('title')}
          </h1>
          <p className='text-muted-foreground'>{text('lead')}</p>
        </header>

        <VibeFilm
          film={VIBE_FILMS[language]}
          title={text('filmTitle')}
          caption={text('filmBody')}
          label={text('filmLabel')}
        />

        <Section title={text('forWhoTitle')}>
          <Paragraph>{text('forWhoBody')}</Paragraph>
        </Section>

        <Section title={text('ruleTitle')}>
          <p className='text-lg font-semibold'>{text('ruleSentence')}</p>
          <Paragraph>{text('ruleBody')}</Paragraph>
          <VibeDiagram text={text} />
          <Layers text={text} />
          <h3 className='pt-2 text-base font-semibold'>{text('priceTitle')}</h3>
          <Paragraph>{text('priceBody')}</Paragraph>
          <ul className='list-disc space-y-1 ps-5 text-sm'>
            <li>
              <NewTabLink href='https://claude.com/pricing'>
                {text('priceLinkClaude')}
              </NewTabLink>
            </li>
            <li>
              <NewTabLink href='https://chatgpt.com/pricing'>
                {text('priceLinkChatgpt')}
              </NewTabLink>
            </li>
          </ul>
        </Section>

        <Section title={text('oneKeyTitle')}>
          <Paragraph>{text('oneKeyBody')}</Paragraph>
          <Paragraph>{text('oneKeyCaption')}</Paragraph>
          <CodeBlock code={TWO_MODELS_EXAMPLE} language='bash'>
            <CodeBlockCopyButton />
          </CodeBlock>
        </Section>

        <Section title={text('cacheTitle')}>
          <Alert className='border-amber-500/50 bg-amber-500/10'>
            <AlertTitle>{text('warnTitle')}</AlertTitle>
            <AlertDescription>{text('warnBody')}</AlertDescription>
          </Alert>
          <Paragraph>{text('cacheBody')}</Paragraph>
          <BulletList text={text} keys={CACHE_KEYS} />
          <Paragraph>{text('cacheNote')}</Paragraph>
        </Section>

        <AiHelp text={text} />

        <Tools text={text} />

        <Section title={text('promptTitle')}>
          <Paragraph>{text('promptBody')}</Paragraph>
          <CodeBlock code={text('promptText')} language='markdown'>
            <CodeBlockCopyButton />
          </CodeBlock>
        </Section>

        <Fit text={text} />

        <Section title={text('ctaTitle')}>
          <Paragraph>{text('ctaBody')}</Paragraph>
          <div className='flex flex-wrap gap-3'>
            <Button render={<a href='/sign-up' {...BUTTON_LINK} />}>
              {text('ctaButton')}
            </Button>
            <Button
              variant='outline'
              render={<a href='/docs' {...BUTTON_LINK} />}
            >
              {text('ctaDocs')}
            </Button>
          </div>
        </Section>
      </PageTransition>
    </PublicLayout>
  )
}
