export const atTheTopId = 'at-the-top'
export const atTheBottomId = 'at-the-bottom'

export function ScrollBlock({ number = 100 }: { number?: number }) {
  return (
    <>
      <div id={atTheTopId} data-testid={atTheTopId}></div>
      {Array.from({ length: number }).map((_, i) => (
        <div key={`scroll-block-${i}`}>{i}</div>
      ))}
      <div id={atTheBottomId} data-testid={atTheBottomId}>
        At the bottom
      </div>
    </>
  )
}
