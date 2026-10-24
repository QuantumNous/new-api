import { generateSpeech } from 'ai';
import { registry } from './setup-registry';
import { run } from '../lib/run';

run(async () => {
  const { audio } = await generateSpeech({
    model: registry.speechModel('openai:tts-1'),
    text: 'Hello, this is a test of speech synthesis using the provider registry!',
  });

  console.log('Generated audio:', audio);
});
