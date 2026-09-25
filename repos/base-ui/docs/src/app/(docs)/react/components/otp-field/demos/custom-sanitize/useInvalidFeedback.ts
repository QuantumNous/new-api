'use client';
import * as React from 'react';

export function useInvalidFeedback() {
  const [focusedIndex, setFocusedIndex] = React.useState(0);
  const [invalidPulse, setInvalidPulse] = React.useState(0);
  const [statusMessage, setStatusMessage] = React.useState('');
  const invalidTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipClearOnNextValueChangeRef = React.useRef(false);

  React.useEffect(() => {
    return () => {
      if (invalidTimeoutRef.current != null) {
        clearTimeout(invalidTimeoutRef.current);
      }
    };
  }, []);

  function clearInvalidFeedback() {
    if (invalidTimeoutRef.current != null) {
      clearTimeout(invalidTimeoutRef.current);
      invalidTimeoutRef.current = null;
    }

    setInvalidPulse(0);
    setStatusMessage('');
  }

  function handleValueChange() {
    if (skipClearOnNextValueChangeRef.current) {
      skipClearOnNextValueChangeRef.current = false;
      return;
    }

    clearInvalidFeedback();
  }

  function handleValueInvalid(value: string) {
    skipClearOnNextValueChangeRef.current = true;
    setInvalidPulse((current) => current + 1);
    setStatusMessage(`Unsupported characters were ignored from ${value}.`);

    if (invalidTimeoutRef.current != null) {
      clearTimeout(invalidTimeoutRef.current);
    }

    invalidTimeoutRef.current = setTimeout(() => {
      invalidTimeoutRef.current = null;
      setInvalidPulse(0);
    }, 400);
  }

  return {
    activeInvalidIndex: invalidPulse > 0 ? focusedIndex : -1,
    invalidPulse,
    statusMessage,
    setFocusedIndex,
    handleValueChange,
    handleValueInvalid,
  };
}
