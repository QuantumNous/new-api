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
export type AgentId =
  | 'claude-code'
  | 'codex-cli'
  | 'gemini-cli'
  | 'deepseek-harness'

export const AGENTS: ReadonlyArray<{
  id: AgentId
  name: string
  configPaths: {
    windows: string
    unix: string
  }
}> = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    configPaths: {
      windows: '%USERPROFILE%\\.claude\\settings.json',
      unix: '~/.claude/settings.json',
    },
  },
  {
    id: 'codex-cli',
    name: 'Codex CLI',
    configPaths: {
      windows: '%USERPROFILE%\\.codex\\config.toml',
      unix: '~/.codex/config.toml',
    },
  },
  {
    id: 'gemini-cli',
    name: 'Gemini CLI',
    configPaths: {
      windows: '%USERPROFILE%\\.gemini\\',
      unix: '~/.gemini/',
    },
  },
  {
    id: 'deepseek-harness',
    name: 'DeepSeek Harness',
    configPaths: {
      windows: '%USERPROFILE%\\.dsh\\profiles\\web\\cordis.patch.yml',
      unix: '~/.dsh/profiles/web/cordis.patch.yml',
    },
  },
]
