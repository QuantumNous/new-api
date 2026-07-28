// 把 SVG 路径异步加载为可绘制到 Canvas 的 Image。带缓存。
const cache = new Map<string, HTMLImageElement>()

export function loadIcon(src: string): Promise<HTMLImageElement> {
  const hit = cache.get(src)
  if (hit) return Promise.resolve(hit)

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      cache.set(src, img)
      resolve(img)
    }
    img.onerror = reject
    img.src = src
  })
}

export function loadIcons(
  list: { icon: string }[]
): Promise<HTMLImageElement[]> {
  return Promise.all(list.map((m) => loadIcon(m.icon).catch(() => new Image())))
}
