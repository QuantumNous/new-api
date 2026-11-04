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
 * Plain-language guide for the models HisarWeb AI sells, written for people who
 * are new to AI coding tools. This is the single place for the texts: the
 * catalogue cards use them when the database has no description of its own,
 * and `RECOMMENDED_ORDER` is the default order of the catalogue and the price
 * table.
 */

import { premiumStepDown, type ModelPrice, MODEL_PRICES } from './model-prices'

export type GuideText = {
  tr: string
  en: string
}

export type ModelGuide = {
  /** Short badge shown next to the model name. */
  tag: GuideText
  /** One or two short sentences: what it is good at, with an example. */
  description: GuideText
}

/** Default order of the catalogue ("Recommended"): strongest first, the
 *  newcomer of a price tier directly after its established peer. */
export const RECOMMENDED_ORDER = [
  'claude-fable-5-1',
  'gpt-6-astra',
  'claude-opus-5-5',
  'claude-sonnet-5-5',
  'gpt-6.1-sol',
  'claude-haiku-5-5',
  'gpt-6-luna',
  'grok-4',
  'grok-4-fast',
] as const

export const MODEL_GUIDE: Readonly<Record<string, ModelGuide>> = {
  'claude-fable-5-1': {
    tag: { tr: 'En güçlü', en: 'Most powerful' },
    description: {
      tr: 'En zor işler için en güçlü model. Derin düşünme gerektiren sorunlarda ve saatler süren, çok adımlı görevlerde kullanın; örneğin büyük bir uygulamanın tasarımını baştan kurmak.',
      en: 'The strongest model, for the hardest jobs. Use it for problems that need deep thinking and for multi-step tasks that run for hours, such as designing a large app from scratch.',
    },
  },
  'claude-opus-5-5': {
    tag: { tr: 'Büyük projeler', en: 'Big projects' },
    description: {
      tr: 'Büyük ve karmaşık kodlama işleri ile uzun süren görevler için. Birçok dosyayı kapsayan bir değişikliği baştan sona kendisi yapabilir; Fable’dan daha hızlı ve ucuz.',
      en: 'For large, complex coding work and long-running tasks. It can carry out a change that spans many files from start to finish, faster and cheaper than Fable.',
    },
  },
  'claude-sonnet-5-5': {
    tag: {
      tr: 'Önerilen: en iyi fiyat/performans',
      en: 'Recommended: best value',
    },
    description: {
      tr: 'Her gün kodlama yapmak ve uygulama geliştirmek için en dengeli seçim. Bir açılış sayfasını ya da basit bir uygulamayı hızlıca kurmak için idealdir.',
      en: 'The best balance of price and quality for everyday coding and building apps. Ideal for quickly putting together a landing page or a simple app.',
    },
  },
  'claude-haiku-5-5': {
    tag: {
      tr: 'Önerilen: en hızlı ve ucuz',
      en: 'Recommended: fastest and cheapest',
    },
    description: {
      tr: 'Çok hızlı ve çok ucuz. Sohbet botu, metin özetleme ya da yüzlerce küçük işi (sınıflandırma, bilgi çıkarma) arka arkaya yapmak için uygundur.',
      en: 'Very fast and very cheap. A good fit for a chatbot, summarising text, or running hundreds of small jobs (sorting, extracting facts) in a row.',
    },
  },
  'gpt-6-astra': {
    tag: {
      tr: 'OpenAI’nin en güçlüsü',
      en: 'OpenAI’s most powerful',
    },
    description: {
      tr: 'OpenAI’nin amiral gemisi modeli. En zor araştırma sorunları, saatler süren çok adımlı görevler ve bir uygulamanın tamamını kapsayan büyük yeniden yazımlar için; Fable ile aynı fiyat sınıfında.',
      en: 'OpenAI’s flagship model. For the hardest research problems, multi-step jobs that run for hours, and rewrites that span a whole app; priced in the same tier as Fable.',
    },
  },
  'gpt-6.1-sol': {
    tag: {
      tr: 'OpenAI: en iyi fiyat/performans',
      en: 'OpenAI: best value',
    },
    description: {
      tr: 'OpenAI dünyasında günlük kodlamanın dengeli seçimi. Cursor veya Codex ile uygulama geliştirmek ve birçok dosyayı kapsayan değişikliği baştan sona tamamlamak için idealdir; Sonnet ile aynı fiyata.',
      en: 'The balanced pick for everyday coding in the OpenAI family. Ideal for building apps with Cursor or Codex and carrying a change across many files from start to finish, at the same price as Sonnet.',
    },
  },
  'gpt-6-luna': {
    tag: {
      tr: 'OpenAI: en hızlı ve ucuz',
      en: 'OpenAI: fastest and cheapest',
    },
    description: {
      tr: 'OpenAI’nin en hızlı ve en ucuz modeli. Sohbet, kısa özetleme, sınıflandırma ve yüzlerce küçük işi arka arkaya çalıştırmak için uygundur; Haiku ile aynı fiyata OpenAI kalitesi.',
      en: 'OpenAI’s fastest and cheapest model. A good fit for chat, short summaries, sorting and running hundreds of small jobs in a row, with OpenAI quality at the same price as Haiku.',
    },
  },
  'grok-4': {
    tag: {
      tr: 'Güçlü akıl yürütme',
      en: 'Strong reasoning',
    },
    description: {
      tr: 'xAI’nin güçlü modeli. Zor mantık problemleri, karmaşık analizler ve uzun çok adımlı görevler için. Bu sitede yanıtları biraz daha yavaş gelir; sabırlı ve derin işlerde kullanın.',
      en: 'xAI’s powerful model. For hard logic problems, complex analysis and long multi-step jobs. On this site its answers arrive a little slower; use it for patient, deep work.',
    },
  },
  'grok-4-fast': {
    tag: {
      tr: 'Günlük Grok',
      en: 'Everyday Grok',
    },
    description: {
      tr: 'xAI’nin günlük işler için tasarlanmış Grok sürümü. Sohbet, kısa kod yardımı ve basit otomasyonlar için grok-4 ile aynı fiyata sunulur; hızı burada günün yoğunluğuna göre değişir.',
      en: 'xAI’s Grok version built for everyday jobs. Offered at the same price as grok-4 for chat, quick coding help and simple automations; its speed here varies with how busy the day is.',
    },
  },
}

/** The guide entry of a model, or undefined for a model that is not in it. */
export function modelGuide(
  modelName: string | undefined
): ModelGuide | undefined {
  if (!modelName) return undefined
  return MODEL_GUIDE[modelName]
}

/** Pick the Turkish or English version of a guide text. */
export function guideText(text: GuideText, language: string): string {
  return language.toLowerCase().startsWith('tr') ? text.tr : text.en
}

/**
 * Position of a model in the recommended order; models that are not in the
 * list come after it.
 */
export function recommendedRank(modelName: string | undefined): number {
  const index = (RECOMMENDED_ORDER as readonly string[]).indexOf(
    modelName ?? ''
  )
  return index === -1 ? RECOMMENDED_ORDER.length : index
}

/** Notice on a premium model; `{model}` is the model one step lower. */
export const PREMIUM_NOTICE: GuideText = {
  tr: 'Bu model kredinizi çok daha hızlı tüketir. Bir alt model, {model}, çok daha ucuz ve neredeyse aynı kalitede.',
  en: 'This model uses up your credit much faster. The model one step lower, {model}, is much cheaper and almost as good.',
}

/**
 * The premium notice of a model in the given language, or undefined when the
 * model is not premium or has no cheaper model of the same provider.
 */
export function premiumNotice(
  modelName: string | undefined,
  language: string,
  models: readonly ModelPrice[] = MODEL_PRICES
): string | undefined {
  const stepDown = premiumStepDown(modelName, models)
  if (!stepDown) return undefined
  return guideText(PREMIUM_NOTICE, language).replace('{model}', stepDown)
}
