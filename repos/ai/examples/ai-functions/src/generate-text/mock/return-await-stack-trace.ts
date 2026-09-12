import {
  generateText,
  wrapLanguageModel,
  type LanguageModelMiddleware,
} from 'ai';
import { MockLanguageModelV3 } from 'ai/test';
import { run } from '../../lib/run';

function createFailingModel() {
  return new MockLanguageModelV3({
    doGenerate: async () => {
      await Promise.resolve();

      throw new Error('stack trace reproduction error');
    },
  });
}

async function plainLeaf() {
  await Promise.resolve();

  throw new Error('stack trace reproduction error');
}

async function plainWithoutAwait() {
  return plainLeaf();
}

async function plainWithAwait() {
  return await plainLeaf();
}

const wrapGenerateWithoutAwait: NonNullable<
  LanguageModelMiddleware['wrapGenerate']
> = async ({ doGenerate }) => doGenerate();

const wrapGenerateWithAwait: NonNullable<
  LanguageModelMiddleware['wrapGenerate']
> = async ({ doGenerate }) => await doGenerate();

function createWrappedModelWithoutAwait() {
  const baseModel = createFailingModel();

  async function wrappedDoGenerateWithoutAwait(
    options: Parameters<MockLanguageModelV3['doGenerate']>[0],
  ) {
    return baseModel.doGenerate(options);
  }

  return new MockLanguageModelV3({
    doGenerate: wrappedDoGenerateWithoutAwait,
  });
}

function createWrappedModelWithAwait() {
  const baseModel = createFailingModel();

  async function wrappedDoGenerateWithAwait(
    options: Parameters<MockLanguageModelV3['doGenerate']>[0],
  ) {
    return await baseModel.doGenerate(options);
  }

  return new MockLanguageModelV3({
    doGenerate: wrappedDoGenerateWithAwait,
  });
}

async function failingGenerateTextCall(
  middleware: Pick<LanguageModelMiddleware, 'wrapGenerate'>,
) {
  return await generateText({
    model: wrapLanguageModel({
      model: createFailingModel(),
      middleware,
    }),
    prompt: 'Trigger the mock provider error.',
  });
}

async function sdkMiddlewareWithoutAwait() {
  return await failingGenerateTextCall({
    wrapGenerate: wrapGenerateWithoutAwait,
  });
}

async function sdkMiddlewareWithAwait() {
  return await failingGenerateTextCall({
    wrapGenerate: wrapGenerateWithAwait,
  });
}

async function sdkModelBoundaryWithoutAwait() {
  return await generateText({
    model: createWrappedModelWithoutAwait(),
    prompt: 'Trigger the mock provider error.',
  });
}

async function sdkModelBoundaryWithAwait() {
  return await generateText({
    model: createWrappedModelWithAwait(),
    prompt: 'Trigger the mock provider error.',
  });
}

async function runCase(
  name: string,
  fn: () => Promise<unknown>,
  framesToCheck: string[],
) {
  try {
    await fn();
  } catch (error) {
    const stack =
      error instanceof Error ? (error.stack ?? error.message) : String(error);

    console.log(`\n=== ${name} ===`);
    console.log(
      'Observed wrapper frames:',
      framesToCheck
        .map(
          frame => `${frame}: ${stack.includes(frame) ? 'present' : 'missing'}`,
        )
        .join(', '),
    );
    console.log(stack);
  }
}

run(async () => {
  console.log(
    [
      'This example compares async wrappers that return a promise directly',
      'with wrappers that use return await at the abstraction boundary.',
      'It first shows the plain JavaScript behavior, then reproduces the',
      'same missing-frame problem through generateText model and middleware wrappers.',
    ].join(' '),
  );

  console.log('\nPlain async baseline:');
  await runCase('plain async wrapper without return await', plainWithoutAwait, [
    'plainWithoutAwait',
  ]);

  await runCase('plain async wrapper with return await', plainWithAwait, [
    'plainWithAwait',
  ]);

  console.log(
    '\nAI SDK reproduction: even the awaited wrappers below still disappear from the stack.',
  );
  await runCase(
    'generateText model wrapper without return await',
    sdkModelBoundaryWithoutAwait,
    ['wrappedDoGenerateWithoutAwait'],
  );

  await runCase(
    'generateText model wrapper with return await',
    sdkModelBoundaryWithAwait,
    ['wrappedDoGenerateWithAwait'],
  );

  await runCase(
    'generateText middleware without return await',
    sdkMiddlewareWithoutAwait,
    ['wrapGenerateWithoutAwait'],
  );

  await runCase(
    'generateText middleware with return await',
    sdkMiddlewareWithAwait,
    ['wrapGenerateWithAwait'],
  );
});
