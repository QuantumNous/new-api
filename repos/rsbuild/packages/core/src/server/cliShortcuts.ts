import { color, isTTY } from '../helpers';
import type { Logger } from '../logger';
import type { CliShortcut, NormalizedConfig } from '../types/config';

type PrintUrlsHandler = (options?: { showAllRoutes?: boolean }) => void;

export const isCliShortcutsEnabled = (config: NormalizedConfig): boolean =>
  config.dev.cliShortcuts && isTTY('stdin');

// Normalize user input so shortcuts are case-insensitive
// and still work with accidental surrounding whitespace.
export const normalizeShortcutInput = (input: string): string => input.trim().toLowerCase();

export async function setupCliShortcuts({
  help = true,
  openPage,
  closeServer,
  printUrls,
  restartServer,
  customShortcuts,
  logger,
}: {
  help?: boolean | string;
  openPage: () => Promise<void>;
  closeServer: () => Promise<void>;
  printUrls: PrintUrlsHandler;
  restartServer?: () => Promise<boolean>;
  customShortcuts?: (shortcuts: CliShortcut[]) => CliShortcut[];
  logger: Logger;
}): Promise<() => void> {
  let shortcuts = [
    {
      key: 'c',
      description: `${color.bold('c + enter')}  ${color.dim('clear console')}`,
      action: () => {
        console.clear();
      },
    },
    {
      key: 'o',
      description: `${color.bold('o + enter')}  ${color.dim('open in browser')}`,
      action: openPage,
    },
    {
      key: 'q',
      description: `${color.bold('q + enter')}  ${color.dim('quit process')}`,
      action: async () => {
        try {
          await closeServer();
        } finally {
          process.exit(0);
        }
      },
    },
    restartServer
      ? {
          key: 'r',
          description: `${color.bold('r + enter')}  ${color.dim('restart server')}`,
          action: restartServer,
        }
      : null,
    {
      key: 'u',
      description: `${color.bold('u + enter')}  ${color.dim('show urls')}`,
      action: () => printUrls({ showAllRoutes: true }),
    },
  ].filter(Boolean) as CliShortcut[];

  if (customShortcuts) {
    shortcuts = customShortcuts(shortcuts);

    if (!Array.isArray(shortcuts)) {
      throw new Error(
        `${color.dim('[rsbuild:config]')} ${color.yellow(
          'dev.cliShortcuts',
        )} option must return an array of shortcuts.`,
      );
    }
  }

  if (help) {
    logger.log(
      help === true
        ? `  ➜  ${color.dim('press')} ${color.bold('h + enter')} ${color.dim('to show shortcuts')}\n`
        : `  ➜  ${help}\n`,
    );
  }

  const { createInterface } = await import('node:readline');
  const rl = createInterface({
    input: process.stdin,
  });

  rl.on('line', (input) => {
    input = normalizeShortcutInput(input);

    if (input === 'h') {
      let message = `\n  ${color.bold(color.blue('Shortcuts:'))}\n`;
      for (const shortcut of shortcuts) {
        message += `  ${shortcut.description}\n`;
      }
      logger.log(message);
    }

    for (const shortcut of shortcuts) {
      if (input === shortcut.key) {
        shortcut.action();
        return;
      }
    }
  });

  return () => {
    rl.close();
  };
}
