import InlineWorker from './inline-worker?worker&inline';
import QueryWorker from './query-worker?worker';

export const workerTypes = `${typeof QueryWorker}:${typeof InlineWorker}`;

export const workerSources = {
  inline: String(InlineWorker),
  query: String(QueryWorker),
};
