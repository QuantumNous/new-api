import net from 'node:net';
import { stripVTControlCharacters as stripAnsi } from 'node:util';
import { expect, getRandomPort, test } from '@e2e/helper';

const HOST = '0.0.0.0';

const occupyPort = async () => {
  const port = await getRandomPort();
  const blocker = net.createServer();

  await new Promise<void>((resolve, reject) => {
    blocker.once('error', reject);
    blocker.listen({ port, host: HOST }, resolve);
  });

  return {
    port,
    close: () =>
      new Promise<void>((resolve) => {
        blocker.close(() => resolve());
      }),
  };
};

test('should exit when port is occupied and --strict-port is used', async ({ execCliSync }) => {
  const blocker = await occupyPort();

  let message = '';
  try {
    execCliSync(`dev --host ${HOST} --port ${blocker.port} --strict-port`, {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
  } catch (error) {
    if (error instanceof Error) {
      message = stripAnsi(error.message);
    }
  } finally {
    await blocker.close();
  }

  expect(message).toContain(`Port ${blocker.port} is occupied`);
});
