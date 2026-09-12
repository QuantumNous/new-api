// https://deepinfra.com/models/text-to-image
export type DeepInfraImageModelId =
  | 'stabilityai/sd3.5'
  | 'black-forest-labs/FLUX-1.1-pro'
  | 'black-forest-labs/FLUX-1-schnell'
  | 'black-forest-labs/FLUX-1-dev'
  | 'black-forest-labs/FLUX-pro'
  | 'black-forest-labs/FLUX.1-Kontext-dev'
  | 'black-forest-labs/FLUX.1-Kontext-pro'
  | 'stabilityai/sd3.5-medium'
  | 'stabilityai/sdxl-turbo'
  | (string & {});
