import type {
  InternalFieldErrors,
  InternalFieldName,
  ValidateResult,
} from '../types';

export default (
  name: InternalFieldName,
  validateAllFieldCriteria: boolean,
  errors: InternalFieldErrors,
  type: string,
  message: ValidateResult,
) =>
  validateAllFieldCriteria
    ? {
        ...errors[name],
        types: {
          ...(errors[name] && errors[name]!.types ? errors[name]!.types : {}),
          [type]: message || true,
        },
      }
    : {};
