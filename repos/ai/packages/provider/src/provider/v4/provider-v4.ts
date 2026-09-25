import type { EmbeddingModelV4 } from '../../embedding-model/v4/embedding-model-v4';
import type { FilesV4 } from '../../files/v4/files-v4';
import type { ImageModelV4 } from '../../image-model/v4/image-model-v4';
import type { LanguageModelV4 } from '../../language-model/v4/language-model-v4';
import type { RerankingModelV4 } from '../../reranking-model/v4/reranking-model-v4';
import type { SpeechModelV4 } from '../../speech-model/v4/speech-model-v4';
import type { TranscriptionModelV4 } from '../../transcription-model/v4/transcription-model-v4';
import type { SkillsV4 } from '../../skills/v4/skills-v4';

/**
 * Provider for language, text embedding, and image generation models.
 */
export interface ProviderV4 {
  readonly specificationVersion: 'v4';

  /**
   * Returns the language model with the given id.
   * The model id is then passed to the provider function to get the model.
   *
   * @param {string} modelId - The id of the model to return.
   *
   * @returns {LanguageModelV4} The language model associated with the id
   *
   * @throws {NoSuchModelError} If no such model exists.
   */
  languageModel(modelId: string): LanguageModelV4;

  /**
   * Returns the text embedding model with the given id.
   * The model id is then passed to the provider function to get the model.
   *
   * @param {string} modelId - The id of the model to return.
   *
   * @returns {EmbeddingModelV4} The embedding model associated with the id
   *
   * @throws {NoSuchModelError} If no such model exists.
   */
  embeddingModel(modelId: string): EmbeddingModelV4;

  /**
   * Returns the image model with the given id.
   * The model id is then passed to the provider function to get the model.
   *
   * @param {string} modelId - The id of the model to return.
   *
   * @returns {ImageModelV4} The image model associated with the id
   */
  imageModel(modelId: string): ImageModelV4;

  /**
   * Returns the transcription model with the given id.
   * The model id is then passed to the provider function to get the model.
   *
   * @param {string} modelId - The id of the model to return.
   *
   * @returns {TranscriptionModelV4} The transcription model associated with the id
   */
  transcriptionModel?(modelId: string): TranscriptionModelV4;

  /**
   * Returns the speech model with the given id.
   * The model id is then passed to the provider function to get the model.
   *
   * @param {string} modelId - The id of the model to return.
   *
   * @returns {SpeechModelV4} The speech model associated with the id
   */
  speechModel?(modelId: string): SpeechModelV4;

  /**
   * Returns the reranking model with the given id.
   * The model id is then passed to the provider function to get the model.
   *
   * @param {string} modelId - The id of the model to return.
   *
   * @returns {RerankingModelV4} The reranking model associated with the id
   *
   * @throws {NoSuchModelError} If no such model exists.
   */
  rerankingModel?(modelId: string): RerankingModelV4;

  /**
   * Returns the files interface for uploading files to the provider.
   * The returned interface can be passed to the `uploadFile` function.
   *
   * @returns {FilesV4} The files interface for this provider.
   */
  files?(): FilesV4;

  /**
   * Returns the skills interface for uploading skills to the provider.
   * The returned interface can be passed to the `uploadSkill` function.
   */
  skills?(): SkillsV4;
}
