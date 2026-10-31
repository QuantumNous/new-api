import type { ValidatorAdapter } from '@tanstack/react-router'

export interface ArkTypeLike {
  infer: any
  inferIn: any
  assert: (input: any) => any
}

export type ArkTypeValidatorAdapter<TOptions extends ArkTypeLike> =
  ValidatorAdapter<TOptions['inferIn'], TOptions['infer']>

export const arkTypeValidator = <TOptions extends ArkTypeLike>(
  options: TOptions,
): ArkTypeValidatorAdapter<TOptions> => {
  return {
    types: {
      input: options.inferIn,
      output: options.infer,
    },
    parse: (input) => options.assert(input),
  }
}
