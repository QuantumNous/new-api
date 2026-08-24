package compute

import (
	"strconv"

	"github.com/QuantumNous/new-api/model"
)

// SyncNodeStatus reconciles our ComputeNode rows with the live upstream
// instance state and returns the number of rows whose status changed.
//
// Multi-node safety (Rule 11): the DB is the single source of truth. Each row's
// status is updated with a scoped column write keyed by primary key, so it is
// safe for this reconciler to run concurrently on more than one app instance —
// writes are idempotent and converge to the upstream-reported state.
func SyncNodeStatus() (int, error) {
	instances, err := ListRemoteInstances()
	if err != nil {
		return 0, err
	}

	// Index live instances by their internal contract id.
	statusByContract := make(map[string]string, len(instances))
	for _, in := range instances {
		statusByContract[strconv.Itoa(in.ContractID)] = in.Status
	}

	nodes, err := model.ListSyncableComputeNodes()
	if err != nil {
		return 0, err
	}

	updated := 0
	for _, node := range nodes {
		desired, present := statusByContract[node.ProviderContractID]
		if !present {
			// Upstream no longer knows about this contract → treat as stopped.
			desired = model.ComputeNodeStatusStopped
		}
		if desired == node.Status {
			continue
		}
		if err := model.UpdateComputeNodeStatus(node.Id, desired); err != nil {
			return updated, err
		}
		updated++
	}
	return updated, nil
}
