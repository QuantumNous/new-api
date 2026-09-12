import { constants } from 'node:os';
import process from 'node:process';

type Callback = (exitCode: number) => void;

const callbacks = new Set<Callback>();

let isCalled = false;
let isRegistered = false;

function exit(exitCode: number, type: 'SIGINT' | 'SIGTERM' | 'exit') {
  if (isCalled) {
    return;
  }

  isCalled = true;
  for (const callback of callbacks) {
    callback(exitCode);
  }

  if (type === 'SIGINT') {
    const listeners = process.listeners('SIGINT');
    // If some other listeners are registered, do not exit the process
    // https://stackoverflow.com/questions/21864127/nodejs-process-hangs-on-exit-ctrlc/21948167
    if (Array.isArray(listeners) && listeners.length <= 1) {
      process.exit(exitCode);
    }
  }
}

export function exitHook(onExit: Callback): () => void {
  callbacks.add(onExit);

  if (!isRegistered) {
    isRegistered = true;
    // CTRL+C
    // Use `process.on` instead of `process.once` to disable
    // Node.js's default exit behavior
    process.on('SIGINT', () => {
      exit(constants.signals.SIGINT + 128, 'SIGINT');
    });
    // `kill` command
    process.once('SIGTERM', () => {
      exit(constants.signals.SIGTERM + 128, 'SIGTERM');
    });
    // process.exit or others
    process.once('exit', (exitCode) => {
      exit(exitCode, 'exit');
    });
  }

  return () => {
    callbacks.delete(onExit);
  };
}
