import { createContext, useContext } from 'react'

export const GroupDisplayNamesContext = createContext<Record<string, string>>(
  {}
)

export function useGroupDisplayName() {
  const names = useContext(GroupDisplayNamesContext)
  return (group: string) =>
    Object.hasOwn(names, group) ? names[group]?.trim() || group : group
}
