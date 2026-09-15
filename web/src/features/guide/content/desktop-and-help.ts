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

export const desktopAndHelpDocs: GuideDoc[] = [
  {
    slug: 'cherry-studio',
    group: 'desktop',
    title: 'Cherry Studio',
    summary:
      'Add an OpenAI-compatible provider, select a model, and test the connection.',
    audience: 'openai',
    readingMinutes: 6,
    sections: [
      {
        id: 'prepare',
        title: 'Prepare the connection',
        blocks: [
          {
            type: 'paragraph',
            text: 'Create a dedicated API key first, then keep this page open while adding a custom provider in Cherry Studio.',
          },
        ],
      },
      {
        id: 'configure',
        title: 'Add a provider',
        blocks: [
          {
            type: 'steps',
            items: [
              {
                title: 'Open Model Services',
                text: 'In Settings, choose Add and select OpenAI Compatible.',
              },
              {
                title: 'Enter the connection values',
                text: 'Use {{BASE_URL}}, your real API key, and the selected model shown above.',
              },
              {
                title: 'Use a key from the selected group',
                text: 'Create or edit the API key so its group is {{GROUP}}. The client only needs the key.',
              },
              {
                title: 'Save and test',
                text: 'Run the built-in connection check, then send one short message in a new chat.',
              },
            ],
          },
          {
            type: 'table',
            columns: ['Field', 'Value'],
            rows: [
              ['Provider type', 'OpenAI Compatible'],
              ['API key', '{{API_KEY_PLACEHOLDER}}'],
              ['API address', '{{BASE_URL}}'],
              ['Model ID', '{{MODEL}}'],
            ],
          },
        ],
      },
      {
        id: 'path-differences',
        title: 'Handle address differences',
        blocks: [
          {
            type: 'callout',
            tone: 'warning',
            title: 'Check what the field expects',
            text: 'If the client appends /v1 automatically, use {{HOST}}. If it asks for a Base URL, use {{BASE_URL}}. A duplicated /v1 usually returns 404.',
          },
        ],
      },
    ],
  },
  {
    slug: 'troubleshooting',
    group: 'help',
    title: 'Troubleshooting',
    summary:
      'Use the response code and a fixed checklist to find configuration problems quickly.',
    audience: 'all',
    readingMinutes: 7,
    sections: [
      {
        id: 'errors',
        title: 'Common errors',
        blocks: [
          {
            type: 'table',
            columns: ['Error', 'Usually means', 'Check first'],
            rows: [
              [
                '401 or invalid_api_key',
                'The key is missing, malformed, disabled, or copied with whitespace.',
                'Copy the key again from API Keys and replace the masked placeholder.',
              ],
              [
                '404',
                'The client built the wrong endpoint path.',
                'Check whether the field expects {{HOST}}, {{BASE_URL}}, or {{FULL_URL}}.',
              ],
              [
                '429',
                'The request rate, concurrency, or account quota was exceeded.',
                'Reduce concurrency and inspect account balance and limits.',
              ],
              [
                'model_not_found',
                'The model name is wrong or unavailable in the selected group.',
                'Choose the model and group again from the selectors above.',
              ],
              [
                'Empty model list',
                'No enabled model matches the current account and protocol.',
                'Open Models and confirm the endpoint capability and group access.',
              ],
              [
                'Chat works but tools fail',
                'The model or endpoint does not support the required tool protocol.',
                'Choose a model whose capability list includes tools for that endpoint.',
              ],
            ],
          },
        ],
      },
      {
        id: 'checklist',
        title: 'Check one thing at a time',
        blocks: [
          {
            type: 'steps',
            items: [
              {
                title: 'Confirm the key',
                text: 'Use an enabled key and remove leading or trailing whitespace.',
              },
              {
                title: 'Confirm the address form',
                text: 'Compare the client field label with {{HOST}}, {{BASE_URL}}, and {{FULL_URL}}.',
              },
              {
                title: 'Confirm model and group together',
                text: 'Use the account-aware selectors instead of typing an old value from memory.',
              },
              {
                title: 'Confirm the protocol',
                text: 'Codex needs Responses, Claude Code needs Anthropic Messages, and Cherry Studio uses an OpenAI-compatible endpoint.',
              },
              {
                title: 'Restart the client',
                text: 'Terminal and editor processes do not automatically reload changed environment variables.',
              },
              {
                title: 'Test the smallest request',
                text: 'Verify a one-line response before enabling tools, files, images, or long context.',
              },
            ],
          },
        ],
      },
    ],
  },
]
