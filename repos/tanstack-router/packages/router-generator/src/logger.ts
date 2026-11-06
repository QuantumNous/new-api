export interface Logger {
  log: (...args: Array<any>) => void
  debug: (...args: Array<any>) => void
  info: (...args: Array<any>) => void
  warn: (...args: Array<any>) => void
  error: (...args: Array<any>) => void
}

export function logging(config: { disabled: boolean }): Logger {
  function stripEmojis(str: string) {
    return str.replace(
      /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu,
      '',
    )
  }

  function formatLogArgs(args: Array<any>): Array<any> {
    if (process.env.CI) {
      return args.map((arg) =>
        typeof arg === 'string' ? stripEmojis(arg) : arg,
      )
    }
    return args
  }

  return {
    log: (...args: Array<any>) => {
      if (!config.disabled) console.log(...formatLogArgs(args))
    },
    debug: (...args: Array<any>) => {
      if (!config.disabled) console.debug(...formatLogArgs(args))
    },
    info: (...args: Array<any>) => {
      if (!config.disabled) console.info(...formatLogArgs(args))
    },
    warn: (...args: Array<any>) => {
      if (!config.disabled) console.warn(...formatLogArgs(args))
    },
    error: (...args: Array<any>) => {
      if (!config.disabled) console.error(...formatLogArgs(args))
    },
  }
}
