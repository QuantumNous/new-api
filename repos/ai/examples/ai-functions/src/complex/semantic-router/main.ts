import { openai } from '@ai-sdk/openai';
import { SemanticRouter } from './semantic-router';
import { run } from '../../lib/run';

run(async () => {
  const router = new SemanticRouter({
    embeddingModel: openai.embedding('text-embedding-3-small'),
    similarityThreshold: 0.2,
    routes: [
      {
        name: 'sports' as const,
        values: [
          "who's your favorite football team?",
          'The World Cup is the most exciting event.',
          'I enjoy running marathons on weekends.',
        ],
      },
      {
        name: 'music' as const,
        values: [
          "what's your favorite genre of music?",
          'Classical music helps me concentrate.',
          'I recently attended a jazz festival.',
        ],
      },
    ],
  });

  // topic is strongly typed
  const topic = await router.route(
    'Many consider Michael Jordan the greatest basketball player ever.',
  );

  switch (topic) {
    case 'sports':
      console.log('sports');
      break;
    case 'music':
      console.log('music');
      break;
    case null:
      console.log('no topic found');
      break;
  }
});
