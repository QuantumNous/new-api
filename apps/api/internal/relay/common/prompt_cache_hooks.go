package common

import (
	"github.com/QuantumNous/new-api/internal/transport/contract"
)

// AffinityKeyResolver derives the deterministic cache-affinity key for one
// relay attempt. internal/relay/channel installs it during package
// initialisation (its key derivation reads the raw body and lives above this
// package in the layering); the prompt-cache injection paths call it through
// this hook so no import cycle is introduced.
var AffinityKeyResolver func(c contract.Context, info *RelayInfo) string

// resolveAffinityKey returns the deterministic cache-prefix key for this
// request (client prompt_cache_key/session_id, else a hash of the stable
// prefix), memoized on the request context so every retry of one relay attempt
// derives the same value.
func resolveAffinityKey(c contract.Context, info *RelayInfo) string {
	if c == nil || info == nil || AffinityKeyResolver == nil {
		return ""
	}
	if cached, ok := c.Get(AffinityKeyContextKey); ok {
		if key, isString := cached.(string); isString {
			return key
		}
	}
	key := AffinityKeyResolver(c, info)
	if key != "" {
		c.Set(AffinityKeyContextKey, key)
	}
	return key
}
