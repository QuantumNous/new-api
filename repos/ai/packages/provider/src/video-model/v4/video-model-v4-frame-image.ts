import type { VideoModelV4File } from './video-model-v4-file';

/**
 * The role a frame image plays in video generation.
 *
 * - `first_frame`: the starting frame the model animates from
 * - `last_frame`: the ending frame the model animates towards
 */
export type VideoModelV4FrameType = 'first_frame' | 'last_frame';

/**
 * A role-tagged image input for image-to-video and first-last-frame generation.
 */
export type VideoModelV4FrameImage = {
  /**
   * The image file used for this frame.
   */
  image: VideoModelV4File;

  /**
   * Which frame this image represents.
   */
  frameType: VideoModelV4FrameType;
};
