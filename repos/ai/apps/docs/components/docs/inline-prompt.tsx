'use client';

import { useEffect, useId, useRef, useState } from 'react';

const getMockResponses = (input: string) => {
  if (input.toLowerCase().includes('coffee')) {
    return [
      'Brewed for better moments.',
      'Where every cup finds its rhythm.',
      'Organic beans. Uncommon energy.',
    ];
  }
  if (input.toLowerCase().includes('harry potter')) {
    return [
      'Mr. and Mrs. Dursley, of number four, Privet Drive, were proud to say that they were perfectly normal.',
    ];
  }
  return [
    'A memorable idea starts specific, speaks plainly, and gives people a reason to care.',
  ];
};

export const InlinePrompt = ({
  initialInput,
  initialTemperature = 0,
  showTemp = false,
  blocking = false,
}: {
  initialInput: string;
  initialTemperature?: number;
  showTemp?: boolean;
  blocking?: boolean;
  skipCache?: boolean;
}) => {
  const [input, setInput] = useState(initialInput);
  const [completion, setCompletion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [temperature, setTemperature] = useState(initialTemperature);
  const cleanupRef = useRef<(() => void) | null>(null);
  const responseIndexRef = useRef(0);
  const inputId = useId();

  useEffect(() => () => cleanupRef.current?.(), []);

  const generate = () => {
    cleanupRef.current?.();
    setCompletion('');
    setIsLoading(true);
    const responses = getMockResponses(input);
    const response =
      responses[
        temperature > 0 ? responseIndexRef.current % responses.length : 0
      ];
    responseIndexRef.current += 1;

    if (blocking) {
      const timeout = setTimeout(() => {
        setCompletion(response);
        setIsLoading(false);
      }, 700);
      cleanupRef.current = () => clearTimeout(timeout);
      return;
    }

    const words = response.split(' ');
    let index = 0;
    const interval = setInterval(() => {
      index += 1;
      setCompletion(words.slice(0, index).join(' '));
      if (index === words.length) {
        clearInterval(interval);
        setIsLoading(false);
      }
    }, 45);
    cleanupRef.current = () => clearInterval(interval);
  };

  return (
    <form
      className="not-prose my-4 overflow-hidden rounded-lg border border-gray-alpha-400"
      onSubmit={event => {
        event.preventDefault();
        generate();
      }}
    >
      <label className="sr-only" htmlFor={inputId}>
        Prompt
      </label>
      <div className="flex items-start gap-2 p-3">
        <textarea
          className="min-h-20 flex-1 resize-y rounded-md border border-gray-alpha-400 bg-background-100 p-3 text-gray-1000 text-sm leading-5 focus-visible:ring-2 focus-visible:ring-blue-700"
          id={inputId}
          name="prompt"
          onChange={event => setInput(event.target.value)}
          spellCheck={false}
          value={input}
        />
        <button
          className="rounded-md bg-gray-1000 px-3 py-2 font-medium text-background-100 text-sm hover:bg-gray-900 focus-visible:ring-2 focus-visible:ring-blue-700"
          disabled={isLoading}
          type="submit"
        >
          {isLoading ? 'Generating…' : 'Generate'}
        </button>
      </div>
      {showTemp ? (
        <label className="flex items-center gap-3 border-gray-alpha-400 border-t px-4 py-3 text-gray-900 text-sm">
          Temperature
          <input
            className="flex-1 accent-blue-700"
            max="1"
            min="0"
            onChange={event => setTemperature(Number(event.target.value))}
            step="0.1"
            type="range"
            value={temperature}
          />
          <span className="w-6 text-right font-mono tabular-nums">
            {temperature.toFixed(1)}
          </span>
        </label>
      ) : null}
      <div
        aria-live="polite"
        className="min-h-20 border-gray-alpha-400 border-t bg-gray-100 p-4 text-gray-900 text-sm leading-6"
      >
        {completion || 'The generated response will appear here.'}
      </div>
    </form>
  );
};
