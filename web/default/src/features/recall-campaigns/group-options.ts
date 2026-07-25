import type { Option } from '@/components/multi-select'

export function buildRecallGroupOptions(groups: string[]): Option[] {
  const seen = new Set<string>()
  const options: Option[] = []

  for (const rawGroup of groups) {
    const group = rawGroup.trim()
    if (!group || seen.has(group)) continue
    seen.add(group)
    options.push({ label: group, value: group })
  }

  return options
}

export function selectedRecallGroupFallbackOptions(groups: string[]): Option[] {
  return groups.map((group) => ({ label: group, value: group }))
}
