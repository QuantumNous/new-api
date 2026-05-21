export const DEFAULT_DRAWING_MODEL = 'gpt-image-2';

export const DRAWING_ASPECT_RATIOS = [
  { value: '1:1', label: '正方形' },
  { value: '9:16', label: '9:16 竖屏' },
  { value: '16:9', label: '16:9 横屏' },
  { value: '3:4', label: '3:4 竖屏' },
  { value: '4:3', label: '4:3 横屏' },
];

export const DRAWING_RESOLUTIONS = [
  { value: '1K', label: '1K' },
  { value: '2K', label: '2K' },
];

export const DRAWING_SIZE_MAP = {
  '1K': {
    '1:1': '1024x1024',
    '9:16': '1024x1792',
    '16:9': '1792x1024',
    '3:4': '1024x1365',
    '4:3': '1365x1024',
  },
  '2K': {
    '1:1': '2048x2048',
    '9:16': '2048x3584',
    '16:9': '3584x2048',
    '3:4': '2048x2731',
    '4:3': '2731x2048',
  },
};

export function resolveDrawingSize(aspectRatio, resolution) {
  return (
    DRAWING_SIZE_MAP[resolution]?.[aspectRatio] ||
    DRAWING_SIZE_MAP[DRAWING_RESOLUTIONS[0].value][
      DRAWING_ASPECT_RATIOS[0].value
    ]
  );
}

export const MAX_UPLOAD_IMAGES = 4;
export const POLL_INTERVAL = 30000;
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
