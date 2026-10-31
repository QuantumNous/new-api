import { cohere } from '@ai-sdk/cohere';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: cohere('command-r-plus'),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'What are the key benefits of artificial intelligence mentioned in these documents?',
          },
          {
            type: 'file',
            data: `Artificial Intelligence (AI) has revolutionized many industries by providing:
1. Automation of repetitive tasks
2. Enhanced decision-making through data analysis
3. Improved customer service through chatbots
4. Predictive analytics for better planning
5. Cost reduction through efficiency gains`,
            mediaType: 'text/plain',
            filename: 'ai-benefits.txt',
          },
          {
            type: 'file',
            data: `Machine Learning, a subset of AI, offers additional advantages:
- Pattern recognition in large datasets
- Personalized recommendations
- Fraud detection and prevention
- Medical diagnosis assistance
- Natural language processing capabilities`,
            mediaType: 'text/plain',
            filename: 'ml-advantages.txt',
          },
        ],
      },
    ],
  });

  console.log('Generated response:');
  console.log(result.text);

  console.log('\nFull result object:');
  console.log(JSON.stringify(result, null, 2));
});
