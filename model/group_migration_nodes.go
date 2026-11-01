package model

import (
	"context"
	"errors"
	"os"
	"slices"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/go-redis/redis/v8"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// The roster is an operator declaration, not a count inferred from heartbeats.
// Generations fence a replaced process even if it later regains connectivity.
type GroupMigrationNode struct {
	Name                string `json:"name" gorm:"type:varchar(128);primaryKey"`
	Generation          string `json:"generation" gorm:"type:varchar(64)"`
	Roster              string `json:"roster" gorm:"type:text"`
	OperationID         string `json:"operation_id" gorm:"type:varchar(64)"`
	Phase               string `json:"phase" gorm:"type:varchar(16)"`
	Revision            int64  `json:"revision"`
	CoordinationVersion int64  `json:"coordination_version"`
	ProtocolVersion     int    `json:"-"`
	Inflight            int64  `json:"inflight"`
	LastSeenAt          int64  `json:"last_seen_at"`
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
	var control GroupMigrationControl
	if err := db.First(&control, 1).Error; err != nil {
		status.Ready, status.Reason = false, "Group migration coordination storage is unavailable."
		return status
	}
	var op GroupMigrationOperation
	if control.OperationID != "" {
		if err := db.First(&op, "id = ?", control.OperationID).Error; err != nil {
			status.Ready, status.Reason = false, "Group migration coordination storage is unavailable."
			return status
		}
		if err := validateGroupMigrationProtocol(&control, &op); err != nil {
			status.Ready, status.Reason = false, err.Error()
			return status
		}
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
	if control.OperationID != "" {
		phase := "drained"
		if control.Stage != "draining" {
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

// groupMigrationRoster returns a sorted, unique declared participant list that
// includes this node. An absent declaration selects single-node qualification.
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

// qualifyGroupMigrationNodes requires a current local generation and fresh,
// matching registrations for every declared node, with no known outside writers.
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
		if node.ProtocolVersion != groupMigrationProtocolVersion || node.Generation == "" || node.Roster != strings.Join(roster, ",") || node.LastSeenAt < time.Now().Unix()-10 || node.Phase == "" {
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

// registerGroupMigrationNode records a new process generation behind the control
// lock. Replacing an existing generation requires the operator's explicit
// declaration that the previous process and its pending cache writes stopped.
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
		if control.OperationID != "" {
			var op GroupMigrationOperation
			if err := tx.First(&op, "id = ?", control.OperationID).Error; err != nil {
				return err
			}
			if err := validateGroupMigrationProtocol(&control, &op); err != nil {
				return err
			}
			participants, err := readGroupMigrationParticipants(&op, roster)
			if err != nil {
				return err
			}
			for i := range participants {
				if participants[i].Name != common.NodeName {
					continue
				}
				if participants[i].Generation != previous.Generation || previous.Roster != strings.Join(roster, ",") {
					return ErrGroupMigrationPaused
				}
				participants[i].Generation = owner
			}
			encoded, err := common.Marshal(participants)
			if err != nil {
				return err
			}
			if err := tx.Model(&op).Update("participants", string(encoded)).Error; err != nil {
				return err
			}
			if err := advanceGroupMigrationCoordination(tx, &control, &op, control.Stage); err != nil {
				return err
			}
		} else {
			// Identity changes are visible even while idle; stale idle observations
			// from the previous process cannot be accepted as current authority.
			if err := tx.Model(&control).Update("coordination_version", gorm.Expr("coordination_version + 1")).Error; err != nil {
				return err
			}
		}
		return tx.Clauses(clause.OnConflict{UpdateAll: true}).Create(&GroupMigrationNode{
			Name: common.NodeName, Generation: owner, Roster: strings.Join(roster, ","), Revision: -1, ProtocolVersion: groupMigrationProtocolVersion,
		}).Error
	})
}

// verifyGroupMigrationGeneration fences superseded processes even if they
// reconnect with a node name that still appears in the declared roster.
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

// syncGroupMigrationNode observes authority, applies the local barrier/view,
// then persists the acknowledgement. All steps retain the caller's transaction,
// durable control lock, node mutex and view lock, including on request paths.
func syncGroupMigrationNode(tx *gorm.DB, control *GroupMigrationControl) error {
	observation, err := readGroupMigrationNodeObservation(tx, control)
	if err != nil {
		return err
	}
	phase, err := observation.applyLocalState(tx)
	if err != nil {
		return err
	}
	now := time.Now().Unix()
	node := observation.node
	// MySQL reports changed rows rather than matched rows. An identical ack
	// already read under this control lock is valid without another write.
	if node.OperationID == observation.control.OperationID && node.CoordinationVersion == observation.control.CoordinationVersion && node.Phase == phase && node.Revision == observation.control.Revision && node.LastSeenAt == now {
		return nil
	}
	// A failed local refresh must never publish a successful acknowledgement.
	result := tx.Model(&GroupMigrationNode{}).Where("name = ? AND generation = ? AND protocol_version = ? AND coordination_version <= ?", node.Name, node.Generation, groupMigrationProtocolVersion, observation.control.CoordinationVersion).Updates(map[string]any{"operation_id": observation.control.OperationID, "coordination_version": observation.control.CoordinationVersion, "phase": phase, "revision": observation.control.Revision, "last_seen_at": now})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return ErrGroupMigrationPaused
	}
	return nil
}

// groupMigrationNodeObservation holds the control, process identity and optional
// operation read under the same durable lock. It is not an admission lease and
// must be applied and acknowledged before that transaction releases the lock.
type groupMigrationNodeObservation struct {
	control   GroupMigrationControl
	node      GroupMigrationNode
	operation *GroupMigrationOperation
}

// readGroupMigrationNodeObservation only reads and validates authority. It does
// not change local readiness, refresh caches or acknowledge a migration phase.
// The caller supplies the already locked control record from this transaction.
func readGroupMigrationNodeObservation(tx *gorm.DB, control *GroupMigrationControl) (*groupMigrationNodeObservation, error) {
	roster, err := groupMigrationRoster()
	if err != nil {
		return nil, err
	}
	groupMigrationTraffic.Lock()
	owner := groupMigrationTraffic.owner
	groupMigrationTraffic.Unlock()
	var node GroupMigrationNode
	if err := tx.First(&node, "name = ?", common.NodeName).Error; err != nil {
		return nil, err
	}
	if node.ProtocolVersion != groupMigrationProtocolVersion || node.Generation != owner || node.Roster != strings.Join(roster, ",") || owner == "" {
		return nil, ErrGroupMigrationPaused
	}
	observation := &groupMigrationNodeObservation{control: *control, node: node}
	id := control.OperationID
	if id == "" {
		id = control.LastOperationID
	}
	if id != "" {
		var op GroupMigrationOperation
		if err := tx.First(&op, "id = ?", id).Error; err != nil {
			return nil, err
		}
		observation.operation = &op
	}
	if err := validateGroupMigrationProtocol(control, observation.operation); err != nil {
		return nil, err
	}
	if control.OperationID != "" {
		participants, err := readGroupMigrationParticipants(observation.operation, roster)
		if err != nil {
			return nil, err
		}
		for _, participant := range participants {
			if participant.Name == node.Name && participant.Generation != owner {
				return nil, ErrGroupMigrationPaused
			}
		}
	}
	return observation, nil
}

// applyLocalState closes related admission before checking existing inflight
// requests, and refreshes the view before clearing a completed barrier. It only
// returns the phase to acknowledge; publishing that phase belongs to the caller.
func (observation *groupMigrationNodeObservation) applyLocalState(tx *gorm.DB) (string, error) {
	control, op := &observation.control, observation.operation
	view := groupMigrationLocalObservation{version: control.CoordinationVersion, revision: control.Revision,
		operation: control.OperationID, lastOperation: control.LastOperationID, owner: control.Owner,
		generation: observation.node.Generation, stage: control.Stage}
	if op != nil {
		view.state, view.source, view.target, view.participants, view.values = op.State, op.Source, op.Target, op.Participants, op.Values
	}
	groupMigrationTraffic.Lock()
	previous := groupMigrationTraffic.observation
	if previous != nil && (view.version < previous.version || view.version == previous.version && (view != *previous || groupMigrationTraffic.conflicted)) {
		if view.version == previous.version {
			groupMigrationTraffic.ready = false
			groupMigrationTraffic.conflicted = true
		}
		groupMigrationTraffic.Unlock()
		return "", ErrGroupMigrationPaused
	}
	if control.OperationID != "" && groupMigrationTraffic.operation != op.ID {
		groupMigrationTraffic.operation, groupMigrationTraffic.source, groupMigrationTraffic.target = op.ID, op.Source, op.Target
		advanceGroupMigrationVersion(op.Source, op.Target)
	}
	active := 0
	if op != nil {
		active = groupMigrationTraffic.inflight[op.Source] + groupMigrationTraffic.inflight[op.Target]
	}
	// A draining barrier changes authority without changing the current data
	// view. Already-ready nodes can keep serving unrelated groups while source
	// requests drain; new processes and every publication still refresh first.
	refresh := !groupMigrationTraffic.ready || previous == nil || groupMigrationNodeRevision.Load() != control.Revision || previous.version != view.version && control.Stage != "draining"
	groupMigrationTraffic.conflicted = false
	groupMigrationTraffic.observation = &view
	if refresh {
		groupMigrationTraffic.ready = false
	}
	groupMigrationTraffic.Unlock()
	phase := "ready"
	if control.OperationID != "" {
		phase = "draining"
		if active == 0 {
			phase = "drained"
		}
	}
	if active == 0 {
		if refresh {
			if err := restoreGroupMigrationView(tx, op, control); err != nil {
				return "", err
			}
			groupMigrationNodeRevision.Store(control.Revision)
		}
		if control.Stage != "draining" {
			phase = "synced"
		}
	}
	if control.OperationID == "" {
		if active != 0 {
			return "", ErrGroupMigrationPaused
		}
		groupMigrationTraffic.Lock()
		if groupMigrationTraffic.operation != "" {
			advanceGroupMigrationVersion(groupMigrationTraffic.source, groupMigrationTraffic.target)
			groupMigrationTraffic.operation, groupMigrationTraffic.source, groupMigrationTraffic.target = "", "", ""
		}
		groupMigrationTraffic.Unlock()
		phase = "ready"
	}
	groupMigrationTraffic.Lock()
	groupMigrationTraffic.ready = active == 0 || !refresh
	groupMigrationTraffic.Unlock()
	return phase, nil
}

// An active commit uses its atomic snapshot; a joining node after completion or
// abort loads current saved options so it also sees subsequent ordinary edits.
// Caller holds the durable control lock, which also serializes shared Redis
// refreshes. Every node must rebuild its local view before acknowledging sync.
func restoreGroupMigrationView(tx *gorm.DB, op *GroupMigrationOperation, control *GroupMigrationControl) error {
	values := map[string]string{}
	if control.Stage == "syncing" {
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
	if common.RedisEnabled {
		// Keep completion in the cache being refreshed: loss of Redis data also
		// loses this optimization. Include operation ID because aborts do not
		// advance the revision. Only successful shared refreshes publish it.
		const completionKey = "group_migration:shared_cache:v1"
		operation := "initial"
		if op != nil {
			operation = op.ID
		}
		completion := operation + ":" + strconv.FormatInt(control.Revision, 10)
		ctx := tx.Statement.Context
		previous, err := common.RDB.Get(ctx, completionKey).Result()
		if err != nil && !errors.Is(err, redis.Nil) {
			return err
		}
		if previous != completion {
			// A returning node may have missed several migrations, so the first
			// participant repairs the full shared routing view, not just op.Target.
			if err := refreshGroupMigrationSharedCaches(tx, ""); err != nil {
				return err
			}
			if err := common.RDB.Set(ctx, completionKey, completion, 0).Err(); err != nil {
				return err
			}
		}
	} else if err := refreshGroupMigrationSharedCaches(tx, ""); err != nil {
		return err
	}
	return initChannelCache(tx)
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

// readGroupMigrationParticipants rejects legacy name-only snapshots, duplicates,
// missing generations and roster changes instead of shrinking the barrier.
func readGroupMigrationParticipants(op *GroupMigrationOperation, roster []string) ([]groupMigrationParticipant, error) {
	var participants []groupMigrationParticipant
	if err := common.UnmarshalJsonStr(op.Participants, &participants); err != nil || len(participants) == 0 {
		return nil, errGroupMigrationLegacyProtocol
	}
	names := make([]string, len(participants))
	for i, participant := range participants {
		if participant.Generation == "" {
			return nil, errGroupMigrationLegacyProtocol
		}
		names[i] = participant.Name
	}
	if !slices.Equal(names, roster) {
		return nil, common.NewMessage("Group migration participant roster changed. Restore the original roster before recovery.")
	}
	return participants, nil
}

// groupMigrationNodesAcknowledged verifies the exact operation, coordination
// version, stage, data revision and process generation for every participant.
// A fresh heartbeat or a diagnostic inflight count cannot replace an ack.
func groupMigrationNodesAcknowledged(tx *gorm.DB, op *GroupMigrationOperation, phase string) error {
	roster, err := groupMigrationRoster()
	if err != nil {
		return err
	}
	participants, err := readGroupMigrationParticipants(op, roster)
	if err != nil {
		return err
	}
	var control GroupMigrationControl
	if err := tx.First(&control, 1).Error; err != nil {
		return err
	}
	if err := validateGroupMigrationProtocol(&control, op); err != nil {
		return err
	}
	if phase == "drained" && control.Stage != "draining" || phase == "synced" && control.Stage != "syncing" && control.Stage != "aborting" {
		return ErrGroupMigrationPaused
	}
	var nodes []GroupMigrationNode
	if err := tx.Where("name IN ? AND roster = ? AND operation_id = ? AND phase = ? AND revision = ? AND coordination_version = ? AND protocol_version = ? AND last_seen_at >= ?", roster, strings.Join(roster, ","), op.ID, phase, control.Revision, control.CoordinationVersion, groupMigrationProtocolVersion, time.Now().Unix()-10).Find(&nodes).Error; err != nil {
		return err
	}
	if len(nodes) != len(participants) {
		return common.NewMessage("Group migration is waiting for every participant to drain or synchronize. Resume the same operation after recovery.")
	}
	for _, participant := range participants {
		matched := slices.ContainsFunc(nodes, func(node GroupMigrationNode) bool {
			return node.Name == participant.Name && node.Generation == participant.Generation
		})
		if !matched {
			return common.NewMessage("Group migration is waiting for every participant to drain or synchronize. Resume the same operation after recovery.")
		}
	}
	return nil
}

// waitGroupMigrationNodes synchronizes this node and waits up to twenty seconds
// for all participant acknowledgements. Ownership loss stops the wait; timeout
// leaves the durable barrier in place so the same operation can be recovered.
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
			if control.Owner != owner || control.OperationID != op.ID || control.CoordinationVersion != op.CoordinationVersion {
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
