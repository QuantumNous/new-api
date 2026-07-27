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

export const STORAGE_VERSION = 1
export const MAX_STORED_MESSAGES = 100
export const MAX_STORED_MESSAGES_BYTES = 1024 * 1024
export const MAX_LOADED_MESSAGES_CHARS = 120_000
export const MAX_LOADED_MESSAGE_CHARS = 40_000
/**
 * Total extracted-document text kept per session. Attachment text is replayed
 * on every later turn, so it has to be bounded independently of message count;
 * the newest turns win because they are the ones still being discussed.
 */
export const MAX_PERSISTED_ATTACHMENT_CHARS = 200_000

export const playgroundConfigSchema = z.object({
  model: z.string().optional(),
  group: z.string().optional(),
  temperature: z.number().optional(),
  top_p: z.number().optional(),
  max_tokens: z.number().optional(),
  frequency_penalty: z.number().optional(),
  presence_penalty: z.number().optional(),
  seed: z.number().nullable().optional(),
  stream: z.boolean().optional(),
})

export const parameterEnabledSchema = z.object({
  temperature: z.boolean().optional(),
  top_p: z.boolean().optional(),
  max_tokens: z.boolean().optional(),
  frequency_penalty: z.boolean().optional(),
  presence_penalty: z.boolean().optional(),
  seed: z.boolean().optional(),
})

const messageRoleSchema = z.enum(['user', 'assistant', 'system'])
const messageStatusSchema = z.enum([
  'loading',
  'streaming',
  'complete',
  'error',
])

const messageVersionSchema = z.object({
  id: z.string(),
  content: z.string(),
})

const sourceSchema = z.object({
  href: z.string(),
  title: z.string(),
  snippet: z.string().optional(),
  domain: z.string().optional(),
  publishedAt: z.string().optional(),
})

const managedToolSchema = z.object({
  runId: z.number().int().positive().optional(),
  action: z.enum(['generate_image', 'generate_video', 'web_search']),
  status: z.enum(['queued', 'running', 'submitted', 'completed', 'failed']),
  model: z.string().optional(),
  taskId: z.string().optional(),
  images: z.array(z.string()).optional(),
  videoUrl: z.string().optional(),
  error: z.string().optional(),
})

const attachmentIdentitySchema = {
  id: z.string(),
  name: z.string(),
  mimeType: z.string(),
}

const attachmentAssetSchema = {
  dataUrl: z.string().optional(),
  assetId: z.number().int().positive().optional(),
}

const chatAttachmentSchema = z
  .discriminatedUnion('kind', [
    z.object({
      ...attachmentIdentitySchema,
      ...attachmentAssetSchema,
      kind: z.literal('image'),
    }),
    // Legacy native-PDF attachment kind; migrated to document on load.
    z.object({
      ...attachmentIdentitySchema,
      ...attachmentAssetSchema,
      kind: z.literal('file'),
      text: z.string().optional(),
    }),
    z.object({
      ...attachmentIdentitySchema,
      kind: z.literal('document'),
      text: z.string(),
      assetId: z.number().int().positive().optional(),
    }),
  ])
  .transform((attachment) => {
    if (attachment.kind !== 'file') return attachment
    return {
      id: attachment.id,
      name: attachment.name,
      mimeType: attachment.mimeType,
      kind: 'document' as const,
      text: attachment.text ?? '',
      assetId: attachment.assetId,
    }
  })

const reasoningSchema = z.object({
  content: z.string(),
  duration: z.number(),
  startedAt: z.number().optional(),
  completedAt: z.number().optional(),
  durationMs: z.number().optional(),
})

const usageSchema = z.object({
  promptTokens: z.number(),
  completionTokens: z.number(),
  totalTokens: z.number(),
})

const messageSchema = z.object({
  key: z.string(),
  from: messageRoleSchema,
  versions: z.array(messageVersionSchema).min(1),
  activeVersion: z.number().optional(),
  createdAt: z.number().optional(),
  startedAt: z.number().optional(),
  completedAt: z.number().optional(),
  durationMs: z.number().optional(),
  sources: z.array(sourceSchema).optional(),
  attachments: z.array(chatAttachmentSchema).optional(),
  managedTool: managedToolSchema.optional(),
  model: z.string().optional(),
  modelChangeFrom: z.string().optional(),
  modelChangeTo: z.string().optional(),
  reasoning: reasoningSchema.optional(),
  isReasoningStreaming: z.boolean().optional(),
  isReasoningComplete: z.boolean().optional(),
  isContentComplete: z.boolean().optional(),
  status: messageStatusSchema.optional(),
  errorCode: z.string().nullable().optional(),
  usage: usageSchema.optional(),
})

export const messagesSchema = z.array(messageSchema)
