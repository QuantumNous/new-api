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

const installClaudeCode = {
  label: 'Install Claude Code',
  language: 'bash',
  copyLabel: 'Copy install command',
  template: 'npm install -g @anthropic-ai/claude-code',
}

const installCodex = {
  label: 'Install Codex',
  language: 'bash',
  copyLabel: 'Copy install command',
  template: 'npm install -g @openai/codex',
}

export const codingToolDocs: GuideDoc[] = [
  {
    slug: 'claude-code',
    group: 'coding',
    title: 'Claude Code',
    summary:
      'Install Claude Code, connect it to the Anthropic-compatible endpoint, and verify the selected route.',
    audience: 'anthropic',
    readingMinutes: 9,
    sections: [
      {
        id: 'requirements',
        title: 'What you need',
        blocks: [
          {
            type: 'paragraph',
            text: 'Prepare Node.js 18 or newer, an API key, and a model that supports the Anthropic-compatible endpoint.',
          },
          {
            type: 'callout',
            tone: 'info',
            title: 'Use the host address',
            text: 'Claude Code appends the Messages API path itself. Use {{HOST}} as ANTHROPIC_BASE_URL, not a full /v1/messages URL.',
          },
        ],
      },
      {
        id: 'install',
        title: 'Install for your system',
        blocks: [
          {
            type: 'platform',
            platforms: {
              windows: [
                {
                  type: 'steps',
                  items: [
                    {
                      title: 'Install Node.js LTS',
                      text: 'Install the current LTS release, then reopen PowerShell.',
                      code: {
                        label: 'Verify Node.js',
                        language: 'powershell',
                        template: 'node --version\nnpm --version',
                      },
                    },
                    { title: 'Install Claude Code', code: installClaudeCode },
                  ],
                },
              ],
              macos: [
                {
                  type: 'steps',
                  items: [
                    {
                      title: 'Install Node.js',
                      text: 'Use Homebrew or the current Node.js LTS installer.',
                      code: {
                        label: 'Homebrew',
                        language: 'bash',
                        template: 'brew install node',
                      },
                    },
                    { title: 'Install Claude Code', code: installClaudeCode },
                  ],
                },
              ],
              linux: [
                {
                  type: 'steps',
                  items: [
                    {
                      title: 'Verify Node.js',
                      text: 'Install Node.js 18 or newer with your distribution package manager or NodeSource.',
                      code: {
                        label: 'Verify Node.js',
                        language: 'bash',
                        template: 'node --version\nnpm --version',
                      },
                    },
                    { title: 'Install Claude Code', code: installClaudeCode },
                  ],
                },
              ],
              vscode: [
                {
                  type: 'paragraph',
                  text: 'Configure and test the Claude Code CLI first. Then install the Claude Code extension and reopen VS Code so it inherits the same environment.',
                },
              ],
              jetbrains: [
                {
                  type: 'paragraph',
                  text: 'The most reliable JetBrains setup is the IDE terminal. Configure the local CLI first, then run claude inside the project terminal.',
                },
              ],
            },
          },
        ],
      },
      {
        id: 'configure',
        title: 'Configure the gateway',
        blocks: [
          {
            type: 'platform',
            platforms: {
              windows: [
                {
                  type: 'code',
                  label: 'PowerShell session',
                  language: 'powershell',
                  copyLabel: 'Copy PowerShell config',
                  template: `$env:ANTHROPIC_BASE_URL = "{{HOST}}"
$env:ANTHROPIC_AUTH_TOKEN = "{{API_KEY_PLACEHOLDER}}"
$env:ANTHROPIC_MODEL = "{{MODEL}}"`,
                },
              ],
              macos: [
                {
                  type: 'code',
                  label: '~/.zshrc',
                  language: 'bash',
                  copyLabel: 'Copy shell config',
                  template: `export ANTHROPIC_BASE_URL="{{HOST}}"
export ANTHROPIC_AUTH_TOKEN="{{API_KEY_PLACEHOLDER}}"
export ANTHROPIC_MODEL="{{MODEL}}"`,
                },
              ],
              linux: [
                {
                  type: 'code',
                  label: '~/.bashrc or ~/.zshrc',
                  language: 'bash',
                  copyLabel: 'Copy shell config',
                  template: `export ANTHROPIC_BASE_URL="{{HOST}}"
export ANTHROPIC_AUTH_TOKEN="{{API_KEY_PLACEHOLDER}}"
export ANTHROPIC_MODEL="{{MODEL}}"`,
                },
              ],
              vscode: [
                {
                  type: 'callout',
                  tone: 'info',
                  title: 'Reuse the CLI configuration',
                  text: 'Fully restart VS Code after changing environment variables. The extension should use the same gateway and key as the working CLI.',
                },
              ],
              jetbrains: [
                {
                  type: 'callout',
                  tone: 'info',
                  title: 'Start from the IDE terminal',
                  text: 'Run the working local claude command in the JetBrains terminal before adding any optional plugin integration.',
                },
              ],
            },
          },
        ],
      },
      {
        id: 'verify',
        title: 'Verify the connection',
        blocks: [
          {
            type: 'steps',
            items: [
              {
                title: 'Restart the terminal or editor',
                text: 'Environment changes are only visible to newly started processes.',
              },
              {
                title: 'Start Claude Code',
                code: {
                  label: 'Terminal',
                  language: 'bash',
                  template: 'claude',
                },
              },
              {
                title: 'Send a minimal prompt',
                text: 'Ask for a one-line reply before testing tools or long context.',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    slug: 'codex',
    group: 'coding',
    title: 'Codex',
    summary:
      'Install Codex, configure a Responses-compatible custom provider, and verify the selected model.',
    audience: 'openai-response',
    readingMinutes: 10,
    sections: [
      {
        id: 'requirements',
        title: 'What you need',
        blocks: [
          {
            type: 'paragraph',
            text: 'Prepare Node.js, an API key, and a model that supports the Responses endpoint. The model selector above already filters for this protocol.',
          },
        ],
      },
      {
        id: 'install',
        title: 'Install for your system',
        blocks: [
          {
            type: 'platform',
            platforms: {
              windows: [
                {
                  type: 'steps',
                  items: [
                    {
                      title: 'Install Node.js LTS',
                      text: 'Install the current LTS release and reopen PowerShell.',
                    },
                    { title: 'Install Codex', code: installCodex },
                  ],
                },
              ],
              macos: [
                {
                  type: 'steps',
                  items: [
                    {
                      title: 'Install Node.js',
                      code: {
                        label: 'Homebrew',
                        language: 'bash',
                        template: 'brew install node',
                      },
                    },
                    { title: 'Install Codex', code: installCodex },
                  ],
                },
              ],
              linux: [
                {
                  type: 'steps',
                  items: [
                    {
                      title: 'Verify Node.js',
                      code: {
                        label: 'Terminal',
                        language: 'bash',
                        template: 'node --version\nnpm --version',
                      },
                    },
                    { title: 'Install Codex', code: installCodex },
                  ],
                },
              ],
              vscode: [
                {
                  type: 'paragraph',
                  text: 'Configure and verify the Codex CLI first. Install the Codex extension, then fully restart VS Code so it reads the same configuration.',
                },
              ],
              jetbrains: [
                {
                  type: 'paragraph',
                  text: 'Use the JetBrains project terminal after the local Codex CLI works. This keeps the IDE workflow on the same configuration as your terminal.',
                },
              ],
            },
          },
        ],
      },
      {
        id: 'configure',
        title: 'Configure a custom provider',
        blocks: [
          {
            type: 'paragraph',
            text: 'Save this configuration in ~/.codex/config.toml. The provider ID is stable and the endpoint and model come from your current selection.',
          },
          {
            type: 'code',
            label: '~/.codex/config.toml',
            language: 'toml',
            copyLabel: 'Copy Codex config',
            template: `model = "{{MODEL}}"
model_provider = "yecai"

[model_providers.yecai]
name = "Yecai"
base_url = "{{BASE_URL}}"
env_key = "YECAI_API_KEY"
wire_api = "responses"`,
          },
          {
            type: 'platform',
            platforms: {
              windows: [
                {
                  type: 'code',
                  label: 'PowerShell session',
                  language: 'powershell',
                  copyLabel: 'Copy key command',
                  template: '$env:YECAI_API_KEY = "{{API_KEY_PLACEHOLDER}}"',
                },
              ],
              macos: [
                {
                  type: 'code',
                  label: 'Terminal session',
                  language: 'bash',
                  copyLabel: 'Copy key command',
                  template: 'export YECAI_API_KEY="{{API_KEY_PLACEHOLDER}}"',
                },
              ],
              linux: [
                {
                  type: 'code',
                  label: 'Terminal session',
                  language: 'bash',
                  copyLabel: 'Copy key command',
                  template: 'export YECAI_API_KEY="{{API_KEY_PLACEHOLDER}}"',
                },
              ],
            },
          },
        ],
      },
      {
        id: 'verify',
        title: 'Verify the connection',
        blocks: [
          {
            type: 'steps',
            items: [
              {
                title: 'Start a new terminal session',
                text: 'Confirm the environment variable is available before starting Codex.',
              },
              {
                title: 'Check the installed version',
                code: {
                  label: 'Terminal',
                  language: 'bash',
                  template: 'codex --version',
                },
              },
              {
                title: 'Start with a small task',
                code: {
                  label: 'Terminal',
                  language: 'bash',
                  template: 'codex',
                },
              },
            ],
          },
        ],
      },
      {
        id: 'large-context',
        title: 'Optional large-context setup',
        blocks: [
          {
            type: 'context-window',
            supportedTitle: 'This model declares a 1M context window',
            supportedText:
              'You can add an explicit context window and a conservative compaction threshold to the top of config.toml.',
            unavailableTitle: '1M context is not confirmed for this model',
            unavailableText:
              'Keep the default context settings unless the Models page declares a context window of at least 1,000,000 tokens.',
          },
        ],
      },
    ],
  },
  {
    slug: 'cc-switch',
    group: 'coding',
    title: 'CC Switch',
    summary:
      'Keep Claude Code and Codex provider settings together and switch them without editing files by hand.',
    audience: 'all',
    readingMinutes: 8,
    sections: [
      {
        id: 'when-to-use',
        title: 'When CC Switch helps',
        blocks: [
          {
            type: 'paragraph',
            text: 'Use CC Switch when you work with more than one provider or want one place to manage Claude Code and Codex configurations.',
          },
          {
            type: 'callout',
            tone: 'info',
            title: 'Custom provider setup',
            text: 'If this service is not included as a preset, choose Custom and enter the values shown on this page.',
          },
        ],
      },
      {
        id: 'claude-provider',
        title: 'Add the Claude Code provider',
        blocks: [
          {
            type: 'table',
            columns: ['Field', 'Value'],
            rows: [
              ['Name', 'Yecai'],
              ['ANTHROPIC_BASE_URL', '{{HOST}}'],
              ['ANTHROPIC_AUTH_TOKEN', '{{API_KEY_PLACEHOLDER}}'],
            ],
          },
        ],
      },
      {
        id: 'codex-provider',
        title: 'Add the Codex provider',
        blocks: [
          {
            type: 'table',
            columns: ['Field', 'Value'],
            rows: [
              ['Name', 'Yecai'],
              ['Base URL', '{{BASE_URL}}'],
              ['API key', '{{API_KEY_PLACEHOLDER}}'],
              ['Wire API', 'responses'],
            ],
          },
        ],
      },
      {
        id: 'verify',
        title: 'Switch and verify',
        blocks: [
          {
            type: 'steps',
            items: [
              {
                title: 'Activate the provider',
                text: 'Set the new custom provider as active for the target client.',
              },
              {
                title: 'Restart the client',
                text: 'Close existing terminal and editor processes so they read the new configuration.',
              },
              {
                title: 'Run a minimal request',
                text: 'Confirm one short response before testing tools or large prompts.',
              },
            ],
          },
        ],
      },
    ],
  },
]
