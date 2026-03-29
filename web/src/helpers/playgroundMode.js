export const PLAYGROUND_MODES = {
  CHAT: 'chat',
  IMAGE: 'image',
  VIDEO: 'video',
};

const GROK_IMAGE_GENERATION_MODELS = new Set([
  'grok-imagine-1.0',
  'grok-imagine-1.0-fast',
]);

const GROK_IMAGE_EDIT_MODELS = new Set(['grok-imagine-1.0-edit']);

const ADOBE_IMAGE_MODELS = new Set([
  'nano-banana',
  'nano-banana-4k',
  'nano-banana2',
  'nano-banana2-4k',
  'nano-banana-pro',
  'nano-banana-pro-4k',
]);

const ADOBE_VIDEO_MODELS = new Set([
  'sora2',
  'sora2-pro',
  'veo31',
  'veo31-ref',
  'veo31-fast',
]);

export const isGrokImagineImageGenerationModel = (model) =>
  GROK_IMAGE_GENERATION_MODELS.has(model);

export const isGrokImagineImageEditModel = (model) =>
  GROK_IMAGE_EDIT_MODELS.has(model);

export const isGrokImagineImageModel = (model) =>
  isGrokImagineImageGenerationModel(model) || isGrokImagineImageEditModel(model);

export const usesDedicatedImageGenerationEndpoint = (model) =>
  isGrokImagineImageModel(model);

export const isAdobeImageModel = (model) => ADOBE_IMAGE_MODELS.has(model);

export const isAdobeImage4KModel = (model) =>
  typeof model === 'string' && model.endsWith('-4k');

export const isImageModeModel = (model) =>
  isGrokImagineImageModel(model) || isAdobeImageModel(model);

export const isGrokImagineVideoModel = (model) =>
  model === 'grok-imagine-1.0-video';

export const isAdobeVideoModel = (model) => ADOBE_VIDEO_MODELS.has(model);

export const isAdobeSoraModel = (model) =>
  model === 'sora2' || model === 'sora2-pro';

export const isAdobeVeoModel = (model) =>
  model === 'veo31' || model === 'veo31-ref' || model === 'veo31-fast';

export const isVideoModeModel = (model) =>
  isGrokImagineVideoModel(model) || isAdobeVideoModel(model);

export const isChatModeModel = (model) =>
  typeof model === 'string' &&
  model.trim() !== '' &&
  !isImageModeModel(model) &&
  !isVideoModeModel(model);

export const isModelCompatibleWithPlaygroundMode = (model, mode) => {
  switch (mode) {
    case PLAYGROUND_MODES.IMAGE:
      return isImageModeModel(model);
    case PLAYGROUND_MODES.VIDEO:
      return isVideoModeModel(model);
    case PLAYGROUND_MODES.CHAT:
    default:
      return isChatModeModel(model);
  }
};

export const getModelValues = (models = []) =>
  models
    .map((item) => {
      if (typeof item === 'string') {
        return item;
      }
      return item?.value;
    })
    .filter((item) => typeof item === 'string' && item.trim() !== '');

export const getAvailableModelsForPlaygroundMode = (models = [], mode) =>
  getModelValues(models).filter((model) =>
    isModelCompatibleWithPlaygroundMode(model, mode),
  );

export const getPreferredModelForPlaygroundMode = (
  currentModel,
  models = [],
  mode,
) => {
  if (isModelCompatibleWithPlaygroundMode(currentModel, mode)) {
    return currentModel;
  }

  return getAvailableModelsForPlaygroundMode(models, mode)[0] || '';
};
