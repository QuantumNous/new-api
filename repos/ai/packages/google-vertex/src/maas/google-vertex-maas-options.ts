// https://cloud.google.com/vertex-ai/generative-ai/docs/maas/use-open-models
export type GoogleVertexMaasModelId =
  | 'deepseek-ai/deepseek-r1-0528-maas'
  | 'deepseek-ai/deepseek-v3.1-maas'
  | 'deepseek-ai/deepseek-v3.2-maas'
  | 'openai/gpt-oss-120b-maas'
  | 'openai/gpt-oss-20b-maas'
  | 'meta/llama-4-maverick-17b-128e-instruct-maas'
  | 'meta/llama-4-scout-17b-16e-instruct-maas'
  | 'minimax/minimax-m2-maas'
  | 'qwen/qwen3-coder-480b-a35b-instruct-maas'
  | 'qwen/qwen3-next-80b-a3b-instruct-maas'
  | 'qwen/qwen3-next-80b-a3b-thinking-maas'
  | 'moonshotai/kimi-k2-thinking-maas'
  | (string & {});
