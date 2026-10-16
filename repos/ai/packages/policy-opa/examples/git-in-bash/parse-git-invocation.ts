export type GitInvocation = { subcommand: string; args: string[] };

// Any of these means the command is more than a single program invocation
// (chaining, piping, redirection, subshells, command substitution, line
// continuation), so we refuse to vouch for it and let the policy fail closed.
const SHELL_METACHARACTERS = /[;&|<>`$(){}\\\n]/;

/**
 * Reduce a bash `command` to a single git invocation, or `null` if it is not
 * one we can vouch for. `null` is the fail-closed signal: the caller maps it to
 * a shape the policy denies by default.
 *
 * Deliberately strict. `cd /tmp && git clone`, `git status | sh`, and
 * `/usr/bin/git status` all return `null` rather than risk mis-parsing an
 * adversarial command. Tighten or widen to taste, but err toward `null`.
 */
export function parseGitInvocation(command: string): GitInvocation | null {
  if (SHELL_METACHARACTERS.test(command)) {
    return null;
  }
  const tokens = command.trim().split(/\s+/);
  if (tokens[0] !== 'git' || tokens.length < 2) {
    return null;
  }
  const [, subcommand, ...args] = tokens;
  return { subcommand, args };
}

/**
 * `toInput` for the bash dispatcher: turn the model's `{ command }` into the
 * logical action shape the shared Rego rule decides on. A command we cannot
 * cleanly parse becomes `{ kind: 'bash' }`, which the policy default-denies.
 */
export function bashCommandToInput(
  command: string,
):
  | { kind: 'git'; subcommand: string; args: string[] }
  | { kind: 'bash'; command: string } {
  const git = parseGitInvocation(command);
  return git
    ? { kind: 'git', subcommand: git.subcommand, args: git.args }
    : { kind: 'bash', command };
}
