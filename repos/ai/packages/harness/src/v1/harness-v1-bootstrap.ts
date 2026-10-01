/**
 * One file to write into the sandbox as part of an adapter's bootstrap recipe.
 * Paths should live under {@link HarnessV1Bootstrap.bootstrapDir}.
 */
export interface HarnessV1BootstrapFile {
  readonly path: string;
  readonly content: string;
}

/**
 * One command to run in the sandbox as part of an adapter's bootstrap recipe.
 * Commands run sequentially after all files have been written; a non-zero exit
 * aborts the bootstrap.
 */
export interface HarnessV1BootstrapCommand {
  readonly command: string;
  readonly workingDirectory?: string;
}

/**
 * Adapter-owned bootstrap recipe. The adapter declares the files and commands
 * needed to set up its bridge inside any sandbox. The harness framework hashes
 * the recipe into an identity used by sandbox providers for snapshot-based
 * reuse, and applies the recipe idempotently before the bridge spawns.
 */
export interface HarnessV1Bootstrap {
  /**
   * Stable id of the adapter that owns this recipe. Conventionally matches
   * {@link HarnessV1.harnessId}. Contributes to the recipe hash.
   */
  readonly harnessId: string;

  /**
   * Absolute path inside the sandbox where this recipe writes its state.
   * The marker file lives directly under it. Files declared in {@link files}
   * should also use this prefix so an adapter upgrade can sweep stale state
   * by clearing the directory.
   */
  readonly bootstrapDir: string;

  /** Files to write into the sandbox before any command runs. */
  readonly files: ReadonlyArray<HarnessV1BootstrapFile>;

  /** Commands to run after files are written, in order. */
  readonly commands: ReadonlyArray<HarnessV1BootstrapCommand>;
}
