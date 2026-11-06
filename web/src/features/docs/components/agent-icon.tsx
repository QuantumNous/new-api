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
import { ClaudeCode, Codex, DeepSeek, GeminiCLI } from '@lobehub/icons'

import type { AgentId } from '../constants'

export function AgentIcon(props: { agent: AgentId; size?: number }) {
  const size = props.size ?? 20
  if (props.agent === 'claude-code') {
    return <ClaudeCode.Color size={size} />
  }
  if (props.agent === 'gemini-cli') {
    return <GeminiCLI.Color size={size} />
  }
  if (props.agent === 'deepseek-harness') {
    return <DeepSeek.Color size={size} />
  }
  return <Codex.Color size={size} />
}
