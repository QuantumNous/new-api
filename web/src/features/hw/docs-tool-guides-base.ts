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
 * Types and shared constants of the "Choose your program" guides in step 6 of
 * `/docs`. The addresses, the model names and the key placeholder exist here
 * once; every code block in the guide data is built from them.
 *
 * Content lives in `docs-tool-guides-*.ts`, assembled by `docs-tool-guides.ts`.
 */

export type GuideLang = 'tr' | 'en'

/** One piece of text in both languages. A missing language is a type error. */
export interface Localized {
  readonly tr: string
  readonly en: string
}

export type GuideOs = 'windows' | 'macos' | 'linux'

export type GuideToolId =
  | 'claude-code'
  | 'codex'
  | 'opencode'
  | 'zed'
  | 'cline'
  | 'copilot'
  | 'kilo'
  | 'aider'
  | 'continue'
  | 'cursor'
  | 'antigravity'

/**
 * - `works`: can be set up without a paid plan of the program.
 * - `needs-paid-plan`: the program only allows this on a paid plan.
 * - `unsupported`: the program cannot talk to another gateway at all.
 */
export type GuideStatus = 'works' | 'needs-paid-plan' | 'unsupported'

/** Which of the two gateway protocols the program uses. */
export type GuideProtocol = 'openai' | 'anthropic' | 'none'

/**
 * - `config`: holds the key, so it must contain the key placeholder.
 * - `settings`: a setting or file that holds no key (the key goes in elsewhere).
 * - `command`: something to type in a terminal.
 */
export type GuideBlockKind = 'config' | 'settings' | 'command'

export interface GuideBlock {
  readonly kind: GuideBlockKind
  /** Language for syntax highlighting: `json`, `bash`, `powershell`, ... */
  readonly language: string
  readonly code: string
  /** Short line above the block, for example the file name. */
  readonly caption?: Localized
}

export interface GuideShot {
  /** Own screenshot, under `/rehber/gids/<tool>/`. */
  readonly src: string
  readonly alt: Localized
  readonly width: number
  readonly height: number
}

export interface GuideStep {
  /** The one action of this step. */
  readonly text: Localized
  /** What the reader sees on the screen after the action. */
  readonly see?: Localized
  /** Extra remark, for example a warning. */
  readonly note?: Localized
  /** What to copy. */
  readonly blocks?: readonly GuideBlock[]
  /** Screenshot of this step, rendered under it. */
  readonly shots?: readonly GuideShot[]
  /**
   * Only for these systems. Without it the step shows everywhere. A variant
   * with any `only` step gets Windows / macOS / Linux sub tabs.
   */
  readonly only?: readonly GuideOs[]
  /** Not seen working on our own machine yet; rendered with a notice. */
  readonly unverified?: boolean
}

export interface GuideProblem {
  readonly message: Localized
  readonly cause: Localized
  readonly fix: Localized
}

export interface GuideVariant {
  readonly id: string
  readonly label: Localized
  readonly intro?: Localized
  readonly steps: readonly GuideStep[]
}

export interface ToolGuide {
  readonly id: GuideToolId
  /** Product name; the same in every language. */
  readonly name: string
  /** Short tab title when the product name is long. */
  readonly tabLabel?: Localized
  readonly status: GuideStatus
  readonly protocol: GuideProtocol
  /** Version and date of the research, e.g. "Claude Code 2.1.308, 22 Oct 2026". */
  readonly testedWith: Localized
  /** One or two plain sentences: what is this program. */
  readonly summary: Localized
  /** Remark above the steps, for example how to pick a variant. */
  readonly notice?: Localized
  /** Explanation for a program that cannot be set up (or only on a paid plan). */
  readonly limit?: Localized
  /** Free programs to try instead; they become buttons that jump to the tab. */
  readonly alternatives?: readonly GuideToolId[]
  readonly variants: readonly GuideVariant[]
  /** "Zo weet je dat het werkt": the literal expected results. */
  readonly works: readonly Localized[]
  readonly problems: readonly GuideProblem[]
  /** Screenshots of the whole tool, rendered under the steps. */
  readonly shots?: readonly GuideShot[]
}

/** The key placeholder in every config block. */
export const KEY_PLACEHOLDER = 'BURAYA_ANAHTARINIZ'

/** Name of the environment variable that holds the key for Codex, OpenCode and Kilo. */
export const KEY_ENV_NAME = 'HISARWEB_API_KEY'

/** OpenAI-compatible protocol: ends with `/v1`. */
export const OPENAI_BASE_URL = 'https://api.hisarweb.be/v1'

/** Anthropic-compatible protocol: no `/v1`, the program adds the path itself. */
export const ANTHROPIC_BASE_URL = 'https://api.hisarweb.be'

/** Main choice for coding. */
export const MODEL_DEFAULT = 'claude-sonnet-5-5'
export const MODEL_OPUS = 'claude-opus-5-5'
/**
 * The cheap default and the model of a free trial key. The older Haiku 4.5
 * cost more than Haiku 5.5 and is no longer sold.
 */
export const MODEL_HAIKU = 'claude-haiku-5-5'
export const FREE_TRIAL_MODELS = [MODEL_HAIKU] as const
/**
 * Default model of the Codex guide: a model we sell, so the sample config never
 * points at a name the gateway does not serve.
 */
export const MODEL_CODEX = MODEL_DEFAULT

/** Models listed in the config files of the programs that need a list. */
export const LISTED_MODELS: readonly { id: string; name: string }[] = [
  { id: MODEL_DEFAULT, name: 'Claude Sonnet 5.5' },
  { id: MODEL_OPUS, name: 'Claude Opus 5.5' },
  { id: MODEL_HAIKU, name: 'Claude Haiku 5.5' },
]

/** Builds a block; keeps the data files short. */
export function block(
  kind: GuideBlockKind,
  language: string,
  code: string,
  caption?: Localized
): GuideBlock {
  return { kind, language, code, caption }
}

export const OS_ORDER: readonly GuideOs[] = ['windows', 'macos', 'linux']
