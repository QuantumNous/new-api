export function getStartModeConfig() {
  const behavior = (process.env.BEHAVIOR ?? 'mock') as 'mock' | 'error'

  return {
    importProtection: {
      behavior,
      log: 'always' as const,
      onViolation: (info: unknown) => {
        void info
      },
    },
  }
}
