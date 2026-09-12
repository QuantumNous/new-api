import type { JSONObject } from '@ai-sdk/provider';
import { isJSONSerializable } from './is-json-serializable';
import type { Resolvable } from './resolve';

/**
 * Serializes a model instance for workflow step boundaries.
 * Returns the `modelId` plus the JSON-serializable config properties.
 *
 * Non-serializable values are omitted. As a special case, a
 * function-valued `headers` property is resolved during serialization
 * and included if the returned value is JSON-serializable.
 *
 * Used as the body of `static [WORKFLOW_SERIALIZE]` in provider models.
 *
 * @example
 * ```ts
 * static [WORKFLOW_SERIALIZE](model: MyLanguageModel) {
 *   return serializeModelOptions({
 *     modelId: model.modelId,
 *     config: model.config,
 *   });
 * }
 * ```
 */
export function serializeModelOptions<
  CONFIG extends {
    headers?: Resolvable<Record<string, string | undefined>>;
  },
>(options: {
  modelId: string;
  config: CONFIG;
}): {
  modelId: string;
  config: JSONObject;
} {
  const serializableConfig: JSONObject = {};
  for (const [key, value] of Object.entries(options.config)) {
    if (key === 'headers') {
      const resolvedHeaders = resolveSync(value);
      if (isJSONSerializable(resolvedHeaders)) {
        serializableConfig[key] = resolvedHeaders;
      }
    } else if (isJSONSerializable(value)) {
      serializableConfig[key] = value;
    }
  }
  return { modelId: options.modelId, config: serializableConfig };
}

function resolveSync<T>(value: Resolvable<T>): T {
  let next: unknown = value;
  if (typeof value === 'function') {
    next = (value as () => unknown)();
  }

  // the serialization for workflows currently only supports synchronous values
  // TODO introduce SerializationError
  if (next instanceof Promise) {
    throw new Error('Promise returned from resolveSync');
  }

  return next as T;
}
