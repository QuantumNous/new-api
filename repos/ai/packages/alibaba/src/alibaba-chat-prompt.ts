export type AlibabaCacheControl = { type: string };

export type AlibabaChatPrompt = Array<AlibabaChatMessage>;

export type AlibabaChatMessage =
  | AlibabaChatSystemMessage
  | AlibabaChatUserMessage
  | AlibabaChatAssistantMessage
  | AlibabaChatToolMessage;

export interface AlibabaChatSystemMessage {
  role: 'system';
  content: string | Array<AlibabaChatSystemMessageContent>;
}

export type AlibabaChatSystemMessageContent = {
  type: 'text';
  text: string;
  cache_control?: AlibabaCacheControl;
};

export interface AlibabaChatUserMessage {
  role: 'user';
  content: string | Array<AlibabaChatUserMessageContent>;
}

export type AlibabaChatUserMessageContent =
  | { type: 'text'; text: string; cache_control?: AlibabaCacheControl }
  | {
      type: 'image_url';
      image_url: { url: string };
      cache_control?: AlibabaCacheControl;
    };

export interface AlibabaChatAssistantMessage {
  role: 'assistant';
  content: string | null | Array<AlibabaChatAssistantMessageContent>;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
}

export type AlibabaChatAssistantMessageContent = {
  type: 'text';
  text: string;
  cache_control?: AlibabaCacheControl;
};

export interface AlibabaChatToolMessage {
  role: 'tool';
  tool_call_id: string;
  content: string | Array<AlibabaChatToolMessageContent>;
}

export type AlibabaChatToolMessageContent = {
  type: 'text';
  text: string;
  cache_control?: AlibabaCacheControl;
};

export type AlibabaChatToolChoice =
  | { type: 'function'; function: { name: string } }
  | 'auto'
  | 'none'
  | 'required';
