import { toJsonSchema as valibotToJsonSchema } from '@valibot/to-json-schema';
import { jsonSchema, type Schema } from '@ai-sdk/provider-utils';
import * as v from 'valibot';

export function valibotSchema<
  SCHEMA extends v.GenericSchema<unknown, unknown, v.BaseIssue<unknown>>,
>(valibotSchema: SCHEMA): Schema<v.InferOutput<SCHEMA>> {
  return jsonSchema(valibotToJsonSchema(valibotSchema), {
    validate: value => {
      const result = v.safeParse(valibotSchema, value);
      return result.success
        ? { success: true, value: result.output }
        : { success: false, error: new v.ValiError(result.issues) };
    },
  });
}
