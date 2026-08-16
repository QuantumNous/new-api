export type ProxyNodeScopeType = "all" | "channel" | "group";

export function proxyNodeDefaultScopeValue(
  scopeType: ProxyNodeScopeType,
  channels: Array<{ id: number; name: string }>,
  groups: string[],
): string {
  if (scopeType === "channel") return channels[0] ? String(channels[0].id) : "";
  if (scopeType === "group") return groups[0] ?? "";
  return "";
}
