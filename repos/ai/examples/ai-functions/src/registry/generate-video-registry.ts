import { fal } from '@ai-sdk/fal';
import { createProviderRegistry, experimental_generateVideo } from 'ai';
import { presentVideos } from '../lib/present-video';
import { run } from '../lib/run';
import { withSpinner } from '../lib/spinner';

const registry = createProviderRegistry({ fal });

run(async () => {
  const { videos } = await withSpinner('Generating video...', () =>
    experimental_generateVideo({
      model: registry.videoModel('fal:luma-dream-machine/ray-2'),
      prompt: 'A cat walking on a beach at sunset',
      aspectRatio: '16:9',
      duration: 5,
    }),
  );

  await presentVideos(videos);
});
