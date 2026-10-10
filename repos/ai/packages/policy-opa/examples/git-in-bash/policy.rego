# Gate `git` whether the model calls a granular git tool directly or shells out
# through `bash` (vercel-labs/bash-tool). The dispatcher's `toInput` parses the
# bash command down to `{ kind, subcommand, args }`; this rule decides on that
# shape, so the same allowlist governs both surfaces.
#
# Posture: allow only read-only git, deny everything else. Anything the parser
# could not reduce to a single clean git invocation arrives as `kind: "bash"`
# and falls through to the default deny — bash is adversarial to parse, so
# "can't prove it's safe" means "deny".
package agent.action

import rego.v1

# Subcommands that are read-only in every form.
git_read_only := {"status", "log", "diff", "show"}

# `branch` and `remote` are read-only only when listing. With flags like
# `git branch -D` or `git remote add` they mutate, so a subcommand-level
# allowlist is too coarse here: we additionally require a listing form. This is
# the gotcha to remember when allowlisting git — the subcommand alone is not
# enough once it takes mutating flags.
git_listing := {"branch", "remote"}

listing_flags := {"-v", "--verbose", "-l", "--list", "-a", "--all"}

# Default deny covers clone, push, pull, fetch, reset, the mutating branch/remote
# forms, and every `kind: "bash"` the parser refused to vouch for.
default decision := {"decision": "deny", "reason": "command not permitted by policy"}

decision := {"decision": "allow"} if {
	input.kind == "git"
	git_read_only[input.subcommand]
}

decision := {"decision": "allow"} if {
	input.kind == "git"
	git_listing[input.subcommand]
	is_listing
}

# Read-only listing form: no args, or a single listing flag. `git remote update`
# and `git remote show` (network), `git branch -D` (mutation) all fail this and
# fall through to the default deny.
is_listing if count(input.args) == 0

is_listing if {
	count(input.args) == 1
	listing_flags[input.args[0]]
}

decision := {"decision": "deny", "reason": msg} if {
	input.kind == "git"
	not git_read_only[input.subcommand]
	not git_listing[input.subcommand]
	msg := sprintf("git %s is not permitted (read-only git only)", [input.subcommand])
}
