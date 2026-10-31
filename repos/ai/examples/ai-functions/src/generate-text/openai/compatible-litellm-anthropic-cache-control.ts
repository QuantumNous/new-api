import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  // See ../../../litellm/README.md for instructions on how to run a LiteLLM
  // proxy locally configured to interface with Anthropic.
  const litellmAnthropic = createOpenAICompatible({
    baseURL: 'http://0.0.0.0:4000',
    name: 'litellm-anthropic',
  });
  const model = litellmAnthropic.chatModel('claude-3-5-sonnet-20240620');
  const result = await generateText({
    model,
    messages: [
      {
        role: 'system',
        // https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching#cache-limitations
        // The cache content must be of a meaningful size (e.g. 1024 tokens, see
        // above for detail) and will only be cached for a moderate period of
        // time e.g. 5 minutes.
        content:
          "You are an AI assistant tasked with analyzing this story: The ancient clocktower stood sentinel over Millbrook Valley, its weathered copper face gleaming dully in the late afternoon sun. Sarah Chen adjusted her backpack and gazed up at the structure that had fascinated her since childhood. At thirteen stories tall, it had been the highest building in town for over a century, though now it was dwarfed by the glass and steel office buildings that had sprung up around it.\n\nThe door creaked as she pushed it open, sending echoes through the dusty entrance hall. Her footsteps on the marble floor seemed unnaturally loud in the empty space. The restoration project wouldn't officially begin for another week, but as the lead architectural historian, she had permission to start her preliminary survey early.\n\nThe building had been abandoned for twenty years, ever since the great earthquake of 2003 had damaged the clock mechanism. The city had finally approved funding to restore it to working order, but Sarah suspected there was more to the clocktower than anyone realized. Her research had uncovered hints that its architect, Theodore Hammond, had built secret rooms and passages throughout the structure.\n\nShe clicked on her flashlight and began climbing the main staircase. The emergency lights still worked on the lower floors, but she'd need the extra illumination higher up. The air grew mustier as she ascended, thick with decades of undisturbed dust. Her hand traced along the ornate brass railings, feeling the intricate patterns worked into the metal.\n\nOn the seventh floor, something caught her eye - a slight irregularity in the wall paneling that didn't match the blueprints she'd memorized. Sarah ran her fingers along the edge of the wood, pressing gently until she felt a click. A hidden door swung silently open, revealing a narrow passage.\n\nHer heart pounding with excitement, she squeezed through the opening. The passage led to a small octagonal room she estimated to be directly behind the clock face. Gears and mechanisms filled the space, all connected to a central shaft that rose up through the ceiling. But it was the walls that drew her attention - they were covered in elaborate astronomical charts and mathematical formulas.\n\n\"It's not just a clock,\" she whispered to herself. \"It's an orrery - a mechanical model of the solar system!\"\n\nThe complexity of the mechanism was far beyond what should have existed in the 1890s when the tower was built. Some of the mathematical notations seemed to describe orbital mechanics that wouldn't be discovered for decades after Hammond's death. Sarah's mind raced as she documented everything with her camera.\n\nA loud grinding sound from above made her jump. The central shaft began to rotate slowly, setting the gears in motion. She watched in amazement as the astronomical models came to life, planets and moons tracking across their metal orbits. But something was wrong - the movements didn't match any normal celestial patterns she knew.\n\nThe room grew noticeably colder. Sarah's breath frosted in the air as the mechanism picked up speed. The walls seemed to shimmer, becoming translucent. Through them, she could see not the expected view of downtown Millbrook, but a star-filled void that made her dizzy to look at.\n\nShe scrambled back toward the hidden door, but it had vanished. The room was spinning now, or maybe reality itself was spinning around it. Sarah grabbed onto a support beam as her stomach lurched. The stars beyond the walls wheeled and danced in impossible patterns.\n\nJust when she thought she couldn't take anymore, everything stopped. The mechanism ground to a halt. The walls solidified. The temperature returned to normal. Sarah's hands shook as she checked her phone - no signal, but the time display showed she had lost three hours.\n\nThe hidden door was back, and she practically fell through it in her haste to exit. She ran down all thirteen flights of stairs without stopping, bursting out into the street. The sun was setting now, painting the sky in deep purples and reds. Everything looked normal, but she couldn't shake the feeling that something was subtly different.\n\nBack in her office, Sarah pored over the photos she'd taken. The astronomical charts seemed to change slightly each time she looked at them, the mathematical formulas rearranging themselves when viewed from different angles. None of her colleagues believed her story about what had happened in the clocktower, but she knew what she had experienced was real.\n\nOver the next few weeks, she threw herself into research, trying to learn everything she could about Theodore Hammond. His personal papers revealed an obsession with time and dimensional theory far ahead of his era. There were references to experiments with \"temporal architecture\" and \"geometric manipulation of spacetime.\"\n\nThe restoration project continued, but Sarah made sure the hidden room remained undiscovered. Whatever Hammond had built, whatever portal or mechanism he had created, she wasn't sure the world was ready for it. But late at night, she would return to the clocktower and study the mysterious device, trying to understand its secrets.\n\nSometimes, when the stars aligned just right, she could hear the gears beginning to turn again, and feel reality starting to bend around her. And sometimes, in her dreams, she saw Theodore Hammond himself, standing at a drawing board, sketching plans for a machine that could fold space and time like paper - a machine that looked exactly like the one hidden in the heart of his clocktower.\n\nThe mystery of what Hammond had truly built, and why, consumed her thoughts. But with each new piece of evidence she uncovered, Sarah became more certain of one thing - the clocktower was more than just a timepiece. It was a key to understanding the very nature of time itself, and its secrets were only beginning to be revealed.\n",
        providerOptions: {
          openaiCompatible: {
            cache_control: {
              type: 'ephemeral',
            },
          },
        },
      },
      {
        role: 'user',
        content: 'What are the key narrative points made in this story?',
      },
    ],
  });

  console.log(result.text);
  console.log();
  // Note the cache-specific token usage information is not yet available in the
  // AI SDK. We plan to make it available in the response through the
  // `providerMetadata` field in the future.
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
});
