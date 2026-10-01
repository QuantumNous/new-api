export function toClaudeSkillsOption(
  skills: ReadonlyArray<string> | undefined,
): 'all' | undefined {
  /*
   * The Claude Agent SDK treats `skills: string[]` as an allowlist, which hides
   * built-in/default skills. When the harness writes project skills, ask Claude
   * to enable every discovered skill so bundled defaults and project skills are
   * both visible.
   */
  return skills && skills.length > 0 ? 'all' : undefined;
}
