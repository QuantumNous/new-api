import { prodia, type ProdiaVideoModelOptions } from '@ai-sdk/prodia';
import { experimental_generateVideo } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

run(async () => {
  const { videos } = await withSpinner('Generating video...', () =>
    experimental_generateVideo({
      model: prodia.video('inference.wan2-2.lightning.txt2vid.v0'),
      prompt: 'A cat walking on a beach at sunset',
      providerOptions: {
        prodia: {
          resolution: '480p',
        } satisfies ProdiaVideoModelOptions,
      },
    }),
  );

  await presentVideos(videos);
});
