'use client';

import { useCompletion } from '@ai-sdk/react';

export default function Chat() {
  const { completion, input, handleInputChange, handleSubmit, error } =
    useCompletion({
      api: '/api/use-completion-server-side-multi-step',
    });

  return (
    <div className="flex flex-col w-full max-w-md py-24 mx-auto stretch">
      <h4 className="pb-4 text-xl font-bold text-gray-900 md:text-xl">
        useCompletion Example
      </h4>
      {error && (
        <div className="fixed top-0 left-0 w-full p-4 text-center text-white bg-red-500">
          {error.message}
        </div>
      )}
      {completion}
      <form onSubmit={handleSubmit}>
        <input
          className="fixed bottom-0 w-full max-w-md p-2 mb-8 border border-gray-300 rounded shadow-xl"
          value={input}
          placeholder="What is the weather in Berlin?"
          onChange={handleInputChange}
        />
      </form>
    </div>
  );
}
