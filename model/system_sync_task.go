package model

import (
	"slices"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

// Topics of the data each node keeps a copy of in memory. A write to that
// data bumps its topic: it adds a sync task, and every node that keeps the
// topic applies the task by reloading the topic.
const (
	SyncTopicOptions           = "options"
	SyncTopicChannels          = "channels"
	SyncTopicAuthz             = "authz"
	SyncTopicPlugins           = "plugins"
	SyncTopicOAuthProviders    = "oauth_providers"
	SyncTopicModels            = "models"
	SyncTopicSubscriptionPlans = "subscription_plans"
)

// syncTaskTypePrefix starts the type of every sync task; the topic follows.
const syncTaskTypePrefix = "sync_"

// SyncTaskType is the system task type of a topic's sync tasks.
func SyncTaskType(topic string) string {
	return syncTaskTypePrefix + topic
}

// SyncTaskTopic returns the topic of a sync task type.
func SyncTaskTopic(taskType string) (string, bool) {
	return strings.CutPrefix(taskType, syncTaskTypePrefix)
}

// SyncTaskPayload names the node whose write added a sync task.
type SyncTaskPayload struct {
	Node string `json:"node"`
}

// BumpSyncTopic adds a sync task for topic. Call it after the write to the
// topic's data has committed. A failed bump is only logged: the periodic full
// reloads still carry the change to the other nodes. Data that no periodic
// reload covers bumps with bumpSyncTopic inside its write transaction.
func BumpSyncTopic(topic string) {
	if err := addSyncTask(DB, topic); err != nil {
		common.SysError(common.LogText("failed to bump sync topic %s: %v", topic, err))
	}
}

// bumpSyncTopic adds the sync task on tx, inside the transaction of a write:
// the write and its task commit or fail together. It first locks the newest
// task of the topic, so concurrent writers add their tasks in commit order. A
// node that loaded the topic after seeing a task then also has every write
// whose task is older.
func bumpSyncTopic(tx *gorm.DB, topic string) error {
	var newest SystemTask
	if err := lockForUpdate(tx).Select("id").Where("type = ?", SyncTaskType(topic)).Order("id desc").Limit(1).Find(&newest).Error; err != nil {
		return err
	}
	return addSyncTask(tx, topic)
}

// addSyncTask inserts a pending sync task. Every write gets its own row, so
// no write is lost; the master marks the rows done once the nodes applied them.
func addSyncTask(db *gorm.DB, topic string) error {
	taskID, err := GenerateSystemTaskID()
	if err != nil {
		return err
	}
	payload, err := marshalSystemTaskJSON(SyncTaskPayload{Node: common.NodeName})
	if err != nil {
		return err
	}
	return db.Create(&SystemTask{TaskID: taskID, Type: SyncTaskType(topic), Status: SystemTaskStatusPending, Payload: payload}).Error
}

// GetLatestSyncRevisions returns the id of the newest sync task of every
// topic that has one. A node reads it before its startup loads, before it
// knows which topics it keeps.
func GetLatestSyncRevisions() (map[string]int64, error) {
	var rows []struct {
		Type string
		ID   int64
	}
	if err := DB.Model(&SystemTask{}).Select("type, MAX(id) AS id").Group("type").Scan(&rows).Error; err != nil {
		return nil, err
	}
	revisions := make(map[string]int64, len(rows))
	for _, row := range rows {
		if topic, ok := SyncTaskTopic(row.Type); ok {
			revisions[topic] = row.ID
		}
	}
	return revisions, nil
}

// PendingSyncTaskTypes returns the types that have sync tasks not every node
// has applied yet.
func PendingSyncTaskTypes() ([]string, error) {
	var types []string
	if err := DB.Model(&SystemTask{}).Where("status = ?", SystemTaskStatusPending).Distinct().Pluck("type", &types).Error; err != nil {
		return nil, err
	}
	return slices.DeleteFunc(types, func(taskType string) bool {
		_, ok := SyncTaskTopic(taskType)
		return !ok
	}), nil
}

// FinishSyncTasks marks the pending sync tasks of taskType up to throughID as
// applied by every node, with their final state.
func FinishSyncTasks(taskType string, throughID int64, state any) error {
	stateText, err := marshalSystemTaskJSON(state)
	if err != nil {
		return err
	}
	return DB.Model(&SystemTask{}).
		Where("type = ? AND status = ? AND id <= ?", taskType, SystemTaskStatusPending, throughID).
		Updates(map[string]any{
			"status":     SystemTaskStatusSucceeded,
			"state":      stateText,
			"error":      "",
			"updated_at": common.GetTimestamp(),
		}).Error
}

// UpdateSyncTaskProgress records on a pending sync task how many nodes have
// applied it and why the others have not. It writes nothing when both are
// unchanged.
func UpdateSyncTaskProgress(task *SystemTask, state any, errorMessage string) error {
	stateText, err := marshalSystemTaskJSON(state)
	if err != nil {
		return err
	}
	if stateText == task.State && errorMessage == task.Error {
		return nil
	}
	return DB.Model(&SystemTask{}).
		Where("id = ? AND status = ?", task.ID, SystemTaskStatusPending).
		Updates(map[string]any{
			"state":      stateText,
			"error":      errorMessage,
			"updated_at": common.GetTimestamp(),
		}).Error
}
