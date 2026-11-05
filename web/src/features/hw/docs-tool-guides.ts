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
/**
 * Data of the "Choose your program" section in step 6 of `/docs`.
 *
 * How to extend it:
 * - A new program: add a `ToolGuide` to `docs-tool-guides-a|b|c.ts` and put it
 *   in `TOOL_GUIDES` below at the position of its tab. Add the id to `GuideToolId`.
 * - A screenshot: put the file in `public/rehber/gids/<tool>/` and add
 *   `shots: [{ src: '/rehber/gids/<tool>/<name>.png', alt: { tr, en }, width, height }]`
 *   to a step (or to the tool). Nothing is rendered for a step without `shots`.
 * - A tested version: change the `testedWith` text of the tool.
 */
import { TOOL_GUIDES_A } from './docs-tool-guides-a'
import { TOOL_GUIDES_B } from './docs-tool-guides-b'
import {
  ANTHROPIC_BASE_URL,
  block,
  FREE_TRIAL_MODELS,
  KEY_PLACEHOLDER,
  MODEL_HAIKU,
  OPENAI_BASE_URL,
  type GuideProtocol,
  type GuideStep,
  type GuideToolId,
  type ToolGuide,
} from './docs-tool-guides-base'
import { TOOL_GUIDES_C } from './docs-tool-guides-c'
import { OPEN_TERMINAL_STEPS } from './docs-tool-guides-shared'

export * from './docs-tool-guides-base'

/** Tab order of the guide. Claude Code first, the two honest tabs last. */
export const TOOL_ORDER: readonly GuideToolId[] = [
  'claude-code',
  'codex',
  'opencode',
  'zed',
  'cline',
  'copilot',
  'kilo',
  'aider',
  'continue',
  'cursor',
  'antigravity',
]

const ALL_GUIDES: readonly ToolGuide[] = [
  ...TOOL_GUIDES_A,
  ...TOOL_GUIDES_B,
  ...TOOL_GUIDES_C,
]

export const TOOL_GUIDES: readonly ToolGuide[] = TOOL_ORDER.flatMap((id) => {
  const guide = ALL_GUIDES.find((candidate) => candidate.id === id)
  return guide ? [guide] : []
})

/** Programs that the beginner should pick when in doubt. */
export const RECOMMENDED_TOOLS: readonly GuideToolId[] = ['cline', 'opencode']

export function findGuide(id: GuideToolId): ToolGuide | undefined {
  return TOOL_GUIDES.find((guide) => guide.id === id)
}

/** The two protocols of the gateway, in the order of the table. */
export const PROTOCOL_ROWS: readonly {
  readonly protocol: Exclude<GuideProtocol, 'none'>
  readonly url: string
}[] = [
  { protocol: 'openai', url: OPENAI_BASE_URL },
  { protocol: 'anthropic', url: ANTHROPIC_BASE_URL },
]

/** Steps that test the key before any program is set up. */
const MODELS_URL = `${OPENAI_BASE_URL}/models`
const CHAT_URL = `${OPENAI_BASE_URL}/chat/completions`
const CHAT_BODY = `{"model":"${MODEL_HAIKU}","messages":[{"role":"user","content":"Merhaba!"}]}`

export const KEY_TEST_STEPS: readonly GuideStep[] = [
  ...OPEN_TERMINAL_STEPS,
  {
    only: ['windows'],
    text: {
      tr: 'PowerShell’e şu komutu yapıştırıp Enter’a basın. BURAYA_ANAHTARINIZ yerine anahtarınızı yazın. (curl.exe yazılır; “curl” tek başına PowerShell’de başka bir komuttur.)',
      en: 'Paste this command into PowerShell and press Enter. Replace BURAYA_ANAHTARINIZ with your key. (Write curl.exe; plain “curl” is a different command in PowerShell.)',
    },
    blocks: [
      block(
        'config',
        'powershell',
        `curl.exe ${MODELS_URL} -H "Authorization: Bearer ${KEY_PLACEHOLDER}"`
      ),
    ],
    see: {
      tr: 'Bir model listesi (JSON metni) gelir; içinde claude-sonnet-5-5 gibi model adları görünür.',
      en: 'A model list (JSON text) comes back; it contains model names such as claude-sonnet-5-5.',
    },
  },
  {
    only: ['macos', 'linux'],
    text: {
      tr: 'Terminal’e şu komutu yapıştırıp Enter’a basın. BURAYA_ANAHTARINIZ yerine anahtarınızı yazın.',
      en: 'Paste this command into the terminal and press Enter. Replace BURAYA_ANAHTARINIZ with your key.',
    },
    blocks: [
      block(
        'config',
        'bash',
        `curl ${MODELS_URL} -H "Authorization: Bearer ${KEY_PLACEHOLDER}"`
      ),
    ],
    see: {
      tr: 'Bir model listesi (JSON metni) gelir; içinde claude-sonnet-5-5 gibi model adları görünür.',
      en: 'A model list (JSON text) comes back; it contains model names such as claude-sonnet-5-5.',
    },
  },
  {
    only: ['windows'],
    text: {
      tr: 'İsterseniz kısa bir soru da sorun. Bu komut PowerShell’in kendi aracıyla gönderilir ve ücretsiz deneme anahtarıyla da çalışır.',
      en: 'If you like, ask a short question too. This command is sent with the own tool of PowerShell and also works with a free trial key.',
    },
    blocks: [
      block(
        'config',
        'powershell',
        `Invoke-RestMethod -Uri "${CHAT_URL}" -Method Post -ContentType "application/json" -Headers @{ Authorization = "Bearer ${KEY_PLACEHOLDER}" } -Body '${CHAT_BODY}'`
      ),
    ],
    see: {
      tr: 'Yanıtın içinde “choices” bölümü ve modelin cevap metni görünür.',
      en: 'The reply contains a “choices” part with the answer text of the model.',
    },
  },
  {
    only: ['macos', 'linux'],
    text: {
      tr: 'İsterseniz kısa bir soru da sorun. Bu komut ücretsiz deneme anahtarıyla da çalışır.',
      en: 'If you like, ask a short question too. This command also works with a free trial key.',
    },
    blocks: [
      block(
        'config',
        'bash',
        `curl ${CHAT_URL} \\\n  -H "Authorization: Bearer ${KEY_PLACEHOLDER}" \\\n  -H "Content-Type: application/json" \\\n  -d '${CHAT_BODY}'`
      ),
    ],
    see: {
      tr: 'Yanıtın içinde “choices” bölümü ve modelin cevap metni görünür.',
      en: 'The reply contains a “choices” part with the answer text of the model.',
    },
  },
]

/** All fixed texts of the section, per language. */
export interface GuideUi {
  readonly intro: string
  readonly recommendation: string
  readonly recommendationHint: string
  readonly protocolTitle: string
  readonly protocolIntro: string
  readonly protocolColumnProtocol: string
  readonly protocolColumnUrl: string
  readonly protocolColumnPrograms: string
  readonly protocolNames: Readonly<
    Record<Exclude<GuideProtocol, 'none'>, string>
  >
  readonly protocolNoSlash: string
  readonly freeTrialNote: string
  readonly paidPlanSuffix: string
  readonly keyTestTitle: string
  readonly keyTestIntro: string
  readonly keyTestWarning: string
  readonly keyTest401: string
  readonly pickTitle: string
  readonly pickLabel: string
  readonly osLabel: string
  readonly variantLabel: string
  readonly osNames: Readonly<Record<'windows' | 'macos' | 'linux', string>>
  readonly protocolLine: string
  readonly protocolValues: Readonly<Record<GuideProtocol, string>>
  readonly testedWith: string
  readonly see: string
  readonly note: string
  readonly unverified: string
  readonly worksTitle: string
  readonly problemsTitle: string
  readonly problemCause: string
  readonly problemFix: string
  readonly limitTitle: Readonly<
    Record<'needs-paid-plan' | 'unsupported', string>
  >
  readonly alternativesLead: string
  readonly tryInstead: string
  readonly rooNote: string
}

export const GUIDE_UI: Readonly<Record<'tr' | 'en', GuideUi>> = {
  tr: {
    intro:
      'HisarWeb AI’yi birçok kodlama programıyla kullanabilirsiniz. Önce anahtarınızı deneyin, sonra kullanmak istediğiniz programın sekmesini açın ve adımları sırayla izleyin. Her adımda tek bir şey yaparsınız.',
    recommendation:
      'Emin değilseniz: Cline (VS Code içinde) ya da OpenCode seçin.',
    recommendationHint:
      'Hangisini seçeceğinizi bilmiyorsanız Cline’ı (VS Code içinde) ya da OpenCode’u seçin. İkisi de ücretsizdir ve kendi anahtarınızla çalışır.',
    protocolTitle: 'Hangi program hangi adresi kullanır?',
    protocolIntro:
      'HisarWeb AI iki “dil” konuşur. Programınızın hangisini istediği aşağıdaki tabloda yazar; ayrıntıyı programın sekmesinde de bulursunuz.',
    protocolColumnProtocol: 'Dil (protokol)',
    protocolColumnUrl: 'Basis-URL (temel adres)',
    protocolColumnPrograms: 'Programlar',
    protocolNames: {
      openai: 'OpenAI uyumlu',
      anthropic: 'Anthropic uyumlu',
    },
    protocolNoSlash: 'Sonunda /v1 yoktur: program yolu kendisi ekler.',
    freeTrialNote:
      'Ücretsiz deneme anahtarı yalnızca haiku modellerini çalıştırır: {models}. Diğer modeller için ücretli bakiye gerekir.',
    paidPlanSuffix: 'ücretli plan gerekir',
    keyTestTitle: 'Önce anahtarınızı deneyin',
    keyTestIntro:
      'Bir programı ayarlamadan önce anahtarınızın çalıştığını görün. Böylece sorun çıkarsa suçlunun program mı anahtar mı olduğunu bilirsiniz. “Terminal”, bilgisayara yazıyla komut verdiğiniz penceredir.',
    keyTestWarning:
      'Anahtarınız özeldir. Bir ekran görüntüsüne, sohbete, e-postaya ya da herkese açık bir yere asla yazmayın. Aşağıdaki BURAYA_ANAHTARINIZ yerine yalnızca kendi bilgisayarınızda gerçek anahtarı yazın.',
    keyTest401:
      '401 görürseniz anahtar yanlış ya da eksiktir: anahtarı baştan sona yeniden kopyalayın ve başında ya da sonunda boşluk bırakmayın. 402 görürseniz bakiyeniz yetersizdir.',
    pickTitle: 'Programınızın adımları',
    pickLabel: 'Programlar',
    osLabel: 'İşletim sistemi',
    variantLabel: 'Sürüm',
    osNames: { windows: 'Windows', macos: 'macOS', linux: 'Linux' },
    protocolLine: 'Kullandığı protokol ve adres',
    protocolValues: {
      openai: 'OpenAI uyumlu',
      anthropic: 'Anthropic uyumlu',
      none: 'HisarWeb AI ile bağlanamaz',
    },
    testedWith: 'Test edilen sürüm',
    see: 'Ne görürsünüz',
    note: 'Not',
    unverified:
      'Bu adımı kendi bilgisayarımızda henüz adım adım denemedik. Ekranınız bundan farklı görünebilir; takılırsanız sorun listesine bakın.',
    worksTitle: 'Çalıştığını nasıl anlarsınız',
    problemsTitle: 'Sık karşılaşılan sorunlar',
    problemCause: 'Neden',
    problemFix: 'Çözüm',
    limitTitle: {
      'needs-paid-plan': 'Bu program için ücretli plan gerekir',
      unsupported: 'Bu program HisarWeb AI ile çalışmaz',
    },
    alternativesLead: 'Ücretsiz seçenekler:',
    tryInstead: '{name} sekmesine git',
    rooNote: 'Roo Code 15 Mayıs 2026’da kapandı; onun yerine Cline kullanın.',
  },
  en: {
    intro:
      'You can use HisarWeb AI with many coding programs. First test your key, then open the tab of the program you want and follow the steps in order. Each step is one action.',
    recommendation: 'Not sure? Choose Cline (in VS Code) or OpenCode.',
    recommendationHint:
      'If you do not know which one to choose, pick Cline (inside VS Code) or OpenCode. Both are free and work with your own key.',
    protocolTitle: 'Which program uses which address?',
    protocolIntro:
      'HisarWeb AI speaks two “languages”. The table below shows which one your program wants; the tab of the program repeats the detail.',
    protocolColumnProtocol: 'Language (protocol)',
    protocolColumnUrl: 'Base URL',
    protocolColumnPrograms: 'Programs',
    protocolNames: {
      openai: 'OpenAI compatible',
      anthropic: 'Anthropic compatible',
    },
    protocolNoSlash: 'No /v1 at the end: the program adds the path itself.',
    freeTrialNote:
      'A free trial key only runs the haiku models: {models}. Other models need paid balance.',
    paidPlanSuffix: 'needs a paid plan',
    keyTestTitle: 'Test your key first',
    keyTestIntro:
      'Before you set up a program, see that your key works. If something goes wrong later you then know whether the program or the key is to blame. The “terminal” is the window where you give the computer commands by typing.',
    keyTestWarning:
      'Your key is private. Never write it in a screenshot, a chat, an email or any public place. Replace BURAYA_ANAHTARINIZ below with the real key only on your own computer.',
    keyTest401:
      'If you see 401 the key is wrong or missing: copy the key again from start to end and leave no space at the start or end. If you see 402 your balance is too low.',
    pickTitle: 'Steps for your program',
    pickLabel: 'Programs',
    osLabel: 'Operating system',
    variantLabel: 'Version',
    osNames: { windows: 'Windows', macos: 'macOS', linux: 'Linux' },
    protocolLine: 'Protocol and address it uses',
    protocolValues: {
      openai: 'OpenAI compatible',
      anthropic: 'Anthropic compatible',
      none: 'cannot connect to HisarWeb AI',
    },
    testedWith: 'Tested with',
    see: 'What you see',
    note: 'Note',
    unverified:
      'We have not stepped through this step on our own computer yet. Your screen may look different; if you get stuck, see the problem list.',
    worksTitle: 'How you know it works',
    problemsTitle: 'Common problems',
    problemCause: 'Cause',
    problemFix: 'Fix',
    limitTitle: {
      'needs-paid-plan': 'This program needs a paid plan',
      unsupported: 'This program does not work with HisarWeb AI',
    },
    alternativesLead: 'Free options:',
    tryInstead: 'Go to the {name} tab',
    rooNote: 'Roo Code was shut down on 15 May 2026; use Cline instead.',
  },
}

/** Models a free trial key may use, as text for the table note. */
export const FREE_TRIAL_MODELS_TEXT = FREE_TRIAL_MODELS.join(', ')
