import { PLAYGROUND_ENDPOINTS } from '../constants/playground.constants';

export const IMAGE_QUALITY_OPTIONS = ['low', 'medium', 'high', 'auto'];

export const validateImageSize = (size = '') => {
  const trimmedSize = String(size).trim();
  const match = /^([1-9]\d*)x([1-9]\d*)$/.exec(trimmedSize);

  if (!match) return 'Size must use axb format with positive integer dimensions';

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (width > 3840 || height > 3840) {
    return 'Size width and height must be less than or equal to 3840';
  }

  return null;
};

export const isImageGenerationEndpoint = (endpoint) =>
  endpoint === PLAYGROUND_ENDPOINTS.IMAGE_GENERATIONS;
