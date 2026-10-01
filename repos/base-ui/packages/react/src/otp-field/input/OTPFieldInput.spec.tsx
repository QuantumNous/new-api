import { OTPField } from '@base-ui/react/otp-field';

// @ts-expect-error - slot order is inferred from render order
const noExplicitIndexSupport = <OTPField.Input index={0} />;
void noExplicitIndexSupport;
