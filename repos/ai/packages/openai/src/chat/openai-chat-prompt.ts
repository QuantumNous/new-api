export type OpenAIChatPrompt = Array<ChatCompletionMessage>;

export type ChatCompletionMessage =
  | ChatCompletionSystemMessage
  | ChatCompletionDeveloperMessage
  | ChatCompletionUserMessage
  | ChatCompletionAssistantMessage
  | ChatCompletionToolMessage;

export interface ChatCompletionSystemMessage {
  role: 'system';
  content: string | Array<ChatCompletionContentPartText>;
}

export interface ChatCompletionDeveloperMessage {
  role: 'developer';
  content: string | Array<ChatCompletionContentPartText>;
}

export interface ChatCompletionUserMessage {
  role: 'user';
  content: string | Array<ChatCompletionContentPart>;
}

export type ChatCompletionContentPart =
  | ChatCompletionContentPartText
  | ChatCompletionContentPartImage
  | ChatCompletionContentPartInputAudio
  | ChatCompletionContentPartFile;

export interface ChatCompletionContentPartText {
  type: 'text';
  text: string;
  prompt_cache_breakpoint?: { mode: 'explicit' };
}

export interface ChatCompletionContentPartImage {
  type: 'image_url';
  image_url: { url: string };
  prompt_cache_breakpoint?: { mode: 'explicit' };
}

export interface ChatCompletionContentPartInputAudio {
  type: 'input_audio';
  input_audio: { data: string; format: 'wav' | 'mp3' };
  prompt_cache_breakpoint?: { mode: 'explicit' };
}

export interface ChatCompletionContentPartFile {
  type: 'file';
  file: { filename: string; file_data: string } | { file_id: string };
  prompt_cache_breakpoint?: { mode: 'explicit' };
}

export interface ChatCompletionAssistantMessage {
  role: 'assistant';
  content?: string | null | Array<ChatCompletionContentPartText>;
  tool_calls?: Array<ChatCompletionMessageToolCall>;
}

export interface ChatCompletionMessageToolCall {
  type: 'function';
  id: string;
  function: {
    arguments: string;
    name: string;
  };
}

export interface ChatCompletionToolMessage {
  role: 'tool';
  content: string | Array<ChatCompletionContentPartText>;
  tool_call_id: string;
}
