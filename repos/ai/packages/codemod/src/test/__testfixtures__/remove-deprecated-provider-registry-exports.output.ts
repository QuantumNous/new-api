// @ts-nocheck
import { Provider, experimental_createProviderRegistry } from 'ai';

function createProvider(): Provider {
  return {
    languageModel: () => null,
    textEmbeddingModel: () => null
  };
}

function createRegistry(): Provider {
  return experimental_createProviderRegistry({
    test: createProvider()
  });
}

const registry: Provider = createRegistry();
