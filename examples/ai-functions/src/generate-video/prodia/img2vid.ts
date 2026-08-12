import { prodia, type ProdiaVideoModelOptions } from '@ai-sdk/prodia';
import { experimental_generateVideo } from 'ai';
import fs from 'node:fs';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

run(async () => {
  const { videos } = await withSpinner('Generating video from image...', () =>
    experimental_generateVideo({
      model: prodia.video('inference.wan2-2.lightning.img2vid.v0'),
      prompt: {
        image: fs.readFileSync('data/comic-cat.png'),
        text: 'The cat slowly turns its head and blinks',
      },
      providerOptions: {
        prodia: {
          resolution: '480p',
        } satisfies ProdiaVideoModelOptions,
      },
    }),
  );

  await presentVideos(videos);
});
