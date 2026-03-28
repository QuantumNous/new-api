export function ensureOptionUpdateSucceeded(
  responseData = {},
  fallbackMessage = '',
) {
  const { success, message } = responseData || {};

  if (success) {
    return;
  }

  const normalizedMessage =
    typeof message === 'string' && message.trim() !== ''
      ? message
      : fallbackMessage;

  throw new Error(normalizedMessage);
}

export function getOptionUpdateErrorMessage(
  error,
  fallbackMessage = '',
) {
  const message =
    typeof error?.message === 'string' ? error.message.trim() : '';

  return message || fallbackMessage;
}
