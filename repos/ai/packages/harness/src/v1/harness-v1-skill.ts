/**
 * A self-contained instruction bundle the underlying runtime can load into
 * its context. Adapters decide how to surface skills to the runtime.
 */
export type HarnessV1Skill = {
  /** Stable identifier for the skill (kebab-case slug). */
  readonly name: string;

  /**
   * Short, model-facing description. This is what the runtime sees to
   * decide whether the skill is relevant.
   */
  readonly description: string;

  /** Full skill content the model loads when the skill is active. */
  readonly content: string;

  /**
   * Additional files that belong to this skill. Adapters with native skill
   * directories materialize these next to `SKILL.md`; adapters without native
   * skill files include them with the skill content.
   */
  readonly files?: ReadonlyArray<HarnessV1SkillFile>;
};

export type HarnessV1SkillFile = {
  /**
   * Skill-relative POSIX path, for example `reference.md` or
   * `references/codes.md`. Absolute paths and `..` segments are rejected by
   * adapters before writing.
   */
  readonly path: string;

  /** UTF-8 text content for the file. */
  readonly content: string;
};
