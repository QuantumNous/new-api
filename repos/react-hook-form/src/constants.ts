export const EVENTS = {
  BLUR: 'blur',
  FOCUS_OUT: 'focusout',
  CHANGE: 'change',
  SUBMIT: 'submit',
  TRIGGER: 'trigger',
  VALID: 'valid',
} as const;

export const VALIDATION_MODE = {
  onBlur: 'onBlur',
  onChange: 'onChange',
  onSubmit: 'onSubmit',
  onTouched: 'onTouched',
  all: 'all',
} as const;

export const INPUT_VALIDATION_RULES = {
  max: 'max',
  min: 'min',
  maxLength: 'maxLength',
  minLength: 'minLength',
  pattern: 'pattern',
  required: 'required',
  validate: 'validate',
} as const;

export const ROOT_ERROR_TYPE = 'root';

export const PROTOTYPE_KEYWORDS = ['__proto__', 'constructor', 'prototype'];
