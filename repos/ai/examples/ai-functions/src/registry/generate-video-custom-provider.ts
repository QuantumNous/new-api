import { fal } from '@ai-sdk/fal';
import { customProvider, experimental_generateVideo } from 'ai';
import { presentVideos } from '../lib/present-video';
import { run } from '../lib/run';
import { withSpinner } from '../lib/spinner';

const myProvider = customProvider({
  videoModels: {
    'luma-ray-2': fal.video('luma-dream-machine/ray-2'),
  },
});

run(async () => {
  const { videos } = await withSpinner('Generating video...', () =>
    experimental_generateVideo({
      model: myProvider.videoModel('luma-ray-2'),
      prompt: 'A cat walking on a beach at sunset',
      aspectRatio: '16:9',
      duration: 5,
    }),
  );

  await presentVideos(videos);
});
