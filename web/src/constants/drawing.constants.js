export const DRAWING_MODELS = [
  { value: 'gpt-image-2', label: 'GPT Image 2' },
];

export const DRAWING_SIZES = [
  { value: 'auto', label: 'Auto' },
  { value: '1024x1024', label: '1024x1024' },
  { value: '1536x1024', label: '1536x1024 (横)' },
  { value: '1024x1536', label: '1024x1536 (竖)' },
  { value: '1536x864', label: '1536x864 (宽屏)' },
  { value: '3840x2160', label: '3840x2160 (4K)' },
];

export const DRAWING_QUALITIES = [
  { value: 'auto', label: 'Auto' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

export const MAX_UPLOAD_IMAGES = 4;
export const POLL_INTERVAL = 3000;
export const POLL_TIMEOUT = 300000;

export const DRAWING_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  FAILURE: 'failure',
};

export const DRAWING_API = {
  SESSIONS: '/pg/drawing/sessions',
  SESSION_DETAIL: (sessionId) => `/pg/drawing/sessions/${sessionId}`,
  SESSION_MESSAGES: (sessionId) => `/pg/drawing/sessions/${sessionId}/messages`,
  MESSAGE_IMAGES: (sessionId, messageId) => `/pg/drawing/sessions/${sessionId}/messages/${messageId}/images`,
  GENERATE: (sessionId) => `/pg/drawing/sessions/${sessionId}/generate`,
  TASK_STATUS: (taskId) => `/pg/drawing/tasks/${taskId}`,
};
