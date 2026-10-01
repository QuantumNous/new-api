// https://cloud.google.com/vertex-ai/generative-ai/docs/learn/model-versions
// Note preview and experimental models may only be detailed in AI Studio:
// https://console.cloud.google.com/vertex-ai/studio/
export type GoogleVertexModelId =
  // Stable models
  | 'gemini-3.5-flash'
  | 'gemini-2.5-pro'
  | 'gemini-2.5-flash'
  | 'gemini-2.5-flash-lite'
  | 'gemini-2.0-flash-lite'
  | 'gemini-2.0-flash'
  | 'gemini-2.0-flash-001'
  | 'gemini-1.5-flash'
  | 'gemini-1.5-flash-001'
  | 'gemini-1.5-flash-002'
  | 'gemini-1.5-pro'
  | 'gemini-1.5-pro-001'
  | 'gemini-1.5-pro-002'
  | 'gemini-1.0-pro-001'
  | 'gemini-1.0-pro-vision-001'
  | 'gemini-1.0-pro'
  | 'gemini-1.0-pro-002'
  // Preview models
  | 'gemini-2.0-flash-lite-preview-02-05'
  | 'gemini-2.5-flash-preview-09-2025'
  | 'gemini-3-pro-preview'
  | 'gemini-3-pro-image-preview'
  | 'gemini-3-flash-preview'
  | 'gemini-3.1-pro-preview'
  | 'gemini-3.1-flash-image-preview'
  | 'gemini-3.1-flash-lite-preview'
  // Experimental models
  | 'gemini-2.0-pro-exp-02-05'
  | 'gemini-2.0-flash-exp'
  | (string & {});
