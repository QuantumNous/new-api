// @ts-nocheck
import { createAnthropic } from '@ai-sdk/anthropic';

const anthropic = createAnthropic({
  apiKey: 'key',
  baseURL: 'url',
  headers: { 'custom': 'header' }
});
