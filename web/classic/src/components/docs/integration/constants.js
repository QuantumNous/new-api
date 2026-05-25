/*
Copyright (C) 2025 QuantumNous

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

import { Bot, Code2, Sparkles, Terminal, Workflow, Wrench } from 'lucide-react';

export const FACEAPI_BASE_URL = 'https://www.faceapi.ai';
export const FACEAPI_WEBSITE = 'https://www.faceapi.ai';
export const FACEAPI_BRAND = 'FaceCloud';

export const INTEGRATION_HOME_PATH = '/docs/integration';

export const INTEGRATION_NAV_ITEMS = [
  {
    id: 'claude-code',
    path: '/docs/integration/claude-code',
    titleKey: 'Claude Code',
    descriptionKey:
      'Configure Claude Code CLI to use FaceCloud as the Anthropic API gateway.',
    icon: Bot,
  },
  {
    id: 'codex',
    path: '/docs/integration/codex',
    titleKey: 'Codex',
    descriptionKey:
      'Use OpenAI Codex CLI with FaceCloud via OpenAI-compatible chat completions.',
    icon: Code2,
  },
  {
    id: 'gemini-cli',
    path: '/docs/integration/gemini-cli',
    titleKey: 'Gemini CLI',
    descriptionKey:
      'Point Google Gemini CLI at FaceCloud for Gemini-compatible requests.',
    icon: Sparkles,
  },
  {
    id: 'open-code',
    path: '/docs/integration/open-code',
    titleKey: 'OpenCode',
    descriptionKey:
      'Add FaceCloud as a custom provider in OpenCode configuration.',
    icon: Workflow,
  },
  {
    id: 'trace',
    path: '/docs/integration/trace',
    titleKey: 'Trace (Trae IDE)',
    descriptionKey:
      'Configure Trae IDE / Trae Agent with full FaceCloud endpoint paths.',
    icon: Terminal,
  },
  {
    id: 'code-buddy',
    path: '/docs/integration/code-buddy',
    titleKey: 'Code Buddy',
    descriptionKey:
      'Connect Tencent CodeBuddy CLI to FaceCloud with environment variables.',
    icon: Wrench,
  },
];
