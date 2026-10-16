// @ts-nocheck
import { StreamData as SData, appendClientMessage as ACM } from 'ai';
import { appendClientMessage } from 'some-other-package';

/* FIXME(@ai-sdk-upgrade-v5): The `StreamData` type has been removed. Please manually migrate following https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0#stream-data-removal */
const streamData = new SData();
streamData.append('custom-data');

/* FIXME(@ai-sdk-upgrade-v5): The `appendClientMessage` option has been removed. Please manually migrate following https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0#message-persistence-changes */
const messages = ACM({
  messages,
  message: lastUserMessage,
});

const unrelated = appendClientMessage();