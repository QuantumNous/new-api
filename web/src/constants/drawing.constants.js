export const DEFAULT_DRAWING_MODEL = 'gpt-image-2';

export const DRAWING_SIZES = [
  { value: '1024x1024', label: '正方形' },
  { value: '1792x1024', label: '16:9 横屏' },
  { value: '1024x1792', label: '9:16 竖屏' },
  { value: '2048x2048', label: '正方形 2K' },
  { value: '3584x2048', label: '16:9 横屏 2K' },
  { value: '2048x3584', label: '9:16 竖屏 2K' },
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
  SESSION_MESSAGE: (sessionId) => `/pg/drawing/sessions/${sessionId}/message`,
  MESSAGE_IMAGES: (sessionId, messageId) =>
    `/pg/drawing/sessions/${sessionId}/messages/${messageId}/images`,
  GENERATE: (sessionId) => `/pg/drawing/sessions/${sessionId}/generate`,
  TASK_STATUS: (taskId) => `/pg/drawing/tasks/${taskId}`,
};
