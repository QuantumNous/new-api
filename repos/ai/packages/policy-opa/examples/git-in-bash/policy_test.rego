# Run with: opa test packages/policy-opa/examples/git-in-bash
package agent.action

import rego.v1

test_allow_status if {
	decision == {"decision": "allow"} with input as {"kind": "git", "subcommand": "status", "args": []}
}

test_allow_log if {
	decision == {"decision": "allow"} with input as {"kind": "git", "subcommand": "log", "args": ["--oneline"]}
}

test_allow_remote_v if {
	decision == {"decision": "allow"} with input as {"kind": "git", "subcommand": "remote", "args": ["-v"]}
}

test_allow_bare_remote if {
	decision == {"decision": "allow"} with input as {"kind": "git", "subcommand": "remote", "args": []}
}

test_allow_bare_branch if {
	decision == {"decision": "allow"} with input as {"kind": "git", "subcommand": "branch", "args": []}
}

# `branch` is allowlisted, but `-D` mutates, so the listing check rejects it.
test_deny_branch_delete if {
	decision.decision == "deny" with input as {"kind": "git", "subcommand": "branch", "args": ["-D", "feature"]}
}

# `remote update` fetches from remotes (network + local ref changes); not a
# listing form, so it is denied despite `remote` being allowlisted.
test_deny_remote_update if {
	decision.decision == "deny" with input as {"kind": "git", "subcommand": "remote", "args": ["update"]}
}

test_deny_clone if {
	d := decision with input as {"kind": "git", "subcommand": "clone", "args": ["https://example.com/x.git"]}
	d.decision == "deny"
	contains(d.reason, "clone")
}

test_deny_push if {
	decision.decision == "deny" with input as {"kind": "git", "subcommand": "push", "args": []}
}

test_deny_remote_add if {
	decision.decision == "deny" with input as {"kind": "git", "subcommand": "remote", "args": ["add", "origin", "https://x"]}
}

# A bash command the dispatcher could not reduce to a single git invocation
# (compound command) arrives as kind:"bash" and is denied by default.
test_deny_unparseable_bash if {
	decision.decision == "deny" with input as {"kind": "bash", "command": "cd /tmp && git clone https://x"}
}
