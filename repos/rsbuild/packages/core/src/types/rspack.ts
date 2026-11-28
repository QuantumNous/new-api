import type * as Rspack from '@rspack/core';
import type { RspackChain } from 'rspack-chain';
import type { TransformHandler } from './plugin';

export type { Rspack, RspackChain };

declare module '@rspack/core' {
  interface Compiler {
    __rsbuildTransformer?: Record<string, TransformHandler>;
  }
}

export type RspackRule = Rspack.RuleSetRules[number];
