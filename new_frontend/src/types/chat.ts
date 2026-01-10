export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface Model {
  id: string;
  name: string;
  provider: string;
  contextLength: number;
  icon?: string;
}

export interface Conversation {
  id: string;
  title: string;
  model: Model;
  messages: Message[];
  updatedAt: Date;
}
