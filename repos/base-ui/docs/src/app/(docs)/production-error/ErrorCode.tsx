'use client';
import * as React from 'react';
import { useSearchParams } from 'next/navigation';

export interface ErrorDisplayProps {
  msg: string;
}

function ErrorCodeContent() {
  return useSearchParams().get('code') ?? '';
}

/**
 * Client component that interpolates arguments in an error message. Must be
 * a client component because it reads the search params.
 */
export default function ErrorCode() {
  return (
    <React.Suspense fallback="…">
      <ErrorCodeContent />
    </React.Suspense>
  );
}
