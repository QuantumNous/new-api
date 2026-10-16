// @ts-nocheck
import { StreamData as SData, appendClientMessage as ACM } from 'ai';
import { appendClientMessage } from 'some-other-package';

const streamData = new SData();
streamData.append('custom-data');

const messages = ACM({
  messages,
  message: lastUserMessage,
});

const unrelated = appendClientMessage();