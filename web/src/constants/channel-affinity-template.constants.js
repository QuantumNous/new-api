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

const buildPassHeadersTemplate = (headers) => ({
  operations: [
    {
      mode: 'pass_headers',
      value: [...headers],
      keep_origin: true,
    },
  ],
});

export const CODEX_CLI_HEADER_PASSTHROUGH_HEADERS = [
  'Originator',
  'Session_id',
  'User-Agent',
  'X-Codex-Beta-Features',
  'X-Codex-Turn-Metadata',
];

export const CLAUDE_CLI_HEADER_PASSTHROUGH_HEADERS = [
  'X-Stainless-Arch',
  'X-Stainless-Lang',
  'X-Stainless-Os',
  'X-Stainless-Package-Version',
  'X-Stainless-Retry-Count',
  'X-Stainless-Runtime',
  'X-Stainless-Runtime-Version',
  'X-Stainless-Timeout',
  'User-Agent',
  'X-App',
  'Anthropic-Beta',
  'Anthropic-Dangerous-Direct-Browser-Access',
  'Anthropic-Version',
];

export const CODEX_CLI_HEADER_PASSTHROUGH_TEMPLATE = buildPassHeadersTemplate(
  CODEX_CLI_HEADER_PASSTHROUGH_HEADERS,
);

export const CLAUDE_CLI_HEADER_PASSTHROUGH_TEMPLATE = buildPassHeadersTemplate(
  CLAUDE_CLI_HEADER_PASSTHROUGH_HEADERS,
);

export const CHANNEL_AFFINITY_RULE_TEMPLATES = {
  codexCli: {
    name: 'codex cli trace',
    model_regex: ['^gpt-.*$'],
    path_regex: ['/v1/responses'],
    key_sources: [{ type: 'gjson', path: 'prompt_cache_key' }],
    param_override_template: CODEX_CLI_HEADER_PASSTHROUGH_TEMPLATE,
    value_regex: '',
    ttl_seconds: 0,
    skip_retry_on_failure: false,
    include_using_group: true,
    include_rule_name: true,
  },
  claudeCli: {
    name: 'claude cli trace',
    model_regex: ['^claude-.*$'],
    path_regex: ['/v1/messages'],
    key_sources: [{ type: 'gjson', path: 'metadata.user_id' }],
    param_override_template: CLAUDE_CLI_HEADER_PASSTHROUGH_TEMPLATE,
    value_regex: '',
    ttl_seconds: 0,
    skip_retry_on_failure: false,
    include_using_group: true,
    include_rule_name: true,
  },
};

export const cloneChannelAffinityTemplate = (template) =>
  JSON.parse(JSON.stringify(template || {}));
