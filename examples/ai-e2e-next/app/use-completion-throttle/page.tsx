'use client';

import { useCompletion } from '@ai-sdk/react';
import { useLayoutEffect, useRef } from 'react';

export default function Chat() {
  const renderCount = useRef(0);
  useLayoutEffect(() => {
    console.log(`component rendered #${++renderCount.current}`);
  });

  const { completion, input, handleInputChange, handleSubmit } = useCompletion({
    api: '/api/use-completion-throttle',
    experimental_throttle: 50,
  });

  return (
    <div className="flex flex-col w-full max-w-md py-24 mx-auto stretch">
      <h4 className="pb-4 text-xl font-bold text-gray-900 md:text-xl">
        useCompletion throttle example
      </h4>
      {completion}
      <form onSubmit={handleSubmit}>
        <input
          className="fixed bottom-0 w-full max-w-md p-2 mb-8 border border-gray-300 rounded shadow-xl"
          value={input}
          placeholder="Book topic..."
          onChange={handleInputChange}
        />
      </form>
    </div>
  );
}
