// @ts-nocheck
import OpenAI from 'openai';
import { createOpenAI } from '@ai-sdk/openai';

const client1 = new OpenAI();
const client2 = createOpenAI();
