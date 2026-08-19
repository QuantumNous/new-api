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
import { z } from 'zod'
import {
  CHANNEL_STATUS,
  ERROR_MESSAGES,
  MODEL_FETCHABLE_TYPES,
} from '../constants'
import type { Channel } from '../types'

export const BLOCKRUN_BASE_API_URL = 'https://blockrun.ai/api'
export const BLOCKRUN_SOLANA_API_URL = 'https://sol.blockrun.ai/api'

export type BlockRunPaymentChain = 'base' | 'solana'

const CODEX_FINGERPRINT_MODES = ['off', 'device', 'session', 'full'] as const
type CodexFingerprintMode = (typeof CODEX_FINGERPRINT_MODES)[number]

const ASSET_MATERIALIZATION_PROVIDERS = [
  'seedance_proxy',
  'tokenspace_material',
] as const
type AssetMaterializationProvider =
  (typeof ASSET_MATERIALIZATION_PROVIDERS)[number]

const BASE58_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const BASE58_INDEX = new Map(
  Array.from(BASE58_ALPHABET, (character, index) => [character, index])
)

export type BlockRunPaymentChainChange = {
  paymentChain: BlockRunPaymentChain
  baseUrl: string
}

export function resolveBlockRunCreateBaseURL(params: {
  channelType: number
  isEditing: boolean
  paymentChain: BlockRunPaymentChain
  currentBaseUrl: string
}): string {
  if (params.channelType !== 100 || params.isEditing) {
    return params.currentBaseUrl
  }
  if (params.paymentChain === 'solana') {
    return BLOCKRUN_SOLANA_API_URL
  }
  return params.currentBaseUrl || BLOCKRUN_BASE_API_URL
}

export type SolanaPrivateKeyInspection =
  | { kind: 'empty'; valid: true; payer: null }
  | { kind: 'seed'; valid: true; payer: null }
  | { kind: 'keypair'; valid: true; payer: string }
  | { kind: 'invalid'; valid: false; payer: null }

function decodeBase58(value: string): Uint8Array | null {
  if (!value) return null

  const bytes = [0]
  for (const character of value) {
    const digit = BASE58_INDEX.get(character)
    if (digit === undefined) return null

    let carry = digit
    for (let index = 0; index < bytes.length; index += 1) {
      carry += bytes[index] * 58
      bytes[index] = carry & 0xff
      carry >>= 8
    }
    while (carry > 0) {
      bytes.push(carry & 0xff)
      carry >>= 8
    }
  }

  for (
    let index = 0;
    value[index] === BASE58_ALPHABET[0] && index < value.length - 1;
    index += 1
  ) {
    bytes.push(0)
  }

  return Uint8Array.from(bytes.reverse())
}

function encodeBase58(value: Uint8Array): string {
  if (value.length === 0) return ''

  const digits = [0]
  for (const byte of value) {
    let carry = byte
    for (let index = 0; index < digits.length; index += 1) {
      carry += digits[index] << 8
      digits[index] = carry % 58
      carry = Math.floor(carry / 58)
    }
    while (carry > 0) {
      digits.push(carry % 58)
      carry = Math.floor(carry / 58)
    }
  }

  let encoded = ''
  for (
    let index = 0;
    value[index] === 0 && index < value.length - 1;
    index += 1
  ) {
    encoded += BASE58_ALPHABET[0]
  }
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    encoded += BASE58_ALPHABET[digits[index]]
  }
  return encoded
}

export function inspectSolanaPrivateKey(
  privateKey: string | undefined
): SolanaPrivateKeyInspection {
  const value = privateKey?.trim() || ''
  if (!value) return { kind: 'empty', valid: true, payer: null }

  const decoded = decodeBase58(value)
  if (decoded?.length === 32) {
    return { kind: 'seed', valid: true, payer: null }
  }
  if (decoded?.length === 64) {
    return {
      kind: 'keypair',
      valid: true,
      payer: encodeBase58(decoded.slice(32)),
    }
  }
  return { kind: 'invalid', valid: false, payer: null }
}

export function resolveBlockRunPaymentChainChange(params: {
  channelType: number
  isEditing: boolean
  currentChain: BlockRunPaymentChain
  currentBaseUrl: string
  requestedChain: BlockRunPaymentChain
}): BlockRunPaymentChainChange {
  if (params.channelType !== 100 || params.isEditing) {
    return {
      paymentChain: params.currentChain,
      baseUrl: params.currentBaseUrl,
    }
  }

  return {
    paymentChain: params.requestedChain,
    baseUrl:
      params.requestedChain === 'solana'
        ? BLOCKRUN_SOLANA_API_URL
        : BLOCKRUN_BASE_API_URL,
  }
}

// ============================================================================
// Form Validation Schema
// ============================================================================

function parseOptionalJson(value: string | undefined): unknown {
  if (!value?.trim()) return undefined
  return JSON.parse(value)
}

function isJsonObjectValue(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isOptionalJsonObject(value: string | undefined): boolean {
  try {
    const parsed = parseOptionalJson(value)
    return parsed === undefined || isJsonObjectValue(parsed)
  } catch {
    return false
  }
}

function isOptionalModelMapping(value: string | undefined): boolean {
  try {
    const parsed = parseOptionalJson(value)
    if (parsed === undefined) return true
    if (!isJsonObjectValue(parsed)) return false
    return Object.values(parsed).every((item) => typeof item === 'string')
  } catch {
    return false
  }
}

function isOptionalStatusCodeMapping(value: string | undefined): boolean {
  try {
    const parsed = parseOptionalJson(value)
    if (parsed === undefined) return true
    if (!isJsonObjectValue(parsed)) return false
    return Object.entries(parsed).every(([from, to]) => {
      const fromCode = Number(from)
      const toCode = Number(to)
      return (
        Number.isInteger(fromCode) &&
        Number.isInteger(toCode) &&
        fromCode >= 100 &&
        fromCode <= 599 &&
        toCode >= 100 &&
        toCode <= 599
      )
    })
  } catch {
    return false
  }
}

function isCodexCredential(value: string | undefined): boolean {
  try {
    const parsed = parseOptionalJson(value)
    if (parsed === undefined) return true
    return (
      isJsonObjectValue(parsed) &&
      typeof parsed.access_token === 'string' &&
      parsed.access_token.trim().length > 0 &&
      typeof parsed.account_id === 'string' &&
      parsed.account_id.trim().length > 0
    )
  } catch {
    return false
  }
}

function normalizeCodexFingerprintMode(value: unknown): CodexFingerprintMode {
  return CODEX_FINGERPRINT_MODES.includes(value as CodexFingerprintMode)
    ? (value as CodexFingerprintMode)
    : 'off'
}

function normalizeAssetMaterializationProvider(
  value: unknown
): AssetMaterializationProvider | string {
  return ASSET_MATERIALIZATION_PROVIDERS.includes(
    value as AssetMaterializationProvider
  )
    ? (value as AssetMaterializationProvider)
    : typeof value === 'string'
      ? value.trim()
      : ''
}

function isSecureAssetMaterializationGatewayUrl(
  value: string | undefined
): boolean {
  const rawValue = value?.trim()
  if (!rawValue) return false

  try {
    const parsed = new URL(rawValue)
    if (
      parsed.protocol !== 'https:' ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    ) {
      return false
    }
    return !parsed.pathname
      .split('/')
      .some((segment) => segment === '.' || segment === '..')
  } catch {
    return false
  }
}

function isVertexJsonKey(value: string | undefined): boolean {
  try {
    const parsed = parseOptionalJson(value)
    if (parsed === undefined) return true
    if (Array.isArray(parsed)) {
      return parsed.every((item) => isJsonObjectValue(item))
    }
    return isJsonObjectValue(parsed)
  } catch {
    return false
  }
}

function addRequiredIssue(
  ctx: z.RefinementCtx,
  path: string,
  message: string
): void {
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: [path],
    message,
  })
}

export const channelFormSchema = z
  .object({
    name: z.string().min(1, ERROR_MESSAGES.REQUIRED_NAME),
    type: z.number().min(0, ERROR_MESSAGES.REQUIRED_TYPE),
    base_url: z.string().optional(),
    key: z.string(),
    openai_organization: z.string().optional(),
    models: z.string().min(1, ERROR_MESSAGES.REQUIRED_MODELS),
    group: z.array(z.string()).min(1, ERROR_MESSAGES.REQUIRED_GROUP),
    model_mapping: z
      .string()
      .optional()
      .refine(
        isOptionalModelMapping,
        'Model mapping must be a JSON object with string values'
      ),
    priority: z.number().optional(),
    weight: z.number().optional(),
    max_concurrency: z
      .number()
      .int('Max concurrency must be a whole number')
      .min(0, 'Max concurrency must be 0 or greater')
      .optional(),
    test_model: z.string().optional(),
    auto_ban: z.number().optional(),
    status: z.number(),
    status_code_mapping: z
      .string()
      .optional()
      .refine(
        isOptionalStatusCodeMapping,
        'Status code mapping must use valid HTTP status codes'
      ),
    tag: z.string().optional(),
    remark: z
      .string()
      .max(255, 'Remark must be less than 255 characters')
      .optional(),
    setting: z
      .string()
      .optional()
      .refine(isOptionalJsonObject, ERROR_MESSAGES.INVALID_JSON),
    param_override: z
      .string()
      .optional()
      .refine(isOptionalJsonObject, ERROR_MESSAGES.INVALID_JSON),
    header_override: z
      .string()
      .optional()
      .refine(isOptionalJsonObject, ERROR_MESSAGES.INVALID_JSON),
    settings: z
      .string()
      .optional()
      .refine(isOptionalJsonObject, ERROR_MESSAGES.INVALID_JSON),
    other: z.string().optional(),
    // Multi-key options (not sent to backend directly)
    multi_key_mode: z.enum(['single', 'batch', 'multi_to_single']).optional(),
    multi_key_type: z.enum(['random', 'polling']).optional(),
    batch_add_set_key_prefix_2_name: z.boolean().optional(),
    key_mode: z.enum(['append', 'replace']).optional(), // For editing multi-key channels
    // Channel extra settings (stored in setting JSON, not sent directly)
    force_format: z.boolean().optional(),
    thinking_to_content: z.boolean().optional(),
    proxy: z.string().optional(),
    pass_through_body_enabled: z.boolean().optional(),
    return_source_url: z.boolean().optional(),
    system_prompt: z.string().optional(),
    system_prompt_override: z.boolean().optional(),
    image_carrier_model: z.string().optional(),
    codex_fingerprint_mode: z.enum(CODEX_FINGERPRINT_MODES).optional(),
    // Type-specific settings (stored in settings JSON)
    is_enterprise_account: z.boolean().optional(), // OpenRouter specific
    vertex_key_type: z.enum(['json', 'api_key']).optional(), // Vertex AI specific
    aws_key_type: z.enum(['ak_sk', 'api_key']).optional(), // AWS specific
    azure_responses_version: z.string().optional(), // Azure specific
    asset_materialization_provider: z.string().optional(),
    asset_materialization_gateway_base_url: z.string().optional(),
    asset_materialization_group_id: z.string().optional(),
    blockrun_payment_chain: z.enum(['base', 'solana']),
    blockrun_max_payment_atomic: z.string().optional(),
    // Field passthrough controls (stored in settings JSON)
    allow_service_tier: z.boolean().optional(), // OpenAI/Anthropic/Codex
    disable_store: z.boolean().optional(), // OpenAI only
    allow_safety_identifier: z.boolean().optional(), // OpenAI only
    allow_include_obfuscation: z.boolean().optional(), // OpenAI: include usage obfuscation
    allow_inference_geo: z.boolean().optional(), // OpenAI/Anthropic: inference geography
    allow_speed: z.boolean().optional(), // Anthropic: speed mode control
    claude_beta_query: z.boolean().optional(), // Anthropic: beta query passthrough
    // Upstream model update settings (stored in settings JSON)
    upstream_model_update_check_enabled: z.boolean().optional(),
    upstream_model_update_auto_sync_enabled: z.boolean().optional(),
    upstream_model_update_ignored_models: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if ([3, 8, 36, 45].includes(data.type) && !data.base_url?.trim()) {
      addRequiredIssue(
        ctx,
        'base_url',
        'Base URL is required for this channel type'
      )
    }

    if ([3, 18, 21, 39, 41, 49].includes(data.type) && !data.other?.trim()) {
      addRequiredIssue(
        ctx,
        'other',
        'This channel type requires additional configuration'
      )
    }

    if (data.type === 100 && data.blockrun_payment_chain === 'solana') {
      if (normalizeBaseUrl(data.base_url) !== BLOCKRUN_SOLANA_API_URL) {
        addRequiredIssue(
          ctx,
          'base_url',
          'Solana BlockRun requires the official API URL'
        )
      }

      const cap = data.blockrun_max_payment_atomic?.trim() || ''
      if (!/^\d+$/.test(cap) || /^0+$/.test(cap)) {
        addRequiredIssue(
          ctx,
          'blockrun_max_payment_atomic',
          'Maximum payment must be a positive decimal integer'
        )
      }

      if (!inspectSolanaPrivateKey(data.key).valid) {
        addRequiredIssue(
          ctx,
          'key',
          'Solana private key must decode to exactly 32 or 64 bytes'
        )
      }
    }

    if (data.type === 57) {
      if (data.multi_key_mode && data.multi_key_mode !== 'single') {
        addRequiredIssue(
          ctx,
          'multi_key_mode',
          'Codex channels do not support batch creation'
        )
      }
      if (data.key?.trim() && !isCodexCredential(data.key)) {
        addRequiredIssue(
          ctx,
          'key',
          'Codex credential must be a JSON object with access_token and account_id'
        )
      }
    }

    const assetMaterializationProvider =
      data.asset_materialization_provider?.trim() || ''
    const assetMaterializationGatewayBaseURL =
      data.asset_materialization_gateway_base_url?.trim() || ''
    const assetMaterializationGroupID =
      data.asset_materialization_group_id?.trim() || ''

    if (
      ASSET_MATERIALIZATION_PROVIDERS.includes(
        assetMaterializationProvider as AssetMaterializationProvider
      )
    ) {
      if (
        !isSecureAssetMaterializationGatewayUrl(
          assetMaterializationGatewayBaseURL
        )
      ) {
        addRequiredIssue(
          ctx,
          'asset_materialization_gateway_base_url',
          'Gateway base URL must be a valid HTTPS URL'
        )
      }
      if (!assetMaterializationGroupID) {
        addRequiredIssue(
          ctx,
          'asset_materialization_group_id',
          'Asset materialization group is required'
        )
      }
    } else if (
      !assetMaterializationProvider &&
      (assetMaterializationGatewayBaseURL || assetMaterializationGroupID)
    ) {
      addRequiredIssue(
        ctx,
        'asset_materialization_provider',
        'Asset materialization provider is required'
      )
      if (
        !isSecureAssetMaterializationGatewayUrl(
          assetMaterializationGatewayBaseURL
        )
      ) {
        addRequiredIssue(
          ctx,
          'asset_materialization_gateway_base_url',
          'Gateway base URL must be a valid HTTPS URL'
        )
      }
      if (!assetMaterializationGroupID) {
        addRequiredIssue(
          ctx,
          'asset_materialization_group_id',
          'Asset materialization group is required'
        )
      }
    }

    if (
      data.type === 112 &&
      data.multi_key_mode &&
      data.multi_key_mode !== 'single'
    ) {
      addRequiredIssue(
        ctx,
        'multi_key_mode',
        'GitHub Copilot channels support one credential only'
      )
    }

    if (
      data.type === 41 &&
      data.vertex_key_type === 'json' &&
      data.key?.trim() &&
      !isVertexJsonKey(data.key)
    ) {
      addRequiredIssue(
        ctx,
        'key',
        'Vertex AI service account key must be valid JSON'
      )
    }

    if (
      data.type === 41 &&
      data.vertex_key_type === 'api_key' &&
      data.multi_key_mode &&
      data.multi_key_mode !== 'single'
    ) {
      addRequiredIssue(
        ctx,
        'multi_key_mode',
        'Vertex AI API Key mode does not support batch creation'
      )
    }
  })

export type ChannelFormValues = z.infer<typeof channelFormSchema>

// ============================================================================
// Default Form Values
// ============================================================================

export const CHANNEL_FORM_DEFAULT_VALUES: ChannelFormValues = {
  name: '',
  type: 1,
  base_url: '',
  key: '',
  openai_organization: '',
  models: '',
  group: ['default'],
  model_mapping: '',
  priority: 0,
  weight: 0,
  max_concurrency: 0,
  test_model: '',
  auto_ban: 1,
  status: CHANNEL_STATUS.ENABLED,
  status_code_mapping: '',
  tag: '',
  remark: '',
  setting: '',
  param_override: '',
  header_override: '',
  settings: '{}',
  other: '',
  multi_key_mode: 'single',
  multi_key_type: 'random',
  batch_add_set_key_prefix_2_name: false,
  key_mode: 'append',
  // Channel extra settings
  force_format: false,
  thinking_to_content: false,
  proxy: '',
  pass_through_body_enabled: false,
  return_source_url: false,
  system_prompt: '',
  system_prompt_override: false,
  image_carrier_model: '',
  codex_fingerprint_mode: 'off',
  // Type-specific settings
  is_enterprise_account: false,
  vertex_key_type: 'json',
  aws_key_type: 'ak_sk',
  azure_responses_version: '',
  asset_materialization_provider: '',
  asset_materialization_gateway_base_url: '',
  asset_materialization_group_id: '',
  blockrun_payment_chain: 'base',
  blockrun_max_payment_atomic: '',
  // Field passthrough controls
  allow_service_tier: false,
  disable_store: false,
  allow_safety_identifier: false,
  allow_include_obfuscation: false,
  allow_inference_geo: false,
  allow_speed: false,
  claude_beta_query: false,
  upstream_model_update_check_enabled: false,
  upstream_model_update_auto_sync_enabled: false,
  upstream_model_update_ignored_models: '',
}

// ============================================================================
// Transform Functions
// ============================================================================

/**
 * Transform Channel from API to Form default values
 */
export function transformChannelToFormDefaults(
  channel: Channel
): ChannelFormValues {
  // Parse channel extra settings from setting field
  let extraSettings: {
    force_format: boolean
    thinking_to_content: boolean
    proxy: string
    pass_through_body_enabled: boolean
    return_source_url: boolean
    system_prompt: string
    system_prompt_override: boolean
    image_carrier_model: string
    codex_fingerprint_mode: CodexFingerprintMode
  } = {
    force_format: false,
    thinking_to_content: false,
    proxy: '',
    pass_through_body_enabled: false,
    return_source_url: false,
    system_prompt: '',
    system_prompt_override: false,
    image_carrier_model: '',
    codex_fingerprint_mode: 'off' as const,
  }

  if (channel.setting) {
    try {
      const parsed = JSON.parse(channel.setting)
      extraSettings = {
        force_format: parsed.force_format || false,
        thinking_to_content: parsed.thinking_to_content || false,
        proxy: parsed.proxy || '',
        pass_through_body_enabled: parsed.pass_through_body_enabled || false,
        return_source_url: parsed.return_source_url || false,
        system_prompt: parsed.system_prompt || '',
        system_prompt_override: parsed.system_prompt_override || false,
        image_carrier_model: parsed.image_carrier_model || '',
        codex_fingerprint_mode: normalizeCodexFingerprintMode(
          parsed.codex_fingerprint_mode
        ),
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to parse channel setting:', error)
    }
  }

  // Parse type-specific settings from settings field
  let vertexKeyType: 'json' | 'api_key' = 'json'
  let azureResponsesVersion = ''
  let assetMaterializationProvider: AssetMaterializationProvider | string = ''
  let assetMaterializationGatewayBaseURL = ''
  let assetMaterializationGroupID = ''
  let isEnterpriseAccount = false
  let awsKeyType: 'ak_sk' | 'api_key' = 'ak_sk'
  let blockRunPaymentChain: BlockRunPaymentChain = 'base'
  let blockRunMaxPaymentAtomic = ''
  let allowServiceTier = false
  let disableStore = false
  let allowSafetyIdentifier = false
  let allowIncludeObfuscation = false
  let allowInferenceGeo = false
  let allowSpeed = false
  let claudeBetaQuery = false
  let upstreamModelUpdateCheckEnabled = false
  let upstreamModelUpdateAutoSyncEnabled = false
  let upstreamModelUpdateIgnoredModels = ''

  if (channel.settings) {
    try {
      const parsed = JSON.parse(channel.settings)
      vertexKeyType = parsed.vertex_key_type || 'json'
      azureResponsesVersion = parsed.azure_responses_version || ''
      if (isJsonObjectValue(parsed.asset_materialization)) {
        assetMaterializationProvider = normalizeAssetMaterializationProvider(
          parsed.asset_materialization.provider
        )
        assetMaterializationGatewayBaseURL =
          typeof parsed.asset_materialization.gateway_base_url === 'string'
            ? parsed.asset_materialization.gateway_base_url
            : ''
        assetMaterializationGroupID =
          typeof parsed.asset_materialization.group_id === 'string'
            ? parsed.asset_materialization.group_id
            : ''
      }
      isEnterpriseAccount = parsed.openrouter_enterprise === true
      awsKeyType = parsed.aws_key_type || 'ak_sk'
      blockRunPaymentChain =
        parsed.blockrun_payment_chain === 'solana' ? 'solana' : 'base'
      blockRunMaxPaymentAtomic =
        typeof parsed.blockrun_max_payment_atomic === 'string'
          ? parsed.blockrun_max_payment_atomic
          : ''
      allowServiceTier = parsed.allow_service_tier === true
      disableStore = parsed.disable_store === true
      allowSafetyIdentifier = parsed.allow_safety_identifier === true
      allowIncludeObfuscation = parsed.allow_include_obfuscation === true
      allowInferenceGeo = parsed.allow_inference_geo === true
      allowSpeed = parsed.allow_speed === true
      claudeBetaQuery = parsed.claude_beta_query === true
      upstreamModelUpdateCheckEnabled =
        parsed.upstream_model_update_check_enabled === true
      upstreamModelUpdateAutoSyncEnabled =
        parsed.upstream_model_update_auto_sync_enabled === true
      upstreamModelUpdateIgnoredModels = Array.isArray(
        parsed.upstream_model_update_ignored_models
      )
        ? parsed.upstream_model_update_ignored_models.join(',')
        : ''
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to parse channel settings:', error)
    }
  }

  return {
    name: channel.name || '',
    type: channel.type,
    base_url: channel.base_url || '',
    key: '', // Never populate key from backend for security
    openai_organization: channel.openai_organization || '',
    models: channel.models || '',
    group: parseGroups(channel.group || 'default'),
    model_mapping: channel.model_mapping || '',
    priority: channel.priority || 0,
    weight: channel.weight || 0,
    max_concurrency: channel.max_concurrency || 0,
    test_model: channel.test_model || '',
    auto_ban: channel.auto_ban ?? 1,
    status: channel.status,
    status_code_mapping: channel.status_code_mapping || '',
    tag: channel.tag || '',
    remark: channel.remark || '',
    setting: channel.setting || '',
    param_override: channel.param_override || '',
    header_override: channel.header_override || '',
    settings: channel.settings || '{}',
    other: channel.other || '',
    multi_key_mode: 'single',
    multi_key_type: channel.channel_info.multi_key_mode || 'random',
    batch_add_set_key_prefix_2_name: false,
    key_mode: 'append', // Default to append mode for editing multi-key channels
    // Channel extra settings
    ...extraSettings,
    // Type-specific settings
    is_enterprise_account: isEnterpriseAccount,
    vertex_key_type: vertexKeyType,
    azure_responses_version: azureResponsesVersion,
    asset_materialization_provider: assetMaterializationProvider,
    asset_materialization_gateway_base_url: assetMaterializationGatewayBaseURL,
    asset_materialization_group_id: assetMaterializationGroupID,
    aws_key_type: awsKeyType,
    blockrun_payment_chain: blockRunPaymentChain,
    blockrun_max_payment_atomic: blockRunMaxPaymentAtomic,
    allow_service_tier: allowServiceTier,
    disable_store: disableStore,
    allow_include_obfuscation: allowIncludeObfuscation,
    allow_inference_geo: allowInferenceGeo,
    allow_speed: allowSpeed,
    claude_beta_query: claudeBetaQuery,
    allow_safety_identifier: allowSafetyIdentifier,
    upstream_model_update_check_enabled: upstreamModelUpdateCheckEnabled,
    upstream_model_update_auto_sync_enabled: upstreamModelUpdateAutoSyncEnabled,
    upstream_model_update_ignored_models: upstreamModelUpdateIgnoredModels,
  }
}

/**
 * Build the setting JSON string from form extra settings
 */
function buildSettingJSON(formData: ChannelFormValues): string {
  const settingObj: Record<string, unknown> = {
    force_format: formData.force_format || false,
    thinking_to_content: formData.thinking_to_content || false,
    proxy: formData.type === 111 ? '' : formData.proxy || '',
    pass_through_body_enabled: formData.pass_through_body_enabled || false,
    // Only TechMobi video channels (type 105) honor this switch server-side
    return_source_url:
      formData.type === 105 ? formData.return_source_url || false : false,
    system_prompt: formData.system_prompt || '',
    system_prompt_override: formData.system_prompt_override || false,
    image_carrier_model: formData.image_carrier_model || '',
  }
  const codexFingerprintMode = normalizeCodexFingerprintMode(
    formData.codex_fingerprint_mode
  )
  if (codexFingerprintMode !== 'off') {
    settingObj.codex_fingerprint_mode = codexFingerprintMode
  }
  return JSON.stringify(settingObj)
}

export function hasAdvancedSettingsValues(values: ChannelFormValues): boolean {
  return Boolean(
    values.param_override?.trim() ||
    values.header_override?.trim() ||
    values.status_code_mapping?.trim() ||
    values.tag?.trim() ||
    values.remark?.trim() ||
    values.priority ||
    values.weight ||
    values.max_concurrency ||
    (values.type !== 111 && values.proxy?.trim()) ||
    values.system_prompt?.trim() ||
    values.force_format ||
    values.thinking_to_content ||
    values.pass_through_body_enabled ||
    values.asset_materialization_provider?.trim() ||
    values.asset_materialization_gateway_base_url?.trim() ||
    values.asset_materialization_group_id?.trim() ||
    normalizeCodexFingerprintMode(values.codex_fingerprint_mode) !== 'off' ||
    (values.type === 105 && values.return_source_url) ||
    values.system_prompt_override ||
    values.claude_beta_query ||
    values.upstream_model_update_check_enabled ||
    values.upstream_model_update_auto_sync_enabled ||
    values.upstream_model_update_ignored_models?.trim()
  )
}

/**
 * Build the settings JSON string (for type-specific config like vertex_key_type)
 */
function buildSettingsJSON(formData: ChannelFormValues): string {
  let settingsObj: Record<string, unknown> = {}

  // Try to parse existing settings first
  if (formData.settings && formData.settings !== '{}') {
    try {
      settingsObj = JSON.parse(formData.settings)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to parse existing settings:', error)
    }
  }

  // Add vertex_key_type for Vertex AI channels (type 41)
  if (formData.type === 41) {
    settingsObj.vertex_key_type = formData.vertex_key_type || 'json'
  } else if ('vertex_key_type' in settingsObj) {
    delete settingsObj.vertex_key_type
  }

  // Add azure_responses_version for Azure channels (type 3)
  if (formData.type === 3 && formData.azure_responses_version) {
    settingsObj.azure_responses_version = formData.azure_responses_version
  } else if ('azure_responses_version' in settingsObj) {
    delete settingsObj.azure_responses_version
  }

  // Add enterprise account setting for OpenRouter (type 20)
  if (formData.type === 20) {
    settingsObj.openrouter_enterprise = formData.is_enterprise_account === true
  } else if ('openrouter_enterprise' in settingsObj) {
    delete settingsObj.openrouter_enterprise
  }

  // Add aws_key_type for AWS channels (type 33)
  if (formData.type === 33) {
    settingsObj.aws_key_type = formData.aws_key_type || 'ak_sk'
  } else if ('aws_key_type' in settingsObj) {
    delete settingsObj.aws_key_type
  }

  const assetMaterializationProvider =
    formData.asset_materialization_provider?.trim() || ''
  const assetMaterializationGatewayBaseURL =
    formData.asset_materialization_gateway_base_url?.trim() || ''
  const assetMaterializationGroupID =
    formData.asset_materialization_group_id?.trim() || ''

  if (assetMaterializationProvider) {
    settingsObj.asset_materialization = {
      provider: assetMaterializationProvider,
      gateway_base_url: assetMaterializationGatewayBaseURL,
      group_id: assetMaterializationGroupID,
    }
  } else if ('asset_materialization' in settingsObj) {
    delete settingsObj.asset_materialization
  }

  if (formData.type === 100) {
    const paymentChain = formData.blockrun_payment_chain || 'base'
    settingsObj.blockrun_payment_chain = paymentChain
    if (paymentChain === 'solana') {
      settingsObj.blockrun_max_payment_atomic =
        formData.blockrun_max_payment_atomic?.trim() || ''
    } else if ('blockrun_max_payment_atomic' in settingsObj) {
      delete settingsObj.blockrun_max_payment_atomic
    }
  } else {
    if ('blockrun_payment_chain' in settingsObj) {
      delete settingsObj.blockrun_payment_chain
    }
    if ('blockrun_max_payment_atomic' in settingsObj) {
      delete settingsObj.blockrun_max_payment_atomic
    }
  }

  // Field passthrough controls:
  // - OpenAI (type 1), Anthropic (type 14), and Codex (type 57): allow_service_tier
  // - OpenAI only: disable_store, allow_safety_identifier
  if (formData.type === 1 || formData.type === 14 || formData.type === 57) {
    settingsObj.allow_service_tier = formData.allow_service_tier === true
  } else if ('allow_service_tier' in settingsObj) {
    delete settingsObj.allow_service_tier
  }

  if (formData.type === 1) {
    settingsObj.disable_store = formData.disable_store === true
    settingsObj.allow_safety_identifier =
      formData.allow_safety_identifier === true
    settingsObj.allow_include_obfuscation =
      formData.allow_include_obfuscation === true
    settingsObj.allow_inference_geo = formData.allow_inference_geo === true
  } else {
    if ('disable_store' in settingsObj) delete settingsObj.disable_store
    if ('allow_safety_identifier' in settingsObj)
      delete settingsObj.allow_safety_identifier
    if ('allow_include_obfuscation' in settingsObj)
      delete settingsObj.allow_include_obfuscation
    if (formData.type !== 14 && 'allow_inference_geo' in settingsObj)
      delete settingsObj.allow_inference_geo
  }

  // Anthropic (type 14): claude_beta_query, allow_inference_geo, allow_speed
  if (formData.type === 14) {
    settingsObj.allow_inference_geo = formData.allow_inference_geo === true
    settingsObj.allow_speed = formData.allow_speed === true
    settingsObj.claude_beta_query = formData.claude_beta_query === true
  } else {
    if ('allow_speed' in settingsObj) delete settingsObj.allow_speed
    if ('claude_beta_query' in settingsObj) delete settingsObj.claude_beta_query
  }

  // Upstream model update settings (for model-fetchable channel types)
  if (MODEL_FETCHABLE_TYPES.has(formData.type)) {
    settingsObj.upstream_model_update_check_enabled =
      formData.upstream_model_update_check_enabled === true
    settingsObj.upstream_model_update_auto_sync_enabled =
      settingsObj.upstream_model_update_check_enabled === true &&
      formData.upstream_model_update_auto_sync_enabled === true
    settingsObj.upstream_model_update_ignored_models = Array.from(
      new Set(
        String(formData.upstream_model_update_ignored_models || '')
          .split(',')
          .map((model) => model.trim())
          .filter(Boolean)
      )
    )
    if (
      !Array.isArray(settingsObj.upstream_model_update_last_detected_models) ||
      settingsObj.upstream_model_update_check_enabled !== true
    ) {
      settingsObj.upstream_model_update_last_detected_models = []
    }
    if (typeof settingsObj.upstream_model_update_last_check_time !== 'number') {
      settingsObj.upstream_model_update_last_check_time = 0
    }
  }

  return JSON.stringify(settingsObj)
}

function normalizeBaseUrl(value: string | undefined): string {
  return String(value || '')
    .trim()
    .replace(/\/+$/, '')
}

/**
 * Transform form data to API payload for creating channel
 */
export function transformFormDataToCreatePayload(formData: ChannelFormValues): {
  mode: 'single' | 'batch' | 'multi_to_single'
  multi_key_mode?: 'random' | 'polling'
  batch_add_set_key_prefix_2_name?: boolean
  channel: Partial<Channel>
} {
  const mode = formData.multi_key_mode || 'single'

  const channel: Partial<Channel> = {
    name: formData.name,
    type: formData.type,
    base_url: normalizeBaseUrl(formData.base_url) || null,
    key: formData.key,
    openai_organization: formData.openai_organization || null,
    models: formData.models,
    group: formatGroups(formData.group),
    model_mapping: formData.model_mapping || null,
    priority: formData.priority || null,
    weight: formData.weight || null,
    max_concurrency: formData.max_concurrency ?? 0,
    test_model: formData.test_model || null,
    auto_ban: formData.auto_ban ?? 1,
    status: formData.status,
    status_code_mapping: formData.status_code_mapping || null,
    tag: formData.tag || null,
    remark: formData.remark || '',
    setting: buildSettingJSON(formData),
    param_override: formData.param_override || null,
    header_override: formData.header_override || null,
    settings: buildSettingsJSON(formData),
    other: formData.other || '',
  }

  // Clean up empty strings to null for optional fields
  Object.keys(channel).forEach((key) => {
    if (channel[key as keyof typeof channel] === '') {
      ;(channel as Record<string, unknown>)[key] = null
    }
  })

  return {
    mode,
    multi_key_mode:
      mode === 'multi_to_single' ? formData.multi_key_type : undefined,
    batch_add_set_key_prefix_2_name:
      mode === 'batch' ? formData.batch_add_set_key_prefix_2_name : undefined,
    channel,
  }
}

/**
 * Transform form data to API payload for updating channel
 */
export function transformFormDataToUpdatePayload(
  formData: ChannelFormValues,
  channelId: number
): Partial<Channel> {
  const payload: Partial<Channel> = {
    id: channelId,
    name: formData.name,
    type: formData.type,
    base_url: normalizeBaseUrl(formData.base_url) || null,
    openai_organization: formData.openai_organization || null,
    models: formData.models,
    group: formatGroups(formData.group),
    model_mapping: formData.model_mapping || null,
    priority: formData.priority ?? 0,
    weight: formData.weight ?? 0,
    max_concurrency: formData.max_concurrency ?? 0,
    test_model: formData.test_model || null,
    auto_ban: formData.auto_ban ?? 1,
    status: formData.status,
    status_code_mapping: formData.status_code_mapping || null,
    tag: formData.tag || null,
    remark: formData.remark || '',
    setting: buildSettingJSON(formData),
    param_override: formData.param_override || null,
    header_override: formData.header_override || null,
    settings: buildSettingsJSON(formData),
    other: formData.other || '',
  }

  // Only include key if it was changed (not empty)
  if (formData.key && formData.key.trim()) {
    payload.key = formData.key
  }

  // Clean up empty strings to null for optional fields
  Object.keys(payload).forEach((key) => {
    if (payload[key as keyof typeof payload] === '') {
      ;(payload as Record<string, unknown>)[key] = null
    }
  })

  // Send explicit empty strings for nullable fields so GORM updates can clear them.
  payload.base_url = normalizeBaseUrl(formData.base_url) || ''
  payload.openai_organization = formData.openai_organization || ''
  payload.test_model = formData.test_model || ''
  payload.tag = formData.tag || ''
  payload.remark = formData.remark || ''
  payload.model_mapping = formData.model_mapping || ''
  payload.status_code_mapping = formData.status_code_mapping || ''
  payload.param_override = formData.param_override || ''
  payload.header_override = formData.header_override || ''

  return payload
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate JSON string
 */
export function validateJSON(value: string): boolean {
  if (!value || value.trim() === '') return true
  try {
    JSON.parse(value)
    return true
  } catch {
    return false
  }
}

/**
 * Validate model mapping format
 */
export function validateModelMapping(value: string): boolean {
  if (!value || value.trim() === '') return true
  return validateJSON(value)
}

/**
 * Parse models string to array
 */
export function parseModels(models: string): string[] {
  if (!models) return []
  return models
    .split(',')
    .map((m) => m.trim())
    .filter((m) => m.length > 0)
}

/**
 * Parse groups string to array
 */
export function parseGroups(groups: string): string[] {
  if (!groups) return []
  return groups
    .split(',')
    .map((g) => g.trim())
    .filter((g) => g.length > 0)
}

/**
 * Format models array to string
 */
export function formatModels(models: string[]): string {
  return models.join(',')
}

/**
 * Format groups array to string
 */
export function formatGroups(groups: string[]): string {
  return groups.join(',')
}
