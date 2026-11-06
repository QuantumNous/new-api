// @ts-nocheck
import { createOpenAI } from '@ai-sdk/openai';

const openai = createOpenAI({
  apiKey: 'key',
  baseURL: 'url',
  headers: { 'custom': 'header' }
});
