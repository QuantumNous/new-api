package ir

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
)

const canonicalToolCallHashLength = 12

// NewToolCallScope returns a response-local scope used to derive canonical tool
// call IDs. Provider response IDs are preferred; a random scope is used only
// when the source protocol does not expose one.
func NewToolCallScope(values ...string) string {
	for _, value := range values {
		if value = strings.TrimSpace(value); value != "" {
			return value
		}
	}
	var seed [16]byte
	if _, err := rand.Read(seed[:]); err == nil {
		return hex.EncodeToString(seed[:])
	}
	return "relaykit"
}

// CanonicalToolCallID preserves a provider ID when present and otherwise
// derives a portable, bounded ID from a response-local scope and source index.
func CanonicalToolCallID(scope string, sourceIndex int, providerID string) string {
	if providerID != "" {
		return providerID
	}
	if sourceIndex < 0 {
		sourceIndex = 0
	}
	if scope = strings.TrimSpace(scope); scope == "" {
		scope = "relaykit"
	}
	sum := sha256.Sum256([]byte(scope))
	return fmt.Sprintf("call_%s_%d", hex.EncodeToString(sum[:])[:canonicalToolCallHashLength], sourceIndex)
}
