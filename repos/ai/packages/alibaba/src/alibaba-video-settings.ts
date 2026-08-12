// https://www.alibabacloud.com/help/en/model-studio/use-video-generation
export type AlibabaVideoModelId =
  // Text-to-Video
  | 'wan2.6-t2v'
  | 'wan2.5-t2v-preview'
  // Image-to-Video (first frame)
  | 'wan2.6-i2v'
  | 'wan2.6-i2v-flash'
  // Reference-to-Video
  | 'wan2.6-r2v'
  | 'wan2.6-r2v-flash'
  | (string & {});
