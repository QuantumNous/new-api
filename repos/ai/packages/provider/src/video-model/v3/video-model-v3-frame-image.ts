import type { VideoModelV3File } from './video-model-v3-file';

/**
 * The role a frame image plays in video generation.
 *
 * - `first_frame`: the starting frame the model animates from
 * - `last_frame`: the ending frame the model animates towards
 */
export type VideoModelV3FrameType = 'first_frame' | 'last_frame';

/**
 * A role-tagged image input for image-to-video and first-last-frame generation.
 */
export type VideoModelV3FrameImage = {
  /**
   * The image file used for this frame.
   */
  image: VideoModelV3File;

  /**
   * Which frame this image represents.
   */
  frameType: VideoModelV3FrameType;
};
