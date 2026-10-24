import type { StreamTextResult } from 'ai';

export async function printFullStream({
  result,
}: {
  result: StreamTextResult<any, any, any>;
}) {
  for await (const chunk of result.stream) {
    switch (chunk.type) {
      case 'tool-call': {
        console.log(
          `\n\x1b[32m\x1b[1mTOOL CALL\x1b[22m\n${JSON.stringify(chunk, null, 2)}\x1b[0m`,
        );
        break;
      }

      case 'tool-result': {
        console.log(
          `\n\x1b[32m\x1b[1mTOOL RESULT\x1b[22m\n${JSON.stringify(chunk, null, 2)}\x1b[0m`,
        );
        break;
      }

      case 'reasoning-start':
        process.stdout.write('\n\n\x1b[34m\x1b[1mREASONING\x1b[22m\n');
        break;

      case 'text-start':
        process.stdout.write('\n\n\x1b[1mTEXT\x1b[22m\n');
        break;

      case 'text-delta':
      case 'reasoning-delta':
        process.stdout.write(chunk.text);
        break;

      case 'text-end':
      case 'reasoning-end':
        process.stdout.write('\x1b[0m\n');
        break;

      case 'error':
        console.error(
          `\n\x1b[31m\x1b[1mERROR\x1b[22m\n${formatStreamError(chunk.error)}\x1b[0m`,
        );
        break;
    }
  }
}

function formatStreamError(error: unknown): string {
  if (error instanceof Error) {
    return JSON.stringify(
      {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      null,
      2,
    );
  }
  return JSON.stringify(error, null, 2);
}
