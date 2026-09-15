import { generateSpeech } from 'ai';
import { registry } from './setup-registry';
import { run } from '../lib/run';

run(async () => {
  const { audio } = await generateSpeech({
    model: registry.speechModel('elevenLabs:eleven_multilingual_v2'),
    text: 'Hello, this is a test of ElevenLabs speech synthesis using the provider registry!',
    voice: process.env.ELEVENLABS_VOICE_ID || 'your-voice-id-here',
  });

  console.log('Generated audio:', audio);
});
