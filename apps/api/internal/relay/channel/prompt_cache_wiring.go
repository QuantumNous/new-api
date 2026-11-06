package channel

import (
	relaycommon "github.com/QuantumNous/new-api/internal/relay/common"
)

// init wires the prompt-cache layering: the affinity key (which needs the
// raw-body prefix hashing in this package) is exposed to internal/relay/common
// through a function hook, so the injection paths there can derive the same
// key without importing back into internal/relay/channel.
func init() {
	relaycommon.AffinityKeyResolver = ResolveSessionAffinityKey
}
