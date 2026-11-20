export type KlingAIVideoModelId =
  // Text-to-Video
  | 'kling-v1-t2v'
  | 'kling-v1.6-t2v'
  | 'kling-v2-master-t2v'
  | 'kling-v2.1-master-t2v'
  | 'kling-v2.5-turbo-t2v'
  | 'kling-v2.6-t2v'
  | 'kling-v3.0-t2v'
  // Image-to-Video
  | 'kling-v1-i2v'
  | 'kling-v1.5-i2v'
  | 'kling-v1.6-i2v'
  | 'kling-v2-master-i2v'
  | 'kling-v2.1-i2v'
  | 'kling-v2.1-master-i2v'
  | 'kling-v2.5-turbo-i2v'
  | 'kling-v2.6-i2v'
  | 'kling-v3.0-i2v'
  // Motion Control
  | 'kling-v2.6-motion-control'
  | 'kling-v3.0-motion-control'
  | (string & {});
