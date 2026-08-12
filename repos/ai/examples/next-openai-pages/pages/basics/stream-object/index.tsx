import { experimental_useObject } from '@ai-sdk/react';
import { z } from 'zod';

export default function Page() {
  const { object, submit } = experimental_useObject({
    api: '/api/stream-object',
    schema: z.object({ content: z.string() }),
  });

  return (
    <div className="p-2 flex flex-col gap-2">
      <div
        className="p-2 bg-zinc-100 cursor-pointer"
        onClick={async () => {
          submit('Final exams');
        }}
      >
        Generate
      </div>

      <pre
        className="text-sm w-full whitespace-pre-wrap"
        data-testid="generation"
      >
        {JSON.stringify(object, null, 2)}
      </pre>
    </div>
  );
}
