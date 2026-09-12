// @ts-ignore v6 API fixture for removed exports.
import { generateImage, type GenerateImageResult } from 'ai';

declare const imageModel: any;

export const result: GenerateImageResult =
  await generateImage({
    model: imageModel,
    prompt: 'A red panda eating bamboo',
  });
