// Package port declares the consumer-owned interfaces the gateway and its
// capabilities depend on. Provider adaptors and relay plumbing accept the
// framework-neutral ingress context instead of a concrete HTTP framework
// type, so this package stays framework-neutral.
package port

import (
	"github.com/QuantumNous/new-api/internal/transport/contract"
)

// IngressContext is the framework-neutral request context handed to provider
// adaptors and relay helpers. It is an alias of the transport contract so
// gateway-side code can reference the capability boundary without importing
// concrete HTTP framework types.
type IngressContext = contract.Context
