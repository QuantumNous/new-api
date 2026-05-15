package common

import (
	"sync"

	"github.com/google/uuid"
)

var (
	replicaID     string
	replicaIDOnce sync.Once
)

// GetReplicaID returns a process-stable UUID identifying this replica.
// Generated lazily on first call; same value returned for the lifetime of the process.
// Used to filter self-published pubsub messages.
func GetReplicaID() string {
	replicaIDOnce.Do(func() {
		replicaID = uuid.NewString()
	})
	return replicaID
}
