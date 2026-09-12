'use client';

import { useState } from 'react';

export default function Home() {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const generateText = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/generate-node');
      const data = await response.json();
      setResult(data.message);
    } catch (error) {
      console.error('Error:', error);
      setResult('Failed to generate text');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <main className="flex flex-col gap-4 items-center">
        <h1 className="text-xl font-medium text-gray-700">
          Demo text generation with Google Vertex using google-auth-library
          authentication
        </h1>
        <button
          onClick={generateText}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
        >
          {loading ? 'Generating...' : 'Generate Text'}
        </button>

        {result && (
          <div className="mt-4 p-4 border rounded max-w-2xl">{result}</div>
        )}
      </main>
    </div>
  );
}
