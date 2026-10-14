package model

import (
	"bytes"
	"context"
	"database/sql/driver"
	"encoding/json"
	"math"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	commonRelay "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"gorm.io/gorm"
)

type TaskStatus string

type TaskDispatchStatus string

func (t TaskStatus) ToVideoStatus() string {
	var status string
	switch t {
	case TaskStatusNotStart, TaskStatusQueued, TaskStatusSubmitted:
		status = dto.VideoStatusQueued
	case TaskStatusInProgress:
		status = dto.VideoStatusInProgress
	case TaskStatusSuccess:
		status = dto.VideoStatusCompleted
	case TaskStatusFailure:
		status = dto.VideoStatusFailed
	case TaskStatusCancelled:
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
	TaskStatusCancelled             = "CANCELLED"
	TaskStatusUnknown               = "UNKNOWN"
)

const (
	TaskExecutionModeDeferred   = "deferred"
	TaskExecutionModeAppManaged = "app_managed"

	TaskDispatchStatusPending    TaskDispatchStatus = "pending_v1"
	TaskDispatchStatusRunning    TaskDispatchStatus = "running_v1"
	TaskDispatchStatusUncertain  TaskDispatchStatus = "uncertain"
	TaskDispatchStatusDispatched TaskDispatchStatus = "dispatched"
	TaskDispatchStatusFailed     TaskDispatchStatus = "failed"

	taskDispatchStatusLegacyPending TaskDispatchStatus = "pending"
	taskDispatchStatusLegacyRunning TaskDispatchStatus = "running"

	// CurrentTaskDispatchProtocolVersion identifies claims protected by the
	// durable provider-I/O fence.
	CurrentTaskDispatchProtocolVersion = 1
)

// TaskRefundLegacyCutoff separates tasks created before timeout refunds were
// introduced. Those legacy tasks are failed without an automatic refund.
const TaskRefundLegacyCutoff int64 = 1771718400 // 2026-02-22 00:00:00 UTC

type Task struct {
	ID         int64                 `json:"id" gorm:"primary_key;AUTO_INCREMENT"`
	CreatedAt  int64                 `json:"created_at" gorm:"index"`
	UpdatedAt  int64                 `json:"updated_at"`
	TaskID     string                `json:"task_id" gorm:"type:varchar(191);index"` // 第三方id，不一定有/ song id\ Task id
	Platform   constant.TaskPlatform `json:"platform" gorm:"type:varchar(30);index"` // 平台
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
	// Deferred task dispatch is an outbox owned by the gateway. These fields
	// stay private while remaining queryable for cross-process claiming.
	ExecutionMode     string             `json:"-" gorm:"type:varchar(20);index"`
	DispatchStatus    TaskDispatchStatus `json:"-" gorm:"type:varchar(20);index"`
	DispatchOwner     string             `json:"-" gorm:"type:varchar(128)"`
	DispatchLockUntil int64              `json:"-" gorm:"index"`
	DispatchStartedAt int64              `json:"-"`
	DispatchAttempts  int                `json:"-"`
	DispatchError     string             `json:"-" gorm:"type:text"`
	// Version zero predates the durable provider-I/O fence. Its running leases
	// cannot be replayed safely after expiry because provider acceptance is unknown.
	DispatchProtocolVersion int        `json:"-" gorm:"not null;default:0"`
	Properties              Properties `json:"properties" gorm:"type:json"`
	Username                string     `json:"username,omitempty" gorm:"-"`
	// 禁止返回给用户，内部可能包含key等隐私信息
	PrivateData TaskPrivateData `json:"-" gorm:"column:private_data;type:json"`
	Data        json.RawMessage `json:"data" gorm:"type:json"`
}

func (t *Task) IsAppManaged() bool {
	return t != nil && t.ExecutionMode == TaskExecutionModeAppManaged
}

func (t *Task) RequiresOperatorResolution() bool {
	return t.RequiresOperatorResolutionAt(common.GetTimestamp())
}

// RequiresOperatorResolutionAt reports whether automatic dispatch cannot
// safely determine the provider outcome at the supplied time.
func (t *Task) RequiresOperatorResolutionAt(now int64) bool {
	if t == nil || t.ExecutionMode != TaskExecutionModeDeferred {
		return false
	}
	if t.DispatchStatus == TaskDispatchStatusUncertain {
		return true
	}
	return t.DispatchStatus == taskDispatchStatusLegacyRunning &&
		t.DispatchProtocolVersion == 0 &&
		(t.DispatchLockUntil == math.MaxInt64 || t.DispatchLockUntil < now)
}

func (t *Task) EffectiveDispatchStartedAt() int64 {
	return t.EffectiveDispatchStartedAtAt(common.GetTimestamp())
}

func (t *Task) EffectiveDispatchStartedAtAt(now int64) int64 {
	if t == nil {
		return 0
	}
	if t.DispatchStartedAt != 0 {
		return t.DispatchStartedAt
	}
	if t.RequiresOperatorResolutionAt(now) {
		return t.SubmitTime
	}
	return 0
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

func (m *Properties) Scan(val any) error {
	bytesValue := jsonScanBytes(val)
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
	// 必须返回 string 而非 []byte:PG simple protocol 下 []byte 按 bytea 编码,
	// 写 json 列会触发 SQLSTATE 22P02。
	b, err := common.Marshal(m)
	if err != nil {
		return nil, err
	}
	return string(b), nil
}

type TaskPrivateData struct {
	Key            string `json:"key,omitempty"`
	UpstreamTaskID string `json:"upstream_task_id,omitempty"` // 上游真实 task ID
	ResultURL      string `json:"result_url,omitempty"`       // 任务成功后的结果 URL（视频地址等）
	// Execution records safe, immutable request provenance. It lives next to
	// other private task state so public task DTOs cannot expose it by accident.
	Execution *TaskExecutionSnapshot `json:"execution,omitempty"`
	// 计费上下文：用于异步退款/差额结算（轮询阶段读取）
	BillingSource  string              `json:"billing_source,omitempty"`  // "wallet" 或 "subscription"
	SubscriptionId int                 `json:"subscription_id,omitempty"` // 订阅 ID，用于订阅退款
	TokenId        int                 `json:"token_id,omitempty"`        // 令牌 ID，用于令牌额度退款
	NodeName       string              `json:"node_name,omitempty"`       // 发起任务的节点名，轮询结算阶段据此归属日志而非最后查询节点
	BillingContext *TaskBillingContext `json:"billing_context,omitempty"` // 计费参数快照（用于轮询阶段重新计算）
	// ResponsesBackground records that the openai_responses create request
	// asked for background:true. Every task is durable and survives client
	// disconnect regardless; this only echoes the protocol-level request
	// attribute back on retrieval snapshots.
	ResponsesBackground bool                 `json:"responses_background,omitempty"`
	DeferredRequest     *TaskDeferredRequest `json:"deferred_request,omitempty"`
	// PluginState is plugin-owned cross-round data. Unlike Task.Data it is
	// only replaced when a hook explicitly returns state.
	PluginState json.RawMessage `json:"plugin_state,omitempty"`
	// Host-observed credentialless artifact descriptors. PrivateData is never
	// serialized by public Task APIs; reads use the existing safe content proxy.
	AppArtifactURLs map[string]string `json:"app_artifact_urls,omitempty"`
	// PollFailures counts consecutive unrecognized or transient poll outcomes.
	PollFailures int `json:"poll_failures,omitempty"`
	// ResultDiscarded marks an immediate terminal result whose submit route
	// declared retainResult: false. The upstream snapshot was never written
	// and every retrieval surface treats the task as not found. The zero
	// value keeps historical rows retained and retrievable.
	ResultDiscarded bool `json:"result_discarded,omitempty"`
}

// TaskDeferredRequest is a credential-free snapshot of the normalized plugin
// request. Channel credentials are resolved again when a worker claims it.
type TaskDeferredRequest struct {
	Path         string                      `json:"path"`
	Method       string                      `json:"method"`
	Params       map[string]string           `json:"params,omitempty"`
	Query        map[string][]string         `json:"query,omitempty"`
	Headers      map[string]string           `json:"headers,omitempty"`
	RouteBody    json.RawMessage             `json:"route_body,omitempty"`
	RequestBody  json.RawMessage             `json:"request_body"`
	OriginTaskID string                      `json:"origin_task_id,omitempty"`
	OriginTasks  []commonRelay.OriginTaskRef `json:"origin_tasks,omitempty"`
}

type TaskExecutionSnapshot struct {
	RequestID   string              `json:"request_id,omitempty"`
	RequestPath string              `json:"request_path,omitempty"`
	TaskPlugin  *TaskPluginSnapshot `json:"task_plugin,omitempty"`
}

// TaskPluginSnapshot contains credential-free identity only. Plugin source,
// request/response payloads, and channel secrets must never be added here.
type TaskPluginSnapshot struct {
	Key        string                    `json:"key"`
	Name       string                    `json:"name"`
	Version    string                    `json:"version"`
	Author     *TaskPluginAuthorSnapshot `json:"author,omitempty"`
	APIVersion int                       `json:"api_version"`
	Generation uint64                    `json:"generation"`
}

type TaskPluginAuthorSnapshot struct {
	Name string `json:"name"`
	URL  string `json:"url,omitempty"`
}

// TaskBillingContext 记录任务提交时的计费参数，以便轮询阶段可以重新计算额度。
type TaskBillingContext struct {
	ModelPrice      float64                      `json:"model_price,omitempty"`       // 模型单价
	GroupRatio      float64                      `json:"group_ratio,omitempty"`       // 分组倍率
	ModelRatio      float64                      `json:"model_ratio,omitempty"`       // 模型倍率
	OtherRatios     map[string]float64           `json:"other_ratios,omitempty"`      // 附加倍率（时长、分辨率等）
	OriginModelName string                       `json:"origin_model_name,omitempty"` // 模型名称，必须为OriginModelName
	PerCallBilling  bool                         `json:"per_call_billing,omitempty"`  // 按次计费：跳过轮询阶段的差额结算
	TieredSnapshot  *billingexpr.BillingSnapshot `json:"tiered_snapshot,omitempty"`
}

// ResultRetrievable reports whether retrieval surfaces (native query routes,
// protocol retrieve endpoints, artifact projection) may serve this task.
func (t *Task) ResultRetrievable() bool {
	return !t.PrivateData.ResultDiscarded
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

// GenerateTaskID 生成对外暴露的 task_xxxx 格式 ID
func GenerateTaskID() string {
	key, _ := common.GenerateRandomCharsKey(32)
	return "task_" + key
}

func (p *TaskPrivateData) Scan(val any) error {
	bytesValue := jsonScanBytes(val)
	if len(bytesValue) == 0 {
		return nil
	}
	return common.Unmarshal(bytesValue, p)
}

func (p TaskPrivateData) Value() (driver.Value, error) {
	if p.Key == "" && p.UpstreamTaskID == "" && p.ResultURL == "" &&
		p.Execution == nil && p.BillingSource == "" && p.SubscriptionId == 0 &&
		p.TokenId == 0 && p.NodeName == "" && p.BillingContext == nil &&
		!p.ResponsesBackground && p.DeferredRequest == nil &&
		len(p.PluginState) == 0 && len(p.AppArtifactURLs) == 0 &&
		p.PollFailures == 0 && !p.ResultDiscarded {
		return nil, nil
	}
	// 同 Properties.Value:string 避免 PG simple protocol 的 bytea 编码。
	b, err := common.Marshal(p)
	if err != nil {
		return nil, err
	}
	return string(b), nil
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
	DispatchStatus string
}

func InitTask(platform constant.TaskPlatform, relayInfo *commonRelay.RelayInfo) *Task {
	properties := Properties{}
	privateData := TaskPrivateData{}
	if relayInfo != nil && relayInfo.ChannelMeta != nil {
		// A New API channel may rotate between several gateway tokens, so the
		// task keeps the key that submitted it and polls with the same identity.
		if relayInfo.ChannelMeta.ChannelType == constant.ChannelTypeGemini ||
			relayInfo.ChannelMeta.ChannelType == constant.ChannelTypeVertexAi ||
			relayInfo.ChannelMeta.ChannelType == constant.ChannelTypeNewAPI {
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
		TaskID:      taskID,
		UserId:      relayInfo.UserId,
		Group:       relayInfo.UsingGroup,
		SubmitTime:  time.Now().Unix(),
		Status:      TaskStatusNotStart,
		Progress:    "0%",
		ChannelId:   relayInfo.ChannelId,
		Platform:    platform,
		Properties:  properties,
		PrivateData: privateData,
	}
	return t
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
	// Task lists never render the persisted upstream snapshot; the dashboard
	// loads media through the artifacts endpoint instead.
	err = query.Omit("channel_id", "data").Order("id desc").Limit(num).Offset(startIdx).Find(&tasks).Error
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
	query = applyTaskDispatchStatusFilter(query, queryParams.DispatchStatus)
	if queryParams.StartTimestamp != 0 {
		query = query.Where("submit_time >= ?", queryParams.StartTimestamp)
	}
	if queryParams.EndTimestamp != 0 {
		query = query.Where("submit_time <= ?", queryParams.EndTimestamp)
	}

	// 获取数据
	err = query.Omit("data").Order("id desc").Limit(num).Offset(startIdx).Find(&tasks).Error
	if err != nil {
		return nil
	}

	return tasks
}

func GetTimedOutUnfinishedTasks(cutoffUnix int64, limit int) []*Task {
	var tasks []*Task
	err := taskTimeoutEligibilityQuery(DB, cutoffUnix).
		Order("submit_time").
		Limit(limit).
		Find(&tasks).Error
	if err != nil {
		return nil
	}
	return tasks
}

func taskTimeoutEligibilityQuery(query *gorm.DB, cutoffUnix int64) *gorm.DB {
	return query.Where("progress != ?", "100%").
		Where("(execution_mode IS NULL OR execution_mode <> ?)", TaskExecutionModeAppManaged).
		Where("status NOT IN ?", []string{TaskStatusFailure, TaskStatusSuccess, TaskStatusCancelled}).
		Where("(execution_mode IS NULL OR execution_mode <> ? OR dispatch_status = ?)",
			TaskExecutionModeDeferred, TaskDispatchStatusDispatched).
		Where(`(
			execution_mode = ? AND dispatch_status = ? AND
			CASE WHEN start_time > 0 THEN start_time ELSE submit_time END < ?
		) OR (
			(execution_mode IS NULL OR execution_mode <> ?) AND submit_time < ?
		)`,
			TaskExecutionModeDeferred, TaskDispatchStatusDispatched, cutoffUnix,
			TaskExecutionModeDeferred, cutoffUnix)
}

func GetAllUnFinishSyncTasks(limit int) []*Task {
	var tasks []*Task
	var err error
	// get all tasks progress is not 100%
	err = DB.Where("progress != ?", "100%").
		Where("(execution_mode IS NULL OR execution_mode <> ?)", TaskExecutionModeAppManaged).
		Where("status NOT IN ?", []string{TaskStatusFailure, TaskStatusSuccess, TaskStatusCancelled}).
		Where("(execution_mode IS NULL OR execution_mode <> ? OR dispatch_status = ?)",
			TaskExecutionModeDeferred, TaskDispatchStatusDispatched).
		Limit(limit).Order("id").Find(&tasks).Error
	if err != nil {
		return nil
	}
	return tasks
}

// HasUnfinishedSyncTasks reports whether at least one async (Suno/video) task is
// still in progress. It is a cheap existence check (LIMIT 1) used to decide
// whether the async_task_poll system task needs to run; when no task is pending
// the scheduler skips creating a row entirely.
func HasUnfinishedSyncTasks() bool {
	var id int64
	err := DB.Model(&Task{}).
		Where("progress != ?", "100%").
		Where("(execution_mode IS NULL OR execution_mode <> ?)", TaskExecutionModeAppManaged).
		Where("status NOT IN ?", []string{TaskStatusFailure, TaskStatusSuccess, TaskStatusCancelled}).
		Where("(execution_mode IS NULL OR execution_mode <> ? OR dispatch_status = ?)",
			TaskExecutionModeDeferred, TaskDispatchStatusDispatched).
		Limit(1).
		Pluck("id", &id).Error
	return err == nil && id != 0
}

// HasDispatchableDeferredTasks reports whether a pending task, or a task whose
// worker lease expired, is available for deferred upstream submission.
func HasDispatchableDeferredTasks(now int64) bool {
	var id int64
	err := deferredTaskDispatchQuery(now).
		Model(&Task{}).
		Limit(1).
		Pluck("id", &id).Error
	return err == nil && id != 0
}

func FindDispatchableDeferredTasks(now int64, limit int) ([]*Task, error) {
	if limit <= 0 {
		limit = 1
	}
	var tasks []*Task
	err := deferredTaskDispatchQuery(now).
		Order("id").
		Limit(limit).
		Find(&tasks).Error
	return tasks, err
}

func CountUncertainDeferredTasks() (int64, error) {
	return CountUncertainDeferredTasksAt(common.GetTimestamp())
}

// CountUncertainDeferredTasksAt counts explicit uncertainty and expired
// pre-versioning leases that require operator resolution.
func CountUncertainDeferredTasksAt(now int64) (int64, error) {
	var count int64
	err := deferredTaskOperatorResolutionQuery(DB.Model(&Task{}), now).Count(&count).Error
	return count, err
}

func applyTaskDispatchStatusFilter(query *gorm.DB, dispatchStatus string) *gorm.DB {
	return applyTaskDispatchStatusFilterAt(query, dispatchStatus, common.GetTimestamp())
}

func applyTaskDispatchStatusFilterAt(query *gorm.DB, dispatchStatus string, now int64) *gorm.DB {
	if dispatchStatus == "" {
		return query
	}
	if dispatchStatus == string(TaskDispatchStatusUncertain) {
		return deferredTaskOperatorResolutionQuery(query, now)
	}
	if dispatchStatus == string(TaskDispatchStatusPending) ||
		dispatchStatus == string(taskDispatchStatusLegacyPending) {
		return query.Where(
			"dispatch_status IN ?",
			[]TaskDispatchStatus{
				TaskDispatchStatusPending,
				taskDispatchStatusLegacyPending,
			},
		)
	}
	return query.Where("dispatch_status = ?", dispatchStatus)
}

func deferredTaskOperatorResolutionQuery(query *gorm.DB, now int64) *gorm.DB {
	return query.Where(
		`execution_mode = ? AND (
			dispatch_status = ? OR (
				dispatch_status = ? AND dispatch_protocol_version = ? AND
				(dispatch_lock_until = ? OR dispatch_lock_until < ?)
			)
		)`,
		TaskExecutionModeDeferred,
		TaskDispatchStatusUncertain,
		taskDispatchStatusLegacyRunning,
		0,
		int64(math.MaxInt64),
		now,
	)
}

func deferredTaskDispatchQuery(now int64) *gorm.DB {
	return DB.Where("execution_mode = ?", TaskExecutionModeDeferred).
		Where("status NOT IN ?", []TaskStatus{TaskStatusFailure, TaskStatusSuccess, TaskStatusCancelled}).
		Where(
			`dispatch_status IN ? OR (
				dispatch_status = ? AND dispatch_protocol_version = ? AND dispatch_lock_until < ?
			)`,
			[]TaskDispatchStatus{
				TaskDispatchStatusPending,
				taskDispatchStatusLegacyPending,
			},
			TaskDispatchStatusRunning,
			CurrentTaskDispatchProtocolVersion,
			now,
		)
}

// ClaimDeferredTask atomically acquires or recovers one deferred task lease.
func ClaimDeferredTask(id int64, owner string, now, lockUntil int64) (*Task, bool, error) {
	if id <= 0 || owner == "" || lockUntil <= now {
		return nil, false, nil
	}
	result := DB.Model(&Task{}).
		Where("id = ? AND execution_mode = ?", id, TaskExecutionModeDeferred).
		Where("status NOT IN ?", []TaskStatus{TaskStatusFailure, TaskStatusSuccess, TaskStatusCancelled}).
		Where(
			`dispatch_status IN ? OR (
				dispatch_status = ? AND dispatch_protocol_version = ? AND dispatch_lock_until < ?
			)`,
			[]TaskDispatchStatus{
				TaskDispatchStatusPending,
				taskDispatchStatusLegacyPending,
			},
			TaskDispatchStatusRunning,
			CurrentTaskDispatchProtocolVersion,
			now,
		).
		Updates(map[string]any{
			"dispatch_status":           TaskDispatchStatusRunning,
			"dispatch_owner":            owner,
			"dispatch_lock_until":       lockUntil,
			"dispatch_attempts":         gorm.Expr("dispatch_attempts + ?", 1),
			"dispatch_error":            "",
			"dispatch_protocol_version": CurrentTaskDispatchProtocolVersion,
		})
	if result.Error != nil || result.RowsAffected == 0 {
		return nil, false, result.Error
	}
	var task Task
	if err := DB.Where("id = ? AND dispatch_owner = ?", id, owner).First(&task).Error; err != nil {
		return nil, false, err
	}
	return &task, true, nil
}

// FenceDeferredTaskProviderSubmit makes provider I/O explicit and durable.
// The uncertain status is not claimable, pollable, or eligible for timeout.
func FenceDeferredTaskProviderSubmit(task *Task, owner string, startedAt int64) (bool, error) {
	if task == nil || owner == "" || startedAt <= 0 {
		return false, nil
	}
	const reason = "provider submission started; acceptance is not yet known"
	result := DB.Model(&Task{}).
		Where("id = ? AND dispatch_status = ? AND dispatch_owner = ?",
			task.ID, TaskDispatchStatusRunning, owner).
		Updates(map[string]any{
			"dispatch_status":     TaskDispatchStatusUncertain,
			"dispatch_started_at": startedAt,
			"dispatch_lock_until": 0,
			"dispatch_error":      reason,
		})
	if result.Error == nil && result.RowsAffected > 0 {
		task.DispatchStatus = TaskDispatchStatusUncertain
		task.DispatchStartedAt = startedAt
		task.DispatchLockUntil = 0
		task.DispatchError = reason
	}
	return result.RowsAffected > 0, result.Error
}

func RequeueDeferredTask(task *Task, owner, reason string) (bool, error) {
	if task == nil {
		return false, nil
	}
	result := DB.Model(&Task{}).
		Where("id = ? AND dispatch_status = ? AND dispatch_owner = ?",
			task.ID, TaskDispatchStatusRunning, owner).
		Updates(map[string]any{
			"dispatch_status":     TaskDispatchStatusPending,
			"dispatch_owner":      "",
			"dispatch_lock_until": 0,
			"dispatch_error":      reason,
		})
	return result.RowsAffected > 0, result.Error
}

func RequeueDeferredTaskBeforeProviderIO(task *Task, owner, reason string) (bool, error) {
	if task == nil {
		return false, nil
	}
	result := DB.Model(&Task{}).
		Where("id = ? AND dispatch_status = ? AND dispatch_owner = ?",
			task.ID, TaskDispatchStatusUncertain, owner).
		Updates(map[string]any{
			"dispatch_status":     TaskDispatchStatusPending,
			"dispatch_owner":      "",
			"dispatch_lock_until": 0,
			"dispatch_started_at": 0,
			"dispatch_error":      reason,
		})
	if result.Error == nil && result.RowsAffected > 0 {
		task.DispatchStatus = TaskDispatchStatusPending
		task.DispatchOwner = ""
		task.DispatchLockUntil = 0
		task.DispatchStartedAt = 0
		task.DispatchError = reason
	}
	return result.RowsAffected > 0, result.Error
}

func RecordDeferredTaskUncertainty(task *Task, owner, reason string) (bool, error) {
	if task == nil {
		return false, nil
	}
	result := DB.Model(&Task{}).
		Where("id = ? AND dispatch_status = ? AND dispatch_owner = ?",
			task.ID, TaskDispatchStatusUncertain, owner).
		Update("dispatch_error", reason)
	if result.Error == nil && result.RowsAffected > 0 {
		task.DispatchError = reason
	}
	return result.RowsAffected > 0, result.Error
}

// CompleteDeferredTask stores the accepted upstream task result under the
// dispatch lease. Clearing DeferredRequest minimizes retained user input.
func CompleteDeferredTask(task *Task, owner string) (bool, error) {
	if task == nil {
		return false, nil
	}
	result := DB.Model(&Task{}).
		Where("id = ? AND dispatch_status = ? AND dispatch_owner = ?",
			task.ID, TaskDispatchStatusUncertain, owner).
		Updates(map[string]any{
			"status":              task.Status,
			"progress":            task.Progress,
			"start_time":          task.StartTime,
			"finish_time":         task.FinishTime,
			"fail_reason":         task.FailReason,
			"private_data":        task.PrivateData,
			"data":                task.Data,
			"dispatch_status":     TaskDispatchStatusDispatched,
			"dispatch_owner":      "",
			"dispatch_lock_until": 0,
			"dispatch_error":      "",
		})
	return result.RowsAffected > 0, result.Error
}

func FailDeferredTask(task *Task, owner, reason string, now int64) (bool, error) {
	return failDeferredTaskFromStatus(task, owner, reason, now, TaskDispatchStatusUncertain)
}

func FailDeferredTaskBeforeProviderIO(task *Task, owner, reason string, now int64) (bool, error) {
	return failDeferredTaskFromStatus(task, owner, reason, now, TaskDispatchStatusRunning)
}

func failDeferredTaskFromStatus(
	task *Task,
	owner, reason string,
	now int64,
	fromStatus TaskDispatchStatus,
) (bool, error) {
	if task == nil {
		return false, nil
	}
	task.Status = TaskStatusFailure
	task.Progress = "100%"
	task.FailReason = reason
	task.FinishTime = now
	task.PrivateData.DeferredRequest = nil
	result := DB.Model(&Task{}).
		Where("id = ? AND dispatch_status = ? AND dispatch_owner = ?",
			task.ID, fromStatus, owner).
		Updates(map[string]any{
			"status":              task.Status,
			"progress":            task.Progress,
			"finish_time":         task.FinishTime,
			"fail_reason":         task.FailReason,
			"private_data":        task.PrivateData,
			"dispatch_status":     TaskDispatchStatusFailed,
			"dispatch_owner":      "",
			"dispatch_lock_until": 0,
			"dispatch_error":      reason,
		})
	return result.RowsAffected > 0, result.Error
}

func ResolveDeferredTask(
	task *Task,
	providerAccepted bool,
	upstreamTaskID, reason string,
	now int64,
) (bool, error) {
	if task == nil || !task.RequiresOperatorResolutionAt(now) {
		return false, nil
	}
	privateData := task.PrivateData
	privateData.DeferredRequest = nil
	updates := map[string]any{
		"private_data":        privateData,
		"dispatch_owner":      "",
		"dispatch_lock_until": 0,
		"dispatch_error":      reason,
	}
	if providerAccepted {
		privateData.UpstreamTaskID = upstreamTaskID
		updates["private_data"] = privateData
		updates["status"] = TaskStatusSubmitted
		updates["progress"] = "10%"
		updates["dispatch_status"] = TaskDispatchStatusDispatched
		if task.StartTime == 0 {
			updates["start_time"] = now
		}
	} else {
		updates["status"] = TaskStatusFailure
		updates["progress"] = "100%"
		updates["finish_time"] = now
		updates["fail_reason"] = reason
		updates["dispatch_status"] = TaskDispatchStatusFailed
	}
	result := deferredTaskOperatorResolutionQuery(
		DB.Model(&Task{}).Where("id = ?", task.ID),
		now,
	).
		Updates(updates)
	if result.Error != nil || result.RowsAffected == 0 {
		return false, result.Error
	}
	task.PrivateData = privateData
	task.DispatchOwner = ""
	task.DispatchLockUntil = 0
	task.DispatchError = reason
	if providerAccepted {
		task.Status = TaskStatusSubmitted
		task.Progress = "10%"
		task.DispatchStatus = TaskDispatchStatusDispatched
		if task.StartTime == 0 {
			task.StartTime = now
		}
	} else {
		task.Status = TaskStatusFailure
		task.Progress = "100%"
		task.FinishTime = now
		task.FailReason = reason
		task.DispatchStatus = TaskDispatchStatusFailed
	}
	return true, nil
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

// GetUniqueByOnlyTaskId resolves a public task identifier only when exactly one
// row owns it. Historical task identifiers were not globally unique, so
// capability-based reads must fail closed instead of selecting an arbitrary
// tenant's row.
func GetUniqueByOnlyTaskId(taskId string) (*Task, bool, error) {
	if taskId == "" {
		return nil, false, nil
	}
	var tasks []*Task
	if err := DB.Where("task_id = ?", taskId).Order("id").Limit(2).Find(&tasks).Error; err != nil {
		return nil, false, err
	}
	if len(tasks) != 1 {
		return nil, false, nil
	}
	return tasks[0], true, nil
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

func GetByTaskIdsForPlatforms(userID int, platforms []constant.TaskPlatform, taskIDs []string) ([]*Task, error) {
	if len(platforms) == 0 || len(taskIDs) == 0 {
		return nil, nil
	}
	var tasks []*Task
	err := DB.
		Where("user_id = ? AND platform IN ? AND task_id IN ?", userID, platforms, taskIDs).
		Find(&tasks).Error
	if err != nil {
		return nil, err
	}
	return tasks, nil
}

// GetTaskForProtocolObservation reloads one public task through the ownership
// boundary used by long-lived plugin protocol observers. A missing task,
// foreign user, and wrong plugin platform are deliberately indistinguishable.
func GetTaskForProtocolObservation(ctx context.Context, userID int, platform constant.TaskPlatform, taskID string) (*Task, bool, error) {
	if taskID == "" {
		return nil, false, nil
	}
	var task Task
	err := DB.WithContext(ctx).
		Where("user_id = ? AND platform = ? AND task_id = ?", userID, platform, taskID).
		First(&task).Error
	exists, err := RecordExist(err)
	if err != nil || !exists {
		return nil, exists, err
	}
	return &task, true, nil
}

func (Task *Task) Insert() error {
	return Task.InsertWithContext(context.Background())
}

// InsertWithContext creates the row. omitColumns are left out of the INSERT
// (for example "data" when the submit route discards the upstream snapshot)
// while the in-memory task keeps its values for presentation.
func (Task *Task) InsertWithContext(ctx context.Context, omitColumns ...string) error {
	tx := DB.WithContext(ctx)
	if len(omitColumns) > 0 {
		tx = tx.Omit(omitColumns...)
	}
	return tx.Create(Task).Error
}

type taskSnapshot struct {
	Status       TaskStatus
	Progress     string
	StartTime    int64
	FinishTime   int64
	FailReason   string
	ResultURL    string
	Data         json.RawMessage
	PluginState  json.RawMessage
	PollFailures int
}

func (s taskSnapshot) Equal(other taskSnapshot) bool {
	return s.Status == other.Status &&
		s.Progress == other.Progress &&
		s.StartTime == other.StartTime &&
		s.FinishTime == other.FinishTime &&
		s.FailReason == other.FailReason &&
		s.ResultURL == other.ResultURL &&
		bytes.Equal(s.Data, other.Data) &&
		bytes.Equal(s.PluginState, other.PluginState) &&
		s.PollFailures == other.PollFailures
}

func (t *Task) Snapshot() taskSnapshot {
	return taskSnapshot{
		Status:       t.Status,
		Progress:     t.Progress,
		StartTime:    t.StartTime,
		FinishTime:   t.FinishTime,
		FailReason:   t.FailReason,
		ResultURL:    t.PrivateData.ResultURL,
		Data:         t.Data,
		PluginState:  t.PrivateData.PluginState,
		PollFailures: t.PrivateData.PollFailures,
	}
}

func (Task *Task) Update() error {
	var err error
	err = DB.Save(Task).Error
	return err
}

func (t *Task) UpdateQuota() error {
	return DB.Model(t).Update("quota", t.Quota).Error
}

// UpdateWithStatus performs a conditional UPDATE guarded by fromStatus (CAS).
// Returns (true, nil) if this caller won the update, (false, nil) if
// another process already moved the task out of fromStatus. MySQL commonly
// reports changed rows rather than matched rows, so a same-value no-op update
// can also return false even when the status predicate still matched.
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

// TimeoutWithStatus fails a task only while it still satisfies the timeout
// selection predicate. It does not write stale dispatch ownership fields.
func (t *Task) TimeoutWithStatus(fromStatus TaskStatus, cutoffUnix int64) (bool, error) {
	updates := map[string]any{
		"status":      t.Status,
		"progress":    t.Progress,
		"finish_time": t.FinishTime,
		"fail_reason": t.FailReason,
	}
	if t.Quota == 0 {
		updates["quota"] = 0
	}
	result := taskTimeoutEligibilityQuery(
		DB.Model(&Task{}).Where("id = ? AND status = ?", t.ID, fromStatus),
		cutoffUnix,
	).
		Updates(updates)
	if result.Error != nil {
		return false, result.Error
	}
	return result.RowsAffected > 0, nil
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
	query = applyTaskDispatchStatusFilter(query, queryParams.DispatchStatus)
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
	if t.Status == TaskStatusSuccess {
		if t.FinishTime != 0 {
			openAIVideo.CompletedAt = t.FinishTime
		} else {
			openAIVideo.CompletedAt = t.UpdatedAt
		}
	}
	return openAIVideo
}
