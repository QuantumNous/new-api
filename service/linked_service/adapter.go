// Package linked_service implements credential-sync adapters for external
// management services. Each adapter knows how to apply a new admin password
// against its target service via the service's own API or config mechanism.
// Passwords are accepted as plain strings and are NEVER persisted; they are
// used only within the scope of SyncPassword and then discarded.
package linked_service

import (
	"fmt"

	"github.com/QuantumNous/new-api/model"
)

// Adapter is the interface every external-service adapter must implement.
type Adapter interface {
	// Apply updates the remote service's admin credential to newPassword.
	// It returns an error if the update fails; the caller records the outcome.
	Apply(svc *model.LinkedService, newPassword string) error
}

var registry = map[string]Adapter{
	model.LinkedServiceAdapterKiroGo: &KiroGoAdapter{},
	model.LinkedServiceAdapterKiroRs: &KiroRsAdapter{},
	model.LinkedServiceAdapterOB1:    &OB1Adapter{},
	// Codex Pool and Cloud Mail require more complex auth flows; placeholders
	// return an informative error so operators know the service is not yet
	// supported for automatic sync.
	model.LinkedServiceAdapterCodexPool: &UnsupportedAdapter{Name: "codex-pool"},
	model.LinkedServiceAdapterCloudMail: &UnsupportedAdapter{Name: "cloud-mail"},
}

// IsKnownAdapter reports whether adapter is registered.
func IsKnownAdapter(adapter string) bool {
	_, ok := registry[adapter]
	return ok
}

// SyncPassword dispatches to the correct adapter for svc.Adapter.
func SyncPassword(svc *model.LinkedService, newPassword string) error {
	adapter, ok := registry[svc.Adapter]
	if !ok {
		return fmt.Errorf("no adapter registered for %q", svc.Adapter)
	}
	return adapter.Apply(svc, newPassword)
}
