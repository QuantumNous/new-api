import { useState } from 'react';

export default function Page() {
  const [generation, setGeneration] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  return (
    <div className="p-2 flex flex-col gap-2">
      <div
        className="p-2 bg-zinc-100 cursor-pointer"
        onClick={async () => {
          setIsLoading(true);

          await fetch('/api/generate-object', {
            method: 'POST',
            body: JSON.stringify({
              prompt: 'Messages during finals week.',
            }),
          }).then(response => {
            response.json().then(json => {
              console.log(json);
              setGeneration(JSON.stringify(json.object, null, 2));
              setIsLoading(false);
            });
          });
        }}
      >
        Generate
      </div>

      {isLoading ? (
        'Loading...'
      ) : (
        <pre
          className="text-sm w-full whitespace-pre-wrap"
          data-testid="generation"
        >
          {generation}
        </pre>
      )}
    </div>
  );
}
