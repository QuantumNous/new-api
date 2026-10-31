import { parse } from 'valibot'
import type { ValidatorAdapter } from '@tanstack/react-router'
import type { GenericSchema, InferInput, InferOutput } from 'valibot'

export type ValibotValidatorAdapter<TOptions extends GenericSchema> =
  ValidatorAdapter<InferInput<TOptions>, InferOutput<TOptions>>

export const valibotValidator = <TOptions extends GenericSchema>(
  options: TOptions,
): ValibotValidatorAdapter<TOptions> => {
  return {
    types: {
      input: null,
      output: null,
    },
    parse: (input) => parse(options, input),
  }
}
