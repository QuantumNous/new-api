export type HuggingFaceResponsesModelId =
  // https://router.huggingface.co/v1/models
  | 'meta-llama/Llama-3.1-8B-Instruct'
  | 'meta-llama/Llama-3.1-70B-Instruct'
  | 'meta-llama/Llama-3.1-405B-Instruct'
  | 'meta-llama/Llama-3.3-70B-Instruct'
  | 'meta-llama/Meta-Llama-3-8B-Instruct'
  | 'meta-llama/Meta-Llama-3-70B-Instruct'
  | 'meta-llama/Llama-3.2-3B-Instruct'
  | 'meta-llama/Llama-4-Maverick-17B-128E-Instruct'
  | 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8'
  | 'meta-llama/Llama-Guard-4-12B'
  | 'deepseek-ai/DeepSeek-V3.1'
  | 'deepseek-ai/DeepSeek-V3-0324'
  | 'deepseek-ai/DeepSeek-R1'
  | 'deepseek-ai/DeepSeek-R1-0528'
  | 'deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B'
  | 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B'
  | 'deepseek-ai/DeepSeek-R1-Distill-Qwen-14B'
  | 'deepseek-ai/DeepSeek-R1-Distill-Qwen-32B'
  | 'deepseek-ai/DeepSeek-R1-Distill-Llama-8B'
  | 'deepseek-ai/DeepSeek-R1-Distill-Llama-70B'
  | 'deepseek-ai/DeepSeek-Prover-V2-671B'
  | 'Qwen/Qwen3-32B'
  | 'Qwen/Qwen3-14B'
  | 'Qwen/Qwen3-8B'
  | 'Qwen/Qwen3-4B'
  | 'Qwen/Qwen3-Coder-480B-A35B-Instruct'
  | 'Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8'
  | 'Qwen/Qwen3-30B-A3B'
  | 'Qwen/Qwen2.5-VL-7B-Instruct'
  | 'Qwen/Qwen2.5-7B-Instruct'
  | 'Qwen/Qwen2.5-Coder-7B-Instruct'
  | 'Qwen/Qwen2.5-Coder-32B-Instruct'
  | 'google/gemma-2-9b-it'
  | 'google/gemma-3-27b-it'
  | 'moonshotai/Kimi-K2-Instruct'
  | (string & {});

export interface HuggingFaceResponsesSettings {
  metadata?: Record<string, string>;
  instructions?: string;
  strictJsonSchema?: boolean;
}
