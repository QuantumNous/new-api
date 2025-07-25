export const ITEMS_PER_PAGE = 10; // this value must keep same as the one defined in backend!

export const DEFAULT_ENDPOINT = '/api/ratio_config';

export const TABLE_COMPACT_MODES_KEY = 'table_compact_modes';

export const API_ENDPOINTS = [
  '/v1/chat/completions',
  '/v1/responses',
  '/v1/messages',
  '/v1beta/models',
  '/v1/embeddings',
  '/v1/rerank',
  '/v1/images/generations',
  '/v1/images/edits',
  '/v1/images/variations',
  '/v1/audio/speech',
  '/v1/audio/transcriptions',
  '/v1/audio/translations'
];

export const TASK_ACTION_GENERATE = 'generate';
export const TASK_ACTION_TEXT_GENERATE = 'textGenerate';