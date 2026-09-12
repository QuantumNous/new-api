// @ts-nocheck
import { convertToModelMessages } from 'other-module';

async function processMessages(uiMessages: any[]) {
  const modelMessages = convertToModelMessages(uiMessages);
  return modelMessages;
}

