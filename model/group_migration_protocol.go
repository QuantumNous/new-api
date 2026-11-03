package model

import (
	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const groupMigrationProtocolVersion = 2

// Participants bind a stable node name to one explicitly registered process.
// A replacement changes this snapshot and invalidates all earlier confirmations.
type groupMigrationParticipant struct {
	Name       string `json:"name"`
	Generation string `json:"generation"`
}

var errGroupMigrationLegacyProtocol = common.NewMessage("An active legacy group migration cannot be recovered by this version. Stop all upgraded nodes, finish recovery with the previous version, then stop all nodes and upgrade together.")

// validateGroupMigrationProtocol refuses to reinterpret name-only legacy
// confirmations or default zero versions as evidence of readiness. Terminal
// history needs no confirmations and can still be read after an idle upgrade.
func validateGroupMigrationProtocol(control *GroupMigrationControl, op *GroupMigrationOperation) error {
	if control.OperationID == "" {
		if control.CoordinationVersion <= 0 || control.Stage != "idle" {
			return ErrGroupMigrationPaused
		}
		return nil
	}
	if op == nil || op.ProtocolVersion != groupMigrationProtocolVersion || op.CoordinationVersion <= 0 || control.CoordinationVersion <= 0 {
		return errGroupMigrationLegacyProtocol
	}
	if op.ID != control.OperationID || op.CoordinationVersion != control.CoordinationVersion {
		return ErrGroupMigrationPaused
	}
	if op.State == "paused" && (control.Stage == "draining" || control.Stage == "aborting") || op.State == "committed" && control.Stage == "syncing" {
		return nil
	}
	return ErrGroupMigrationPaused
}

// advanceGroupMigrationCoordination is called with the control lock held, after
// validating ownership and the expected stage. Every authority/stage change
// advances both durable records atomically, invalidating all prior node acks.
func advanceGroupMigrationCoordination(tx *gorm.DB, control *GroupMigrationControl, op *GroupMigrationOperation, stage string) error {
	previous := control.CoordinationVersion
	if previous <= 0 || op.ProtocolVersion != groupMigrationProtocolVersion || op.CoordinationVersion != previous {
		return errGroupMigrationLegacyProtocol
	}
	result := tx.Model(&GroupMigrationOperation{}).Where("id = ? AND coordination_version = ?", op.ID, previous).Update("coordination_version", previous+1)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return ErrGroupMigrationPaused
	}
	control.CoordinationVersion++
	control.Stage = stage
	op.CoordinationVersion = control.CoordinationVersion
	return tx.Model(control).Updates(map[string]any{
		"coordination_version": control.CoordinationVersion, "stage": stage,
		"operation_id": control.OperationID, "owner": control.Owner,
		"revision": control.Revision, "last_operation_id": control.LastOperationID,
	}).Error
}

// Local observations deliberately exclude Fence and heartbeat/acknowledgement
// fields: they change without changing authority. All safety-relevant state is
// compared so conflicting observations at the same version fail closed.
type groupMigrationLocalObservation struct {
	version, revision                                  int64
	operation, lastOperation, owner, generation, stage string
	state, source, target, participants, values        string
}
