package model

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

type SystemTaskStatus string

const (
	SystemTaskStatusPending   SystemTaskStatus = "pending"
	SystemTaskStatusRunning   SystemTaskStatus = "running"
	SystemTaskStatusSucceeded SystemTaskStatus = "succeeded"
	SystemTaskStatusFailed    SystemTaskStatus = "failed"

	SystemTaskTypeLogCleanup     = "log_cleanup"
	SystemTaskTypeChannelTest    = "channel_test"
	SystemTaskTypeModelUpdate    = "model_update"
	SystemTaskTypeMidjourneyPoll = "midjourney_poll"
	SystemTaskTypeAsyncTaskPoll  = "async_task_poll"
	SystemTaskTypeChannelBalance = "channel_balance"
	SystemTaskTypeCleanup        = "system_task_cleanup"

	systemTaskCleanupBatchSize = 500
)

var ErrSystemTaskLockLost = errors.New("system task lock lost")

// SystemTask is one run of a background job, or one sync task (see
// SyncTaskType). The (type, id) index answers "newest row of a type" without
// reading older rows; every node asks it every few seconds.
type SystemTask struct {
	ID        int64            `json:"id" gorm:"primary_key;index:,composite:type_id,priority:2"`
	TaskID    string           `json:"task_id" gorm:"type:varchar(64);uniqueIndex"`
	Type      string           `json:"type" gorm:"type:varchar(64);index:,composite:type_id,priority:1"`
	Status    SystemTaskStatus `json:"status" gorm:"type:varchar(32);index"`
	ActiveKey *string          `json:"active_key,omitempty" gorm:"type:varchar(64);uniqueIndex"`
	Payload   string           `json:"payload" gorm:"type:text"`
	State     string           `json:"state" gorm:"type:text"`
	Result    string           `json:"result" gorm:"type:text"`
	Error     string           `json:"error" gorm:"type:text"`
	LockedBy  string           `json:"locked_by" gorm:"type:varchar(128);index"`
	CreatedAt int64            `json:"created_at" gorm:"bigint;index"`
	UpdatedAt int64            `json:"updated_at" gorm:"bigint;index"`
}

type SystemTaskLock struct {
	Type        string `json:"type" gorm:"type:varchar(64);primaryKey"`
	TaskID      string `json:"task_id" gorm:"type:varchar(64);index"`
	LockedBy    string `json:"locked_by" gorm:"type:varchar(128);index"`
	LockedUntil int64  `json:"locked_until" gorm:"bigint;index"`
	UpdatedAt   int64  `json:"updated_at" gorm:"bigint;index"`
}

type SystemTaskResponse struct {
	ID        int64            `json:"id"`
	TaskID    string           `json:"task_id"`
	Type      string           `json:"type"`
	Status    SystemTaskStatus `json:"status"`
	ActiveKey *string          `json:"active_key,omitempty"`
	Payload   any              `json:"payload"`
	State     any              `json:"state"`
	Result    any              `json:"result"`
	Error     string           `json:"error"`
	LockedBy  string           `json:"locked_by"`
	CreatedAt int64            `json:"created_at"`
	UpdatedAt int64            `json:"updated_at"`
}

func (task *SystemTask) BeforeCreate(_ *gorm.DB) error {
	now := common.GetTimestamp()
	if task.CreatedAt == 0 {
		task.CreatedAt = now
	}
	if task.UpdatedAt == 0 {
		task.UpdatedAt = now
	}
	return nil
}

func (lock *SystemTaskLock) BeforeCreate(_ *gorm.DB) error {
	if lock.UpdatedAt == 0 {
		lock.UpdatedAt = common.GetTimestamp()
	}
	return nil
}

func GenerateSystemTaskID() (string, error) {
	key, err := common.GenerateRandomCharsKey(32)
	if err != nil {
		return "", err
	}
	return "systask_" + key, nil
}

func CreateSystemTask(taskType string, payload any, state any) (*SystemTask, error) {
	taskID, err := GenerateSystemTaskID()
	if err != nil {
		return nil, err
	}
	payloadText, err := marshalSystemTaskJSON(payload)
	if err != nil {
		return nil, err
	}
	stateText, err := marshalSystemTaskJSON(state)
	if err != nil {
		return nil, err
	}

	task := &SystemTask{
		TaskID:    taskID,
		Type:      taskType,
		Status:    SystemTaskStatusPending,
		ActiveKey: &taskType,
		Payload:   payloadText,
		State:     stateText,
	}

	if err := DB.Create(task).Error; err != nil {
		return nil, err
	}
	return task, nil
}

func GetSystemTaskByTaskID(taskID string) (*SystemTask, error) {
	var task SystemTask
	if err := DB.Where("task_id = ?", taskID).First(&task).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &task, nil
}

func GetActiveSystemTask(taskType string) (*SystemTask, error) {
	var task SystemTask
	err := DB.Where("type = ? AND status IN ?", taskType, activeSystemTaskStatuses()).
		Order("id desc").
		First(&task).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &task, nil
}

func FindPendingSystemTasks(taskType string, limit int) ([]*SystemTask, error) {
	var tasks []*SystemTask
	if limit <= 0 {
		limit = 1
	}
	err := DB.Where("type = ? AND status = ?", taskType, SystemTaskStatusPending).
		Order("id asc").
		Limit(limit).
		Find(&tasks).Error
	return tasks, err
}

func FindEarliestPendingSystemTasks(taskTypes []string) (map[string]*SystemTask, error) {
	tasksByType := map[string]*SystemTask{}
	if len(taskTypes) == 0 {
		return tasksByType, nil
	}

	// Read the ids first: MySQL 5.7 runs "id IN (grouped subquery)" as a scan
	// of the whole table.
	var ids []int64
	if err := DB.Model(&SystemTask{}).
		Where("type IN ? AND status = ?", taskTypes, SystemTaskStatusPending).
		Group("type").
		Pluck("MIN(id)", &ids).Error; err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return tasksByType, nil
	}
	var tasks []*SystemTask
	if err := DB.Where("id IN ?", ids).Find(&tasks).Error; err != nil {
		return nil, err
	}
	for _, task := range tasks {
		tasksByType[task.Type] = task
	}
	return tasksByType, nil
}

type SystemTaskFilter struct {
	Scope  string           `form:"scope" binding:"omitempty,oneof=active history"`
	Type   string           `form:"type" binding:"max=64"`
	Status SystemTaskStatus `form:"status" binding:"omitempty,oneof=pending running succeeded failed"`
}

func (filter SystemTaskFilter) query() *gorm.DB {
	query := DB.Model(&SystemTask{})
	switch filter.Scope {
	case "active":
		query = query.Where("status IN ?", activeSystemTaskStatuses())
	case "history":
		query = query.Where("status IN ?", []SystemTaskStatus{SystemTaskStatusSucceeded, SystemTaskStatusFailed})
	}
	if filter.Type != "" {
		query = query.Where("type = ?", filter.Type)
	}
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	return query
}

func ListSystemTasks(filter SystemTaskFilter, offset, limit int) ([]*SystemTask, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	query := filter.query()
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var tasks []*SystemTask
	err := query.Order("id desc").Offset(max(0, offset)).Limit(min(limit, 100)).Find(&tasks).Error
	return tasks, total, err
}

// DeleteSystemTaskHistory preserves the latest row of every type because the
// scheduler uses it to determine when the next run is due. Active rows and rows
// created after this cleanup's snapshot are never removed.
func DeleteSystemTaskHistory(filter SystemTaskFilter) (int64, error) {
	var latestIDs []int64
	if err := DB.Model(&SystemTask{}).Select("MAX(id)").Group("type").Pluck("MAX(id)", &latestIDs).Error; err != nil {
		return 0, err
	}
	if len(latestIDs) == 0 {
		return 0, nil
	}
	var newestID int64
	for _, id := range latestIDs {
		newestID = max(newestID, id)
	}
	filter.Scope = "history"
	result := filter.query().Where("id < ? AND id NOT IN ?", newestID, latestIDs).Delete(&SystemTask{})
	return result.RowsAffected, result.Error
}

// GetLatestSystemTask returns the most recent task row of the given type
// (any status) so the scheduler can decide whether enough time has elapsed
// since the last run. Returns (nil, nil) when no row exists.
func GetLatestSystemTask(taskType string) (*SystemTask, error) {
	var task SystemTask
	err := DB.Where("type = ?", taskType).Order("id desc").First(&task).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &task, nil
}

// GetLatestSystemTaskIDs returns the id of the newest row of each type that
// has one. Every type is its own MAX(id) subquery, which each database answers
// from the (type, id) index without reading older rows.
func GetLatestSystemTaskIDs(taskTypes []string) (map[string]int64, error) {
	ids := make(map[string]int64, len(taskTypes))
	if len(taskTypes) == 0 {
		return ids, nil
	}
	columns := make([]string, len(taskTypes))
	subQueries := make([]any, len(taskTypes))
	for i, taskType := range taskTypes {
		columns[i] = "(?)"
		subQueries[i] = DB.Model(&SystemTask{}).Select("MAX(id)").Where("type = ?", taskType)
	}
	rows, err := DB.Raw("SELECT "+strings.Join(columns, ", "), subQueries...).Rows()
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	latest := make([]sql.NullInt64, len(taskTypes))
	dest := make([]any, len(latest))
	for i := range latest {
		dest[i] = &latest[i]
	}
	if rows.Next() {
		if err := rows.Scan(dest...); err != nil {
			return nil, err
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for i, taskType := range taskTypes {
		if latest[i].Valid {
			ids[taskType] = latest[i].Int64
		}
	}
	return ids, nil
}

func GetLatestSystemTasks(taskTypes []string) (map[string]*SystemTask, error) {
	tasksByType := map[string]*SystemTask{}
	latestIDs, err := GetLatestSystemTaskIDs(taskTypes)
	if err != nil || len(latestIDs) == 0 {
		return tasksByType, err
	}
	ids := make([]int64, 0, len(latestIDs))
	for _, id := range latestIDs {
		ids = append(ids, id)
	}
	var tasks []*SystemTask
	if err := DB.Where("id IN ?", ids).Find(&tasks).Error; err != nil {
		return nil, err
	}
	for _, task := range tasks {
		tasksByType[task.Type] = task
	}
	return tasksByType, nil
}

// DeleteFinishedSystemTasks deletes, in batches, the succeeded and failed rows
// last updated before cutoff. The newest row of every type stays: the
// scheduler and the node sync read it. A row that becomes the newest later is
// newer than cutoff.
func DeleteFinishedSystemTasks(ctx context.Context, cutoff int64) (int64, error) {
	var newestIDs []int64
	if err := DB.Model(&SystemTask{}).Group("type").Pluck("MAX(id)", &newestIDs).Error; err != nil {
		return 0, err
	}
	var deleted int64
	for {
		if err := ctx.Err(); err != nil {
			return deleted, err
		}
		query := DB.Model(&SystemTask{}).Where("status IN ? AND updated_at < ?", []SystemTaskStatus{SystemTaskStatusSucceeded, SystemTaskStatusFailed}, cutoff)
		if len(newestIDs) > 0 {
			query = query.Where("id NOT IN ?", newestIDs)
		}
		// MySQL rejects LIMIT in an IN subquery: read the ids, then delete them.
		var ids []int64
		if err := query.Order("id").Limit(systemTaskCleanupBatchSize).Pluck("id", &ids).Error; err != nil {
			return deleted, err
		}
		if len(ids) == 0 {
			return deleted, nil
		}
		result := DB.Where("id IN ?", ids).Delete(&SystemTask{})
		if result.Error != nil {
			return deleted, result.Error
		}
		deleted += result.RowsAffected
		if len(ids) < systemTaskCleanupBatchSize {
			return deleted, nil
		}
	}
}

func ClaimSystemTask(id int64, taskType string, runnerID string, lockUntil int64) (*SystemTask, bool, error) {
	now := common.GetTimestamp()
	var task SystemTask
	if err := DB.Where("id = ? AND type = ? AND status = ?", id, taskType, SystemTaskStatusPending).First(&task).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, false, nil
		}
		return nil, false, err
	}

	acquired, expiredTaskID, err := acquireSystemTaskLock(taskType, task.TaskID, runnerID, now, lockUntil)
	if err != nil || !acquired {
		return nil, acquired, err
	}
	if expiredTaskID != "" && expiredTaskID != task.TaskID {
		if err := MarkSystemTaskLeaseExpired(expiredTaskID); err != nil {
			_ = ReleaseSystemTaskLock(task.TaskID, runnerID)
			return nil, false, err
		}
	}

	result := DB.Model(&SystemTask{}).
		Where("id = ? AND type = ? AND status = ?", id, taskType, SystemTaskStatusPending).
		Updates(map[string]any{
			"status":     SystemTaskStatusRunning,
			"locked_by":  runnerID,
			"updated_at": now,
		})
	if result.Error != nil {
		_ = ReleaseSystemTaskLock(task.TaskID, runnerID)
		return nil, false, result.Error
	}
	if result.RowsAffected == 0 {
		_ = ReleaseSystemTaskLock(task.TaskID, runnerID)
		return nil, false, nil
	}

	if err := DB.Where("id = ?", id).First(&task).Error; err != nil {
		return nil, false, err
	}
	return &task, true, nil
}

func acquireSystemTaskLock(taskType string, taskID string, lockedBy string, now int64, lockUntil int64) (bool, string, error) {
	lock := &SystemTaskLock{
		Type:        taskType,
		TaskID:      taskID,
		LockedBy:    lockedBy,
		LockedUntil: lockUntil,
		UpdatedAt:   now,
	}
	if err := DB.Create(lock).Error; err == nil {
		return true, "", nil
	}

	var existing SystemTaskLock
	err := DB.Where("type = ?", taskType).First(&existing).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, "", nil
		}
		return false, "", err
	}
	if existing.LockedUntil >= now {
		return false, "", nil
	}

	result := DB.Model(&SystemTaskLock{}).
		Where("type = ? AND locked_until < ?", taskType, now).
		Updates(map[string]any{
			"task_id":      taskID,
			"locked_by":    lockedBy,
			"locked_until": lockUntil,
			"updated_at":   now,
		})
	if result.Error != nil {
		return false, "", result.Error
	}
	if result.RowsAffected == 0 {
		return false, "", nil
	}
	return true, existing.TaskID, nil
}

func UpdateSystemTaskState(taskID string, lockedBy string, state any) error {
	stateText, err := marshalSystemTaskJSON(state)
	if err != nil {
		return err
	}
	now := common.GetTimestamp()
	result := DB.Model(&SystemTask{}).
		Where("task_id = ? AND status = ? AND locked_by = ?", taskID, SystemTaskStatusRunning, lockedBy).
		Where("EXISTS (SELECT 1 FROM system_task_locks WHERE system_task_locks.task_id = system_tasks.task_id AND system_task_locks.locked_by = ? AND system_task_locks.locked_until >= ?)", lockedBy, now).
		Updates(map[string]any{
			"state":      stateText,
			"updated_at": now,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected > 0 {
		return nil
	}
	// MySQL counts changed rows, not matched rows. A no-op persist of the same
	// state in the same second therefore returns RowsAffected == 0 even while
	// the lease is still held. Confirm the lock before treating this as loss.
	// Reuse `now` from the UPDATE so a clock tick cannot reintroduce false
	// lock-loss; a lease that expires during the write is caught by the next heartbeat.
	var held int64
	err = DB.Model(&SystemTask{}).
		Where("task_id = ? AND status = ? AND locked_by = ?", taskID, SystemTaskStatusRunning, lockedBy).
		Where("EXISTS (SELECT 1 FROM system_task_locks WHERE system_task_locks.task_id = system_tasks.task_id AND system_task_locks.locked_by = ? AND system_task_locks.locked_until >= ?)", lockedBy, now).
		Count(&held).Error
	if err != nil {
		return err
	}
	if held == 0 {
		return ErrSystemTaskLockLost
	}
	return nil
}

func RenewSystemTaskLock(taskID string, lockedBy string, lockUntil int64) error {
	now := common.GetTimestamp()
	result := DB.Model(&SystemTaskLock{}).
		Where("task_id = ? AND locked_by = ? AND locked_until >= ?", taskID, lockedBy, now).
		Updates(map[string]any{
			"locked_until": lockUntil,
			"updated_at":   now,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrSystemTaskLockLost
	}
	return nil
}

func MarkSystemTaskLeaseExpired(taskID string) error {
	result := DB.Model(&SystemTask{}).
		Where("task_id = ? AND status = ?", taskID, SystemTaskStatusRunning).
		Updates(map[string]any{
			"status":     SystemTaskStatusFailed,
			"active_key": nil,
			"error":      "task lease expired",
			"updated_at": common.GetTimestamp(),
		})
	return result.Error
}

func ExpireStaleSystemTaskLocks(now int64) error {
	var locks []*SystemTaskLock
	if err := DB.Where("locked_until < ?", now).Find(&locks).Error; err != nil {
		return err
	}
	for _, lock := range locks {
		if err := MarkSystemTaskLeaseExpired(lock.TaskID); err != nil {
			return err
		}
		result := DB.Where("type = ? AND task_id = ? AND locked_by = ? AND locked_until < ?", lock.Type, lock.TaskID, lock.LockedBy, now).
			Delete(&SystemTaskLock{})
		if result.Error != nil {
			return result.Error
		}
	}
	return nil
}

func ReleaseSystemTaskLock(taskID string, lockedBy string) error {
	result := DB.Where("task_id = ? AND locked_by = ?", taskID, lockedBy).Delete(&SystemTaskLock{})
	return result.Error
}

func FinishSystemTask(taskID string, lockedBy string, status SystemTaskStatus, resultPayload any, errorMessage string) error {
	resultText, err := marshalSystemTaskJSON(resultPayload)
	if err != nil {
		return err
	}
	now := common.GetTimestamp()
	result := DB.Model(&SystemTask{}).
		Where("task_id = ? AND status = ? AND locked_by = ?", taskID, SystemTaskStatusRunning, lockedBy).
		Where("EXISTS (SELECT 1 FROM system_task_locks WHERE system_task_locks.task_id = system_tasks.task_id AND system_task_locks.locked_by = ? AND system_task_locks.locked_until >= ?)", lockedBy, now).
		Updates(map[string]any{
			"status":     status,
			"active_key": nil,
			"result":     resultText,
			"error":      errorMessage,
			"updated_at": now,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrSystemTaskLockLost
	}
	return ReleaseSystemTaskLock(taskID, lockedBy)
}

func (task *SystemTask) DecodePayload(v any) error {
	return decodeSystemTaskJSONString(task.Payload, v)
}

func (task *SystemTask) DecodeState(v any) error {
	return decodeSystemTaskJSONString(task.State, v)
}

func (task *SystemTask) ToResponse() SystemTaskResponse {
	return SystemTaskResponse{
		ID:        task.ID,
		TaskID:    task.TaskID,
		Type:      task.Type,
		Status:    task.Status,
		ActiveKey: task.ActiveKey,
		Payload:   decodeSystemTaskJSONValue(task.Payload),
		State:     decodeSystemTaskJSONValue(task.State),
		Result:    decodeSystemTaskJSONValue(task.Result),
		Error:     task.Error,
		LockedBy:  task.LockedBy,
		CreatedAt: task.CreatedAt,
		UpdatedAt: task.UpdatedAt,
	}
}

func activeSystemTaskStatuses() []string {
	return []string{string(SystemTaskStatusPending), string(SystemTaskStatusRunning)}
}

func marshalSystemTaskJSON(v any) (string, error) {
	if v == nil {
		return "", nil
	}
	data, err := common.Marshal(v)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func decodeSystemTaskJSONString(data string, v any) error {
	if data == "" {
		return nil
	}
	return common.UnmarshalJsonStr(data, v)
}

func decodeSystemTaskJSONValue(data string) any {
	if data == "" {
		return nil
	}
	var value any
	if err := common.UnmarshalJsonStr(data, &value); err != nil {
		return data
	}
	return value
}
