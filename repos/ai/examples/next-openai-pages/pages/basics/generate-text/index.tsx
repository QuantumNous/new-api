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

          await fetch('/api/generate-text', {
            method: 'POST',
            body: JSON.stringify({
              prompt: 'Why is the sky blue?',
            }),
          }).then(response => {
            response.json().then(json => {
              setGeneration(json.text);
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
        <div data-testid="generation">generation</div>
      )}
    </div>
  );
}
