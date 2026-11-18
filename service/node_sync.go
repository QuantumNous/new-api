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
	"github.com/QuantumNous/new-api/logger"
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

// NodeSyncTopicState is what this node has applied of one topic: every write
// whose sync task id is at most Revision. Errors lists the items of the topic
// the node failed to load, by key.
type NodeSyncTopicState struct {
	Revision  int64             `json:"revision"`
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
	startup map[string]int64
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

// ReadStartupSyncRevisions reads the newest sync task of every topic before
// the startup loads, so a write made while they run is reloaded once the loop
// starts.
func ReadStartupSyncRevisions() {
	revisions, err := model.GetLatestSyncRevisions()
	if err != nil {
		common.SysError(common.LogText("failed to read sync topics: %v", err))
		return
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
// 3 seconds reloads each registered topic that has a newer sync task and
// writes this node's registry row at once. Call it after the startup loads.
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

// syncNodeTopics runs the reload of each registered topic whose newest sync
// task is newer than the one this node applied, and reports whether any ran.
// A success records the task read before the reload, so a write made during
// the reload runs it again on the next tick; a failure keeps the old one.
func syncNodeTopics(ctx context.Context) bool {
	nodeSync.mu.Lock()
	reloads := maps.Clone(nodeSync.reloads)
	states := maps.Clone(nodeSync.states)
	nodeSync.mu.Unlock()
	topics := slices.Sorted(maps.Keys(reloads))
	taskTypes := make([]string, len(topics))
	for i, topic := range topics {
		taskTypes[i] = model.SyncTaskType(topic)
	}
	revisions, err := model.GetLatestSystemTaskIDs(taskTypes)
	nodeSync.mu.Lock()
	failedBefore := nodeSync.listFailed
	nodeSync.listFailed = err != nil
	nodeSync.mu.Unlock()
	if err != nil {
		if !failedBefore {
			common.SysError(common.LogText("failed to read sync topics: %v", err))
		}
		return false
	}
	ran := false
	for _, topic := range topics {
		revision := revisions[model.SyncTaskType(topic)]
		if state := states[topic]; state.AppliedAt != 0 && revision <= state.Revision {
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

// NodeSyncTopic is the newest sync task of a topic: its id, when it was
// added and the node whose write added it.
type NodeSyncTopic struct {
	Topic     string `json:"topic"`
	Revision  int64  `json:"revision"`
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

// systemInstanceSyncStates reads what a node's registry row says it applied.
// A row written before node sync existed, or unreadable, has none.
func systemInstanceSyncStates(instance *model.SystemInstance) map[string]NodeSyncTopicState {
	var info struct {
		Sync map[string]NodeSyncTopicState `json:"sync"`
	}
	_ = common.UnmarshalJsonStr(instance.Info, &info)
	return info.Sync
}

// GetNodeSyncStatus compares the newest sync task of every topic a node keeps,
// this one or another online node, with what each node's registry row says it
// applied. A node keeps only the topics it registers: one that reports what it
// applied but not a topic reads that data from the database or a shared cache,
// so it always runs the latest revision.
func GetNodeSyncStatus() (NodeSyncStatus, error) {
	instances, err := model.ListSystemInstances()
	if err != nil {
		return NodeSyncStatus{}, err
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
		applied[index] = systemInstanceSyncStates(instance)
		if now-instance.LastSeenAt <= model.SystemInstanceStaleAfterSeconds {
			for topic := range applied[index] {
				keptTopics[topic] = true
			}
		}
	}
	topics := slices.Sorted(maps.Keys(keptTopics))
	taskTypes := make([]string, len(topics))
	for i, topic := range topics {
		taskTypes[i] = model.SyncTaskType(topic)
	}
	newest, err := model.GetLatestSystemTasks(taskTypes)
	if err != nil {
		return NodeSyncStatus{}, err
	}

	status := NodeSyncStatus{Topics: make([]NodeSyncTopic, 0, len(topics)), Nodes: make([]NodeSyncNode, 0, len(instances))}
	for _, topic := range topics {
		item := NodeSyncTopic{Topic: topic}
		if task := newest[model.SyncTaskType(topic)]; task != nil {
			var payload model.SyncTaskPayload
			_ = task.DecodePayload(&payload)
			item.Revision, item.UpdatedAt, item.UpdatedBy = task.ID, task.CreatedAt, payload.Node
		}
		status.Topics = append(status.Topics, item)
	}
	for index, instance := range instances {
		node := NodeSyncNode{
			NodeName: instance.NodeName,
			Online:   now-instance.LastSeenAt <= model.SystemInstanceStaleAfterSeconds,
			Topics:   make(map[string]NodeSyncNodeTopic, len(topics)),
		}
		for _, topic := range status.Topics {
			state, kept := applied[index][topic.Topic]
			synced := kept && state.AppliedAt != 0 && state.Revision >= topic.Revision
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

// finishAppliedSyncTasks runs on the master with the system tasks. A sync
// task is done once every online node that keeps its topic has applied it or
// a newer one; with no such node, nothing waits for it. The newest task still
// waiting shows how many of those nodes have applied it, and the error of each
// node whose reload fails.
func finishAppliedSyncTasks() {
	taskTypes, err := model.PendingSyncTaskTypes()
	if err != nil {
		logger.LogWarn(context.Background(), common.LogText("sync task query failed: %v", err))
		return
	}
	if len(taskTypes) == 0 {
		return
	}
	instances, err := model.ListSystemInstances()
	if err != nil {
		logger.LogWarn(context.Background(), common.LogText("sync task query failed: %v", err))
		return
	}
	newest, err := model.GetLatestSystemTasks(taskTypes)
	if err != nil {
		logger.LogWarn(context.Background(), common.LogText("sync task query failed: %v", err))
		return
	}
	now := common.GetTimestamp()
	online := make([]*model.SystemInstance, 0, len(instances))
	applied := make([]map[string]NodeSyncTopicState, 0, len(instances))
	for _, instance := range instances {
		if now-instance.LastSeenAt <= model.SystemInstanceStaleAfterSeconds {
			online = append(online, instance)
			applied = append(applied, systemInstanceSyncStates(instance))
		}
	}
	for _, taskType := range taskTypes {
		task := newest[taskType]
		if task == nil {
			continue
		}
		topic, _ := model.SyncTaskTopic(taskType)
		var revisions []int64
		var failures []string
		for index, instance := range online {
			state, kept := applied[index][topic]
			if !kept {
				continue
			}
			revision := state.Revision
			if state.AppliedAt == 0 {
				revision = 0
			}
			revisions = append(revisions, revision)
			if state.Error != "" && revision < task.ID {
				failures = append(failures, instance.NodeName+": "+state.Error)
			}
		}
		total := len(revisions)
		throughID := task.ID
		if total > 0 {
			throughID = slices.Min(revisions)
		}
		if throughID > 0 {
			if err := model.FinishSyncTasks(taskType, throughID, SystemTaskProgress{Total: total, Processed: total, Progress: 100}); err != nil {
				logger.LogWarn(context.Background(), common.LogText("sync task update failed: type=%s err=%v", taskType, err))
				continue
			}
		}
		if task.Status != model.SystemTaskStatusPending || task.ID <= throughID {
			continue
		}
		processed := 0
		for _, revision := range revisions {
			if revision >= task.ID {
				processed++
			}
		}
		progress := SystemTaskProgress{Total: total, Processed: processed, Progress: processed * 100 / total}
		if err := model.UpdateSyncTaskProgress(task, progress, strings.Join(failures, "; ")); err != nil {
			logger.LogWarn(context.Background(), common.LogText("sync task update failed: type=%s err=%v", taskType, err))
		}
	}
}
