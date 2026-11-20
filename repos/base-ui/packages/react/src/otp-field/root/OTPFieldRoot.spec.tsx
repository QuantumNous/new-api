import { expectType } from '#test-utils';
import { OTPField } from '@base-ui/react/otp-field';
import { REASONS } from '../../internals/reasons';

type OTPFieldChangeHandler = NonNullable<OTPField.Root.Props['onValueChange']>;
type OTPFieldChangeDetails = Parameters<OTPFieldChangeHandler>[1];
type OTPFieldInvalidHandler = NonNullable<OTPField.Root.Props['onValueInvalid']>;
type OTPFieldInvalidDetails = Parameters<OTPFieldInvalidHandler>[1];
type OTPFieldCompleteHandler = NonNullable<OTPField.Root.Props['onValueComplete']>;
type OTPFieldCompleteDetails = Parameters<OTPFieldCompleteHandler>[1];

function assertOTPFieldChange(details: OTPFieldChangeDetails) {
  if (details.reason === REASONS.inputPaste) {
    const event: ClipboardEvent = details.event;
    void event;
  }

  if (details.reason === REASONS.keyboard) {
    const event: KeyboardEvent = details.event;
    void event;
  }

  if (details.reason === REASONS.inputChange) {
    const event: InputEvent | Event = details.event;
    void event;
  }

  if (details.reason === REASONS.inputClear) {
    const event: InputEvent | FocusEvent | Event = details.event;
    void event;
    // @ts-expect-error keyboard events are not emitted for input-clear
    const keyboardEvent: KeyboardEvent = details.event;
    void keyboardEvent;
  }
}

const handleOTPFieldChange: OTPFieldChangeHandler = (value, details) => {
  expectType<string, typeof value>(value);
  assertOTPFieldChange(details);
};

function assertOTPFieldInvalid(details: OTPFieldInvalidDetails) {
  if (details.reason === REASONS.inputPaste) {
    const event: ClipboardEvent = details.event;
    void event;
  }

  if (details.reason === REASONS.inputChange) {
    const event: InputEvent | Event = details.event;
    void event;
  }
}

const handleOTPFieldInvalid: OTPFieldInvalidHandler = (value, details) => {
  expectType<string, typeof value>(value);
  assertOTPFieldInvalid(details);
};

function assertOTPFieldComplete(details: OTPFieldCompleteDetails) {
  if (details.reason === REASONS.inputPaste) {
    const event: ClipboardEvent = details.event;
    void event;
  }

  if (details.reason === REASONS.inputChange) {
    const event: InputEvent | Event = details.event;
    void event;
  }
}

const handleOTPFieldComplete: OTPFieldCompleteHandler = (value, details) => {
  expectType<string, typeof value>(value);
  assertOTPFieldComplete(details);
};

const otpFieldEventNarrowing = (
  <OTPField.Root
    length={6}
    form="verification-form"
    mask
    validationType="alphanumeric"
    normalizeValue={(value) => value.toUpperCase()}
    onValueChange={handleOTPFieldChange}
    onValueInvalid={handleOTPFieldInvalid}
    onValueComplete={handleOTPFieldComplete}
  />
);
void otpFieldEventNarrowing;

// @ts-expect-error - length is required
const requiresLength = <OTPField.Root />;
void requiresLength;

const customInputModeWithCustomValidation = (
  <OTPField.Root length={6} validationType="none" inputMode="numeric" />
);
void customInputModeWithCustomValidation;

const customInputModeWithBuiltInValidation = (
  <OTPField.Root length={6} validationType="numeric" inputMode="tel" />
);
void customInputModeWithBuiltInValidation;

const normalizesValue = (
  <OTPField.Root length={6} validationType="alphanumeric" normalizeValue={(value) => value} />
);
void normalizesValue;

const removedSanitizeValue = (
  // @ts-expect-error - sanitizeValue was renamed to normalizeValue
  <OTPField.Root length={6} validationType="alphanumeric" sanitizeValue={(value) => value} />
);
void removedSanitizeValue;
