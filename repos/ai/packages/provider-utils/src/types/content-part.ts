import type { JSONValue } from '@ai-sdk/provider';
import type { DataContent } from './data-content';
import type { FileData, FileDataData, FileDataUrl } from './file-data';
import type { ProviderOptions } from './provider-options';
import type { ProviderReference } from './provider-reference';

/**
 * Text content part of a prompt. It contains a string of text.
 */
export interface TextPart {
  type: 'text';

  /**
   * The text content.
   */
  text: string;

  /**
   * Additional provider-specific metadata. They are passed through
   * to the provider from the AI SDK and enable provider-specific
   * functionality that can be fully encapsulated in the provider.
   */
  providerOptions?: ProviderOptions;
}

/**
 * Image content part of a prompt. It contains an image.
 *
 * @deprecated Use `FilePart` with `mediaType: 'image'` instead:
 * `{ type: 'file', mediaType: 'image', data: { type: 'data', data } }`.
 */
export interface ImagePart {
  type: 'image';

  /**
   * Image data. Can either be:
   *
   * - data: a base64-encoded string, a Uint8Array, an ArrayBuffer, or a Buffer
   * - URL: a URL that points to the image
   * - ProviderReference: a provider reference from `uploadFile`
   */
  image: DataContent | URL | ProviderReference;

  /**
   * Optional IANA media type of the image.
   *
   * @see https://www.iana.org/assignments/media-types/media-types.xhtml
   */
  mediaType?: string;

  /**
   * Additional provider-specific metadata. They are passed through
   * to the provider from the AI SDK and enable provider-specific
   * functionality that can be fully encapsulated in the provider.
   */
  providerOptions?: ProviderOptions;
}

/**
 * File content part of a prompt. It contains a file.
 */
export interface FilePart {
  type: 'file';

  /**
   * File data. Either a tagged shape or a bare shorthand:
   *
   * - `{ type: 'data', data }` or bare `DataContent`: raw bytes
   *   (base64 string, Uint8Array, ArrayBuffer, Buffer)
   * - `{ type: 'url', url }` or bare `URL`: a URL that points to the file
   * - `{ type: 'reference', reference }` or bare `ProviderReference`:
   *   a provider reference from `uploadFile`
   * - `{ type: 'text', text }`: inline text content (tagged only)
   */
  data: FileData | DataContent | URL | ProviderReference;

  /**
   * Optional filename of the file.
   */
  filename?: string;

  /**
   * Either a full IANA media type (`type/subtype`, e.g. `image/png`) or just
   * the top-level IANA segment (e.g. `image`, `audio`, `video`, `text`).
   *
   * `*`-subtype wildcards (e.g. `image/*`) are normalized as equivalent to the
   * top-level segment alone (e.g. `image`). Providers can use the helpers in
   * `@ai-sdk/provider-utils` (`isFullMediaType`, `getTopLevelMediaType`,
   * `detectMediaType`) to resolve the field according to their API
   * requirements.
   *
   * @see https://www.iana.org/assignments/media-types/media-types.xhtml
   */
  mediaType: string;

  /**
   * Additional provider-specific metadata. They are passed through
   * to the provider from the AI SDK and enable provider-specific
   * functionality that can be fully encapsulated in the provider.
   */
  providerOptions?: ProviderOptions;
}

/**
 * Reasoning content part of a prompt. It contains a reasoning.
 */
export interface ReasoningPart {
  type: 'reasoning';

  /**
   * The reasoning text.
   */
  text: string;

  /**
   * Additional provider-specific metadata. They are passed through
   * to the provider from the AI SDK and enable provider-specific
   * functionality that can be fully encapsulated in the provider.
   */
  providerOptions?: ProviderOptions;
}

/**
 * Custom content part of a prompt. It contains no standardized payload beyond
 * provider-specific options.
 */
export interface CustomPart {
  type: 'custom';

  /**
   * The kind of custom content, in the format `{provider}.{provider-type}`.
   */
  kind: `${string}.${string}`;

  /**
   * Additional provider-specific metadata. They are passed through
   * to the provider from the AI SDK and enable provider-specific
   * functionality that can be fully encapsulated in the provider.
   */
  providerOptions?: ProviderOptions;
}

/**
 * Reasoning file content part of a prompt. It contains a file generated as part of reasoning.
 */
export interface ReasoningFilePart {
  type: 'reasoning-file';

  /**
   * Reasoning file data.
   *
   * Reasoning files originate from a model's reasoning output and are always
   * raw bytes or a fetchable URL. Unlike `FilePart.data`, the `reference` and
   * `text` shapes are not supported here: provider references describe files
   * uploaded by the user (not produced as model output), and reasoning text is
   * carried by `ReasoningPart` rather than as a file.
   *
   * Either a tagged shape or a bare shorthand:
   *
   * - `{ type: 'data', data }` or bare `DataContent`: raw bytes
   *   (base64 string, Uint8Array, ArrayBuffer, Buffer)
   * - `{ type: 'url', url }` or bare `URL`: a URL that points to the file
   */
  data: FileDataData | FileDataUrl | DataContent | URL;

  /**
   * IANA media type of the file.
   *
   * @see https://www.iana.org/assignments/media-types/media-types.xhtml
   */
  mediaType: string;

  /**
   * Additional provider-specific metadata. They are passed through
   * to the provider from the AI SDK and enable provider-specific
   * functionality that can be fully encapsulated in the provider.
   */
  providerOptions?: ProviderOptions;
}

/**
 * Tool call content part of a prompt. It contains a tool call (usually generated by the AI model).
 */
export interface ToolCallPart {
  type: 'tool-call';

  /**
   * ID of the tool call. This ID is used to match the tool call with the tool result.
   */
  toolCallId: string;

  /**
   * Name of the tool that is being called.
   */
  toolName: string;

  /**
   * Arguments of the tool call. This is a JSON-serializable object that matches the tool's input schema.
   */
  input: unknown;

  /**
   * Additional provider-specific metadata. They are passed through
   * to the provider from the AI SDK and enable provider-specific
   * functionality that can be fully encapsulated in the provider.
   */
  providerOptions?: ProviderOptions;

  /**
   * Whether the tool call was executed by the provider.
   */
  providerExecuted?: boolean;
}

/**
 * Tool result content part of a prompt. It contains the result of the tool call with the matching ID.
 */
export interface ToolResultPart {
  type: 'tool-result';

  /**
   * ID of the tool call that this result is associated with.
   */
  toolCallId: string;

  /**
   * Name of the tool that generated this result.
   */
  toolName: string;

  /**
   * Result of the tool call. This is a JSON-serializable object.
   */
  output: ToolResultOutput;

  /**
   * Additional provider-specific metadata. They are passed through
   * to the provider from the AI SDK and enable provider-specific
   * functionality that can be fully encapsulated in the provider.
   */
  providerOptions?: ProviderOptions;
}

/**
 * Output of a tool result.
 */
export type ToolResultOutput =
  | {
      /**
       * Text tool output that should be directly sent to the API.
       */
      type: 'text';
      value: string;

      /**
       * Provider-specific options.
       */
      providerOptions?: ProviderOptions;
    }
  | {
      type: 'json';
      value: JSONValue;

      /**
       * Provider-specific options.
       */
      providerOptions?: ProviderOptions;
    }
  | {
      /**
       * Type when the user has denied the execution of the tool call.
       */
      type: 'execution-denied';

      /**
       * Optional reason for the execution denial.
       */
      reason?: string;

      /**
       * Provider-specific options.
       */
      providerOptions?: ProviderOptions;
    }
  | {
      type: 'error-text';
      value: string;

      /**
       * Provider-specific options.
       */
      providerOptions?: ProviderOptions;
    }
  | {
      type: 'error-json';
      value: JSONValue;

      /**
       * Provider-specific options.
       */
      providerOptions?: ProviderOptions;
    }
  | {
      type: 'content';
      value: Array<
        | {
            type: 'text';

            /**
             * Text content.
             */
            text: string;

            /**
             * Provider-specific options.
             */
            providerOptions?: ProviderOptions;
          }
        | {
            type: 'file';

            /**
             * File data as a tagged discriminated union:
             *
             * - `{ type: 'data', data }`: raw bytes
             *   (base64 string, Uint8Array, ArrayBuffer, Buffer)
             * - `{ type: 'url', url }`: a URL that points to the file
             * - `{ type: 'reference', reference }`: a provider reference
             *   from `uploadFile`
             * - `{ type: 'text', text }`: inline text content (e.g. an inline
             *   text document)
             */
            data: FileData;

            /**
             * Either a full IANA media type (`type/subtype`, e.g. `image/png`) or just
             * the top-level IANA segment (e.g. `image`, `audio`, `video`, `text`).
             *
             * `*`-subtype wildcards (e.g. `image/*`) are normalized as equivalent to the
             * top-level segment alone (e.g. `image`). Providers can use the helpers in
             * `@ai-sdk/provider-utils` (`isFullMediaType`, `getTopLevelMediaType`,
             * `detectMediaType`) to resolve the field according to their API
             * requirements.
             *
             * @see https://www.iana.org/assignments/media-types/media-types.xhtml
             */
            mediaType: string;

            /**
             * Optional filename of the file.
             */
            filename?: string;

            /**
             * Provider-specific options.
             */
            providerOptions?: ProviderOptions;
          }
        | {
            /**
             * @deprecated Use 'file' with mediaType + tagged data instead:
             * `{ type: 'file', mediaType, data: { type: 'data', data } }`.
             */
            type: 'file-data';

            /**
             * Base-64 encoded media data.
             */
            data: string;

            /**
             * IANA media type.
             * @see https://www.iana.org/assignments/media-types/media-types.xhtml
             */
            mediaType: string;

            /**
             * Optional filename of the file.
             */
            filename?: string;

            /**
             * Provider-specific options.
             */
            providerOptions?: ProviderOptions;
          }
        | {
            /**
             * @deprecated Use 'file' with mediaType and tagged data instead:
             * `{ type: 'file', mediaType, data: { type: 'url', url: new URL(url) } }`.
             */
            type: 'file-url';

            /**
             * URL of the file.
             */
            url: string;

            /**
             * IANA media type.
             * @see https://www.iana.org/assignments/media-types/media-types.xhtml
             */
            mediaType?: string;

            /**
             * Provider-specific options.
             */
            providerOptions?: ProviderOptions;
          }
        | {
            /**
             * @deprecated Use 'file' with tagged data instead:
             * `{ type: 'file', mediaType, data: { type: 'reference', reference } }`.
             */
            type: 'file-id';

            /**
             * ID of the file.
             *
             * If you use multiple providers, you need to
             * specify the provider specific ids using
             * the Record option. The key is the provider
             * name, e.g. 'openai' or 'anthropic'.
             */
            fileId: string | Record<string, string>;

            /**
             * Provider-specific options.
             */
            providerOptions?: ProviderOptions;
          }
        | {
            /**
             * @deprecated Use 'file' with tagged data instead:
             * `{ type: 'file', mediaType, data: { type: 'reference', reference } }`.
             */
            type: 'file-reference';

            /**
             * Provider-specific references for the file.
             * The key is the provider name, e.g. 'openai' or 'anthropic'.
             */
            providerReference: ProviderReference;

            /**
             * Provider-specific options.
             */
            providerOptions?: ProviderOptions;
          }
        | {
            /**
             * @deprecated Use 'file' with mediaType (e.g. 'image' or a specific
             * `image/*` subtype) and tagged data instead:
             * `{ type: 'file', mediaType: 'image', data: { type: 'data', data } }`.
             */
            type: 'image-data';

            /**
             * Base-64 encoded image data.
             */
            data: string;

            /**
             * IANA media type.
             * @see https://www.iana.org/assignments/media-types/media-types.xhtml
             */
            mediaType: string;

            /**
             * Provider-specific options.
             */
            providerOptions?: ProviderOptions;
          }
        | {
            /**
             * @deprecated Use 'file' with `mediaType: 'image'` (or a specific
             * `image/*` subtype) and tagged data instead:
             * `{ type: 'file', mediaType: 'image', data: { type: 'url', url: new URL(url) } }`.
             */
            type: 'image-url';

            /**
             * URL of the image.
             */
            url: string;

            /**
             * Provider-specific options.
             */
            providerOptions?: ProviderOptions;
          }
        | {
            /**
             * @deprecated Use 'file' with `mediaType: 'image'` (or a specific
             * `image/*` subtype) and tagged data instead:
             * `{ type: 'file', mediaType: 'image', data: { type: 'reference', reference } }`.
             */
            type: 'image-file-id';

            /**
             * Image that is referenced using a provider file id.
             *
             * If you use multiple providers, you need to
             * specify the provider specific ids using
             * the Record option. The key is the provider
             * name, e.g. 'openai' or 'anthropic'.
             */
            fileId: string | Record<string, string>;

            /**
             * Provider-specific options.
             */
            providerOptions?: ProviderOptions;
          }
        | {
            /**
             * @deprecated Use 'file' with `mediaType: 'image'` (or a specific
             * `image/*` subtype) and tagged data instead:
             * `{ type: 'file', mediaType: 'image', data: { type: 'reference', reference } }`.
             */
            type: 'image-file-reference';

            /**
             * Provider-specific references for the image file.
             * The key is the provider name, e.g. 'openai' or 'anthropic'.
             */
            providerReference: ProviderReference;

            /**
             * Provider-specific options.
             */
            providerOptions?: ProviderOptions;
          }
        | {
            /**
             * Custom content part. This can be used to implement
             * provider-specific content parts.
             */
            type: 'custom';

            /**
             * Provider-specific options.
             */
            providerOptions?: ProviderOptions;
          }
      >;
    };
