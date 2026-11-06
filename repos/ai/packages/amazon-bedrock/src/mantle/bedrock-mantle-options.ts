export type BedrockMantleChatModelId =
  | 'openai.gpt-oss-20b'
  | 'openai.gpt-oss-120b'
  | 'openai.gpt-oss-safeguard-20b'
  | 'openai.gpt-oss-safeguard-120b'
  | (string & {});

export type BedrockMantleResponsesModelId =
  | 'openai.gpt-oss-20b'
  | 'openai.gpt-oss-120b'
  | (string & {});

export type BedrockMantleModelId =
  | BedrockMantleChatModelId
  | BedrockMantleResponsesModelId;
