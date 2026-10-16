import type {
  Experimental_VideoModelV3,
  Experimental_VideoModelV4,
  SharedV4ProviderMetadata,
} from '@ai-sdk/provider';

/**
 * A video model can be a string (model ID) or a video model object.
 */
export type VideoModel =
  | string
  | Experimental_VideoModelV4
  | Experimental_VideoModelV3;

export type VideoModelProviderMetadata = SharedV4ProviderMetadata;
