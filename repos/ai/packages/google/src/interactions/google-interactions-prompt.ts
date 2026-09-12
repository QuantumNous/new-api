/**
 * Internal TypeScript types for the Gemini Interactions API wire format.
 *
 * Mirrors the public types in `googleapis/js-genai`:
 * `src/interactions/resources/interactions.ts`.
 */

export type GoogleInteractionsTextContent = {
  type: 'text';
  text: string;
  annotations?: Array<GoogleInteractionsAnnotation | { type: string }>;
};

export type GoogleInteractionsImageContent = {
  type: 'image';
  data?: string;
  mime_type?: string;
  uri?: string;
  resolution?: 'low' | 'medium' | 'high' | 'ultra_high';
};

export type GoogleInteractionsAudioContent = {
  type: 'audio';
  data?: string;
  mime_type?: string;
  uri?: string;
  channels?: number;
  sample_rate?: number;
};

export type GoogleInteractionsDocumentContent = {
  type: 'document';
  data?: string;
  mime_type?: string;
  uri?: string;
};

export type GoogleInteractionsVideoContent = {
  type: 'video';
  data?: string;
  mime_type?: string;
  uri?: string;
  resolution?: 'low' | 'medium' | 'high' | 'ultra_high';
};

export type GoogleInteractionsThoughtSummaryItem =
  | GoogleInteractionsTextContent
  | GoogleInteractionsImageContent;

export type GoogleInteractionsFunctionResultContent = {
  type: 'function_result';
  call_id: string;
  result:
    | string
    | Array<GoogleInteractionsTextContent | GoogleInteractionsImageContent>
    | unknown;
  name?: string;
  is_error?: boolean;
  signature?: string;
};

/**
 * Annotation types attached to a `text` content block:
 * - `url_citation` (web) — `url` + optional `title`
 * - `file_citation` — `url` for the citation target; optional `document_uri`
 *   / `file_name` for doc references
 * - `place_citation` — Maps grounding, carries `url`
 */
export type GoogleInteractionsURLCitation = {
  type: 'url_citation';
  url?: string;
  title?: string;
  start_index?: number;
  end_index?: number;
};

export type GoogleInteractionsFileCitation = {
  type: 'file_citation';
  file_name?: string;
  document_uri?: string;
  url?: string;
  page_number?: number;
  media_id?: string;
  start_index?: number;
  end_index?: number;
  custom_metadata?: Record<string, unknown>;
};

export type GoogleInteractionsPlaceCitation = {
  type: 'place_citation';
  name?: string;
  url?: string;
  place_id?: string;
  start_index?: number;
  end_index?: number;
  review_snippets?: Array<{
    review_id?: string;
    title?: string;
    url?: string;
  }>;
};

export type GoogleInteractionsAnnotation =
  | GoogleInteractionsURLCitation
  | GoogleInteractionsFileCitation
  | GoogleInteractionsPlaceCitation;

/*
 * --- Step payload shapes ---
 *
 * `function_call`, `thought`, and the built-in `*_call`/`*_result` are
 * top-level **step** types — their fields live directly on the step object
 * (no `content` indirection). The types below model those payloads; the step
 * wrapper (`type` discriminator + payload) is `GoogleInteractionsStep`
 * further down.
 */

export type GoogleInteractionsFunctionCallStepPayload = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  signature?: string;
};

export type GoogleInteractionsThoughtStepPayload = {
  signature?: string;
  summary?: Array<GoogleInteractionsThoughtSummaryItem>;
};

export type GoogleInteractionsCodeExecutionCallStepPayload = {
  id: string;
  arguments?: { code?: string; language?: string };
  signature?: string;
};

export type GoogleInteractionsCodeExecutionResultStepPayload = {
  call_id: string;
  result?: string;
  is_error?: boolean;
  signature?: string;
};

export type GoogleInteractionsURLContextCallStepPayload = {
  id: string;
  arguments?: { urls?: Array<string> };
  signature?: string;
};

export type GoogleInteractionsURLContextResultEntry = {
  url?: string;
  status?: 'success' | 'error' | 'paywall' | 'unsafe' | string;
};

export type GoogleInteractionsURLContextResultStepPayload = {
  call_id: string;
  result?: Array<GoogleInteractionsURLContextResultEntry>;
  is_error?: boolean;
  signature?: string;
};

export type GoogleInteractionsGoogleSearchCallStepPayload = {
  id: string;
  arguments?: { queries?: Array<string> };
  search_type?: 'web_search' | 'image_search' | 'enterprise_web_search';
  signature?: string;
};

export type GoogleInteractionsGoogleSearchResultEntry = {
  search_suggestions?: string;
  url?: string;
  title?: string;
};

export type GoogleInteractionsGoogleSearchResultStepPayload = {
  call_id: string;
  result?: Array<GoogleInteractionsGoogleSearchResultEntry>;
  is_error?: boolean;
  signature?: string;
};

export type GoogleInteractionsFileSearchCallStepPayload = {
  id: string;
  signature?: string;
};

export type GoogleInteractionsFileSearchResultStepPayload = {
  call_id: string;
  result?: Array<unknown>;
  signature?: string;
};

export type GoogleInteractionsGoogleMapsCallStepPayload = {
  id: string;
  arguments?: { queries?: Array<string> };
  signature?: string;
};

export type GoogleInteractionsGoogleMapsResultPlace = {
  name?: string;
  place_id?: string;
  url?: string;
  review_snippets?: Array<{
    review_id?: string;
    title?: string;
    url?: string;
  }>;
};

export type GoogleInteractionsGoogleMapsResultEntry = {
  places?: Array<GoogleInteractionsGoogleMapsResultPlace>;
  widget_context_token?: string;
};

export type GoogleInteractionsGoogleMapsResultStepPayload = {
  call_id: string;
  result?: Array<GoogleInteractionsGoogleMapsResultEntry>;
  signature?: string;
};

export type GoogleInteractionsMCPServerToolCallStepPayload = {
  id: string;
  name: string;
  server_name: string;
  arguments?: Record<string, unknown>;
  signature?: string;
};

export type GoogleInteractionsMCPServerToolResultStepPayload = {
  call_id: string;
  result?: unknown;
  name?: string;
  server_name?: string;
  signature?: string;
};

/*
 * Discriminated step union — the elements of `response.steps[]` and the
 * `step` field on `step.start` SSE events.
 */
export type GoogleInteractionsModelOutputStep = {
  type: 'model_output';
  content?: Array<GoogleInteractionsContentBlock>;
};

export type GoogleInteractionsUserInputStep = {
  type: 'user_input';
  content?: Array<GoogleInteractionsContentBlock>;
};

export type GoogleInteractionsFunctionCallStep = {
  type: 'function_call';
} & GoogleInteractionsFunctionCallStepPayload;

export type GoogleInteractionsThoughtStep = {
  type: 'thought';
} & GoogleInteractionsThoughtStepPayload;

export type GoogleInteractionsBuiltinToolCallStep =
  | ({
      type: 'google_search_call';
    } & GoogleInteractionsGoogleSearchCallStepPayload)
  | ({
      type: 'code_execution_call';
    } & GoogleInteractionsCodeExecutionCallStepPayload)
  | ({ type: 'url_context_call' } & GoogleInteractionsURLContextCallStepPayload)
  | ({ type: 'file_search_call' } & GoogleInteractionsFileSearchCallStepPayload)
  | ({ type: 'google_maps_call' } & GoogleInteractionsGoogleMapsCallStepPayload)
  | ({
      type: 'mcp_server_tool_call';
    } & GoogleInteractionsMCPServerToolCallStepPayload);

export type GoogleInteractionsBuiltinToolResultStep =
  | ({
      type: 'google_search_result';
    } & GoogleInteractionsGoogleSearchResultStepPayload)
  | ({
      type: 'code_execution_result';
    } & GoogleInteractionsCodeExecutionResultStepPayload)
  | ({
      type: 'url_context_result';
    } & GoogleInteractionsURLContextResultStepPayload)
  | ({
      type: 'file_search_result';
    } & GoogleInteractionsFileSearchResultStepPayload)
  | ({
      type: 'google_maps_result';
    } & GoogleInteractionsGoogleMapsResultStepPayload)
  | ({
      type: 'mcp_server_tool_result';
    } & GoogleInteractionsMCPServerToolResultStepPayload);

export type GoogleInteractionsStep =
  | GoogleInteractionsUserInputStep
  | GoogleInteractionsModelOutputStep
  | GoogleInteractionsFunctionCallStep
  | GoogleInteractionsThoughtStep
  | GoogleInteractionsBuiltinToolCallStep
  | GoogleInteractionsBuiltinToolResultStep
  | { type: string; [k: string]: unknown };

/*
 * Inner content-block types (what lives inside `model_output.content[]` and
 * `user_input.content[]`). Function calls, thoughts, and built-in tool
 * call/result blocks are steps, not content blocks.
 */
export type GoogleInteractionsContentBlock =
  | GoogleInteractionsTextContent
  | GoogleInteractionsImageContent
  | GoogleInteractionsAudioContent
  | GoogleInteractionsDocumentContent
  | GoogleInteractionsVideoContent
  | GoogleInteractionsFunctionResultContent
  | { type: string; [k: string]: unknown };

/**
 * Alias kept for the file-part converter surface; identical to
 * `GoogleInteractionsContentBlock`.
 */
export type GoogleInteractionsContent = GoogleInteractionsContentBlock;

/*
 * `input` is an array of steps. A single-turn user prompt is sent as
 * `[{ type: 'user_input', content: [...] }]`.
 */
export type GoogleInteractionsInput = Array<GoogleInteractionsStep>;

export type GoogleInteractionsTool =
  | {
      type: 'function';
      name?: string;
      description?: string;
      parameters?: unknown;
    }
  | { type: 'code_execution' }
  | { type: 'url_context' }
  | {
      type: 'computer_use';
      environment?: 'browser';
      excludedPredefinedFunctions?: Array<string>;
    }
  | {
      type: 'mcp_server';
      name?: string;
      url?: string;
      headers?: Record<string, string>;
      allowed_tools?: Array<unknown>;
    }
  | {
      type: 'google_search';
      search_types?: Array<
        'web_search' | 'image_search' | 'enterprise_web_search'
      >;
    }
  | {
      type: 'file_search';
      file_search_store_names?: Array<string>;
      metadata_filter?: string;
      top_k?: number;
    }
  | {
      type: 'google_maps';
      enable_widget?: boolean;
      latitude?: number;
      longitude?: number;
    }
  | {
      type: 'retrieval';
      retrieval_types?: Array<'vertex_ai_search'>;
      vertex_ai_search_config?: {
        datastores?: Array<string>;
        engine?: string;
      };
    };

export type GoogleInteractionsToolChoiceType =
  | 'auto'
  | 'any'
  | 'none'
  | 'validated';

export type GoogleInteractionsAllowedToolsConfig = {
  allowed_tools?: {
    mode?: GoogleInteractionsToolChoiceType;
    tools?: Array<string>;
  };
};

export type GoogleInteractionsToolChoice =
  | GoogleInteractionsToolChoiceType
  | GoogleInteractionsAllowedToolsConfig;

export type GoogleInteractionsThinkingLevel =
  | 'minimal'
  | 'low'
  | 'medium'
  | 'high';

export type GoogleInteractionsThinkingSummaries = 'auto' | 'none';

export type GoogleInteractionsResponseModality =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'document';

export type GoogleInteractionsServiceTier = 'flex' | 'standard' | 'priority';

export type GoogleInteractionsAspectRatio =
  | '1:1'
  | '2:3'
  | '3:2'
  | '3:4'
  | '4:3'
  | '4:5'
  | '5:4'
  | '9:16'
  | '16:9'
  | '21:9'
  | '1:8'
  | '8:1'
  | '1:4'
  | '4:1';

export type GoogleInteractionsImageSize = '1K' | '2K' | '4K' | '512';

/*
 * `response_format` is a polymorphic entry. Multiple modalities are requested
 * by sending an array of entries. Entries the SDK constructs:
 *
 *   { type: 'text', mime_type: 'application/json', schema: <JSONSchema> }
 *     -- structured output (JSON mode). `mime_type` is required; `schema` is
 *     optional but recommended.
 *
 *   { type: 'image', mime_type, aspect_ratio?, image_size? }
 *     -- image generation. `mime_type` defaults to `image/png`.
 */
export type GoogleInteractionsResponseFormatTextEntry = {
  type: 'text';
  mime_type?: string;
  schema?: unknown;
};

export type GoogleInteractionsResponseFormatImageEntry = {
  type: 'image';
  mime_type?: string;
  aspect_ratio?: GoogleInteractionsAspectRatio;
  image_size?: GoogleInteractionsImageSize;
};

export type GoogleInteractionsResponseFormatAudioEntry = {
  type: 'audio';
  mime_type?: string;
};

export type GoogleInteractionsResponseFormatEntry =
  | GoogleInteractionsResponseFormatTextEntry
  | GoogleInteractionsResponseFormatImageEntry
  | GoogleInteractionsResponseFormatAudioEntry;

export type GoogleInteractionsGenerationConfig = {
  temperature?: number;
  top_p?: number;
  seed?: number;
  stop_sequences?: Array<string>;
  max_output_tokens?: number;
  thinking_level?: GoogleInteractionsThinkingLevel;
  thinking_summaries?: GoogleInteractionsThinkingSummaries;
  tool_choice?: GoogleInteractionsToolChoice;
};

export type GoogleInteractionsAgentConfig =
  | { type: 'dynamic'; [k: string]: unknown }
  | {
      type: 'deep-research';
      thinking_summaries?: GoogleInteractionsThinkingSummaries;
      visualization?: 'off' | 'auto';
      collaborative_planning?: boolean;
    };

export type GoogleInteractionsGcsSource = {
  type: 'gcs';
  source: string;
  target?: string;
};

export type GoogleInteractionsRepositorySource = {
  type: 'repository';
  source: string;
  target?: string;
};

export type GoogleInteractionsInlineSource = {
  type: 'inline';
  content: string;
  target: string;
};

export type GoogleInteractionsEnvironmentSource =
  | GoogleInteractionsGcsSource
  | GoogleInteractionsRepositorySource
  | GoogleInteractionsInlineSource;

export type GoogleInteractionsNetworkAllowlistEntry = {
  domain: string;
  transform?: Array<Record<string, string>>;
};

export type GoogleInteractionsNetworkConfig =
  | 'disabled'
  | { allowlist: Array<GoogleInteractionsNetworkAllowlistEntry> };

/**
 * Environment configuration for the agent sandbox.
 *
 *   - `"remote"`: provision a fresh sandbox for this call.
 *   - any other string: an existing `environment_id` to reuse (forks the
 *     previous sandbox so its filesystem and installed packages persist).
 *   - object form: provision a fresh sandbox and preload it with `sources`
 *     and/or constrain outbound traffic via `network`.
 */
export type GoogleInteractionsEnvironment =
  | string
  | {
      type: 'remote';
      sources?: Array<GoogleInteractionsEnvironmentSource>;
      network?: GoogleInteractionsNetworkConfig;
    };

export type GoogleInteractionsRequestBody = {
  model?: string;
  agent?: string;
  input: GoogleInteractionsInput;
  system_instruction?: string;
  tools?: Array<GoogleInteractionsTool>;
  response_format?: Array<GoogleInteractionsResponseFormatEntry>;
  response_modalities?: Array<GoogleInteractionsResponseModality>;
  generation_config?: GoogleInteractionsGenerationConfig;
  agent_config?: GoogleInteractionsAgentConfig;
  previous_interaction_id?: string;
  service_tier?: GoogleInteractionsServiceTier;
  store?: boolean;
  stream?: boolean;
  environment?: GoogleInteractionsEnvironment;
  /**
   * Run the interaction in the background. The POST returns immediately with a
   * non-terminal status (`in_progress` / `requires_action`); the client must
   * poll `GET /interactions/{id}` until terminal.
   *
   * Required for agent calls -- the API returns
   * `background=true is required for agent interactions.` otherwise. Not used
   * for model-id calls.
   */
  background?: boolean;
};

export type GoogleInteractionsStatus =
  | 'in_progress'
  | 'requires_action'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'incomplete';

/*
 * Aliases used by the source extractor; structurally equivalent to their
 * step-payload counterparts.
 */
export type GoogleInteractionsBuiltinToolResultContent =
  GoogleInteractionsBuiltinToolResultStep;
export type GoogleInteractionsGoogleSearchResultContent = Extract<
  GoogleInteractionsBuiltinToolResultStep,
  { type: 'google_search_result' }
>;
export type GoogleInteractionsGoogleMapsResultContent = Extract<
  GoogleInteractionsBuiltinToolResultStep,
  { type: 'google_maps_result' }
>;
export type GoogleInteractionsURLContextResultContent = Extract<
  GoogleInteractionsBuiltinToolResultStep,
  { type: 'url_context_result' }
>;
