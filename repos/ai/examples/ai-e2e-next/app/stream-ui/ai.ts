import { createAI } from '@ai-sdk/rsc';
import { submitUserMessage, type AIState, type UIState } from './actions';
import { generateId } from 'ai';

export const AI = createAI({
  actions: { submitUserMessage },
  initialUIState: [] as UIState,
  initialAIState: { chatId: generateId(), messages: [] } as AIState,
});
