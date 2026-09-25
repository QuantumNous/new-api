import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { AISDKError, type LanguageModelV4 } from '@ai-sdk/provider';
import { generateText } from 'ai';

type ErrorDetails = {
  name: string;
  message: string;
  isAISDKError: boolean;
  cause?: {
    name: string;
    message: string;
  };
};

type ScenarioResult = {
  scenario: string;
  failurePhase: 'factory' | 'request' | 'none';
  error?: ErrorDetails;
};

function getErrorDetails(error: unknown): ErrorDetails {
  const cause =
    error instanceof Error && error.cause instanceof Error
      ? {
          name: error.cause.name,
          message: error.cause.message,
        }
      : undefined;

  return {
    name: error instanceof Error ? error.name : typeof error,
    message: error instanceof Error ? error.message : String(error),
    isAISDKError: AISDKError.isInstance(error),
    cause,
  };
}

async function runScenario({
  scenario,
  createModel,
}: {
  scenario: string;
  createModel: () => LanguageModelV4;
}): Promise<ScenarioResult> {
  let model: LanguageModelV4;

  try {
    model = createModel();
  } catch (error) {
    return {
      scenario,
      failurePhase: 'factory',
      error: getErrorDetails(error),
    };
  }

  try {
    await generateText({
      model,
      prompt: 'Hello',
      maxRetries: 0,
    });

    return { scenario, failurePhase: 'none' };
  } catch (error) {
    return {
      scenario,
      failurePhase: 'request',
      error: getErrorDetails(error),
    };
  }
}

function isHelpfulBaseURLError(result: ScenarioResult): boolean {
  return (
    result.failurePhase === 'factory' &&
    result.error?.isAISDKError === true &&
    /base.?url/i.test(result.error.message) &&
    /(empty|non-empty|invalid|required)/i.test(result.error.message)
  );
}

async function main() {
  const explicitOpenAI = await runScenario({
    scenario: 'createOpenAI({ baseURL: "" })',
    createModel: () =>
      createOpenAI({
        baseURL: '',
        apiKey: 'test-api-key',
      })('gpt-4o-mini'),
  });

  const originalOpenAIBaseURL = process.env.OPENAI_BASE_URL;
  let environmentOpenAI: ScenarioResult;

  try {
    process.env.OPENAI_BASE_URL = '';
    environmentOpenAI = await runScenario({
      scenario: 'OPENAI_BASE_URL=""',
      createModel: () =>
        createOpenAI({
          apiKey: 'test-api-key',
        })('gpt-4o-mini'),
    });
  } finally {
    if (originalOpenAIBaseURL == null) {
      delete process.env.OPENAI_BASE_URL;
    } else {
      process.env.OPENAI_BASE_URL = originalOpenAIBaseURL;
    }
  }

  const explicitAnthropic = await runScenario({
    scenario: 'createAnthropic({ baseURL: "" })',
    createModel: () =>
      createAnthropic({
        baseURL: '',
        apiKey: 'test-api-key',
      })('claude-sonnet-4-20250514'),
  });

  const primaryResults = [explicitOpenAI, environmentOpenAI];
  const primaryFailures = primaryResults.filter(
    result => !isHelpfulBaseURLError(result),
  );

  if (primaryFailures.length > 0) {
    throw new Error(
      `Reproduced issue #17156: ${primaryFailures
        .map(
          result =>
            `${result.scenario} failed during ${result.failurePhase} with ${result.error?.name}: ${result.error?.message}`,
        )
        .join('; ')}`,
    );
  }

  if (!isHelpfulBaseURLError(explicitAnthropic)) {
    throw new Error(
      `Other provider check failed: ${explicitAnthropic.scenario} failed during ${explicitAnthropic.failurePhase} with ${explicitAnthropic.error?.name}: ${explicitAnthropic.error?.message}`,
    );
  }

  const liveResult = await generateText({
    model: createOpenAI()('gpt-4o-mini'),
    prompt: 'Reply with exactly: empty base URL validation works',
    maxOutputTokens: 20,
  });

  const output = {
    expected:
      'OpenAI provider creation rejects an empty baseURL with a helpful AI SDK error mentioning the invalid base URL.',
    primaryResults,
    secondaryOtherProviderCheck: explicitAnthropic,
    liveOpenAIResponse: liveResult.text,
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
