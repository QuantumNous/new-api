export function getElementAtPoint(doc: Document | null | undefined, x: number, y: number) {
  return typeof doc?.elementFromPoint === 'function' ? doc.elementFromPoint(x, y) : null;
}
