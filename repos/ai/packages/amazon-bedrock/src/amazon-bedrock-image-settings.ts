export type AmazonBedrockImageModelId =
  | 'amazon.nova-canvas-v1:0'
  | (string & {});

// https://docs.aws.amazon.com/nova/latest/userguide/image-gen-req-resp-structure.html
export const modelMaxImagesPerCall: Record<AmazonBedrockImageModelId, number> =
  {
    'amazon.nova-canvas-v1:0': 5,
  };
