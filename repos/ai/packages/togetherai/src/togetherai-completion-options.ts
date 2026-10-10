// https://docs.together.ai/docs/serverless-models#language-models
export type TogetherAICompletionModelId =
  | 'meta-llama/Llama-2-70b-hf'
  | 'mistralai/Mistral-7B-v0.1'
  | 'mistralai/Mixtral-8x7B-v0.1'
  | 'Meta-Llama/Llama-Guard-7b'
  | 'codellama/CodeLlama-34b-Instruct-hf'
  | 'Qwen/Qwen2.5-Coder-32B-Instruct'
  | (string & {});
