/** A character that can be part of a model name. */
const MODEL_NAME_CHAR = /[a-z0-9.-]/i

/**
 * Every index where `name` appears as a whole model name, in order. A plain
 * substring search would find gpt-6 inside gpt-6-astra and offer the shorter
 * name the user cannot reach, so a hit that continues or is preceded by
 * another name character is skipped.
 */
export function modelNameIndexes(content: string, name: string): number[] {
  const hits: number[] = []
  let from = 0
  for (;;) {
    const index = content.indexOf(name, from)
    if (index < 0) {
      return hits
    }
    const before = content[index - 1]
    const after = content[index + name.length]
    if (
      (before === undefined || !MODEL_NAME_CHAR.test(before)) &&
      (after === undefined || !MODEL_NAME_CHAR.test(after))
    ) {
      hits.push(index)
    }
    from = index + 1
  }
}
