package model

import (
	"bytes"
	"context"
	"database/sql/driver"
	"encoding/json"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/pkg/billingexpr"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	commonRelay "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
)

type TaskStatus string

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

// TaskRefundLegacyCutoff separates tasks created before timeout refunds were
// introduced. Those legacy tasks are failed without an automatic refund.
const TaskRefundLegacyCutoff int64 = 1771718400 // 2026-02-22 00:00:00 UTC

type Task struct {
	ID         int64                 `json:"id" gorm:"primary_key;AUTO_INCREMENT"`
	CreatedAt  int64                 `json:"created_at" gorm:"index"`
	UpdatedAt  int64                 `json:"updated_at"`
	TaskID     string                `json:"task_id" gorm:"type:varchar(191);index"` // Third-party id, not necessarily /song id\Task id
	Platform   constant.TaskPlatform `json:"platform" gorm:"type:varchar(30);index"` // platform
	UserId     int                   `json:"user_id" gorm:"index"`
	Group      string                `json:"group" gorm:"type:varchar(50)"` // Revised billing
	ChannelId  int                   `json:"channel_id" gorm:"index"`
	Quota      int                   `json:"quota"`
	Action     string                `json:"action" gorm:"type:varchar(40);index"` // Task type, song, lyrics, description-mode
	Status     TaskStatus            `json:"status" gorm:"type:varchar(20);index"` // Task status
	FailReason string                `json:"fail_reason"`
	SubmitTime int64                 `json:"submit_time" gorm:"index"`
	StartTime  int64                 `json:"start_time" gorm:"index"`
	FinishTime int64                 `json:"finish_time" gorm:"index"`
	Progress   string                `json:"progress" gorm:"type:varchar(20);index"`
	Properties Properties            `json:"properties" gorm:"type:json"`
	Username   string                `json:"username,omitempty" gorm:"-"`
	// It is prohibited to return to the user. It may contain private information such as keys.
	PrivateData TaskPrivateData `json:"-" gorm:"column:private_data;type:json"`
	Data        json.RawMessage `json:"data" gorm:"type:json"`
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
	// Must return string instead of []byte: under PG simple protocol []byte is encoded by bytea,
	// Writing to a json column triggers SQLSTATE 22P02.
	b, err := common.Marshal(m)
	if err != nil {
		return nil, err
	}
	return string(b), nil
}

type TaskPrivateData struct {
	Key            string `json:"key,omitempty"`
	UpstreamTaskID string `json:"upstream_task_id,omitempty"` // Upstream real task ID
	ResultURL      string `json:"result_url,omitempty"`       // The result URL after the task is successful (video address, etc.)
	// Execution records safe, immutable request provenance. It lives next to
	// other private task state so public task DTOs cannot expose it by accident.
	Execution *TaskExecutionSnapshot `json:"execution,omitempty"`
	// Billing context: used for asynchronous refund/difference settlement (read in polling phase)
	BillingSource  string              `json:"billing_source,omitempty"`  // "wallet" or "subscription"
	SubscriptionId int                 `json:"subscription_id,omitempty"` // Subscription ID, used for subscription refunds
	TokenId        int                 `json:"token_id,omitempty"`        // Token ID, used for token credit refund
	NodeName       string              `json:"node_name,omitempty"`       // The name of the node that initiated the task, according to which the log is assigned during the polling settlement phase instead of the last query node.
	BillingContext *TaskBillingContext `json:"billing_context,omitempty"` // Billing parameter snapshot (used for polling phase recalculation)
	// ResponsesBackground records that the openai_responses create request
	// asked for background:true. Every task is durable and survives client
	// disconnect regardless; this only echoes the protocol-level request
	// attribute back on retrieval snapshots.
	ResponsesBackground bool `json:"responses_background,omitempty"`
	// PluginState is plugin-owned cross-round data. Unlike Task.Data it is
	// only replaced when a hook explicitly returns state.
	PluginState json.RawMessage `json:"plugin_state,omitempty"`
	// PollFailures counts consecutive unrecognized or transient poll outcomes.
	PollFailures int `json:"poll_failures,omitempty"`
	// ResultDiscarded marks an immediate terminal result whose submit route
	// declared retainResult: false. The upstream snapshot was never written
	// and every retrieval surface treats the task as not found. The zero
	// value keeps historical rows retained and retrievable.
	ResultDiscarded bool `json:"result_discarded,omitempty"`
	// CredentialAccount is the account of the plugin credential that
	// submitted the task, which polls the task and fetches its content.
	CredentialAccount string `json:"credential_account,omitempty"`
	// RequestPlugins is set when a request plugin instance may report the
	// task: the task reports once, at its final state.
	RequestPlugins *TaskRequestPlugins `json:"request_plugins,omitempty"`
}

// TaskRequestPlugins is what the report of a task needs from its
// submission. The request id and path are in Execution; the model, group,
// user, channel and token are on the task.
type TaskRequestPlugins struct {
	// Instances are the ids of the report instances that matched.
	Instances   []string `json:"instances"`
	Format      string   `json:"format"`
	ChannelType int      `json:"channel_type,omitempty"`
	Attempt     int      `json:"attempt,omitempty"`
	Username    string   `json:"username,omitempty"`
	TokenName   string   `json:"token_name,omitempty"`
	// StartedAt is when the submission started, in Unix milliseconds.
	StartedAt int64 `json:"started_at"`
	// Request is the client body as a report shows it, inline media
	// replaced by references; null when it is not JSON or too large.
	Request json.RawMessage           `json:"request,omitempty"`
	Media   []jsplugin.TransformMedia `json:"media,omitempty"`
	// Record is the submission's public record.
	Record []commonRelay.RequestPluginRecord `json:"record,omitempty"`
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

// TaskBillingContext records the billing parameters when the task is submitted so that the amount can be recalculated during the polling phase.
type TaskBillingContext struct {
	ModelPrice      float64                      `json:"model_price,omitempty"`       // Model unit price
	GroupRatio      float64                      `json:"group_ratio,omitempty"`       // Group magnification
	ModelRatio      float64                      `json:"model_ratio,omitempty"`       // Model magnification
	OtherRatios     map[string]float64           `json:"other_ratios,omitempty"`      // Additional magnification (duration, resolution, etc.)
	OriginModelName string                       `json:"origin_model_name,omitempty"` // Model name, must be OriginModelName
	PerCallBilling  bool                         `json:"per_call_billing,omitempty"`  // Pay-per-view: Difference settlement skipping the polling stage
	TieredSnapshot  *billingexpr.BillingSnapshot `json:"tiered_snapshot,omitempty"`
}

// ResultRetrievable reports whether retrieval surfaces (native query routes,
// protocol retrieve endpoints, artifact projection) may serve this task.
func (t *Task) ResultRetrievable() bool {
	return !t.PrivateData.ResultDiscarded
}

// GetUpstreamTaskID Gets the real upstream task ID (used to communicate with provider)
// When the old data does not have an UpstreamTaskID, the TaskID itself is the upstream ID.
func (t *Task) GetUpstreamTaskID() string {
	if t.PrivateData.UpstreamTaskID != "" {
		return t.PrivateData.UpstreamTaskID
	}
	return t.TaskID
}

// GetResultURL Gets the task result URL (video address, etc.)
// New data is stored in PrivateData.ResultURL; old data falls back to FailReason (historical compatibility)
func (t *Task) GetResultURL() string {
	if t.PrivateData.ResultURL != "" {
		return t.PrivateData.ResultURL
	}
	return t.FailReason
}

// GenerateTaskID generates an externally exposed task_xxxx format ID
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
		!p.ResponsesBackground && len(p.PluginState) == 0 && p.PollFailures == 0 &&
		!p.ResultDiscarded && p.RequestPlugins == nil {
		return nil, nil
	}
	// Same as Properties.Value:string to avoid bytea encoding of PG simple protocol.
	b, err := common.Marshal(p)
	if err != nil {
		return nil, err
	}
	return string(b), nil
}

// SyncTaskQueryParams is a structure containing all search conditions. More fields can be added as needed.
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
		// A New API channel may rotate between several gateway tokens, so the
		// task keeps the key that submitted it and polls with the same identity.
		if relayInfo.ChannelMeta.ChannelType == constant.ChannelTypeGemini ||
			relayInfo.ChannelMeta.ChannelType == constant.ChannelTypeVertexAi ||
			relayInfo.ChannelMeta.ChannelType == constant.ChannelTypeNewAPI {
			privateData.Key = relayInfo.ChannelMeta.ApiKey
		}
		if relayInfo.ChannelMeta.ChannelType == constant.ChannelTypeTaskPlugin {
			if credential, ok := jsplugin.ParseCredential(relayInfo.ChannelMeta.ApiKey); ok {
				privateData.CredentialAccount = credential.AccountID
			}
		}
		if relayInfo.UpstreamModelName != "" {
			properties.UpstreamModelName = relayInfo.UpstreamModelName
		}
		if relayInfo.OriginModelName != "" {
			properties.OriginModelName = relayInfo.OriginModelName
		}
	}

	// Use pre-generated public ID if available, otherwise generate a new one
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

	// Initialize query builder
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
		// It is assumed that you have converted the timestamp from the front end into the time format required by the database, and handled the verification and parsing of the timestamp.
		query = query.Where("submit_time >= ?", queryParams.StartTimestamp)
	}
	if queryParams.EndTimestamp != 0 {
		query = query.Where("submit_time <= ?", queryParams.EndTimestamp)
	}

	// Get data
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

	// Initialize query builder
	query := DB

	// Add filter
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

	// Get data
	err = query.Omit("data").Order("id desc").Limit(num).Offset(startIdx).Find(&tasks).Error
	if err != nil {
		return nil
	}

	return tasks
}

func GetTimedOutUnfinishedTasks(cutoffUnix int64, limit int) []*Task {
	var tasks []*Task
	err := DB.Where("progress != ?", "100%").
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
	err = DB.Where("progress != ?", "100%").Where("status != ?", TaskStatusFailure).Where("status != ?", TaskStatusSuccess).Limit(limit).Order("id").Find(&tasks).Error
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
		Where("status != ?", TaskStatusFailure).
		Where("status != ?", TaskStatusSuccess).
		Limit(1).
		Pluck("id", &id).Error
	return err == nil && id != 0
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
	if t.Status == TaskStatusSuccess {
		if t.FinishTime != 0 {
			openAIVideo.CompletedAt = t.FinishTime
		} else {
			openAIVideo.CompletedAt = t.UpdatedAt
		}
	}
	return openAIVideo
}
