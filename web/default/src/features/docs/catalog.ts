/*
Copyright (C) 2026 DeepRouter

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
*/

/**
 * Integration docs catalog.
 *
 * The prose for each tool lives as a markdown file under
 * `public/docs/integrations/<slug>.md` and is fetched at runtime by the docs
 * pages. This catalog only describes how to group and label them — it is the
 * single source of truth for the docs sidebar and the index grid.
 */

export interface DocEntry {
  /** URL slug and markdown filename (without extension). */
  slug: string
  /** Display title in the sidebar / grid. */
  title: string
  /** One-line hint shown on the index card. */
  blurb: string
}

export interface DocCategory {
  id: string
  title: string
  entries: DocEntry[]
}

/** The master guide — rendered as the docs landing hero / first sidebar item. */
export const GUIDE_SLUG = 'GUIDE'

export const DOC_CATEGORIES: DocCategory[] = [
  {
    id: 'cli',
    title: 'AI coding assistants (terminal)',
    entries: [
      { slug: 'claude-code', title: 'Claude Code', blurb: 'Two env vars and Claude Code routes through DeepRouter.' },
      { slug: 'codex', title: 'Codex CLI', blurb: 'Add a DeepRouter model provider in config.toml.' },
      { slug: 'gemini-cli', title: 'Gemini CLI', blurb: 'Point Google’s CLI at the DeepRouter Gemini endpoint.' },
      { slug: 'opencode', title: 'OpenCode', blurb: 'A custom OpenAI-compatible provider in opencode.json.' },
    ],
  },
  {
    id: 'editors',
    title: 'Code editors & extensions',
    entries: [
      { slug: 'cursor', title: 'Cursor', blurb: 'Override the OpenAI base URL in Cursor settings.' },
      { slug: 'copilot', title: 'GitHub Copilot', blurb: 'Bring your own key via an OpenAI-compatible provider.' },
      { slug: 'cline', title: 'Cline (VS Code)', blurb: 'OpenAI-compatible or Anthropic provider in Cline.' },
      { slug: 'zed', title: 'Zed', blurb: 'A custom OpenAI-compatible model in settings.json.' },
    ],
  },
  {
    id: 'apps',
    title: 'Desktop & chat apps',
    entries: [
      { slug: 'claude-coworks', title: 'Claude Cowork', blurb: 'Set the gateway in developer mode.' },
      { slug: 'openclaw', title: 'OpenClaw', blurb: 'A provider block in openclaw.json.' },
      { slug: 'cherry-studio', title: 'Cherry Studio', blurb: 'Add an OpenAI provider with the DeepRouter host.' },
      { slug: 'botgem', title: 'BotGem', blurb: 'An OpenAI-compatible service provider.' },
      { slug: 'chatbox', title: 'Chatbox', blurb: 'OpenAI API Compatible provider with the DeepRouter host.' },
      { slug: 'lobehub', title: 'LobeChat', blurb: 'Set the OpenAI API proxy address to DeepRouter.' },
      { slug: 'opencat', title: 'OpenCat', blurb: 'Add a custom API provider with the DeepRouter host.' },
      { slug: 'nextchat', title: 'NextChat', blurb: 'Custom endpoint + key, or self-host env vars.' },
      { slug: 'workbuddy', title: 'WorkBuddy', blurb: 'A custom model entry pointing at DeepRouter.' },
    ],
  },
  {
    id: 'sdks',
    title: 'Helpers, SDKs & frameworks',
    entries: [
      { slug: 'cc-switch', title: 'CC Switch', blurb: 'A point-and-click provider switcher for Claude Code.' },
      { slug: 'openai-sdk', title: 'OpenAI SDK', blurb: 'Set base_url to DeepRouter in Python or Node.' },
      { slug: 'langchain', title: 'LangChain', blurb: 'ChatOpenAI / ChatAnthropic pointed at DeepRouter.' },
      { slug: 'llamaindex', title: 'LlamaIndex', blurb: 'OpenAILike with the DeepRouter base URL.' },
    ],
  },
  {
    id: 'other',
    title: 'Browser & other',
    entries: [
      { slug: 'immersive-translate', title: 'Immersive Translate', blurb: 'A custom OpenAI-compatible translation service.' },
      { slug: 'others', title: 'Any other tool', blurb: 'The universal rule for any tool with a base URL field.' },
    ],
  },
]

/** Flat slug → title lookup, used for page titles and link validation. */
export const DOC_TITLES: Record<string, string> = Object.fromEntries(
  DOC_CATEGORIES.flatMap((c) => c.entries.map((e) => [e.slug, e.title]))
)

export function isValidDocSlug(slug: string): boolean {
  return slug === GUIDE_SLUG || slug in DOC_TITLES
}
