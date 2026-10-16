// https://docs.baseten.co/development/model-apis/overview#supported-models
// Below is the current list of models supported by Baseten model APIs.
// Ohter dedicated models are also supported, but not listed here.
export type BasetenChatModelId =
  | 'deepseek-ai/DeepSeek-R1-0528'
  | 'deepseek-ai/DeepSeek-V3-0324'
  | 'deepseek-ai/DeepSeek-V3.1'
  | 'moonshotai/Kimi-K2-Instruct-0905'
  | 'moonshotai/Kimi-K2-Thinking'
  | 'Qwen/Qwen3-235B-A22B-Instruct-2507'
  | 'Qwen/Qwen3-Coder-480B-A35B-Instruct'
  | 'openai/gpt-oss-120b'
  | 'zai-org/GLM-4.6'
  | 'zai-org/GLM-4.7'
  | (string & {});
