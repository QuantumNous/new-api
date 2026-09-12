// @ts-nocheck
import { convertToModelMessages as toModel } from 'ai';

async function processMessages(uiMessages: any[]) {
  const modelMessages = await toModel(uiMessages);
  return modelMessages;
}

