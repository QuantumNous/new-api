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
import type { GuideDoc } from '../types'

export const gettingStartedDocs: GuideDoc[] = [
  {
    slug: 'quick-start',
    group: 'start',
    title: 'Quick start',
    summary:
      'Create a key, choose an available route, and send your first request.',
    audience: 'openai',
    readingMinutes: 5,
    sections: [
      {
        id: 'before-you-start',
        title: 'Before you start',
        blocks: [
          {
            type: 'paragraph',
            text: 'You only need an API key, a Base URL, a model, and a billing group. This page fills in everything except your secret key.',
          },
          {
            type: 'callout',
            tone: 'info',
            title: 'Your key stays private',
            text: 'The examples use a masked placeholder. Copy the real key from the API Keys page only when your client asks for it.',
          },
        ],
      },
      {
        id: 'connect',
        title: 'Connect in three steps',
        blocks: [
          {
            type: 'steps',
            items: [
              {
                title: 'Choose a model and group',
                text: 'Use the selectors above. Only combinations available to your account are shown.',
              },
              {
                title: 'Create an API key',
                text: 'Create the key in {{GROUP}} so billing and routing match the selection above.',
                action: { label: 'Open API Keys', to: '/keys' },
              },
              {
                title: 'Send a minimal request',
                text: 'Run this request after replacing the masked key with your real key.',
                code: {
                  label: 'curl',
                  language: 'bash',
                  copyLabel: 'Copy request',
                  template: `curl {{FULL_URL}} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer {{API_KEY_PLACEHOLDER}}" \\
  -d '{"model":"{{MODEL}}","messages":[{"role":"user","content":"Reply with: connected"}]}'`,
                },
              },
            ],
          },
        ],
      },
      {
        id: 'verify',
        title: 'Know that it worked',
        blocks: [
          {
            type: 'paragraph',
            text: 'A successful response confirms the address, key, model, and group can work together. You can inspect the request in Usage Logs afterward.',
          },
          {
            type: 'callout',
            tone: 'warning',
            title: 'If the first request fails',
            text: 'Do not keep changing every value at once. Check the status code, then use the troubleshooting article to verify one value at a time.',
          },
        ],
      },
    ],
  },
  {
    slug: 'essentials',
    group: 'start',
    title: 'Keys, addresses, models, and groups',
    summary:
      'Understand the four values every compatible client needs before you configure it.',
    audience: 'all',
    readingMinutes: 7,
    sections: [
      {
        id: 'four-values',
        title: 'The four values',
        blocks: [
          {
            type: 'table',
            columns: ['Value', 'What it controls', 'Where to get it'],
            rows: [
              [
                'API key',
                'Authenticates a request and applies its access limits.',
                'Create and copy it from API Keys.',
              ],
              [
                'Base URL',
                'Tells the client which gateway should receive the request.',
                '{{BASE_URL}}',
              ],
              [
                'Model',
                'Chooses the capability used for the request.',
                'Choose one from the account-aware selector above.',
              ],
              [
                'Group',
                'Chooses an available billing and routing group.',
                'Choose a group that supports the selected model.',
              ],
            ],
          },
        ],
      },
      {
        id: 'addresses',
        title: 'Choose the correct address form',
        blocks: [
          {
            type: 'table',
            columns: ['Client field', 'Use this value'],
            rows: [
              ['Host or API host', '{{HOST}}'],
              ['Base URL', '{{BASE_URL}}'],
              ['Full Chat Completions endpoint', '{{FULL_URL}}'],
              ['Anthropic-compatible Base URL', '{{HOST}}'],
            ],
          },
          {
            type: 'callout',
            tone: 'warning',
            title: 'Avoid a duplicated path',
            text: 'If a client appends /v1 or /chat/completions automatically, enter only the shorter address it requests. A duplicated path usually returns 404.',
          },
        ],
      },
      {
        id: 'compatibility',
        title: 'Model and group compatibility',
        blocks: [
          {
            type: 'paragraph',
            text: 'A key can only call models enabled for its selected group. The selector on this page checks the current account and hides incompatible combinations.',
          },
          {
            type: 'steps',
            items: [
              {
                title: 'Pick the model first',
                text: 'Choose the model required by your client or workflow.',
              },
              {
                title: 'Pick a compatible group',
                text: 'The group list is filtered after the model changes.',
              },
              {
                title: 'Create an API key',
                text: 'Create the key in {{GROUP}} so billing and routing match the selection above.',
              },
            ],
          },
        ],
      },
      {
        id: 'key-safety',
        title: 'Keep keys safe',
        blocks: [
          {
            type: 'callout',
            tone: 'warning',
            title: 'Treat an API key like a password',
            text: 'Do not paste it into screenshots, chat messages, source control, browser URLs, or public issue reports. Revoke a key immediately if it is exposed.',
          },
        ],
      },
    ],
  },
]
