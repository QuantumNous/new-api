package service

import (
	"context"
	"fmt"
	"maps"
	"slices"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/bytedance/gopkg/util/gopool"
)

const nodeSyncInterval = 3 * time.Second

// The caps keep a node's registry row small: its info is a TEXT column, which
// holds 64 KiB on MySQL.
const (
	nodeSyncMessageLimit = 300
	nodeSyncErrorsLimit  = 50
)

// NodeSyncTopicState is what this node has applied of one topic. Errors lists
// the items of the topic the node failed to load, by key.
type NodeSyncTopicState struct {
	Revision  string            `json:"revision"`
	AppliedAt int64             `json:"applied_at"`
	Error     string            `json:"error,omitempty"`
	Errors    map[string]string `json:"errors,omitempty"`
}

type nodeSyncRegistry struct {
	mu      sync.Mutex
	reloads map[string]func(ctx context.Context) error
	states  map[string]NodeSyncTopicState
	// startup holds the revisions read before the startup loads; nil when
	// that read failed, and every topic then reloads on the first tick.
	startup map[string]string
	// listFailed logs a failing topic read once, not on every tick.
	listFailed bool
}

var nodeSync = newNodeSyncRegistry()

func newNodeSyncRegistry() *nodeSyncRegistry {
	return &nodeSyncRegistry{reloads: map[string]func(context.Context) error{}, states: map[string]NodeSyncTopicState{}}
}

// RegisterSyncTopic makes this node run reload whenever another write bumps
// topic. Register every topic before StartNodeSync.
func RegisterSyncTopic(topic string, reload func(ctx context.Context) error) {
	nodeSync.mu.Lock()
	defer nodeSync.mu.Unlock()
	nodeSync.reloads[topic] = reload
}

// SetSyncTopicErrors records the items of topic this node failed to load, by
// key; nil or empty clears them.
func SetSyncTopicErrors(topic string, errors map[string]string) {
	var capped map[string]string
	if len(errors) > 0 {
		keys := slices.Sorted(maps.Keys(errors))
		keys = keys[:min(len(keys), nodeSyncErrorsLimit)]
		capped = make(map[string]string, len(keys))
		for _, key := range keys {
			capped[key] = capSyncMessage(errors[key])
		}
	}
	nodeSync.mu.Lock()
	defer nodeSync.mu.Unlock()
	state := nodeSync.states[topic]
	state.Errors = capped
	nodeSync.states[topic] = state
}

// NodeSyncStates returns a copy of what this node has applied, by topic.
func NodeSyncStates() map[string]NodeSyncTopicState {
	nodeSync.mu.Lock()
	defer nodeSync.mu.Unlock()
	states := make(map[string]NodeSyncTopicState, len(nodeSync.states))
	for topic, state := range nodeSync.states {
		state.Errors = maps.Clone(state.Errors)
		states[topic] = state
	}
	return states
}

// ReadStartupSyncRevisions reads the topic revisions before the startup loads,
// so a write made while they run is reloaded once the loop starts.
func ReadStartupSyncRevisions() {
	rows, err := model.ListSyncTopics()
	if err != nil {
		common.SysError(common.LogText("failed to read sync topics: %v", err))
		return
	}
	revisions := make(map[string]string, len(rows))
	for _, row := range rows {
		revisions[row.Topic] = row.Revision
	}
	nodeSync.mu.Lock()
	defer nodeSync.mu.Unlock()
	nodeSync.startup = revisions
}

// SyncTopicLoadFailed records that this node's startup load of topic failed:
// StartNodeSync then leaves the topic unapplied, so the first tick loads it
// again, and the error shows until a load succeeds.
func SyncTopicLoadFailed(topic string, err error) {
	nodeSync.mu.Lock()
	defer nodeSync.mu.Unlock()
	state := nodeSync.states[topic]
	state.Error = capSyncMessage(err.Error())
	nodeSync.states[topic] = state
}

// StartNodeSync records the revisions read at startup as applied, then every
// 3 seconds reloads each registered topic whose revision changed and writes
// this node's registry row at once. Call it after the startup loads.
func StartNodeSync() {
	applyStartupSyncRevisions()
	gopool.Go(func() {
		ticker := time.NewTicker(nodeSyncInterval)
		defer ticker.Stop()
		for range ticker.C {
			if syncNodeTopics(context.Background()) {
				reportSystemInstanceWithLog()
			}
		}
	})
}

// applyStartupSyncRevisions records the revisions read before the startup
// loads as applied. A topic whose startup load failed, or every topic when that
// read failed, stays unapplied: the first tick loads it again, and the node
// reports it as not synced until then.
func applyStartupSyncRevisions() {
	nodeSync.mu.Lock()
	defer nodeSync.mu.Unlock()
	now := common.GetTimestamp()
	for topic := range nodeSync.reloads {
		state := nodeSync.states[topic]
		if nodeSync.startup != nil && state.Error == "" {
			state.Revision, state.AppliedAt = nodeSync.startup[topic], now
		}
		nodeSync.states[topic] = state
	}
}

// syncNodeTopics runs the reload of each registered topic whose revision
// differs from the one this node applied, and reports whether any ran. A
// success records the revision read before the reload, so a write made during
// the reload runs it again on the next tick; a failure keeps the old one.
func syncNodeTopics(ctx context.Context) bool {
	rows, err := model.ListSyncTopics()
	nodeSync.mu.Lock()
	failedBefore := nodeSync.listFailed
	nodeSync.listFailed = err != nil
	reloads := maps.Clone(nodeSync.reloads)
	states := maps.Clone(nodeSync.states)
	nodeSync.mu.Unlock()
	if err != nil {
		if !failedBefore {
			common.SysError(common.LogText("failed to read sync topics: %v", err))
		}
		return false
	}
	revisions := make(map[string]string, len(rows))
	for _, row := range rows {
		revisions[row.Topic] = row.Revision
	}
	ran := false
	for _, topic := range slices.Sorted(maps.Keys(reloads)) {
		revision := revisions[topic]
		if state := states[topic]; state.AppliedAt != 0 && state.Revision == revision {
			continue
		}
		ran = true
		err := func() (err error) {
			defer func() {
				if recovered := recover(); recovered != nil {
					err = fmt.Errorf("reload panicked: %v", recovered)
				}
			}()
			return reloads[topic](ctx)
		}()
		nodeSync.mu.Lock()
		state := nodeSync.states[topic]
		previousError := state.Error
		if err != nil {
			state.Error = capSyncMessage(err.Error())
		} else {
			state.Revision, state.AppliedAt, state.Error = revision, common.GetTimestamp(), ""
		}
		nodeSync.states[topic] = state
		nodeSync.mu.Unlock()
		if err != nil && state.Error != previousError {
			common.SysError(common.LogText("failed to reload sync topic %s: %v", topic, err))
		}
	}
	return ran
}

func capSyncMessage(message string) string {
	if utf8.RuneCountInString(message) <= nodeSyncMessageLimit {
		return message
	}
	return string([]rune(message)[:nodeSyncMessageLimit])
}

// NodeSyncTopic is the latest revision of a topic.
type NodeSyncTopic struct {
	Topic     string `json:"topic"`
	Revision  string `json:"revision"`
	UpdatedAt int64  `json:"updated_at"`
	UpdatedBy string `json:"updated_by"`
}

// NodeSyncNodeTopic tells whether a node runs the latest revision of a topic.
type NodeSyncNodeTopic struct {
	Synced    bool              `json:"synced"`
	AppliedAt int64             `json:"applied_at"`
	Error     string            `json:"error"`
	Errors    map[string]string `json:"errors"`
}

type NodeSyncNode struct {
	NodeName string                       `json:"node_name"`
	Online   bool                         `json:"online"`
	Topics   map[string]NodeSyncNodeTopic `json:"topics"`
}

type NodeSyncStatus struct {
	Topics []NodeSyncTopic `json:"topics"`
	Nodes  []NodeSyncNode  `json:"nodes"`
}

// GetNodeSyncStatus compares the latest revision of every topic a node keeps,
// this one or another online node, with what each node's registry row says it
// applied. A node keeps only the topics it registers: one that reports what it
// applied but not a topic reads that data from the database or a shared cache,
// so it always runs the latest revision.
func GetNodeSyncStatus() (NodeSyncStatus, error) {
	rows, err := model.ListSyncTopics()
	if err != nil {
		return NodeSyncStatus{}, err
	}
	instances, err := model.ListSystemInstances()
	if err != nil {
		return NodeSyncStatus{}, err
	}
	stored := make(map[string]model.SystemSyncTopic, len(rows))
	for _, row := range rows {
		stored[row.Topic] = row
	}
	nodeSync.mu.Lock()
	keptTopics := make(map[string]bool, len(nodeSync.reloads))
	for topic := range nodeSync.reloads {
		keptTopics[topic] = true
	}
	nodeSync.mu.Unlock()
	now := common.GetTimestamp()
	applied := make([]map[string]NodeSyncTopicState, len(instances))
	for index, instance := range instances {
		// A row written before this member existed, or unreadable, has no sync.
		var info struct {
			Sync map[string]NodeSyncTopicState `json:"sync"`
		}
		_ = common.UnmarshalJsonStr(instance.Info, &info)
		applied[index] = info.Sync
		if now-instance.LastSeenAt <= model.SystemInstanceStaleAfterSeconds {
			for topic := range info.Sync {
				keptTopics[topic] = true
			}
		}
	}
	topics := slices.Sorted(maps.Keys(keptTopics))

	status := NodeSyncStatus{Topics: make([]NodeSyncTopic, 0, len(topics)), Nodes: make([]NodeSyncNode, 0, len(instances))}
	for _, topic := range topics {
		row := stored[topic]
		status.Topics = append(status.Topics, NodeSyncTopic{Topic: topic, Revision: row.Revision, UpdatedAt: row.UpdatedAt, UpdatedBy: row.UpdatedBy})
	}
	for index, instance := range instances {
		node := NodeSyncNode{
			NodeName: instance.NodeName,
			Online:   now-instance.LastSeenAt <= model.SystemInstanceStaleAfterSeconds,
			Topics:   make(map[string]NodeSyncNodeTopic, len(topics)),
		}
		for _, topic := range status.Topics {
			state, kept := applied[index][topic.Topic]
			synced := kept && state.AppliedAt != 0 && state.Revision == topic.Revision
			if !kept {
				// A node that reports other topics does not keep this one; a
				// node without any sync state predates node sync.
				synced = len(applied[index]) > 0
			}
			errors := state.Errors
			if errors == nil {
				errors = map[string]string{}
			}
			node.Topics[topic.Topic] = NodeSyncNodeTopic{
				Synced:    synced,
				AppliedAt: state.AppliedAt,
				Error:     state.Error,
				Errors:    errors,
			}
		}
		status.Nodes = append(status.Nodes, node)
	}
	slices.SortFunc(status.Nodes, func(a, b NodeSyncNode) int { return strings.Compare(a.NodeName, b.NodeName) })
	return status, nil
}
