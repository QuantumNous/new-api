package model

import (
	"bytes"
	"context"
	"database/sql/driver"
	"encoding/json"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	commonRelay "github.com/QuantumNous/new-api/relay/common"
	"gorm.io/gorm"
)

type TaskStatus string

func (t TaskStatus) ToVideoStatus() string {
	var status string
	switch t {
	case TaskStatusQueued, TaskStatusSubmitted:
		status = dto.VideoStatusQueued
	case TaskStatusInProgress:
		status = dto.VideoStatusInProgress
	case TaskStatusSuccess:
		status = dto.VideoStatusCompleted
	case TaskStatusFailure:
		status = dto.VideoStatusFailed
	default:
		status = dto.VideoStatusUnknown // Default fallback
	}
	return status
}

const (
	TaskStatusNotStart   TaskStatus = "NOT_START"
	TaskStatusSubmitted             = "SUBMITTED"
	TaskStatusQueued                = "QUEUED"
	TaskStatusInProgress            = "IN_PROGRESS"
	TaskStatusFailure               = "FAILURE"
	TaskStatusSuccess               = "SUCCESS"
	TaskStatusUnknown               = "UNKNOWN"
)

const (
	TaskPreparationStatusPending         = "PENDING"
	TaskPreparationStatusPreparing       = "PREPARING"
	TaskPreparationStatusPreparingAssets = "preparing_assets"
	TaskPreparationStatusSubmitting      = "SUBMITTING"
	TaskPreparationStatusReady           = "READY"
	TaskPreparationStatusFailed          = "FAILED"
	TaskPreparationStatusUnknownOutcome  = "UNKNOWN_OUTCOME"
)

const (
	TaskAcceptedAccountingPending         = "pending"
	TaskAcceptedAccountingProcessing      = "processing"
	TaskAcceptedAccountingDone            = "done"
	TaskAcceptedAccountingFailedRetryable = "failed_retryable"

	TaskAcceptedAccountingStepFunding            = "funding"
	TaskAcceptedAccountingStepLogStats           = "log_stats"
	TaskAcceptedAccountingStepTemporarySpend     = "temporary_spend"
	TaskAcceptedAccountingStepSubscriptionWindow = "subscription_window"
	TaskAcceptedAccountingStepTokenCache         = "token_cache"
)

type Task struct {
	ID         int64                 `json:"id" gorm:"primary_key;AUTO_INCREMENT"`
	CreatedAt  int64                 `json:"created_at" gorm:"index"`
	UpdatedAt  int64                 `json:"updated_at"`
	TaskID     string                `json:"task_id" gorm:"type:varchar(191);uniqueIndex:idx_tasks_task_id_unique"` // 第三方id，不一定有/ song id\ Task id
	Platform   constant.TaskPlatform `json:"platform" gorm:"type:varchar(30);index"`                                // 平台
	UserId     int                   `json:"user_id" gorm:"index"`
	Group      string                `json:"group" gorm:"type:varchar(50)"` // 修正计费用
	ChannelId  int                   `json:"channel_id" gorm:"index"`
	Quota      int                   `json:"quota"`
	Action     string                `json:"action" gorm:"type:varchar(40);index"` // 任务类型, song, lyrics, description-mode
	Status     TaskStatus            `json:"status" gorm:"type:varchar(20);index"` // 任务状态
	FailReason string                `json:"fail_reason"`
	SubmitTime int64                 `json:"submit_time" gorm:"index"`
	StartTime  int64                 `json:"start_time" gorm:"index"`
	FinishTime int64                 `json:"finish_time" gorm:"index"`
	Progress   string                `json:"progress" gorm:"type:varchar(20);index"`
	Properties Properties            `json:"properties" gorm:"type:json"`
	Username   string                `json:"username,omitempty" gorm:"-"`
	// 禁止返回给用户，内部可能包含key等隐私信息
	PrivateData                      TaskPrivateData `json:"-" gorm:"column:private_data;type:json"`
	Data                             json.RawMessage `json:"data" gorm:"type:json"`
	PreparationStatus                string          `json:"-" gorm:"type:varchar(24);index"`
	NormalizedRequestPayload         json.RawMessage `json:"-" gorm:"type:json"`
	PreparationLeaseOwner            string          `json:"-" gorm:"type:varchar(64);index"`
	PreparationLeaseExpiresAt        int64           `json:"-" gorm:"index"`
	PreparationAttemptCount          int             `json:"-"`
	VideoResultArchiveLeaseOwner     string          `json:"-" gorm:"type:varchar(64);index"`
	VideoResultArchiveLeaseExpiresAt int64           `json:"-" gorm:"index;default:0"`

	AcceptedAccountingStatus         string `json:"-" gorm:"type:varchar(24);index"`
	AcceptedAccountingLeaseOwner     string `json:"-" gorm:"type:varchar(64);index"`
	AcceptedAccountingLeaseExpiresAt int64  `json:"-" gorm:"index"`
	AcceptedAccountingAttemptCount   int    `json:"-"`
	AcceptedAccountingReservedQuota  int    `json:"-"`
	AcceptedAccountingActualQuota    int    `json:"-"`
	AcceptedAccountingFailReason     string `json:"-"`
	AcceptedAccountingDoneAt         int64  `json:"-" gorm:"index"`
}

type TaskAcceptedAccountingLedger struct {
	ID        int64  `json:"id" gorm:"primary_key;AUTO_INCREMENT"`
	CreatedAt int64  `json:"created_at" gorm:"index"`
	UpdatedAt int64  `json:"updated_at"`
	TaskID    string `json:"task_id" gorm:"type:varchar(191);uniqueIndex:idx_task_accepted_accounting_step,priority:1"`
	Step      string `json:"step" gorm:"type:varchar(64);uniqueIndex:idx_task_accepted_accounting_step,priority:2"`
}

type TaskAcceptedAccountingLogLedger struct {
	ID        int64  `json:"id" gorm:"primary_key;AUTO_INCREMENT"`
	CreatedAt int64  `json:"created_at" gorm:"index"`
	UpdatedAt int64  `json:"updated_at"`
	TaskID    string `json:"task_id" gorm:"type:varchar(191);uniqueIndex:idx_task_accepted_accounting_log_step,priority:1"`
	Step      string `json:"step" gorm:"type:varchar(64);uniqueIndex:idx_task_accepted_accounting_log_step,priority:2"`
}

func (t *Task) SetData(data any) {
	b, _ := common.Marshal(data)
	t.Data = json.RawMessage(b)
}

func (t *Task) GetData(v any) error {
	return common.Unmarshal(t.Data, &v)
}

type Properties struct {
	Input             string `json:"input"`
	UpstreamModelName string `json:"upstream_model_name,omitempty"`
	OriginModelName   string `json:"origin_model_name,omitempty"`
}

func (m *Properties) Scan(val interface{}) error {
	bytesValue, _ := val.([]byte)
	if len(bytesValue) == 0 {
		*m = Properties{}
		return nil
	}
	return common.Unmarshal(bytesValue, m)
}

func (m Properties) Value() (driver.Value, error) {
	if m == (Properties{}) {
		return nil, nil
	}
	return common.Marshal(m)
}

type TaskPrivateData struct {
	Key             string                       `json:"key,omitempty"`
	UpstreamTaskID  string                       `json:"upstream_task_id,omitempty"` // 上游真实 task ID
	ResultURL       string                       `json:"result_url,omitempty"`       // 任务成功后的结果 URL（视频地址等）
	VideoResult     *VideoResult                 `json:"video_result,omitempty"`
	GrokVideoResult *GrokSubscriptionVideoResult `json:"grok_video_result,omitempty"`
	// 计费上下文：用于异步退款/差额结算（轮询阶段读取）
	BillingSource     string              `json:"billing_source,omitempty"`  // "wallet" 或 "subscription"
	SubscriptionId    int                 `json:"subscription_id,omitempty"` // 订阅 ID，用于订阅退款
	TokenId           int                 `json:"token_id,omitempty"`        // 令牌 ID，用于令牌额度退款
	SpecificChannelId int                 `json:"specific_channel_id,omitempty"`
	BillingContext    *TaskBillingContext `json:"billing_context,omitempty"` // 计费参数快照（用于轮询阶段重新计算）
	// 上游返回的 token 用量（轮询成功时落库），供两套查询接口统一回传 usage。
	CompletionTokens int `json:"completion_tokens,omitempty"`
	TotalTokens      int `json:"total_tokens,omitempty"`
}

type GrokSubscriptionVideoResult struct {
	URL         string  `json:"url,omitempty"`
	Duration    float64 `json:"duration,omitempty"`
	Resolution  string  `json:"resolution,omitempty"`
	RefreshedAt int64   `json:"refreshed_at,omitempty"`
}

type VideoResult struct {
	Bucket      string `json:"bucket"`
	Object      string `json:"object"`
	Generation  int64  `json:"generation"`
	ContentType string `json:"content_type"`
	Size        int64  `json:"size"`
	StoredAt    int64  `json:"stored_at"`
	ExpiresAt   int64  `json:"expires_at"`
}

// TaskBillingContext 记录任务提交时的计费参数，以便轮询阶段可以重新计算额度。
type TaskBillingContext struct {
	ModelPrice           float64            `json:"model_price,omitempty"`             // 模型单价
	GroupRatio           float64            `json:"group_ratio,omitempty"`             // 分组倍率
	GroupModelRatio      float64            `json:"group_model_ratio,omitempty"`       // 分组模型专属倍率
	GroupModelRatioGroup string             `json:"group_model_ratio_group,omitempty"` // 分组模型专属倍率命中的分组
	GroupModelRatioModel string             `json:"group_model_ratio_model,omitempty"` // 分组模型专属倍率命中的模型
	ModelRatio           float64            `json:"model_ratio,omitempty"`             // 模型倍率
	OtherRatios          map[string]float64 `json:"other_ratios,omitempty"`            // 附加倍率（时长、分辨率等）
	OriginModelName      string             `json:"origin_model_name,omitempty"`       // 模型名称，必须为OriginModelName
	PerCallBilling       bool               `json:"per_call_billing,omitempty"`        // 按次计费：跳过轮询阶段的差额结算
	// SubscriptionWeight 订阅计费的模型权重快照（任务提交时刻）。task.Quota 存的
	// 是未加权 list 额度，而订阅池按加权额扣减——异步退款/差额结算必须按此权重
	// 换算，否则退错额（权重 >1 的模型会少退/少补）。0 视为 1.0（旧数据兼容）。
	SubscriptionWeight float64 `json:"subscription_weight,omitempty"`
	// SubscriptionWindow is a legacy short-window ledger snapshot. New
	// synchronous subscription billing no longer persists it, but old queued
	// tasks may still carry one while compatibility accounting drains.
	SubscriptionWindow *TaskSubscriptionWindow `json:"subscription_window,omitempty"`
}

// TaskSubscriptionWindow is the legacy serialized subscription window guard
// snapshot kept for old queued task compatibility.
type TaskSubscriptionWindow struct {
	SubId      int              `json:"sub_id"`
	SubStart   int64            `json:"sub_start"`
	Limit5h    int64            `json:"limit_5h"`
	LimitWeek  int64            `json:"limit_week"`
	BucketHeld map[string]int64 `json:"bucket_held,omitempty"` // 5h 桶 key → 持有量
	WeekHeld   map[string]int64 `json:"week_held,omitempty"`   // 周 key → 持有量
}

// GetUpstreamTaskID 获取上游真实 task ID（用于与 provider 通信）
// 旧数据没有 UpstreamTaskID 时，TaskID 本身就是上游 ID
func (t *Task) GetUpstreamTaskID() string {
	if t.PrivateData.UpstreamTaskID != "" {
		return t.PrivateData.UpstreamTaskID
	}
	return t.TaskID
}

// GetResultURL 获取任务结果 URL（视频地址等）
// 新数据存在 PrivateData.ResultURL 中；旧数据回退到 FailReason（历史兼容）
func (t *Task) GetResultURL() string {
	if t.PrivateData.ResultURL != "" {
		return t.PrivateData.ResultURL
	}
	return t.FailReason
}

// UsageDTO returns the persisted upstream token usage as a response DTO, or nil
// when no tokens were recorded. Single source for the OpenAI-video and generic
// task-dto responses so they surface usage identically.
func (p TaskPrivateData) UsageDTO() *dto.OpenAIVideoUsage {
	if p.CompletionTokens == 0 && p.TotalTokens == 0 {
		return nil
	}
	return &dto.OpenAIVideoUsage{
		CompletionTokens: p.CompletionTokens,
		TotalTokens:      p.TotalTokens,
	}
}

// GenerateTaskID 生成对外暴露的 task_xxxx 格式 ID
func GenerateTaskID() string {
	key, _ := common.GenerateRandomCharsKey(32)
	return "task_" + key
}

func (p *TaskPrivateData) Scan(val interface{}) error {
	bytesValue, _ := val.([]byte)
	if len(bytesValue) == 0 {
		return nil
	}
	return common.Unmarshal(bytesValue, p)
}

func (p TaskPrivateData) Value() (driver.Value, error) {
	if (p == TaskPrivateData{}) {
		return nil, nil
	}
	return common.Marshal(p)
}

// SyncTaskQueryParams 用于包含所有搜索条件的结构体，可以根据需求添加更多字段
type SyncTaskQueryParams struct {
	Platform       constant.TaskPlatform
	ChannelID      string
	TaskID         string
	UserID         string
	Action         string
	Status         string
	StartTimestamp int64
	EndTimestamp   int64
	UserIDs        []int
}

func InitTask(platform constant.TaskPlatform, relayInfo *commonRelay.RelayInfo) *Task {
	properties := Properties{}
	privateData := TaskPrivateData{}
	if relayInfo != nil && relayInfo.ChannelMeta != nil {
		if TaskChannelTypePersistsPollingKey(relayInfo.ChannelMeta.ChannelType) {
			privateData.Key = relayInfo.ChannelMeta.ApiKey
		}
		if relayInfo.UpstreamModelName != "" {
			properties.UpstreamModelName = relayInfo.UpstreamModelName
		}
		if relayInfo.OriginModelName != "" {
			properties.OriginModelName = relayInfo.OriginModelName
		}
	}

	// 使用预生成的公开 ID（如果有），否则新生成
	taskID := ""
	if relayInfo.TaskRelayInfo != nil && relayInfo.TaskRelayInfo.PublicTaskID != "" {
		taskID = relayInfo.TaskRelayInfo.PublicTaskID
	} else {
		taskID = GenerateTaskID()
	}

	t := &Task{
		TaskID:            taskID,
		UserId:            relayInfo.UserId,
		Group:             relayInfo.UsingGroup,
		SubmitTime:        time.Now().Unix(),
		Status:            TaskStatusNotStart,
		PreparationStatus: TaskPreparationStatusPending,
		Progress:          "0%",
		ChannelId:         relayInfo.ChannelId,
		Platform:          platform,
		Properties:        properties,
		PrivateData:       privateData,
	}
	return t
}

func TaskChannelTypePersistsPollingKey(channelType int) bool {
	switch channelType {
	case constant.ChannelTypeGemini,
		constant.ChannelTypeVertexAi,
		constant.ChannelTypeTechMobiVideo,
		constant.ChannelTypeModelAPISeedance:
		return true
	case constant.ChannelTypeGrokSubscription:
		return false
	default:
		return false
	}
}

func TaskGetAllUserTask(userId int, startIdx int, num int, queryParams SyncTaskQueryParams) []*Task {
	var tasks []*Task
	var err error

	// 初始化查询构建器
	query := DB.Where("user_id = ?", userId)

	if queryParams.TaskID != "" {
		query = query.Where("task_id = ?", queryParams.TaskID)
	}
	if queryParams.Action != "" {
		query = query.Where("action = ?", queryParams.Action)
	}
	if queryParams.Status != "" {
		query = query.Where("status = ?", queryParams.Status)
	}
	if queryParams.Platform != "" {
		query = query.Where("platform = ?", queryParams.Platform)
	}
	if queryParams.StartTimestamp != 0 {
		// 假设您已将前端传来的时间戳转换为数据库所需的时间格式，并处理了时间戳的验证和解析
		query = query.Where("submit_time >= ?", queryParams.StartTimestamp)
	}
	if queryParams.EndTimestamp != 0 {
		query = query.Where("submit_time <= ?", queryParams.EndTimestamp)
	}

	// 获取数据
	err = query.Omit("channel_id").Order("id desc").Limit(num).Offset(startIdx).Find(&tasks).Error
	if err != nil {
		return nil
	}

	return tasks
}

func TaskGetAllTasks(startIdx int, num int, queryParams SyncTaskQueryParams) []*Task {
	var tasks []*Task
	var err error

	// 初始化查询构建器
	query := DB

	// 添加过滤条件
	if queryParams.ChannelID != "" {
		query = query.Where("channel_id = ?", queryParams.ChannelID)
	}
	if queryParams.Platform != "" {
		query = query.Where("platform = ?", queryParams.Platform)
	}
	if queryParams.UserID != "" {
		query = query.Where("user_id = ?", queryParams.UserID)
	}
	if len(queryParams.UserIDs) != 0 {
		query = query.Where("user_id in (?)", queryParams.UserIDs)
	}
	if queryParams.TaskID != "" {
		query = query.Where("task_id = ?", queryParams.TaskID)
	}
	if queryParams.Action != "" {
		query = query.Where("action = ?", queryParams.Action)
	}
	if queryParams.Status != "" {
		query = query.Where("status = ?", queryParams.Status)
	}
	if queryParams.StartTimestamp != 0 {
		query = query.Where("submit_time >= ?", queryParams.StartTimestamp)
	}
	if queryParams.EndTimestamp != 0 {
		query = query.Where("submit_time <= ?", queryParams.EndTimestamp)
	}

	// 获取数据
	err = query.Order("id desc").Limit(num).Offset(startIdx).Find(&tasks).Error
	if err != nil {
		return nil
	}

	return tasks
}

func GetTimedOutUnfinishedTasks(cutoffUnix int64, limit int) []*Task {
	var tasks []*Task
	err := excludePreparingAssetTasks(DB.Where("progress != ?", "100%")).
		Where("status NOT IN ?", []string{TaskStatusFailure, TaskStatusSuccess}).
		Where("submit_time < ?", cutoffUnix).
		Order("submit_time").
		Limit(limit).
		Find(&tasks).Error
	if err != nil {
		return nil
	}
	return tasks
}

func GetAllUnFinishSyncTasks(limit int) []*Task {
	var tasks []*Task
	var err error
	// get all tasks progress is not 100%
	err = excludePreparingAssetTasks(DB.Where("progress != ?", "100%")).Where("status != ?", TaskStatusFailure).Where("status != ?", TaskStatusSuccess).Limit(limit).Order("id").Find(&tasks).Error
	if err != nil {
		return nil
	}
	return tasks
}

func excludePreparingAssetTasks(db *gorm.DB) *gorm.DB {
	return db.Where("(preparation_status IS NULL OR preparation_status = '' OR preparation_status NOT IN ?)", []string{
		TaskPreparationStatusPreparingAssets,
		TaskPreparationStatusPreparing,
		TaskPreparationStatusSubmitting,
		TaskPreparationStatusUnknownOutcome,
	})
}

func GetQueuedAssetPreparationTasks(now int64, limit int) ([]*Task, error) {
	if limit <= 0 {
		limit = 10
	}
	var tasks []*Task
	err := DB.Where("status = ? AND preparation_status IN ? AND preparation_lease_expires_at <= ?",
		TaskStatusQueued, []string{TaskPreparationStatusPreparingAssets, TaskPreparationStatusPreparing}, now).
		Order("id ASC").
		Limit(limit).
		Find(&tasks).Error
	return tasks, err
}

func GetExpiredAssetTaskSubmissionFences(now int64, limit int) ([]*Task, error) {
	if limit <= 0 {
		limit = 10
	}
	var tasks []*Task
	err := DB.Where("status = ? AND preparation_status = ? AND preparation_lease_expires_at <= ?",
		TaskStatusQueued, TaskPreparationStatusSubmitting, now).
		Order("id ASC").
		Limit(limit).
		Find(&tasks).Error
	return tasks, err
}

func GetAcceptedAccountingTasks(now int64, limit int) ([]*Task, error) {
	if limit <= 0 {
		limit = 10
	}
	var tasks []*Task
	err := DB.Where("status = ? AND ((accepted_accounting_status IN ?) OR (accepted_accounting_status = ? AND accepted_accounting_lease_expires_at <= ?))",
		TaskStatusSubmitted,
		[]string{TaskAcceptedAccountingPending, TaskAcceptedAccountingFailedRetryable},
		TaskAcceptedAccountingProcessing,
		now).
		Order("id ASC").
		Limit(limit).
		Find(&tasks).Error
	return tasks, err
}

func GetByOnlyTaskId(taskId string) (*Task, bool, error) {
	if taskId == "" {
		return nil, false, nil
	}
	var task *Task
	var err error
	err = DB.Where("task_id = ?", taskId).First(&task).Error
	exist, err := RecordExist(err)
	if err != nil {
		return nil, false, err
	}
	return task, exist, err
}

func GetByTaskId(userId int, taskId string) (*Task, bool, error) {
	if taskId == "" {
		return nil, false, nil
	}
	var task *Task
	var err error
	err = DB.Where("user_id = ? and task_id = ?", userId, taskId).
		First(&task).Error
	exist, err := RecordExist(err)
	if err != nil {
		return nil, false, err
	}
	return task, exist, err
}

func GetByTaskIds(userId int, taskIds []any) ([]*Task, error) {
	if len(taskIds) == 0 {
		return nil, nil
	}
	var task []*Task
	var err error
	err = DB.Where("user_id = ? and task_id in (?)", userId, taskIds).
		Find(&task).Error
	if err != nil {
		return nil, err
	}
	return task, nil
}

func (Task *Task) Insert() error {
	var err error
	err = DB.Create(Task).Error
	return err
}

type taskSnapshot struct {
	Status           TaskStatus
	Progress         string
	StartTime        int64
	FinishTime       int64
	FailReason       string
	ResultURL        string
	VideoResult      *VideoResult
	CompletionTokens int
	TotalTokens      int
	Data             json.RawMessage
}

func (s taskSnapshot) Equal(other taskSnapshot) bool {
	return s.Status == other.Status &&
		s.Progress == other.Progress &&
		s.StartTime == other.StartTime &&
		s.FinishTime == other.FinishTime &&
		s.FailReason == other.FailReason &&
		s.ResultURL == other.ResultURL &&
		taskVideoResultEqual(s.VideoResult, other.VideoResult) &&
		s.CompletionTokens == other.CompletionTokens &&
		s.TotalTokens == other.TotalTokens &&
		bytes.Equal(s.Data, other.Data)
}

func taskVideoResultEqual(a, b *VideoResult) bool {
	if a == nil || b == nil {
		return a == b
	}
	return *a == *b
}

func grokVideoResultEqual(a, b *GrokSubscriptionVideoResult) bool {
	if a == nil || b == nil {
		return a == b
	}
	return *a == *b
}

func cloneVideoResult(result *VideoResult) *VideoResult {
	if result == nil {
		return nil
	}
	clone := *result
	return &clone
}

func CloneGrokSubscriptionVideoResult(result *GrokSubscriptionVideoResult) *GrokSubscriptionVideoResult {
	if result == nil {
		return nil
	}
	clone := *result
	return &clone
}

func (t *Task) Snapshot() taskSnapshot {
	return taskSnapshot{
		Status:           t.Status,
		Progress:         t.Progress,
		StartTime:        t.StartTime,
		FinishTime:       t.FinishTime,
		FailReason:       t.FailReason,
		ResultURL:        t.PrivateData.ResultURL,
		VideoResult:      cloneVideoResult(t.PrivateData.VideoResult),
		CompletionTokens: t.PrivateData.CompletionTokens,
		TotalTokens:      t.PrivateData.TotalTokens,
		Data:             t.Data,
	}
}

func UpdateGrokSubscriptionVideoResultCAS(taskID string, expectedUpstreamTaskID string, expectedPrior *GrokSubscriptionVideoResult, next *GrokSubscriptionVideoResult, now int64) (bool, error) {
	updated := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		var current Task
		if err := tx.Where("task_id = ?", taskID).First(&current).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil
			}
			return err
		}
		if current.Status != TaskStatusSuccess ||
			current.Platform != constant.TaskPlatform("113") ||
			current.PrivateData.UpstreamTaskID != expectedUpstreamTaskID ||
			!grokVideoResultEqual(current.PrivateData.GrokVideoResult, expectedPrior) {
			return nil
		}
		currentPrivateData, err := common.Marshal(current.PrivateData)
		if err != nil {
			return err
		}
		privateData := current.PrivateData
		privateData.GrokVideoResult = CloneGrokSubscriptionVideoResult(next)
		result := tx.Model(&Task{}).
			Where("task_id = ? AND status = ? AND platform = ? AND private_data = ?", taskID, TaskStatusSuccess, constant.TaskPlatform("113"), currentPrivateData).
			Updates(map[string]any{
				"private_data": privateData,
				"updated_at":   now,
			})
		if result.Error != nil {
			return result.Error
		}
		updated = result.RowsAffected == 1
		return nil
	})
	return updated, err
}

func (Task *Task) Update() error {
	var err error
	err = DB.Save(Task).Error
	return err
}

// UpdateWithStatus performs a conditional UPDATE guarded by fromStatus (CAS).
// Returns (true, nil) if this caller won the update, (false, nil) if
// another process already moved the task out of fromStatus.
//
// Uses Model().Select("*").Updates() instead of Save() because GORM's Save
// falls back to INSERT ON CONFLICT when the WHERE-guarded UPDATE matches
// zero rows, which silently bypasses the CAS guard.
func (t *Task) UpdateWithStatus(fromStatus TaskStatus) (bool, error) {
	result := DB.Model(t).Where("status = ?", fromStatus).Select("*").Updates(t)
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected > 0, nil
}

func ClaimTaskVideoResultArchiveLease(taskID string, fromStatus TaskStatus, owner string, now int64, leaseExpiresAt int64) (bool, error) {
	result := DB.Model(&Task{}).
		Where("task_id = ? AND status = ?", taskID, fromStatus).
		Where("(video_result_archive_lease_expires_at IS NULL OR video_result_archive_lease_expires_at <= ?)", now).
		Updates(map[string]any{
			"video_result_archive_lease_owner":      owner,
			"video_result_archive_lease_expires_at": leaseExpiresAt,
			"updated_at":                            now,
		})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func ReleaseTaskVideoResultArchiveLease(taskID string, fromStatus TaskStatus, owner string, expectedLeaseExpiresAt int64, now int64) (bool, error) {
	return releaseTaskVideoResultArchiveLease(DB, taskID, fromStatus, owner, expectedLeaseExpiresAt, now)
}

func ReleaseTaskVideoResultArchiveLeaseWithContext(ctx context.Context, taskID string, fromStatus TaskStatus, owner string, expectedLeaseExpiresAt int64, now int64) (bool, error) {
	return releaseTaskVideoResultArchiveLease(DB.WithContext(ctx), taskID, fromStatus, owner, expectedLeaseExpiresAt, now)
}

func RenewTaskVideoResultArchiveLease(taskID string, fromStatus TaskStatus, owner string, expectedLeaseExpiresAt int64, now int64, leaseExpiresAt int64) (bool, error) {
	result := DB.Model(&Task{}).
		Where("task_id = ? AND status = ?", taskID, fromStatus).
		Where("video_result_archive_lease_owner = ? AND video_result_archive_lease_expires_at = ? AND video_result_archive_lease_expires_at > ?", owner, expectedLeaseExpiresAt, now).
		Updates(map[string]any{
			"video_result_archive_lease_expires_at": leaseExpiresAt,
			"updated_at":                            now,
		})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func releaseTaskVideoResultArchiveLease(db *gorm.DB, taskID string, fromStatus TaskStatus, owner string, expectedLeaseExpiresAt int64, now int64) (bool, error) {
	result := db.Model(&Task{}).
		Where("task_id = ? AND status = ?", taskID, fromStatus).
		Where("video_result_archive_lease_owner = ? AND video_result_archive_lease_expires_at = ?", owner, expectedLeaseExpiresAt).
		Updates(map[string]any{
			"video_result_archive_lease_owner":      "",
			"video_result_archive_lease_expires_at": 0,
			"updated_at":                            now,
		})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func (t *Task) UpdateWithStatusAndVideoResultArchiveLease(fromStatus TaskStatus, owner string, expectedLeaseExpiresAt int64, now int64) (bool, error) {
	t.VideoResultArchiveLeaseOwner = ""
	t.VideoResultArchiveLeaseExpiresAt = 0
	result := DB.Model(t).
		Where("task_id = ?", t.TaskID).
		Where("status = ?", fromStatus).
		Where("video_result_archive_lease_owner = ? AND video_result_archive_lease_expires_at = ? AND video_result_archive_lease_expires_at > ?", owner, expectedLeaseExpiresAt, now).
		Select("*").
		Updates(t)
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected > 0, nil
}

func ClaimTaskPreparationLease(taskID string, owner string, expectedAttemptCount int, now int64, leaseExpiresAt int64) (bool, error) {
	result := DB.Model(&Task{}).
		Where("task_id = ? AND status = ?", taskID, TaskStatusQueued).
		Where("(preparation_status IS NULL OR preparation_status = '' OR preparation_status IN ?)", []string{TaskPreparationStatusPending, TaskPreparationStatusPreparingAssets, TaskPreparationStatusPreparing}).
		Where("preparation_attempt_count = ? AND preparation_lease_expires_at <= ?", expectedAttemptCount, now).
		Updates(map[string]any{
			"preparation_status":           TaskPreparationStatusPreparing,
			"preparation_lease_owner":      owner,
			"preparation_lease_expires_at": leaseExpiresAt,
			"preparation_attempt_count":    gorm.Expr("preparation_attempt_count + ?", 1),
			"updated_at":                   now,
		})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func RequeueQueuedTaskForAssetPreparation(taskID string, owner string, expectedLeaseExpiresAt int64, now int64, retryAt int64) (bool, error) {
	result := DB.Model(&Task{}).
		Where("task_id = ? AND status = ? AND preparation_status = ?", taskID, TaskStatusQueued, TaskPreparationStatusPreparing).
		Where("preparation_lease_owner = ? AND preparation_lease_expires_at = ? AND preparation_lease_expires_at > ?", owner, expectedLeaseExpiresAt, now).
		Updates(map[string]any{
			"preparation_status":           TaskPreparationStatusPreparingAssets,
			"preparation_lease_owner":      "",
			"preparation_lease_expires_at": retryAt,
			"updated_at":                   now,
		})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func MarkQueuedTaskSubmitting(taskID string, owner string, expectedAttemptCount int, now int64, channelID int, platform constant.TaskPlatform, quota int) (bool, error) {
	return MarkQueuedTaskSubmittingWithPollingKey(taskID, owner, expectedAttemptCount, now, channelID, platform, quota, "")
}

func MarkQueuedTaskSubmittingWithPollingKey(taskID string, owner string, expectedAttemptCount int, now int64, channelID int, platform constant.TaskPlatform, quota int, pollingKey string) (bool, error) {
	updates := map[string]any{
		"preparation_status":               TaskPreparationStatusSubmitting,
		"channel_id":                       channelID,
		"platform":                         platform,
		"accepted_accounting_actual_quota": quota,
		"updated_at":                       now,
	}
	if strings.TrimSpace(pollingKey) == "" {
		result := DB.Model(&Task{}).
			Where("task_id = ? AND status = ?", taskID, TaskStatusQueued).
			Where("preparation_status IN ?", []string{TaskPreparationStatusPreparing, TaskPreparationStatusSubmitting}).
			Where("preparation_lease_owner = ? AND preparation_attempt_count = ? AND preparation_lease_expires_at > ?", owner, expectedAttemptCount, now).
			Updates(updates)
		if result.Error != nil {
			return false, result.Error
		}
		return result.RowsAffected == 1, nil
	}

	fenced := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		var current Task
		if err := tx.Select("private_data").Where("task_id = ?", taskID).First(&current).Error; err != nil {
			return err
		}
		current.PrivateData.Key = strings.TrimSpace(pollingKey)
		updates["private_data"] = current.PrivateData
		result := tx.Model(&Task{}).
			Where("task_id = ? AND status = ?", taskID, TaskStatusQueued).
			Where("preparation_status IN ?", []string{TaskPreparationStatusPreparing, TaskPreparationStatusSubmitting}).
			Where("preparation_lease_owner = ? AND preparation_attempt_count = ? AND preparation_lease_expires_at > ?", owner, expectedAttemptCount, now).
			Updates(updates)
		if result.Error != nil {
			return result.Error
		}
		fenced = result.RowsAffected == 1
		return nil
	})
	return fenced, err
}

func RenewTaskPreparationLease(taskID string, owner string, expectedLeaseExpiresAt int64, now int64, leaseExpiresAt int64) (bool, error) {
	result := DB.Model(&Task{}).
		Where("task_id = ? AND status = ?", taskID, TaskStatusQueued).
		Where("preparation_lease_owner = ? AND preparation_lease_expires_at = ? AND preparation_lease_expires_at > ?", owner, expectedLeaseExpiresAt, now).
		Updates(map[string]any{
			"preparation_lease_expires_at": leaseExpiresAt,
			"updated_at":                   now,
		})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func MarkQueuedTaskSubmitted(taskID string, owner string, expectedLeaseExpiresAt int64, now int64, submitTime int64) (bool, error) {
	result := DB.Model(&Task{}).
		Where("task_id = ? AND status = ?", taskID, TaskStatusQueued).
		Where("preparation_lease_owner = ? AND preparation_lease_expires_at = ? AND preparation_lease_expires_at > ?", owner, expectedLeaseExpiresAt, now).
		Updates(map[string]any{
			"status":                       TaskStatusSubmitted,
			"preparation_status":           TaskPreparationStatusReady,
			"preparation_lease_owner":      "",
			"preparation_lease_expires_at": 0,
			"submit_time":                  submitTime,
			"updated_at":                   now,
		})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func MarkQueuedTaskAccepted(taskID string, owner string, expectedLeaseExpiresAt int64, now int64, submitTime int64, channelID int, platform constant.TaskPlatform, quota int, upstreamTaskID string, taskData []byte, publicIDs []string, lastUsedAt int64, retentionUntil int64) (bool, error) {
	return MarkQueuedTaskAcceptedWithPollingKey(taskID, owner, expectedLeaseExpiresAt, now, submitTime, channelID, platform, quota, upstreamTaskID, taskData, "", publicIDs, lastUsedAt, retentionUntil)
}

func MarkQueuedTaskAcceptedWithPollingKey(taskID string, owner string, expectedLeaseExpiresAt int64, now int64, submitTime int64, channelID int, platform constant.TaskPlatform, quota int, upstreamTaskID string, taskData []byte, pollingKey string, publicIDs []string, lastUsedAt int64, retentionUntil int64) (bool, error) {
	accepted := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		privateDataExpr := gorm.Expr("private_data")
		var current Task
		if err := tx.Select("private_data", "user_id", "quota").Where("task_id = ?", taskID).First(&current).Error; err == nil {
			current.PrivateData.UpstreamTaskID = upstreamTaskID
			if trimmedPollingKey := strings.TrimSpace(pollingKey); trimmedPollingKey != "" {
				current.PrivateData.Key = trimmedPollingKey
			}
			privateDataExpr = gorm.Expr("?", current.PrivateData)
		} else {
			return err
		}
		result := tx.Model(&Task{}).
			Where("task_id = ? AND status = ?", taskID, TaskStatusQueued).
			Where("preparation_lease_owner = ? AND preparation_lease_expires_at = ? AND preparation_lease_expires_at > ?", owner, expectedLeaseExpiresAt, now).
			Updates(map[string]any{
				"status":                               TaskStatusSubmitted,
				"preparation_status":                   TaskPreparationStatusReady,
				"preparation_lease_owner":              "",
				"preparation_lease_expires_at":         0,
				"submit_time":                          submitTime,
				"updated_at":                           now,
				"channel_id":                           channelID,
				"platform":                             platform,
				"data":                                 json.RawMessage(taskData),
				"private_data":                         privateDataExpr,
				"accepted_accounting_status":           TaskAcceptedAccountingPending,
				"accepted_accounting_lease_owner":      "",
				"accepted_accounting_lease_expires_at": 0,
				"accepted_accounting_reserved_quota":   current.Quota,
				"accepted_accounting_actual_quota":     quota,
				"accepted_accounting_fail_reason":      "",
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return nil
		}
		accepted = true
		return extendAcceptedAssetRetentionTx(tx, current.UserId, publicIDs, lastUsedAt, retentionUntil)
	})
	if err != nil {
		return false, err
	}
	return accepted, nil
}

func MarkQueuedTaskSubmissionUnknown(taskID string, expectedAttemptCount int, now int64, submitTime int64, channelID int, platform constant.TaskPlatform, quota int, upstreamTaskID string, taskData []byte, publicIDs []string, lastUsedAt int64, retentionUntil int64) (bool, error) {
	return MarkQueuedTaskSubmissionUnknownWithPollingKey(taskID, expectedAttemptCount, now, submitTime, channelID, platform, quota, upstreamTaskID, taskData, "", publicIDs, lastUsedAt, retentionUntil)
}

func MarkQueuedTaskSubmissionUnknownWithPollingKey(taskID string, expectedAttemptCount int, now int64, submitTime int64, channelID int, platform constant.TaskPlatform, quota int, upstreamTaskID string, taskData []byte, pollingKey string, publicIDs []string, lastUsedAt int64, retentionUntil int64) (bool, error) {
	quarantined := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		var current Task
		if err := tx.Select("private_data", "user_id", "quota").Where("task_id = ?", taskID).First(&current).Error; err != nil {
			return err
		}
		if upstreamTaskID != "" {
			current.PrivateData.UpstreamTaskID = upstreamTaskID
		}
		if trimmedPollingKey := strings.TrimSpace(pollingKey); trimmedPollingKey != "" {
			current.PrivateData.Key = trimmedPollingKey
		}
		updates := map[string]any{
			"status":                             TaskStatusUnknown,
			"preparation_status":                 TaskPreparationStatusUnknownOutcome,
			"preparation_lease_owner":            "",
			"preparation_lease_expires_at":       0,
			"submit_time":                        submitTime,
			"updated_at":                         now,
			"channel_id":                         channelID,
			"platform":                           platform,
			"private_data":                       current.PrivateData,
			"fail_reason":                        "upstream submission outcome requires manual reconciliation",
			"accepted_accounting_reserved_quota": current.Quota,
			"accepted_accounting_actual_quota":   quota,
		}
		if taskData != nil {
			updates["data"] = json.RawMessage(taskData)
		}
		result := tx.Model(&Task{}).
			Where("task_id = ? AND preparation_attempt_count = ?", taskID, expectedAttemptCount).
			Where("(status = ? OR (status = ? AND preparation_status = ?))", TaskStatusQueued, TaskStatusUnknown, TaskPreparationStatusUnknownOutcome).
			Updates(updates)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return nil
		}
		quarantined = true
		return extendAcceptedAssetRetentionTx(tx, current.UserId, publicIDs, lastUsedAt, retentionUntil)
	})
	if err != nil {
		return false, err
	}
	return quarantined, nil
}

func MarkExpiredAssetTaskSubmissionUnknown(taskID string, expectedOwner string, expectedLeaseExpiresAt int64, expectedAttemptCount int, now int64, publicIDs []string, retentionUntil int64) (bool, error) {
	quarantined := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		result := tx.Model(&Task{}).
			Where("task_id = ? AND status = ? AND preparation_status = ?", taskID, TaskStatusQueued, TaskPreparationStatusSubmitting).
			Where("preparation_lease_owner = ? AND preparation_lease_expires_at = ? AND preparation_lease_expires_at <= ?", expectedOwner, expectedLeaseExpiresAt, now).
			Where("preparation_attempt_count = ?", expectedAttemptCount).
			Updates(map[string]any{
				"status":                             TaskStatusUnknown,
				"preparation_status":                 TaskPreparationStatusUnknownOutcome,
				"preparation_lease_owner":            "",
				"preparation_lease_expires_at":       0,
				"submit_time":                        gorm.Expr("CASE WHEN submit_time > 0 THEN submit_time ELSE ? END", now),
				"updated_at":                         now,
				"fail_reason":                        "upstream submission outcome requires manual reconciliation",
				"accepted_accounting_reserved_quota": gorm.Expr("quota"),
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return nil
		}
		quarantined = true
		var current Task
		if err := tx.Select("user_id").Where("task_id = ?", taskID).First(&current).Error; err != nil {
			return err
		}
		return extendAcceptedAssetRetentionTx(tx, current.UserId, publicIDs, now, retentionUntil)
	})
	if err != nil {
		return false, err
	}
	return quarantined, nil
}

func ClaimAcceptedAccountingLease(taskID string, owner string, now int64, leaseExpiresAt int64) (bool, error) {
	result := DB.Model(&Task{}).
		Where("task_id = ? AND status = ?", taskID, TaskStatusSubmitted).
		Where("((accepted_accounting_status IN ?) OR (accepted_accounting_status = ? AND accepted_accounting_lease_expires_at <= ?) OR (accepted_accounting_status = ? AND accepted_accounting_lease_owner = ?))",
			[]string{TaskAcceptedAccountingPending, TaskAcceptedAccountingFailedRetryable},
			TaskAcceptedAccountingProcessing, now,
			TaskAcceptedAccountingProcessing, owner).
		Updates(map[string]any{
			"accepted_accounting_status":           TaskAcceptedAccountingProcessing,
			"accepted_accounting_lease_owner":      owner,
			"accepted_accounting_lease_expires_at": leaseExpiresAt,
			"accepted_accounting_attempt_count":    gorm.Expr("accepted_accounting_attempt_count + ?", 1),
			"accepted_accounting_fail_reason":      "",
			"updated_at":                           now,
		})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func MarkAcceptedAccountingDone(taskID string, owner string, expectedLeaseExpiresAt int64, now int64) (bool, error) {
	result := DB.Model(&Task{}).
		Where("task_id = ? AND status = ?", taskID, TaskStatusSubmitted).
		Where("accepted_accounting_status = ? AND accepted_accounting_lease_owner = ? AND accepted_accounting_lease_expires_at = ? AND accepted_accounting_lease_expires_at > ?",
			TaskAcceptedAccountingProcessing, owner, expectedLeaseExpiresAt, now).
		Updates(map[string]any{
			"accepted_accounting_status":           TaskAcceptedAccountingDone,
			"accepted_accounting_lease_owner":      "",
			"accepted_accounting_lease_expires_at": 0,
			"accepted_accounting_done_at":          now,
			"accepted_accounting_fail_reason":      "",
			"quota":                                gorm.Expr("accepted_accounting_actual_quota"),
			"updated_at":                           now,
		})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func MarkAcceptedAccountingRetryable(taskID string, owner string, expectedLeaseExpiresAt int64, reason string, now int64) (bool, error) {
	result := DB.Model(&Task{}).
		Where("task_id = ? AND status = ?", taskID, TaskStatusSubmitted).
		Where("accepted_accounting_status = ? AND accepted_accounting_lease_owner = ? AND accepted_accounting_lease_expires_at = ? AND accepted_accounting_lease_expires_at > ?",
			TaskAcceptedAccountingProcessing, owner, expectedLeaseExpiresAt, now).
		Updates(map[string]any{
			"accepted_accounting_status":           TaskAcceptedAccountingFailedRetryable,
			"accepted_accounting_lease_owner":      "",
			"accepted_accounting_lease_expires_at": 0,
			"accepted_accounting_fail_reason":      reason,
			"updated_at":                           now,
		})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

func extendAcceptedAssetRetentionTx(tx *gorm.DB, userID int, publicIDs []string, lastUsedAt int64, retentionUntil int64) error {
	if len(publicIDs) == 0 {
		return nil
	}
	unique := make([]string, 0, len(publicIDs))
	seen := make(map[string]struct{}, len(publicIDs))
	for _, id := range publicIDs {
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		unique = append(unique, id)
	}
	if len(unique) == 0 {
		return nil
	}
	return tx.Model(&Asset{}).
		Where("user_id = ? AND public_id IN ?", userID, unique).
		Updates(map[string]any{
			"last_used_at":      gorm.Expr("CASE WHEN last_used_at < ? THEN ? ELSE last_used_at END", lastUsedAt, lastUsedAt),
			"source_expires_at": gorm.Expr("CASE WHEN source_expires_at < ? THEN ? ELSE source_expires_at END", retentionUntil, retentionUntil),
			"updated_at":        lastUsedAt,
		}).Error
}

func MarkQueuedTaskFailed(taskID string, owner string, expectedLeaseExpiresAt int64, failReason string, now int64) (bool, error) {
	result := DB.Model(&Task{}).
		Where("task_id = ? AND status = ?", taskID, TaskStatusQueued).
		Where("preparation_lease_owner = ? AND preparation_lease_expires_at = ? AND preparation_lease_expires_at > ?", owner, expectedLeaseExpiresAt, now).
		Updates(map[string]any{
			"status":                       TaskStatusFailure,
			"preparation_status":           TaskPreparationStatusFailed,
			"preparation_lease_owner":      "",
			"preparation_lease_expires_at": 0,
			"fail_reason":                  failReason,
			"finish_time":                  now,
			"updated_at":                   now,
		})
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected == 1, nil
}

// TaskBulkUpdate performs an unconditional bulk UPDATE by upstream task_id strings.
// Same caveats as TaskBulkUpdateByID — no CAS guard.
func TaskBulkUpdate(taskIds []string, params map[string]any) error {
	if len(taskIds) == 0 {
		return nil
	}
	return DB.Model(&Task{}).
		Where("task_id in (?)", taskIds).
		Updates(params).Error
}

// TaskBulkUpdateByID performs an unconditional bulk UPDATE by primary key IDs.
// WARNING: This function has NO CAS (Compare-And-Swap) guard — it will overwrite
// any concurrent status changes. DO NOT use in billing/quota lifecycle flows
// (e.g., timeout, success, failure transitions that trigger refunds or settlements).
// For status transitions that involve billing, use Task.UpdateWithStatus() instead.
func TaskBulkUpdateByID(ids []int64, params map[string]any) error {
	if len(ids) == 0 {
		return nil
	}
	return DB.Model(&Task{}).
		Where("id in (?)", ids).
		Updates(params).Error
}

type TaskQuotaUsage struct {
	Mode  string  `json:"mode"`
	Count float64 `json:"count"`
}

// TaskCountAllTasks returns total tasks that match the given query params (admin usage)
func TaskCountAllTasks(queryParams SyncTaskQueryParams) int64 {
	var total int64
	query := DB.Model(&Task{})
	if queryParams.ChannelID != "" {
		query = query.Where("channel_id = ?", queryParams.ChannelID)
	}
	if queryParams.Platform != "" {
		query = query.Where("platform = ?", queryParams.Platform)
	}
	if queryParams.UserID != "" {
		query = query.Where("user_id = ?", queryParams.UserID)
	}
	if len(queryParams.UserIDs) != 0 {
		query = query.Where("user_id in (?)", queryParams.UserIDs)
	}
	if queryParams.TaskID != "" {
		query = query.Where("task_id = ?", queryParams.TaskID)
	}
	if queryParams.Action != "" {
		query = query.Where("action = ?", queryParams.Action)
	}
	if queryParams.Status != "" {
		query = query.Where("status = ?", queryParams.Status)
	}
	if queryParams.StartTimestamp != 0 {
		query = query.Where("submit_time >= ?", queryParams.StartTimestamp)
	}
	if queryParams.EndTimestamp != 0 {
		query = query.Where("submit_time <= ?", queryParams.EndTimestamp)
	}
	_ = query.Count(&total).Error
	return total
}

// TaskCountAllUserTask returns total tasks for given user
func TaskCountAllUserTask(userId int, queryParams SyncTaskQueryParams) int64 {
	var total int64
	query := DB.Model(&Task{}).Where("user_id = ?", userId)
	if queryParams.TaskID != "" {
		query = query.Where("task_id = ?", queryParams.TaskID)
	}
	if queryParams.Action != "" {
		query = query.Where("action = ?", queryParams.Action)
	}
	if queryParams.Status != "" {
		query = query.Where("status = ?", queryParams.Status)
	}
	if queryParams.Platform != "" {
		query = query.Where("platform = ?", queryParams.Platform)
	}
	if queryParams.StartTimestamp != 0 {
		query = query.Where("submit_time >= ?", queryParams.StartTimestamp)
	}
	if queryParams.EndTimestamp != 0 {
		query = query.Where("submit_time <= ?", queryParams.EndTimestamp)
	}
	_ = query.Count(&total).Error
	return total
}
func (t *Task) ToOpenAIVideo() *dto.OpenAIVideo {
	openAIVideo := dto.NewOpenAIVideo()
	openAIVideo.ID = t.TaskID
	openAIVideo.Status = t.Status.ToVideoStatus()
	openAIVideo.Model = t.Properties.OriginModelName
	openAIVideo.SetProgressStr(t.Progress)
	openAIVideo.CreatedAt = t.CreatedAt
	openAIVideo.CompletedAt = t.UpdatedAt
	openAIVideo.SetMetadata("url", t.GetResultURL())
	return openAIVideo
}
