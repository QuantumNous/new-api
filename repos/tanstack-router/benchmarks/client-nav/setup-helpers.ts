export function getRequiredLink(
  container: ParentNode,
  testId: string,
  cache?: Map<string, HTMLAnchorElement>,
) {
  const cachedLink = cache?.get(testId)
  if (cachedLink) {
    return cachedLink
  }

  const link = container.querySelector<HTMLAnchorElement>(
    `[data-testid="${testId}"]`,
  )
  if (!link) {
    throw new Error(`Unable to find benchmark link: ${testId}`)
  }

  cache?.set(testId, link)
  return link
}

export async function waitForRequiredLink(
  container: ParentNode,
  testId: string,
  cache?: Map<string, HTMLAnchorElement>,
) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const link = container.querySelector<HTMLAnchorElement>(
      `[data-testid="${testId}"]`,
    )

    if (link) {
      cache?.set(testId, link)
      return link
    }

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve())
    })
  }

  return getRequiredLink(container, testId, cache)
}
