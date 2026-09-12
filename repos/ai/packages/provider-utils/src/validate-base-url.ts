import { InvalidArgumentError } from '@ai-sdk/provider';

export function validateBaseURL(baseURL: string | undefined) {
  if (baseURL?.trim() === '') {
    throw new InvalidArgumentError({
      argument: 'baseURL',
      message: 'baseURL must be a non-empty string.',
    });
  }

  return baseURL;
}
