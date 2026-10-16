import { OTPField } from '@base-ui/react/otp-field';
import { createMultipleTypes } from 'docs/src/utils/createTypes';

const { types, AdditionalTypes } = createMultipleTypes(import.meta.url, OTPField);

export const TypesOTPField = types;
export const TypesOTPFieldAdditional = AdditionalTypes;
