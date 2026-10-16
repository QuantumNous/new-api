'use client';

import { useState } from 'react';

export default function Page() {
  const [inputValue, setInputValue] = useState('');
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setIsLoading(true);
    setImageSrc(null);
    setError(null);

    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: inputValue }),
      });

      if (response.ok) {
        const image = await response.json();
        setImageSrc(`data:image/png;base64,${image}`);
        return;
      }

      setError(await response.text());
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen p-24">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold tracking-tighter text-center sm:text-4xl md:text-5xl">
          Image Generator
        </h2>
        <p className="max-w-[600px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400">
          Generate images.
        </p>
      </div>

      <div className="w-full max-w-sm pt-6 pb-8 space-y-2">
        <form className="flex space-x-2" onSubmit={handleSubmit}>
          <input
            className="flex-1 max-w-lg px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            placeholder="Describe the image"
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 text-white bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-blue-300 disabled:cursor-not-allowed"
          >
            Generate
          </button>
        </form>
      </div>

      {error && (
        <div className="p-4 mb-4 text-red-700 bg-red-100 border border-red-400 rounded-lg">
          {error}
        </div>
      )}

      <div className="w-[512px] h-[512px] space-y-2">
        {isLoading ? (
          <div className="h-[512px] w-[512px] animate-pulse bg-gray-200 rounded-lg" />
        ) : (
          imageSrc && (
            <img
              alt="Generated Image"
              className="object-cover overflow-hidden rounded-lg"
              src={imageSrc}
            />
          )
        )}
      </div>
    </div>
  );
}
