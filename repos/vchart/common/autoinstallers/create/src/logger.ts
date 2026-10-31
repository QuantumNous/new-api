import chalk from 'chalk'

export const logger = {
  info: (...messages: any[]) => console.info(
    chalk.greenBright.bold('[rush create]'),
    ...messages,
  ),

  error: (...messages: any[]) => {
    console.error(
      chalk.redBright.bold('[rush create][error]'),
      ...messages,
    )
  },
}
