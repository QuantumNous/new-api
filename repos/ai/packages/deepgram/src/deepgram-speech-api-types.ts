export type DeepgramSpeechAPITypes = {
  // Request body
  text: string;

  // Query parameters (these are set via query params, not body)
  model?: string;
  encoding?: string;
  sample_rate?: number;
  bit_rate?: number | string;
  container?: string;
  callback?: string;
  callback_method?: 'POST' | 'PUT';
  mip_opt_out?: boolean;
  tag?: string | string[];
};
