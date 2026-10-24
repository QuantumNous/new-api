// @ts-ignore v6 API fixture for removed exports.
import { experimental_generateImage, type Experimental_GenerateImageResult } from 'ai';

declare const imageModel: any;

export const result: Experimental_GenerateImageResult =
  await experimental_generateImage({
    model: imageModel,
    prompt: 'A red panda eating bamboo',
  });
