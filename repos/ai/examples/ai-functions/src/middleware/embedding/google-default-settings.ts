import { google } from '@ai-sdk/google';
import {
  customProvider,
  defaultEmbeddingSettingsMiddleware,
  embed,
  wrapEmbeddingModel,
} from 'ai';
import { print } from '../../lib/print';
import { run } from '../../lib/run';

const custom = customProvider({
  embeddingModels: {
    'powerful-embedding-model': wrapEmbeddingModel({
      model: google.embedding('gemini-embedding-001'),
      middleware: defaultEmbeddingSettingsMiddleware({
        settings: {
          providerOptions: {
            google: {
              outputDimensionality: 256,
              taskType: 'CLASSIFICATION',
            },
          },
        },
      }),
    }),
  },
});

run(async () => {
  const result = await embed({
    model: custom.embeddingModel('powerful-embedding-model'),
    value: 'rainy afternoon in the city',
  });

  print('Embedding length:', result.embedding.length);
});
