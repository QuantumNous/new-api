import { experimental_generateVideo as generateVideo } from 'ai';
import { presentVideos } from '../../lib/present-video';
import { run } from '../../lib/run';
import { withSpinner } from '../../lib/spinner';

run(async () => {
  const { videos } = await withSpinner('Generating video...', () =>
    generateVideo({
      model: 'google/veo-3.1-generate-001',
      prompt:
        "A Selkirk Rex cat looking at koi fish in a stream alongside the Philosopher's Path in Kyoto, in the style of ukiyo-e.",
      aspectRatio: '16:9',
      duration: 4,
    }),
  );

  await presentVideos(videos);
});
