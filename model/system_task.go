package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

type SystemTaskStatus string

const (
	SystemTaskStatusPending   SystemTaskStatus = "pending"
	SystemTaskStatusRunning   SystemTaskStatus = "running"
	SystemTaskStatusSucceeded SystemTaskStatus = "succeeded"
	SystemTaskStatusFailed    SystemTaskStatus = "failed"

	SystemTaskTypeLogCleanup = "log_cleanup"
)

var ErrSystemTaskLockLost = errors.New("system task lock lost")

type SystemTask struct {
	ID          int64            `json:"id" gorm:"primary_key;AUTO_INCREMENT"`
	TaskID      string           `json:"task_id" gorm:"type:varchar(64);uniqueIndex"`
	Type        string           `json:"type" gorm:"type:varchar(64);index"`
	Status      SystemTaskStatus `json:"status" gorm:"type:varchar(32);index"`
	ActiveKey   *string          `json:"active_key,omitempty" gorm:"type:varchar(64);uniqueIndex"`
	Payload     string           `json:"payload" gorm:"type:text"`
	State       string           `json:"state" gorm:"type:text"`
	Result      string           `json:"result" gorm:"type:text"`
	Error       string           `json:"error" gorm:"type:text"`
	LockedBy    string           `json:"locked_by" gorm:"type:varchar(128);index"`
	LockedUntil int64            `json:"locked_until" gorm:"bigint;index"`
	CreatedAt   int64            `json:"created_at" gorm:"bigint;index"`
	UpdatedAt   int64            `json:"updated_at" gorm:"bigint;index"`
}

type SystemTaskResponse struct {
	ID          int64            `json:"id"`
	TaskID      string           `json:"task_id"`
	Type        string           `json:"type"`
	Status      SystemTaskStatus `json:"status"`
	ActiveKey   string           `json:"active_key,omitempty"`
	Payload     any              `json:"payload"`
	State       any              `json:"state"`
	Result      any              `json:"result"`
	Error       string           `json:"error"`
	LockedBy    string           `json:"locked_by"`
	LockedUntil int64            `json:"locked_until"`
	CreatedAt   int64            `json:"created_at"`
	UpdatedAt   int64            `json:"updated_at"`
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

func GenerateSystemTaskID() (string, error) {
	key, err := common.GenerateRandomCharsKey(32)
	if err != nil {
		return "", err
	}
	return "systask_" + key, nil
}

func CreateSystemTask(taskType string, activeKey string, payload any, state any) (*SystemTask, error) {
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
		TaskID:  taskID,
		Type:    taskType,
		Status:  SystemTaskStatusPending,
		Payload: payloadText,
		State:   stateText,
	}
	if activeKey != "" {
		task.ActiveKey = &activeKey
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
	err := DB.Where("type = ? AND active_key IS NOT NULL", taskType).
		Where("status IN ?", activeSystemTaskStatuses()).
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

func FindRunnableSystemTasks(taskType string, now int64, limit int) ([]*SystemTask, error) {
	var tasks []*SystemTask
	if limit <= 0 {
		limit = 1
	}
	err := DB.Where("type = ? AND status IN ? AND (locked_until = 0 OR locked_until < ?)", taskType, activeSystemTaskStatuses(), now).
		Order("id asc").
		Limit(limit).
		Find(&tasks).Error
	return tasks, err
}

func ClaimSystemTask(id int64, taskType string, runnerID string, lockUntil int64) (*SystemTask, bool, error) {
	now := common.GetTimestamp()
	result := DB.Model(&SystemTask{}).
		Where("id = ? AND type = ? AND status IN ? AND (locked_until = 0 OR locked_until < ? OR locked_by = ?)", id, taskType, activeSystemTaskStatuses(), now, runnerID).
		Updates(map[string]any{
			"status":       SystemTaskStatusRunning,
			"locked_by":    runnerID,
			"locked_until": lockUntil,
			"updated_at":   now,
		})
	if result.Error != nil {
		return nil, false, result.Error
	}
	if result.RowsAffected == 0 {
		return nil, false, nil
	}

	var task SystemTask
	if err := DB.Where("id = ?", id).First(&task).Error; err != nil {
		return nil, false, err
	}
	return &task, true, nil
}

func UpdateSystemTaskState(taskID string, lockedBy string, state any, lockUntil int64) error {
	stateText, err := marshalSystemTaskJSON(state)
	if err != nil {
		return err
	}
	result := DB.Model(&SystemTask{}).
		Where("task_id = ? AND status = ? AND locked_by = ?", taskID, SystemTaskStatusRunning, lockedBy).
		Updates(map[string]any{
			"state":        stateText,
			"locked_until": lockUntil,
			"updated_at":   common.GetTimestamp(),
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrSystemTaskLockLost
	}
	return nil
}

func FinishSystemTask(taskID string, lockedBy string, status SystemTaskStatus, resultPayload any, errorMessage string) error {
	resultText, err := marshalSystemTaskJSON(resultPayload)
	if err != nil {
		return err
	}
	result := DB.Model(&SystemTask{}).
		Where("task_id = ? AND status = ? AND locked_by = ?", taskID, SystemTaskStatusRunning, lockedBy).
		Updates(map[string]any{
			"status":       status,
			"active_key":   nil,
			"result":       resultText,
			"error":        errorMessage,
			"locked_by":    "",
			"locked_until": 0,
			"updated_at":   common.GetTimestamp(),
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrSystemTaskLockLost
	}
	return nil
}

func (task *SystemTask) DecodePayload(v any) error {
	return decodeSystemTaskJSONString(task.Payload, v)
}

func (task *SystemTask) DecodeState(v any) error {
	return decodeSystemTaskJSONString(task.State, v)
}

func (task *SystemTask) ToResponse() SystemTaskResponse {
	activeKey := ""
	if task.ActiveKey != nil {
		activeKey = *task.ActiveKey
	}
	return SystemTaskResponse{
		ID:          task.ID,
		TaskID:      task.TaskID,
		Type:        task.Type,
		Status:      task.Status,
		ActiveKey:   activeKey,
		Payload:     decodeSystemTaskJSONValue(task.Payload),
		State:       decodeSystemTaskJSONValue(task.State),
		Result:      decodeSystemTaskJSONValue(task.Result),
		Error:       task.Error,
		LockedBy:    task.LockedBy,
		LockedUntil: task.LockedUntil,
		CreatedAt:   task.CreatedAt,
		UpdatedAt:   task.UpdatedAt,
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
