export function getErrorMessage(error: unknown | undefined) {
  if (error == null) {
    return 'unknown error';
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.toString();
  }

  return JSON.stringify(error);
}
