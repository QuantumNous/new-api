import net from 'node:net';
import { stripVTControlCharacters as stripAnsi } from 'node:util';
import { expect, test } from '@e2e/helper';
import { getRandomPort } from '@rstackjs/test-utils';

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

test('should throw when strictPort is enabled and port is taken', async ({ devOnly }) => {
  const blocker = await occupyPort();

  let message = '';
  try {
    await devOnly({
      config: {
        server: {
          host: HOST,
          port: blocker.port,
          strictPort: true,
        },
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      message = error.message;
    }
  }

  expect(stripAnsi(message)).toContain(`Port ${blocker.port} is occupied`);
  await blocker.close();
});
