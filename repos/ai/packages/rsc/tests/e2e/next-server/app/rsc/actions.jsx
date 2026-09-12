'use server';

import { createStreamableUI, createStreamableValue } from '@ai-sdk/rsc';
import { ClientInfo } from './client-utils';

function sleep(ms = 0) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function streamableUI() {
  const streamable = createStreamableUI();
  (async () => {
    await sleep();
    streamable.update(
      <ClientInfo>
        <p>I am a paragraph</p>
      </ClientInfo>,
    );
    await sleep();
    streamable.update(
      <ClientInfo>
        <button>I am a button</button>
      </ClientInfo>,
    );
    await sleep();
    streamable.done();
  })();
  return streamable.value;
}

export async function streamableValue() {
  const streamable = createStreamableValue('hello');
  (async () => {
    await sleep();
    streamable.append(', world');
    await sleep();
    streamable.append('!');
    await sleep();
    streamable.update({ value: 'I am a JSON' });
    await sleep();
    streamable.done(['Finished']);
  })();
  return streamable.value;
}
