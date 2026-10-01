import { streamText } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { run } from '../../lib/run';

// An integration test for Vercel AI Gateway provider authentication. There are
// two authentication methods: OIDC and API key. Proper testing requires that
// the developer has set a valid OIDC token and API key in the
// `examples/ai-functions/.env` file (or otherwise in the environment somehow).

const VALID_OIDC_TOKEN = (() => {
  const token = process.env.VERCEL_OIDC_TOKEN;
  if (!token) {
    throw new Error('VERCEL_OIDC_TOKEN environment variable is required');
  }
  return token;
})();

const VALID_API_KEY = (() => {
  const key = process.env.AI_GATEWAY_API_KEY;
  if (!key) {
    throw new Error('AI_GATEWAY_API_KEY environment variable is required');
  }
  return key;
})();
const INVALID_OIDC_TOKEN = 'invalid-oidc-token';
const INVALID_API_KEY = 'invalid-api-key';

const testScenarios = [
  {
    name: 'no auth at all',
    setupEnv: () => {
      delete process.env.VERCEL_OIDC_TOKEN;
      delete process.env.AI_GATEWAY_API_KEY;
    },
    expectSuccess: false,
  },
  {
    name: 'valid oidc, invalid api key',
    setupEnv: () => {
      process.env.VERCEL_OIDC_TOKEN = VALID_OIDC_TOKEN;
      process.env.AI_GATEWAY_API_KEY = INVALID_API_KEY;
    },
    expectSuccess: false,
  },
  {
    name: 'invalid oidc, valid api key',
    setupEnv: () => {
      process.env.VERCEL_OIDC_TOKEN = INVALID_OIDC_TOKEN;
      process.env.AI_GATEWAY_API_KEY = VALID_API_KEY;
    },
    expectSuccess: true,
    expectedAuthMethod: 'api-key',
  },
  {
    name: 'no oidc, invalid api key',
    setupEnv: () => {
      delete process.env.VERCEL_OIDC_TOKEN;
      process.env.AI_GATEWAY_API_KEY = INVALID_API_KEY;
    },
    expectSuccess: false,
  },
  {
    name: 'no oidc, valid api key',
    setupEnv: () => {
      delete process.env.VERCEL_OIDC_TOKEN;
      process.env.AI_GATEWAY_API_KEY = VALID_API_KEY;
    },
    expectSuccess: true,
    expectedAuthMethod: 'api-key',
  },
  {
    name: 'valid oidc, valid api key',
    setupEnv: () => {
      process.env.VERCEL_OIDC_TOKEN = VALID_OIDC_TOKEN;
      process.env.AI_GATEWAY_API_KEY = VALID_API_KEY;
    },
    expectSuccess: true,
    expectedAuthMethod: 'api-key',
  },
  {
    name: 'valid oidc, no api key',
    setupEnv: () => {
      process.env.VERCEL_OIDC_TOKEN = VALID_OIDC_TOKEN;
      delete process.env.AI_GATEWAY_API_KEY;
    },
    expectSuccess: true,
    expectedAuthMethod: 'oidc',
  },
  {
    name: 'invalid oidc, no api key',
    setupEnv: () => {
      process.env.VERCEL_OIDC_TOKEN = INVALID_OIDC_TOKEN;
      delete process.env.AI_GATEWAY_API_KEY;
    },
    expectSuccess: false,
  },
  {
    name: 'invalid oidc, invalid api key',
    setupEnv: () => {
      process.env.VERCEL_OIDC_TOKEN = INVALID_OIDC_TOKEN;
      process.env.AI_GATEWAY_API_KEY = INVALID_API_KEY;
    },
    expectSuccess: false,
  },
];

async function testAuthenticationScenario(scenario: (typeof testScenarios)[0]) {
  scenario.setupEnv();

  console.log(`Testing: ${scenario.name}`);

  const abortController = new AbortController();
  const timeout = setTimeout(() => {
    abortController.abort(new Error('timeout'));
  }, 10000);

  try {
    const result = await testStream(abortController.signal);

    console.log(`  Result: SUCCESS`);
    return { success: true, detectedAuthMethod: result.detectedAuthMethod };
  } catch (error) {
    console.log(`  Result: FAILURE`);
    return { success: false, error };
  } finally {
    clearTimeout(timeout);
  }
}

async function testStream(abortSignal?: AbortSignal) {
  return new Promise<{ detectedAuthMethod: string }>((resolve, reject) => {
    const result = streamText({
      model: gateway('openai/gpt-4'),
      prompt: 'Respond with "OK"',
      onError: reject,
      abortSignal,
    });

    (async () => {
      try {
        let text = '';
        for await (const chunk of result.textStream) {
          text += chunk;
        }

        const hasApiKey = !!process.env.AI_GATEWAY_API_KEY;
        const detectedAuthMethod = hasApiKey ? 'api-key' : 'oidc';

        resolve({ detectedAuthMethod });
      } catch (error) {
        reject(error);
      }
    })();
  });
}

async function runAllScenarios() {
  console.log('AI Gateway Authentication Tests\n');

  const results = [];

  for (const scenario of testScenarios) {
    const result = await testAuthenticationScenario(scenario);
    const match = result.success === scenario.expectSuccess;

    results.push({
      scenario: scenario.name,
      expected: scenario.expectSuccess,
      actual: result.success,
      match,
      detectedAuthMethod: result.detectedAuthMethod,
    });
  }

  console.log('\nSUMMARY:');
  const passed = results.filter(r => r.match).length;
  console.log(`${passed}/${results.length} tests passed`);

  const failed = results.filter(r => !r.match);
  if (failed.length > 0) {
    console.log('\nFAILED:');
    failed.forEach(r => {
      console.log(
        `  ${r.scenario}: expected ${r.expected ? 'SUCCESS' : 'FAILURE'}, got ${r.actual ? 'SUCCESS' : 'FAILURE'}`,
      );
    });
  }
}

run(async () => {
  const scenarioArg = process.argv[2];

  if (!scenarioArg || scenarioArg === 'all') {
    await runAllScenarios();
  } else {
    const scenario = testScenarios.find(s => s.name === scenarioArg);
    if (!scenario) {
      console.log('Available scenarios:');
      testScenarios.forEach(s => console.log(`  ${s.name}`));
      return;
    }
    await testAuthenticationScenario(scenario);
  }
});
