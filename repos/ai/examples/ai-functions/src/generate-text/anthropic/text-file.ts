import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const documentText = `TEAM ONBOARDING GUIDE

Welcome to the team! Here are the most important points to remember:

1. Morning standup is at 9:30 AM every weekday.
2. Code reviews should be completed within 24 hours.
3. All production deploys must be approved by at least two engineers.
4. The on-call rotation switches every Monday at noon.
5. Lunch-and-learn sessions happen on the last Friday of the month.
`;

  const result = await generateText({
    model: anthropic('claude-sonnet-4-6'),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Based on the attached onboarding document, when does the on-call rotation change?',
          },
          {
            type: 'file',
            mediaType: 'text/plain',
            data: { type: 'text', text: documentText },
          },
        ],
      },
    ],
  });

  console.log(result.text);
});
