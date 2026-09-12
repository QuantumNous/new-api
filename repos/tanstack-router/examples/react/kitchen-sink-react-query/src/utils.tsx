export async function loaderDelayFn<T>(
  fn: (...args: Array<any>) => Promise<T> | T,
) {
  const delay = Number(sessionStorage.getItem('loaderDelay') ?? 0)
  const delayPromise = new Promise((r) => setTimeout(r, delay))

  await delayPromise
  const res = await fn()

  return res
}

export async function actionDelayFn<T>(
  fn: (...args: Array<any>) => Promise<T> | T,
) {
  const delay = Number(sessionStorage.getItem('actionDelay') ?? 0)
  await new Promise((r) => setTimeout(r, delay))
  return fn()
}

export function shuffle<T>(arr: Array<T>): Array<T> {
  let i = arr.length
  if (i == 0) return arr
  const copy = [...arr]
  while (--i) {
    const j = Math.floor(Math.random() * (i + 1))
    const a = copy[i]
    const b = copy[j]
    copy[i] = b!
    copy[j] = a!
  }
  return copy
}
