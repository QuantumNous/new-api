import type { RealtimeModelV4 } from './realtime-model-v4';
import type { RealtimeModelV4ClientSecretOptions } from './realtime-model-v4-client-secret';

export type RealtimeFactoryV4GetTokenOptions = {
  model: string;
} & RealtimeModelV4ClientSecretOptions;

export type RealtimeFactoryV4GetTokenResult = {
  token: string;
  url: string;
  expiresAt?: number;
};

export interface RealtimeFactoryV4 {
  (modelId: string): RealtimeModelV4;

  getToken(
    options: RealtimeFactoryV4GetTokenOptions,
  ): Promise<RealtimeFactoryV4GetTokenResult>;
}
