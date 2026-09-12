/**
 * Options for executing a command in the sandbox via `run` or `spawn`.
 */
type SandboxProcessOptions = {
  /**
   * Command to execute in the sandbox.
   */
  command: string;

  /**
   * Working directory to execute the command in.
   */
  workingDirectory?: string;

  /**
   * Environment variables to set for this command. Merged with the
   * sandbox's default environment; values here take precedence.
   * Supporting environment variables as an option is preferable from a
   * security perspective, e.g. to avoid them leaking in logs.
   */
  env?: Record<string, string>;

  /**
   * Signal that can be used to abort the command. When aborted, the running
   * process is killed; for `spawn`, `wait()` rejects with the abort reason.
   */
  abortSignal?: AbortSignal;
};

/**
 * Options for reading a file from the sandbox.
 */
type ReadFileOptions = {
  /**
   * Path of the file to read.
   */
  path: string;

  /**
   * Signal that can be used to abort the read.
   */
  abortSignal?: AbortSignal;
};

/**
 * Options for writing a file to the sandbox. `CONTENT` is the payload written
 * to the file: a byte stream, raw bytes, or a string.
 */
type WriteFileOptions<CONTENT> = {
  /**
   * Path of the file to write.
   */
  path: string;

  /**
   * Content to write to the file.
   */
  content: CONTENT;

  /**
   * Signal that can be used to abort the write.
   */
  abortSignal?: AbortSignal;
};

/**
 * Sandbox session that can execute commands and read/write files.
 */
export type SandboxSession = {
  /**
   * Description of the sandbox environment that can be added to the agent's instructions
   * so that the agent knows about relevant details such as the root directory, exposed
   * ports, the public hostname, etc.
   */
  readonly description: string;

  /**
   * Read one file from the sandbox as a stream of bytes. Resolves to `null`
   * when the file does not exist.
   *
   * Relative path handling is implementation-defined. This is the lowest-level
   * read primitive; prefer `readBinaryFile` or `readTextFile` unless you need
   * to stream bytes.
   */
  readonly readFile: (
    options: ReadFileOptions,
  ) => PromiseLike<ReadableStream<Uint8Array> | null>;

  /**
   * Read one file from the sandbox as raw bytes. Resolves to `null` when the
   * file does not exist.
   */
  readonly readBinaryFile: (
    options: ReadFileOptions,
  ) => PromiseLike<Uint8Array | null>;

  /**
   * Read one text file from the sandbox, decoded using the requested encoding.
   * Resolves to `null` when the file does not exist.
   *
   * Line ranges are 1-based and inclusive. When `endLine` is past EOF the read
   * returns through EOF without error.
   */
  readonly readTextFile: (
    options: ReadFileOptions & {
      /**
       * Text encoding used to decode the file bytes. Defaults to `"utf-8"`.
       */
      encoding?: string;

      /**
       * 1-based inclusive start line. Defaults to 1.
       */
      startLine?: number;

      /**
       * 1-based inclusive end line. When past the file's line count, the read
       * returns through EOF without error.
       */
      endLine?: number;
    },
  ) => PromiseLike<string | null>;

  /**
   * Write one file to the sandbox from a stream of bytes. Creates parent
   * directories recursively and overwrites any existing file.
   *
   * This is the lowest-level write primitive; prefer `writeBinaryFile` or
   * `writeTextFile` when the full content is already materialized in memory.
   */
  readonly writeFile: (
    options: WriteFileOptions<ReadableStream<Uint8Array>>,
  ) => PromiseLike<void>;

  /**
   * Write one file to the sandbox from raw bytes. Creates parent directories
   * recursively and overwrites any existing file.
   */
  readonly writeBinaryFile: (
    options: WriteFileOptions<Uint8Array>,
  ) => PromiseLike<void>;

  /**
   * Write one file to the sandbox from a string, encoded using the requested
   * encoding. Creates parent directories recursively and overwrites any
   * existing file.
   */
  readonly writeTextFile: (
    options: WriteFileOptions<string> & {
      /**
       * Text encoding used to encode the string to bytes. Defaults to `"utf-8"`.
       */
      encoding?: string;
    },
  ) => PromiseLike<void>;

  /**
   * Spawn a long-running process in the sandbox. Returns immediately with a
   * handle that streams stdout/stderr, can be waited on, and can be killed.
   *
   * `run` is conceptually a thin wrapper over this primitive: spawn,
   * collect both streams to strings, await `wait()`, return the result.
   */
  readonly spawn: (
    options: SandboxProcessOptions,
  ) => PromiseLike<SandboxProcess>;

  /**
   * Run a command in the sandbox.
   */
  readonly run: (options: SandboxProcessOptions) => PromiseLike<{
    /**
     * Exit code returned by the command.
     */
    exitCode: number;

    /**
     * Standard output produced by the command.
     */
    stdout: string;

    /**
     * Standard error produced by the command.
     */
    stderr: string;
  }>;
};

/**
 * Handle to a long-running process started via `SandboxSession.spawn`.
 */
export type SandboxProcess = {
  /**
   * Process identifier, if the sandbox implementation exposes one.
   */
  readonly pid?: number;

  /**
   * Stream of bytes written by the process to standard output.
   */
  readonly stdout: ReadableStream<Uint8Array>;

  /**
   * Stream of bytes written by the process to standard error.
   */
  readonly stderr: ReadableStream<Uint8Array>;

  /**
   * Resolve when the process exits, yielding its exit code.
   */
  wait(): PromiseLike<{ exitCode: number }>;

  /**
   * Terminate the process. Idempotent.
   */
  kill(): PromiseLike<void>;
};
