package model

import (
	"context"
	"errors"
	"os"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// The roster is an operator declaration, not a count inferred from heartbeats.
// Generations fence a replaced process even if it later regains connectivity.
type GroupMigrationNode struct {
	Name        string `json:"name" gorm:"type:varchar(128);primaryKey"`
	Generation  string `json:"generation" gorm:"type:varchar(64)"`
	Roster      string `json:"roster" gorm:"type:text"`
	OperationID string `json:"operation_id" gorm:"type:varchar(64)"`
	Phase       string `json:"phase" gorm:"type:varchar(16)"`
	Revision    int64  `json:"revision"`
	Inflight    int64  `json:"inflight"`
	LastSeenAt  int64  `json:"last_seen_at"`
}

type GroupMigrationCoordination struct {
	Ready  bool                 `json:"ready"`
	Reason string               `json:"reason"`
	Nodes  []GroupMigrationNode `json:"nodes"`
}

// Root-only management responses expose the declared scope and acknowledgements.
// A missing node is retained in the response instead of shrinking the roster.
func readGroupMigrationCoordination(db *gorm.DB) *GroupMigrationCoordination {
	status := &GroupMigrationCoordination{Ready: true, Nodes: []GroupMigrationNode{}}
	if err := groupMigrationQualification(db); err != nil {
		status.Ready = false
		status.Reason = err.Error()
	}
	roster, err := groupMigrationRoster()
	if err != nil || len(roster) == 0 {
		return status
	}
	var nodes []GroupMigrationNode
	if err := db.Where("name IN ?", roster).Find(&nodes).Error; err != nil {
		status.Ready = false
		status.Reason = "Group migration coordination storage is unavailable."
		return status
	}
	for _, name := range roster {
		node := GroupMigrationNode{Name: name}
		for _, registered := range nodes {
			if registered.Name == name {
				node = registered
				break
			}
		}
		status.Nodes = append(status.Nodes, node)
	}
	var control GroupMigrationControl
	if err := db.First(&control, 1).Error; err != nil {
		status.Ready, status.Reason = false, "Group migration coordination storage is unavailable."
		return status
	}
	if control.OperationID != "" {
		var op GroupMigrationOperation
		if err := db.First(&op, "id = ?", control.OperationID).Error; err != nil {
			status.Ready, status.Reason = false, "Group migration coordination storage is unavailable."
			return status
		}
		phase := "drained"
		if op.State == "committed" {
			phase = "synced"
		}
		if err := groupMigrationNodesAcknowledged(db, &op, phase); err != nil {
			status.Ready, status.Reason = false, err.Error()
		}
	}
	return status
}

var groupMigrationNodeSync sync.Mutex
var groupMigrationNodeRevision atomic.Int64

func groupMigrationRoster() ([]string, error) {
	declaration := os.Getenv("GROUP_MIGRATION_NODES")
	if declaration == "" {
		return nil, nil
	}
	nodes := strings.Split(declaration, ",")
	for i, node := range nodes {
		nodes[i] = strings.TrimSpace(node)
		if nodes[i] == "" || len(nodes[i]) > 128 {
			return nil, common.NewMessage("Group migration requires a valid participant roster containing this node.")
		}
	}
	slices.Sort(nodes)
	if len(nodes) < 2 || len(slices.Compact(slices.Clone(nodes))) != len(nodes) || !slices.Contains(nodes, common.NodeName) {
		return nil, common.NewMessage("Group migration requires a valid participant roster containing this node.")
	}
	return nodes, nil
}

func qualifyGroupMigrationNodes(db *gorm.DB, roster []string) error {
	if err := verifyGroupMigrationGeneration(db); err != nil {
		return err
	}
	var nodes []GroupMigrationNode
	if err := db.Where("name IN ?", roster).Find(&nodes).Error; err != nil {
		return common.NewMessage("Group migration coordination storage is unavailable.")
	}
	if len(nodes) != len(roster) {
		return common.NewMessage("Group migration participants are not all ready. Check the declared roster and node status.")
	}
	for _, node := range nodes {
		if node.Roster != strings.Join(roster, ",") || node.LastSeenAt < time.Now().Unix()-10 || node.Phase == "" {
			return common.NewMessage("Group migration participants are not all ready. Check the declared roster and node status.")
		}
	}
	var conflicts int64
	if err := db.Model(&SystemInstance{}).Where("node_name NOT IN ? AND last_seen_at >= ?", roster, time.Now().Unix()-SystemInstanceStaleAfterSeconds).Count(&conflicts).Error; err != nil {
		return common.NewMessage("Unable to verify known deployment conflicts.")
	}
	if conflicts != 0 {
		return common.NewMessage("Known serving instances are outside the group migration participant roster.")
	}
	return nil
}

func registerGroupMigrationNode(ctx context.Context, roster []string, owner string) error {
	groupMigrationNodeSync.Lock()
	defer groupMigrationNodeSync.Unlock()
	groupMigrationNodeRevision.Store(-1)
	return DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var control GroupMigrationControl
		if err := control.lock(tx); err != nil {
			return err
		}
		var previous GroupMigrationNode
		err := tx.First(&previous, "name = ?", common.NodeName).Error
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		// Even an idle generation may still be publishing authentication cache
		// snapshots before admission. Replacement always requires an operator
		// declaration that the previous process and its pending writes stopped.
		if previous.Generation != "" && os.Getenv("GROUP_MIGRATION_REPLACE_GENERATION") != previous.Generation {
			return common.NewMessage("Stop the previous node generation and its pending cache writes, then set GROUP_MIGRATION_REPLACE_GENERATION to its generation before restarting.")
		}
		return tx.Clauses(clause.OnConflict{UpdateAll: true}).Create(&GroupMigrationNode{
			Name: common.NodeName, Generation: owner, Roster: strings.Join(roster, ","), Revision: -1,
		}).Error
	})
}

func verifyGroupMigrationGeneration(tx *gorm.DB) error {
	groupMigrationTraffic.Lock()
	owner := groupMigrationTraffic.owner
	groupMigrationTraffic.Unlock()
	var node GroupMigrationNode
	if err := tx.First(&node, "name = ?", common.NodeName).Error; err != nil {
		return err
	}
	if owner == "" || node.Generation != owner {
		return ErrGroupMigrationPaused
	}
	return nil
}

// SyncGroupMigrationNode is also called before reading authentication/routing
// snapshots. Polling supplies acknowledgements, but is never an admission lease.
func SyncGroupMigrationNode(ctx context.Context) error {
	if os.Getenv("GROUP_MIGRATION_NODES") == "" {
		return nil
	}
	groupMigrationNodeSync.Lock()
	defer groupMigrationNodeSync.Unlock()
	groupViewMutex.Lock()
	defer groupViewMutex.Unlock()
	return DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var control GroupMigrationControl
		if err := control.lock(tx); err != nil {
			return err
		}
		return syncGroupMigrationNode(tx, &control)
	})
}

// Caller holds both the durable control lock and this process's node mutex.
func syncGroupMigrationNode(tx *gorm.DB, control *GroupMigrationControl) error {
	roster, err := groupMigrationRoster()
	if err != nil {
		return err
	}
	groupMigrationTraffic.Lock()
	owner := groupMigrationTraffic.owner
	groupMigrationTraffic.Unlock()
	var node GroupMigrationNode
	if err := tx.First(&node, "name = ?", common.NodeName).Error; err != nil {
		return err
	}
	if node.Generation != owner || node.Roster != strings.Join(roster, ",") || owner == "" {
		return ErrGroupMigrationPaused
	}
	id := control.OperationID
	if id == "" {
		id = control.LastOperationID
	}
	phase := "ready"
	if id == "" {
		groupMigrationNodeRevision.Store(control.Revision)
	}
	if id != "" {
		var op GroupMigrationOperation
		if err := tx.First(&op, "id = ?", id).Error; err != nil {
			return err
		}
		groupMigrationTraffic.Lock()
		if groupMigrationTraffic.operation != op.ID && control.OperationID != "" {
			groupMigrationTraffic.operation, groupMigrationTraffic.source, groupMigrationTraffic.target = op.ID, op.Source, op.Target
			advanceGroupMigrationVersion(op.Source, op.Target)
		}
		active := groupMigrationTraffic.inflight[op.Source] + groupMigrationTraffic.inflight[op.Target]
		groupMigrationTraffic.Unlock()
		if control.OperationID != "" {
			phase = "draining"
			if active == 0 {
				phase = "drained"
			}
		}
		if (op.State == "committed" || control.OperationID == "") && active == 0 {
			if groupMigrationNodeRevision.Load() != control.Revision {
				if err := restoreGroupMigrationView(tx, &op, control.OperationID != ""); err != nil {
					return err
				}
				groupMigrationNodeRevision.Store(control.Revision)
			}
			phase = "synced"
		}
		if control.OperationID == "" {
			groupMigrationTraffic.Lock()
			if groupMigrationTraffic.operation != "" {
				advanceGroupMigrationVersion(op.Source, op.Target)
				groupMigrationTraffic.operation, groupMigrationTraffic.source, groupMigrationTraffic.target = "", "", ""
			}
			groupMigrationTraffic.Unlock()
			phase = "ready"
		}
	}
	return tx.Model(&node).Updates(map[string]any{"operation_id": control.OperationID, "phase": phase, "revision": control.Revision, "last_seen_at": time.Now().Unix()}).Error
}

// An active commit uses its atomic snapshot; a joining node after completion or
// abort loads current saved options so it also sees subsequent ordinary edits.
func restoreGroupMigrationView(tx *gorm.DB, op *GroupMigrationOperation, active bool) error {
	values := map[string]string{}
	if active {
		if err := common.UnmarshalJsonStr(op.Values, &values); err != nil {
			return err
		}
	} else {
		var options []Option
		if err := tx.Find(&options).Error; err != nil {
			return err
		}
		for _, option := range options {
			canonical := canonicalGroupOption(option.Key)
			if canonical == "" {
				continue
			}
			values[option.Key], values[canonical] = option.Value, option.Value
		}
	}
	for key, value := range values {
		if err := updateOptionMap(key, value); err != nil {
			return err
		}
	}
	return refreshGroupMigrationCaches(tx, "")
}

// RunGroupMigrationCoordination starts only after Redis and all runtime caches
// are initialized. A failed sync retains the durable pause; requests fail closed.
func RunGroupMigrationCoordination(ctx context.Context) {
	if os.Getenv("GROUP_MIGRATION_NODES") == "" {
		return
	}
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()
	for {
		_ = SyncGroupMigrationNode(ctx)
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func groupMigrationNodesAcknowledged(tx *gorm.DB, op *GroupMigrationOperation, phase string) error {
	var roster []string
	if err := common.UnmarshalJsonStr(op.Participants, &roster); err != nil || len(roster) == 0 {
		return errors.New("group migration participant snapshot is unavailable")
	}
	declared, err := groupMigrationRoster()
	if err != nil || !slices.Equal(declared, roster) {
		return common.NewMessage("Group migration participant roster changed. Restore the original roster before recovery.")
	}
	var control GroupMigrationControl
	if err := tx.First(&control, 1).Error; err != nil {
		return err
	}
	var count int64
	if err := tx.Model(&GroupMigrationNode{}).Where("name IN ? AND roster = ? AND operation_id = ? AND phase = ? AND revision = ? AND last_seen_at >= ?", roster, strings.Join(roster, ","), op.ID, phase, control.Revision, time.Now().Unix()-10).Count(&count).Error; err != nil {
		return err
	}
	if count != int64(len(roster)) {
		return common.NewMessage("Group migration is waiting for every participant to drain or synchronize. Resume the same operation after recovery.")
	}
	return nil
}

func waitGroupMigrationNodes(ctx context.Context, op *GroupMigrationOperation, owner, phase string) error {
	wait, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	ticker := time.NewTicker(50 * time.Millisecond)
	defer ticker.Stop()
	for {
		if err := SyncGroupMigrationNode(wait); err != nil {
			return err
		}
		err := DB.WithContext(wait).Transaction(func(tx *gorm.DB) error {
			var control GroupMigrationControl
			if err := control.lock(tx); err != nil {
				return err
			}
			if control.Owner != owner || control.OperationID != op.ID {
				return ErrGroupMigrationPaused
			}
			return groupMigrationNodesAcknowledged(tx, op, phase)
		})
		if err == nil || errors.Is(err, ErrGroupMigrationPaused) {
			return err
		}
		select {
		case <-wait.Done():
			return common.NewMessage("Group migration is waiting for every participant to drain or synchronize. Resume the same operation after recovery.")
		case <-ticker.C:
		}
	}
}
