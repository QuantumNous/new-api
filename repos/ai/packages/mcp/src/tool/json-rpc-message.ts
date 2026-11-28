import { parseJSON } from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';
import { BaseParamsSchema, RequestSchema, ResultSchema } from './types';

const JSONRPC_VERSION = '2.0';

const JSONRPCRequestSchema = z
  .object({
    jsonrpc: z.literal(JSONRPC_VERSION),
    id: z.union([z.string(), z.number().int()]),
  })
  .merge(RequestSchema)
  .strict();

export type JSONRPCRequest = z.infer<typeof JSONRPCRequestSchema>;

const JSONRPCResponseSchema = z
  .object({
    jsonrpc: z.literal(JSONRPC_VERSION),
    id: z.union([z.string(), z.number().int()]),
    result: ResultSchema,
  })
  .strict();

export type JSONRPCResponse = z.infer<typeof JSONRPCResponseSchema>;

const JSONRPCErrorSchema = z
  .object({
    jsonrpc: z.literal(JSONRPC_VERSION),
    id: z.union([z.string(), z.number().int()]),
    error: z.object({
      code: z.number().int(),
      message: z.string(),
      data: z.optional(z.unknown()),
    }),
  })
  .strict();

export type JSONRPCError = z.infer<typeof JSONRPCErrorSchema>;

const JSONRPCNotificationSchema = z
  .object({
    jsonrpc: z.literal(JSONRPC_VERSION),
  })
  .merge(
    z.object({
      method: z.string(),
      params: z.optional(BaseParamsSchema),
    }),
  )
  .strict();

export type JSONRPCNotification = z.infer<typeof JSONRPCNotificationSchema>;

export const JSONRPCMessageSchema = z.union([
  JSONRPCRequestSchema,
  JSONRPCNotificationSchema,
  JSONRPCResponseSchema,
  JSONRPCErrorSchema,
]);

export type JSONRPCMessage = z.infer<typeof JSONRPCMessageSchema>;

export function validateJSONRPCMessage(message: unknown): JSONRPCMessage {
  return JSONRPCMessageSchema.parse(message);
}

export async function parseJSONRPCMessage(
  text: string,
): Promise<JSONRPCMessage> {
  return validateJSONRPCMessage(await parseJSON({ text }));
}
