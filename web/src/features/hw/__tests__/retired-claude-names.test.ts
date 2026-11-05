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
import { describe, expect, it } from 'vitest'

import { aiSetupTexts } from '../docs-ai-setup-texts'
import { AI_SETUP_PROMPTS } from '../docs-ai-setup-prompts'
import {
  FREE_TRIAL_MODELS,
  GUIDE_UI,
  LISTED_MODELS,
  MODEL_CODEX,
  MODEL_DEFAULT,
  MODEL_HAIKU,
  MODEL_OPUS,
  TOOL_GUIDES,
} from '../docs-tool-guides'
import { HW_SOLD_MODELS } from '../constants'
import { MODEL_GUIDE, RECOMMENDED_ORDER } from '../data/model-guide'
import { MODEL_PRICES } from '../data/model-prices'
import { REFERENCE_MODEL } from '../lib/usage-calculator'
import { hwTexts } from '../texts'
import { vibeTexts } from '../vibe-texts'

/**
 * The four Claude names that left the catalog on 5 Nov 2026 (decision
 * Altuner): they are neither advertised nor sold. Everything the customer
 * reads, and every name the console offers, must stay free of them; the models
 * that replaced them are the other names of the same catalog.
 */
const RETIRED_NAMES = [
  'claude-fable-5-1',
  'claude-opus-5-5',
  'claude-sonnet-5-5',
  'claude-haiku-5-5',
]

/** Every customer-visible text of the hisarweb pages, in both languages. */
const CUSTOMER_TEXTS = [
  hwTexts,
  vibeTexts,
  aiSetupTexts,
  AI_SETUP_PROMPTS,
  TOOL_GUIDES,
  GUIDE_UI,
]

describe('retired Claude names', () => {
  it('names none of them in the catalogue', () => {
    const catalogue = [
      ...HW_SOLD_MODELS,
      ...RECOMMENDED_ORDER,
      ...MODEL_PRICES.map((price) => price.model),
      ...Object.keys(MODEL_GUIDE),
    ]
    for (const name of RETIRED_NAMES) {
      expect(catalogue).not.toContain(name)
    }
  })

  it('names none of them as a model the setup guides offer', () => {
    const offered = [
      MODEL_DEFAULT,
      MODEL_OPUS,
      MODEL_HAIKU,
      MODEL_CODEX,
      REFERENCE_MODEL,
      ...FREE_TRIAL_MODELS,
      ...LISTED_MODELS.map((entry) => entry.id),
    ]
    for (const name of RETIRED_NAMES) {
      expect(offered).not.toContain(name)
    }
  })

  it('names none of them in a customer text', () => {
    for (const texts of CUSTOMER_TEXTS) {
      const text = JSON.stringify(texts)
      for (const name of RETIRED_NAMES) {
        expect(text, texts === TOOL_GUIDES ? 'tool guides' : name).not.toContain(
          name
        )
      }
    }
  })
})
