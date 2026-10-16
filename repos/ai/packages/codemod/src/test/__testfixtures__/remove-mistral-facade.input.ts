// @ts-nocheck
import { createMistral } from '@ai-sdk/mistral';

const mistral = createMistral({
  apiKey: 'key',
  baseURL: 'url',
  headers: { 'custom': 'header' }
});
