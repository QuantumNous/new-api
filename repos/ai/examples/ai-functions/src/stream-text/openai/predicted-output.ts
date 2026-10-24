import { openai, type OpenAILanguageModelChatOptions } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { run } from '../../lib/run';

const code = `
/// <summary>
/// Represents a user with a first name, last name, and username.
/// </summary>
public class User
{
    /// <summary>
    /// Gets or sets the user's first name.
    /// </summary>
    public string FirstName { get; set; }

    /// <summary>
    /// Gets or sets the user's last name.
    /// </summary>
    public string LastName { get; set; }

    /// <summary>
    /// Gets or sets the user's username.
    /// </summary>
    public string Username { get; set; }
}
`;

run(async () => {
  const result = streamText({
    model: openai('gpt-4o'),
    messages: [
      {
        role: 'user',
        content:
          'Replace the Username property with an Email property. Respond only with code, and with no markdown formatting.',
      },
      {
        role: 'user',
        content: code,
      },
    ],
    providerOptions: {
      openai: {
        prediction: {
          type: 'content',
          content: code,
        },
      } satisfies OpenAILanguageModelChatOptions,
    },
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  const usage = await result.usage;
  const openaiMetadata = (await result.finalStep).providerMetadata?.openai;

  console.log();
  console.log('Token usage:', {
    ...usage,
    acceptedPredictionTokens: openaiMetadata?.acceptedPredictionTokens,
    rejectedPredictionTokens: openaiMetadata?.rejectedPredictionTokens,
  });
  console.log('Finish reason:', await result.finishReason);
});
