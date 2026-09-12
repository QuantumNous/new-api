// https://cloud.google.com/vertex-ai/generative-ai/docs/partner-models/grok
export type GoogleVertexXaiModelId =
  | 'xai/grok-4.20-reasoning'
  | 'xai/grok-4.20-non-reasoning'
  | 'xai/grok-4.1-fast-reasoning'
  | 'xai/grok-4.1-fast-non-reasoning'
  | (string & {});
