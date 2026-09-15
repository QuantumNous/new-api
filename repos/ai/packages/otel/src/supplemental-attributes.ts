import type { Attributes, Tracer } from '@opentelemetry/api';
import type { TelemetryOptions } from 'ai';
import {
  selectAttributes,
  type AttributeSpec,
  type AttributeSpecMap,
} from './select-attributes';

type SupplementalAttributeOption =
  | 'usage'
  | 'providerMetadata'
  | 'embedding'
  | 'reranking'
  | 'runtimeContext'
  | 'headers'
  | 'toolChoice'
  | 'schema';

export type SupplementalAttributeOptions = Record<
  SupplementalAttributeOption,
  boolean
>;

export type OpenTelemetrySpanType =
  | 'operation'
  | 'step'
  | 'languageModel'
  | 'tool'
  | 'embedding'
  | 'reranking';

export type EnrichSpan = (options: {
  spanType: OpenTelemetrySpanType;
  operationId: string;
  callId: string;
  runtimeContext: Record<string, unknown> | undefined;
}) => Attributes | undefined;

export type OpenTelemetryOptions = {
  /**
   * The tracer to use for the telemetry data.
   */
  tracer?: Tracer;

  /**
   * Adds custom attributes to spans when they are created. These attributes are
   * not AI SDK-owned semantics and are intended for observability integrations.
   */
  enrichSpan?: EnrichSpan;

  /**
   * Emit AI SDK usage details that are not represented by GenAI SemConv.
   */
  usage?: boolean;

  /**
   * Emit provider metadata on response spans.
   */
  providerMetadata?: boolean;

  /**
   * Emit embedding input and output values.
   */
  embedding?: boolean;

  /**
   * Emit reranking input documents and output ranking.
   */
  reranking?: boolean;

  /**
   * Emit runtime context values.
   */
  runtimeContext?: boolean;

  /**
   * Emit request headers.
   */
  headers?: boolean;

  /**
   * Emit selected tool choice information.
   */
  toolChoice?: boolean;

  /**
   * Emit object generation schema information.
   */
  schema?: boolean;
};

const disabledSupplementalAttributes: SupplementalAttributeOptions = {
  usage: false,
  providerMetadata: false,
  embedding: false,
  reranking: false,
  runtimeContext: false,
  headers: false,
  toolChoice: false,
  schema: false,
};

export function normalizeSupplementalAttributes(
  options: OpenTelemetryOptions,
): SupplementalAttributeOptions {
  return {
    ...disabledSupplementalAttributes,
    usage: options.usage ?? false,
    providerMetadata: options.providerMetadata ?? false,
    embedding: options.embedding ?? false,
    reranking: options.reranking ?? false,
    runtimeContext: options.runtimeContext ?? false,
    headers: options.headers ?? false,
    toolChoice: options.toolChoice ?? false,
    schema: options.schema ?? false,
  };
}

export function getRuntimeContextAttributes(
  context: Record<string, unknown> | undefined,
): AttributeSpecMap {
  const attributes: AttributeSpecMap = {};

  for (const [key, value] of Object.entries(context ?? {})) {
    addRuntimeContextAttribute(attributes, `ai.settings.context.${key}`, value);
  }

  return attributes;
}

/**
 * Flattens nested runtime context objects into OTel-compatible attribute keys.
 * Arrays are preserved because OTel supports primitive array attribute values.
 */
function addRuntimeContextAttribute(
  attributes: AttributeSpecMap,
  key: string,
  value: unknown,
): void {
  if (value == null) {
    return;
  }

  if (Array.isArray(value) || typeof value !== 'object') {
    attributes[key] = value as AttributeSpec;
    return;
  }

  for (const [nestedKey, nestedValue] of Object.entries(value)) {
    addRuntimeContextAttribute(attributes, `${key}.${nestedKey}`, nestedValue);
  }
}

export function getHeaderAttributes(
  headers: Record<string, string | undefined> | undefined,
): AttributeSpecMap {
  return Object.fromEntries(
    Object.entries(headers ?? {})
      .filter(([, value]) => value != null)
      .map(([key, value]) => [`ai.request.headers.${key}`, value]),
  ) as AttributeSpecMap;
}

export function getDetailedUsageAttributes(usage: {
  inputTokenDetails?: {
    noCacheTokens?: number | undefined;
  };
  outputTokenDetails?: {
    textTokens?: number | undefined;
    reasoningTokens?: number | undefined;
  };
}): AttributeSpecMap {
  return {
    'ai.usage.inputTokenDetails.noCacheTokens':
      usage.inputTokenDetails?.noCacheTokens,
    'ai.usage.outputTokenDetails.textTokens':
      usage.outputTokenDetails?.textTokens,
    'ai.usage.outputTokenDetails.reasoningTokens':
      usage.outputTokenDetails?.reasoningTokens,
  };
}

export function selectSupplementalAttributes(
  telemetry: TelemetryOptions | undefined,
  enabledAttributes: SupplementalAttributeOptions,
  attributes: Partial<Record<SupplementalAttributeOption, AttributeSpecMap>>,
): Attributes {
  const result: Attributes = {};

  for (const [key, value] of Object.entries(attributes) as Array<
    [SupplementalAttributeOption, AttributeSpecMap | undefined]
  >) {
    if (!enabledAttributes[key] || value == null) {
      continue;
    }

    Object.assign(result, selectAttributes(telemetry, value));
  }

  return result;
}
