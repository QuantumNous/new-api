export type {
  ProdiaImageModelOptions,
  /** @deprecated Use `ProdiaImageModelOptions` instead. */
  ProdiaImageModelOptions as ProdiaImageProviderOptions,
} from './prodia-image-model-options';
export type { ProdiaImageModelId } from './prodia-image-settings';
export type { ProdiaLanguageModelOptions } from './prodia-language-model-options';
export type { ProdiaLanguageModelId } from './prodia-language-model-settings';
export type { ProdiaVideoModelOptions } from './prodia-video-model-options';
export type { ProdiaVideoModelId } from './prodia-video-model-settings';
export type { ProdiaProvider, ProdiaProviderSettings } from './prodia-provider';
export { createProdia, prodia } from './prodia-provider';
export { VERSION } from './version';
