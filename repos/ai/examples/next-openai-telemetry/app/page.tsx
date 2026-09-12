'use client';

import { useState } from 'react';

export default function Page() {
  const [generation, setGeneration] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-100">
      <button
        className="px-4 py-2 font-bold text-white bg-blue-500 rounded hover:bg-blue-700"
        onClick={async () => {
          try {
            setIsLoading(true);

            const response = await fetch('/api/text', {
              method: 'POST',
              body: JSON.stringify({
                prompt: 'Why is the sky blue?',
              }),
              headers: {
                'Content-Type': 'application/json',
              },
            });

            const json = await response.json();

            setGeneration(json.text);
          } catch (error) {
            setError(error as Error);
          } finally {
            setIsLoading(false);
          }
        }}
      >
        Generate
      </button>

      {error && <div className="text-red-500">{error.message}</div>}
      <div className="mt-4">
        {isLoading ? (
          <span className="text-blue-500">Loading...</span>
        ) : (
          <span className="text-gray-800">{generation}</span>
        )}
      </div>
    </div>
  );
}
