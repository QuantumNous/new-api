// https://www.alibabacloud.com/help/en/model-studio/use-video-generation
export type AlibabaVideoModelId =
  // Text-to-Video
  | 'wan2.6-t2v'
  | 'wan2.5-t2v-preview'
  | 'wan2.7-t2v'
  | 'wan2.7-t2v-2026-06-12'
  // Image-to-Video (first frame)
  | 'wan2.6-i2v'
  | 'wan2.6-i2v-flash'
  // Reference-to-Video
  | 'wan2.6-r2v'
  | 'wan2.6-r2v-flash'
  | 'wan2.7-r2v'
  | 'wan2.7-r2v-2026-06-12'
  | (string & {});
