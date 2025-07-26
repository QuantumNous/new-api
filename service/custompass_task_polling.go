package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"one-api/common"
	"one-api/constant"
	"one-api/model"
	"one-api/setting/ratio_setting"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/bytedance/gopkg/util/gopool"
)

// Local data structures to avoid import cycles
type TaskQueryRequest struct {
	TaskIDs []string `json:"task_ids"`
}

type TaskQueryResponse struct {
	Code    interface{} `json:"code"`
	Message string      `json:"message,omitempty"`
	Msg     string      `json:"msg,omitempty"`
	Data    []*TaskInfo `json:"data"`
}

func (r *TaskQueryResponse) IsSuccess() bool {
	switch code := r.Code.(type) {
	case int:
		return code == 0
	case float64:
		return code == 0
	case string:
		return code == "0"
	default:
		return false
	}
}

func (r *TaskQueryResponse) GetMessage() string {
	if r.Message != "" {
		return r.Message
	}
	if r.Msg != "" {
		return r.Msg
	}
	return "未知错误"
}

func (r *TaskQueryResponse) GetTaskList() []*TaskInfo {
	if r.Data == nil {
		return []*TaskInfo{}
	}
	return r.Data
}

type TaskInfo struct {
	TaskID   string      `json:"task_id"`
	Status   string      `json:"status"`
	Progress string      `json:"progress"`
	Error    string      `json:"error"`
	Result   interface{} `json:"result"`
	Usage    *Usage      `json:"usage"`
}

func (t *TaskInfo) IsCompleted(mapping *CustomPassStatusMapping) bool {
	mappedStatus := mapUpstreamStatus(t.Status, mapping)
	return mappedStatus == "SUCCESS"
}

func (t *TaskInfo) IsFailed(mapping *CustomPassStatusMapping) bool {
	mappedStatus := mapUpstreamStatus(t.Status, mapping)
	return mappedStatus == "FAILURE"
}

func mapUpstreamStatus(upstreamStatus string, mapping *CustomPassStatusMapping) string {
	// Check success status
	for _, status := range mapping.Success {
		if strings.EqualFold(upstreamStatus, status) {
			return "SUCCESS"
		}
	}

	// Check failed status
	for _, status := range mapping.Failed {
		if strings.EqualFold(upstreamStatus, status) {
			return "FAILURE"
		}
	}

	// Check processing status
	for _, status := range mapping.Processing {
		if strings.EqualFold(upstreamStatus, status) {
			return "IN_PROGRESS"
		}
	}

	return "UNKNOWN"
}

func getDefaultStatusMapping() *CustomPassStatusMapping {
	return &CustomPassStatusMapping{
		Success:    []string{"completed", "success", "finished"},
		Failed:     []string{"failed", "error", "cancelled", "not_found"},
		Processing: []string{"processing", "pending", "running", "submitted"},
	}
}

// TaskPollingService manages scheduled task polling
type TaskPollingService struct {
	ctx           context.Context
	cancel        context.CancelFunc
	isRunning     bool
	mutex         sync.RWMutex
	pollInterval  time.Duration
	batchSize     int
	maxConcurrent int
}

var (
	taskPollingService *TaskPollingService
	once               sync.Once
)

// GetTaskPollingService returns singleton instance
func GetTaskPollingService() *TaskPollingService {
	once.Do(func() {
		taskPollingService = &TaskPollingService{
			pollInterval:  30 * time.Second, // Default 30 seconds
			batchSize:     50,               // Process 50 tasks per batch
			maxConcurrent: 10,               // Max 10 concurrent queries
		}
	})
	return taskPollingService
}

// Start begins the task polling service
func (s *TaskPollingService) Start() error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if s.isRunning {
		return fmt.Errorf("task polling service is already running")
	}

	s.ctx, s.cancel = context.WithCancel(context.Background())
	s.isRunning = true

	gopool.Go(func() {
		s.run()
	})

	common.SysLog("CustomPass task polling service started")
	return nil
}

// Stop stops the task polling service
func (s *TaskPollingService) Stop() error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if !s.isRunning {
		return fmt.Errorf("task polling service is not running")
	}

	s.cancel()
	s.isRunning = false

	common.SysLog("CustomPass task polling service stopped")
	return nil
}

// IsRunning returns whether the service is running
func (s *TaskPollingService) IsRunning() bool {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	return s.isRunning
}

// run is the main polling loop
func (s *TaskPollingService) run() {
	ticker := time.NewTicker(s.pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-s.ctx.Done():
			return
		case <-ticker.C:
			s.pollTasks()
		}
	}
}

// pollTasks polls and updates task statuses
func (s *TaskPollingService) pollTasks() {
	// Get incomplete CustomPass tasks
	incompleteTasks := model.GetAllUnFinishSyncTasks(s.batchSize)
	common.SysLog(fmt.Sprintf("[CustomPass-TaskPolling-Debug] 开始轮询任务 - 发现未完成任务: %d", len(incompleteTasks)))
	
	if len(incompleteTasks) == 0 {
		return
	}

	// Filter CustomPass tasks only
	customPassTasks := s.filterCustomPassTasks(incompleteTasks)
	common.SysLog(fmt.Sprintf("[CustomPass-TaskPolling-Debug] 过滤后的CustomPass任务: %d", len(customPassTasks)))
	
	if len(customPassTasks) == 0 {
		return
	}

	// Check for timeout tasks and handle them first
	s.handleTimeoutTasks(customPassTasks)

	// Filter out timeout tasks from normal processing
	activeTasks := s.filterActiveNonTimeoutTasks(customPassTasks)
	if len(activeTasks) == 0 {
		return
	}

	common.SysLog(fmt.Sprintf("Polling %d CustomPass tasks for status updates", len(activeTasks)))

	// Group tasks by channel for batch processing
	tasksByChannel := s.groupTasksByChannel(activeTasks)

	// Process each channel's tasks concurrently
	semaphore := make(chan struct{}, s.maxConcurrent)
	var wg sync.WaitGroup

	for channelId, channelTasks := range tasksByChannel {
		wg.Add(1)
		gopool.Go(func() {
			defer wg.Done()

			semaphore <- struct{}{}        // Acquire
			defer func() { <-semaphore }() // Release

			s.processChannelTasks(channelId, channelTasks)
		})
	}

	wg.Wait()
}

// handleTimeoutTasks checks for tasks that have exceeded 1 hour timeout and marks them as failed with refund
func (s *TaskPollingService) handleTimeoutTasks(tasks []*model.Task) {
	const timeoutDuration = 1 * time.Hour
	currentTime := time.Now().Unix()
	
	for _, task := range tasks {
		// Check if task has been running for more than 1 hour
		taskStartTime := time.Unix(task.SubmitTime, 0)
		if currentTime-task.SubmitTime > int64(timeoutDuration.Seconds()) {
			common.SysLog(fmt.Sprintf("[CustomPass-Timeout] 任务超时检测 - 任务ID: %s, 提交时间: %v, 当前时间: %v, 超时: %v", 
				task.TaskID, taskStartTime, time.Unix(currentTime, 0), timeoutDuration))
			
			// Mark task as failed due to timeout
			s.markTaskAsTimeout(task)
		}
	}
}

// markTaskAsTimeout marks a task as failed due to timeout and processes refund
func (s *TaskPollingService) markTaskAsTimeout(task *model.Task) {
	common.SysLog(fmt.Sprintf("[CustomPass-Timeout] 标记任务超时失败 - 模型: %s, 任务ID: %s, 预收费: %d", 
		task.Action, task.TaskID, task.Quota))
		
	// Update task status to FAILURE with timeout reason
	updateParams := map[string]interface{}{
		"status":      model.TaskStatusFailure,
		"progress":    "100%",
		"updated_at":  time.Now().Unix(),
		"finish_time": time.Now().Unix(),
		"fail_reason": "任务执行超时（超过1小时）",
	}
	
	// Save timeout information as JSON data
	timeoutData := map[string]interface{}{
		"task_id":       task.TaskID,
		"error":         "任务执行超时（超过1小时）",
		"timeout_at":    time.Now().Unix(),
		"submit_time":   task.SubmitTime,
		"timeout_duration": "1小时",
		"status":        "timeout",
	}
	if timeoutBytes, err := json.Marshal(timeoutData); err == nil {
		updateParams["data"] = json.RawMessage(timeoutBytes)
	}

	err := model.TaskBulkUpdate([]string{task.TaskID}, updateParams)
	if err != nil {
		common.SysError(fmt.Sprintf("Failed to update timeout task %s: %v", task.TaskID, err))
		return
	}

	// Process refund for timeout task
	s.processTimeoutRefund(task)
	
	common.SysLog(fmt.Sprintf("[CustomPass-Timeout] 任务已标记为超时失败 - 模型: %s, 任务ID: %s", task.Action, task.TaskID))
}

// processTimeoutRefund processes refund for timeout tasks
func (s *TaskPollingService) processTimeoutRefund(task *model.Task) {
	common.SysLog(fmt.Sprintf("[CustomPass-Timeout] 开始超时任务退费 - 模型: %s, 任务ID: %s, 退费金额: %d", 
		task.Action, task.TaskID, task.Quota))

	// Refund the quota to user (following Midjourney's approach)
	if task.Quota > 0 {
		// Increase user quota (refund) - same as Midjourney and CustomPass billing service
		err := model.IncreaseUserQuota(task.UserId, task.Quota, false)
		if err != nil {
			common.SysError(fmt.Sprintf("Failed to refund quota to user %d: %v", task.UserId, err))
			return
		}
		
		// Decrease channel used quota (refund) - use negative quota to reduce used quota
		model.UpdateChannelUsedQuota(task.ChannelId, -task.Quota)
		
		// Record system log for refund (following Midjourney's approach)
		logContent := fmt.Sprintf("CustomPass任务超时退费 - 模型: %s, 任务ID: %s, 补偿 %s, 原因: 任务执行超过1小时", 
			task.Action, task.TaskID, common.LogQuota(task.Quota))
		model.RecordLog(task.UserId, model.LogTypeSystem, logContent)
		
		common.SysLog(fmt.Sprintf("[CustomPass-Timeout] 超时任务退费完成 - 模型: %s, 任务ID: %s, 用户ID: %d, 渠道ID: %d, 退费金额: %d", 
			task.Action, task.TaskID, task.UserId, task.ChannelId, task.Quota))
	}
}

// processFailureRefund processes refund for failed tasks
func (s *TaskPollingService) processFailureRefund(task *model.Task) {
	common.SysLog(fmt.Sprintf("[CustomPass-Failure] 开始失败任务退费 - 模型: %s, 任务ID: %s, 退费金额: %d", 
		task.Action, task.TaskID, task.Quota))

	// Refund the quota to user (following Midjourney and timeout approach)
	if task.Quota > 0 {
		// Increase user quota (refund) - same as Midjourney and CustomPass billing service
		err := model.IncreaseUserQuota(task.UserId, task.Quota, false)
		if err != nil {
			common.SysError(fmt.Sprintf("Failed to refund quota to user %d: %v", task.UserId, err))
			return
		}
		
		// Decrease channel used quota (refund) - use negative quota to reduce used quota
		model.UpdateChannelUsedQuota(task.ChannelId, -task.Quota)
		
		// Record system log for refund (following Midjourney's approach)
		logContent := fmt.Sprintf("CustomPass任务失败退费 - 模型: %s, 任务ID: %s, 补偿 %s, 原因: 任务执行失败", 
			task.Action, task.TaskID, common.LogQuota(task.Quota))
		model.RecordLog(task.UserId, model.LogTypeSystem, logContent)
		
		common.SysLog(fmt.Sprintf("[CustomPass-Failure] 失败任务退费完成 - 模型: %s, 任务ID: %s, 用户ID: %d, 渠道ID: %d, 退费金额: %d", 
			task.Action, task.TaskID, task.UserId, task.ChannelId, task.Quota))
	}
}

// filterActiveNonTimeoutTasks filters out tasks that are not timeout for normal processing
func (s *TaskPollingService) filterActiveNonTimeoutTasks(tasks []*model.Task) []*model.Task {
	const timeoutDuration = 1 * time.Hour
	currentTime := time.Now().Unix()
	
	var activeTasks []*model.Task
	for _, task := range tasks {
		// Only process tasks that haven't timed out yet
		if currentTime-task.SubmitTime <= int64(timeoutDuration.Seconds()) {
			activeTasks = append(activeTasks, task)
		}
	}
	return activeTasks
}

// filterCustomPassTasks filters tasks that belong to CustomPass platform
func (s *TaskPollingService) filterCustomPassTasks(tasks []*model.Task) []*model.Task {
	var customPassTasks []*model.Task
	for _, task := range tasks {
		if task.Platform == constant.TaskPlatformCustomPass {
			customPassTasks = append(customPassTasks, task)
		}
	}
	return customPassTasks
}

// groupTasksByChannel groups tasks by channel ID
func (s *TaskPollingService) groupTasksByChannel(tasks []*model.Task) map[int][]*model.Task {
	tasksByChannel := make(map[int][]*model.Task)
	for _, task := range tasks {
		tasksByChannel[task.ChannelId] = append(tasksByChannel[task.ChannelId], task)
	}
	return tasksByChannel
}

// processChannelTasks processes all tasks for a specific channel
func (s *TaskPollingService) processChannelTasks(channelId int, tasks []*model.Task) {
	// Get channel information
	channel, err := model.GetChannelById(channelId, true)
	if err != nil {
		common.SysError(fmt.Sprintf("Failed to get channel %d: %v", channelId, err))
		return
	}

	// Validate channel type
	if channel.Type != constant.ChannelTypeCustomPass {
		return
	}

	// Extract task IDs for query and get model name from first task
	taskIDs := make([]string, 0, len(tasks))
	taskMap := make(map[string]*model.Task)
	var modelName string

	for _, task := range tasks {
		if task.TaskID != "" {
			taskIDs = append(taskIDs, task.TaskID)
			taskMap[task.TaskID] = task
			// Use the model name from the first task (all tasks in a channel should have the same model)
			if modelName == "" {
				modelName = task.Action
			}
		}
	}

	if len(taskIDs) == 0 {
		return
	}

	if modelName == "" {
		common.SysError(fmt.Sprintf("No model name found for tasks in channel %d", channelId))
		return
	}

	// Query upstream for task status
	taskInfos, err := s.queryUpstreamTasks(channel, taskIDs, modelName)
	if err != nil {
		common.SysError(fmt.Sprintf("Failed to query upstream tasks for channel %d: %v", channelId, err))
		return
	}

	// Update local task statuses
	s.updateTaskStatuses(taskMap, taskInfos)
}

// queryUpstreamTasks queries upstream API for task statuses
func (s *TaskPollingService) queryUpstreamTasks(channel *model.Channel, taskIDs []string, modelName string) ([]*TaskInfo, error) {
	// Build query request
	queryReq := TaskQueryRequest{
		TaskIDs: taskIDs,
	}

	requestBody, err := json.Marshal(queryReq)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal query request: %v", err)
	}

	// Build upstream URL with model_without_submit
	baseURL := channel.GetBaseURL()
	if baseURL == "" {
		return nil, fmt.Errorf("channel base URL not configured")
	}

	// For task query, remove /submit suffix to get base model name (model_without_submit)
	baseModelName := strings.TrimSuffix(modelName, "/submit")
	upstreamURL := fmt.Sprintf("%s/%s/task/list-by-condition", strings.TrimSuffix(baseURL, "/"), baseModelName)

	// Build headers
	headers := map[string]string{
		"Authorization": "Bearer " + channel.Key,
		"Content-Type":  "application/json",
	}

	// Log upstream request details
	common.SysLog(fmt.Sprintf("[CustomPass-Request-Debug] 任务轮询上游API - 原始模型: %s, model_without_submit: %s", modelName, baseModelName))
	common.SysLog(fmt.Sprintf("[CustomPass-Request-Debug] 任务轮询上游API - URL: %s", upstreamURL))
	common.SysLog(fmt.Sprintf("[CustomPass-Request-Debug] 任务轮询Headers: %+v", headers))
	common.SysLog(fmt.Sprintf("[CustomPass-Request-Debug] 任务轮询Body: %s", string(requestBody)))

	// Make HTTP request
	req, err := http.NewRequest("POST", upstreamURL, bytes.NewReader(requestBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %v", err)
	}

	// Set headers
	for key, value := range headers {
		req.Header.Set(key, value)
	}

	client := &http.Client{
		Timeout: 15 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to query upstream: %v", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %v", err)
	}

	// Log upstream response
	common.SysLog(fmt.Sprintf("[CustomPass-Response-Debug] 任务轮询响应状态码: %d", resp.StatusCode))
	common.SysLog(fmt.Sprintf("[CustomPass-Response-Debug] 任务轮询响应Body: %s", string(respBody)))

	// Parse response
	var queryResp TaskQueryResponse
	if err := json.Unmarshal(respBody, &queryResp); err != nil {
		return nil, fmt.Errorf("failed to parse query response: %v", err)
	}

	if !queryResp.IsSuccess() {
		return nil, fmt.Errorf("upstream query failed: %s", queryResp.GetMessage())
	}

	return queryResp.GetTaskList(), nil
}

// updateTaskStatuses updates local task statuses based on upstream response
func (s *TaskPollingService) updateTaskStatuses(taskMap map[string]*model.Task, taskInfos []*TaskInfo) {
	statusMapping := getDefaultStatusMapping()

	// First pass: handle failed tasks immediately to preserve original quota
	for _, taskInfo := range taskInfos {
		if taskInfo.TaskID == "" {
			continue
		}

		localTask, exists := taskMap[taskInfo.TaskID]
		if !exists {
			continue
		}

		// Priority handling: Mark as failed if failed (before any quota modifications)
		if taskInfo.IsFailed(statusMapping) {
			// Check if task is not already in failure status to prevent duplicate refund
			isFirstTimeFailure := localTask.Status != model.TaskStatusFailure
			
			if isFirstTimeFailure {
				// Process direct refund for failed task BEFORE updating database
				// This ensures we use the original precharge amount
				s.processFailedTaskDirectRefund(localTask, taskInfo)
			}
			
			updateParams := map[string]interface{}{
				"status":      model.TaskStatusFailure,
				"progress":    "100%",
				"updated_at":  time.Now().Unix(),
				"finish_time": time.Now().Unix(),
				"fail_reason": taskInfo.Error,
			}
			
			// Save complete response data for failed tasks in JSON format
			if taskInfoBytes, err := json.Marshal(taskInfo); err == nil {
				updateParams["data"] = json.RawMessage(taskInfoBytes)
			}

			err := model.TaskBulkUpdate([]string{taskInfo.TaskID}, updateParams)
			if err != nil {
				common.SysError(fmt.Sprintf("Failed to update failed task %s: %v", taskInfo.TaskID, err))
			}
		}
	}

	// Second pass: handle other status updates and successful tasks
	for _, taskInfo := range taskInfos {
		if taskInfo.TaskID == "" {
			continue
		}

		localTask, exists := taskMap[taskInfo.TaskID]
		if !exists {
			continue
		}

		// Skip if already processed as failed
		if taskInfo.IsFailed(statusMapping) {
			continue
		}

		// Update task status
		if taskInfo.Status != "" {
			err := model.UpdateTaskStatus(taskInfo.TaskID, taskInfo.Status)
			if err != nil {
				common.SysError(fmt.Sprintf("Failed to update task %s status: %v", taskInfo.TaskID, err))
				continue
			}
		}

		// Update progress if available
		if taskInfo.Progress != "" && taskInfo.Progress != localTask.Progress {
			err := model.TaskUpdateProgress(localTask.ID, taskInfo.Progress)
			if err != nil {
				common.SysError(fmt.Sprintf("Failed to update task %s progress: %v", taskInfo.TaskID, err))
			}
		}

		// Update task status based on upstream status mapping
		mappedStatus := mapUpstreamStatus(taskInfo.Status, statusMapping)
		var targetStatus model.TaskStatus
		var needsUpdate bool
		
		switch mappedStatus {
		case "IN_PROGRESS":
			if localTask.Status != model.TaskStatusInProgress {
				targetStatus = model.TaskStatusInProgress
				needsUpdate = true
			}
		case "QUEUED":
			if localTask.Status != model.TaskStatusQueued {
				targetStatus = model.TaskStatusQueued
				needsUpdate = true
			}
		}
		
		if needsUpdate {
			updateParams := map[string]interface{}{
				"status":     targetStatus,
				"updated_at": time.Now().Unix(),
			}
			
			err := model.TaskBulkUpdate([]string{taskInfo.TaskID}, updateParams)
			if err != nil {
				common.SysError(fmt.Sprintf("Failed to update task %s status to %s: %v", taskInfo.TaskID, targetStatus, err))
			}
		}

		// Update task data if completed and has result
		if taskInfo.IsCompleted(statusMapping) && taskInfo.Result != nil {
			// Update task with final result
			updateParams := map[string]interface{}{
				"status":      model.TaskStatusSuccess,
				"progress":    "100%",
				"updated_at":  time.Now().Unix(),
				"finish_time": time.Now().Unix(),
			}

			// Update task data with latest upstream task info
			if taskInfoBytes, err := json.Marshal(taskInfo); err == nil {
				updateParams["data"] = json.RawMessage(taskInfoBytes)
			}

			err := model.TaskBulkUpdate([]string{taskInfo.TaskID}, updateParams)
			if err != nil {
				common.SysError(fmt.Sprintf("Failed to update completed task %s: %v", taskInfo.TaskID, err))
			}

			// If task has usage information, perform settlement using billing service
			if taskInfo.Usage != nil && s.shouldRecalculateQuota(taskInfo) {
				s.performTaskSettlement(localTask, taskInfo)
			}
		}
	}
}

// shouldRecalculateQuota determines if quota should be recalculated
func (s *TaskPollingService) shouldRecalculateQuota(taskInfo *TaskInfo) bool {
	if taskInfo.Usage == nil {
		return false
	}

	// Only recalculate if we have actual token usage
	return taskInfo.Usage.GetInputTokens() > 0 || taskInfo.Usage.GetOutputTokens() > 0
}

// recalculateTaskQuota recalculates and updates task quota based on actual usage
func (s *TaskPollingService) recalculateTaskQuota(localTask *model.Task, taskInfo *TaskInfo) {
	common.SysLog(fmt.Sprintf("[CustomPass-TaskPolling-Debug] 开始重新计算任务配额 - 任务ID: %s, 模型: %s, 当前配额: %d", 
		localTask.TaskID, localTask.Action, localTask.Quota))

	if taskInfo.Usage == nil {
		common.SysLog(fmt.Sprintf("[CustomPass-TaskPolling-Debug] 任务没有使用量信息，跳过重新计算 - 任务ID: %s", localTask.TaskID))
		return
	}

	promptTokens := taskInfo.Usage.GetInputTokens()
	completionTokens := taskInfo.Usage.GetOutputTokens()
	
	common.SysLog(fmt.Sprintf("[CustomPass-TaskPolling-Debug] 发现使用量信息 - 输入tokens: %d, 输出tokens: %d", 
		promptTokens, completionTokens))

	// Check if model uses usage-based billing
	isUsageBased := IsModelUsageBasedBilling(localTask.Action)
	common.SysLog(fmt.Sprintf("[CustomPass-TaskPolling-Debug] 模型使用量计费检查 - 模型: %s, 支持使用量计费: %t", 
		localTask.Action, isUsageBased))
	
	if !isUsageBased {
		common.SysLog(fmt.Sprintf("[CustomPass-TaskPolling-Debug] 模型不支持使用量计费，跳过重新计算"))
		return
	}

	// Get user's group from local task (we should have this from task creation)
	// For now, we'll use a default group - this could be improved by storing group in task
	userGroup := "default"
	common.SysLog(fmt.Sprintf("[CustomPass-TaskPolling-Debug] 使用用户组: %s", userGroup))

	// Calculate new quota based on actual usage
	common.SysLog(fmt.Sprintf("[CustomPass-TaskPolling-Debug] 开始基于实际使用量计算新配额"))
	newQuota, err := CalculateQuotaByTokens(localTask.Action, promptTokens, completionTokens, userGroup)
	if err != nil {
		common.SysError(fmt.Sprintf("Failed to calculate quota for task %s: %v", taskInfo.TaskID, err))
		common.SysLog(fmt.Sprintf("[CustomPass-TaskPolling-Debug] 配额计算失败 - 错误: %v", err))
		return
	}
	
	common.SysLog(fmt.Sprintf("[CustomPass-TaskPolling-Debug] 配额计算完成 - 新配额: %d", newQuota))

	// Calculate quota difference
	quotaDiff := newQuota - localTask.Quota

	if quotaDiff != 0 {
		// Update task quota
		updateParams := map[string]interface{}{
			"quota": newQuota,
		}

		err := model.TaskBulkUpdate([]string{taskInfo.TaskID}, updateParams)
		if err != nil {
			common.SysError(fmt.Sprintf("Failed to update task quota for %s: %v", taskInfo.TaskID, err))
			return
		}

		// Update user and channel usage statistics
		if quotaDiff > 0 {
			// Additional quota needed
			model.UpdateUserUsedQuotaAndRequestCount(localTask.UserId, quotaDiff)
			model.UpdateChannelUsedQuota(localTask.ChannelId, quotaDiff)
		} else {
			// Quota refund (negative diff)
			// Note: This might need special handling for refunds
			common.SysLog(fmt.Sprintf("Task %s completed with less quota than estimated: refund %d", taskInfo.TaskID, -quotaDiff))
		}

		common.SysLog(fmt.Sprintf("Updated task %s quota from %d to %d (diff: %d)",
			taskInfo.TaskID, localTask.Quota, newQuota, quotaDiff))
	}
}

// UpdatePollingConfig updates polling configuration
func (s *TaskPollingService) UpdatePollingConfig(pollIntervalSeconds, batchSize, maxConcurrent int) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if pollIntervalSeconds > 0 {
		s.pollInterval = time.Duration(pollIntervalSeconds) * time.Second
	}

	if batchSize > 0 {
		s.batchSize = batchSize
	}

	if maxConcurrent > 0 {
		s.maxConcurrent = maxConcurrent
	}

	common.SysLog(fmt.Sprintf("Updated polling config: interval=%v, batch=%d, concurrent=%d",
		s.pollInterval, s.batchSize, s.maxConcurrent))
}

// performTaskSettlement performs complete billing settlement using CustomPass billing service
func (s *TaskPollingService) performTaskSettlement(localTask *model.Task, taskInfo *TaskInfo) {
	common.SysLog(fmt.Sprintf("[CustomPass-TaskPolling-Debug] 开始任务结算 - 任务ID: %s, 模型: %s, 预收费: %d", 
		localTask.TaskID, localTask.Action, localTask.Quota))

	if taskInfo.Usage == nil {
		common.SysLog(fmt.Sprintf("[CustomPass-Billing] 任务没有使用量信息，跳过结算 - 任务ID: %s", localTask.TaskID))
		return
	}

	common.SysLog(fmt.Sprintf("[CustomPass-Billing] 从异步任务获取到token信息 - 任务ID: %s, 原始数据: prompt_tokens=%d, completion_tokens=%d, total_tokens=%d", 
		localTask.TaskID, taskInfo.Usage.PromptTokens, taskInfo.Usage.CompletionTokens, taskInfo.Usage.TotalTokens))

	// Create billing service instance
	billingService := NewCustomPassBillingService()
	
	// Convert TaskInfo.Usage to service.Usage
	actualUsage := &Usage{
		PromptTokens:     taskInfo.Usage.PromptTokens,
		CompletionTokens: taskInfo.Usage.CompletionTokens,
		TotalTokens:      taskInfo.Usage.TotalTokens,
		InputTokens:      taskInfo.Usage.InputTokens,
		OutputTokens:     taskInfo.Usage.OutputTokens,
	}

	common.SysLog(fmt.Sprintf("[CustomPass-Billing] 异步任务实际使用量 - 模型: %s, 输入tokens: %d, 输出tokens: %d, 总计: %d", 
		localTask.Action, actualUsage.GetInputTokens(), actualUsage.GetOutputTokens(), actualUsage.GetInputTokens()+actualUsage.GetOutputTokens()))

	// 使用从任务属性中保存的计费信息，而不是重新计算
	var groupRatio, userRatio float64 = 1.0, 1.0
	var userGroup string = "default"
	
	// 优先使用任务创建时保存的计费信息
	if localTask.Properties.BillingInfo != nil {
		billingInfo := localTask.Properties.BillingInfo
		groupRatio = billingInfo.GroupRatio
		
		// 使用保存的用户组倍率（分组特殊倍率）
		if billingInfo.HasSpecialRatio {
			userRatio = billingInfo.UserGroupRatio
		}
		
		// 打印完整的保存计费信息
		common.SysLog(fmt.Sprintf("[CustomPass-Billing] ========== 使用保存的计费信息 =========="))
		common.SysLog(fmt.Sprintf("[CustomPass-Billing] 任务ID: %s, 模型: %s, 用户ID: %d", localTask.TaskID, localTask.Action, localTask.UserId))
		common.SysLog(fmt.Sprintf("[CustomPass-Billing] 预收费金额: %d", localTask.Quota))
		common.SysLog(fmt.Sprintf("[CustomPass-Billing] 保存的计费信息详情:"))
		common.SysLog(fmt.Sprintf("[CustomPass-Billing]   - 组倍率 (GroupRatio): %.6f", billingInfo.GroupRatio))
		common.SysLog(fmt.Sprintf("[CustomPass-Billing]   - 用户组倍率 (UserGroupRatio): %.6f", billingInfo.UserGroupRatio))
		common.SysLog(fmt.Sprintf("[CustomPass-Billing]   - 模型倍率 (ModelRatio): %.6f", billingInfo.ModelRatio))
		common.SysLog(fmt.Sprintf("[CustomPass-Billing]   - 补全倍率 (CompletionRatio): %.6f", billingInfo.CompletionRatio))
		common.SysLog(fmt.Sprintf("[CustomPass-Billing]   - 模型价格 (ModelPrice): %.6f", billingInfo.ModelPrice))
		common.SysLog(fmt.Sprintf("[CustomPass-Billing]   - 计费模式 (BillingMode): %s", billingInfo.BillingMode))
		common.SysLog(fmt.Sprintf("[CustomPass-Billing]   - 使用特殊倍率 (HasSpecialRatio): %t", billingInfo.HasSpecialRatio))
		common.SysLog(fmt.Sprintf("[CustomPass-Billing] 最终使用的倍率:"))
		common.SysLog(fmt.Sprintf("[CustomPass-Billing]   - 组倍率: %.6f", groupRatio))
		common.SysLog(fmt.Sprintf("[CustomPass-Billing]   - 用户倍率: %.6f", userRatio))
		common.SysLog(fmt.Sprintf("[CustomPass-Billing] ================================================"))
	} else {
		// 向后兼容：如果没有保存的计费信息，则使用原有的计算方式
		common.SysLog(fmt.Sprintf("[CustomPass-Billing] 未找到保存的计费信息，使用向后兼容方式计算倍率"))
		
		// Get user information for group
		if user, err := model.GetUserById(localTask.UserId, false); err == nil {
			userGroup = user.Group
		}

		// Get group ratio
		groupRatio = ratio_setting.GetGroupRatio(userGroup)
		
		// Check for user group special ratio - this requires both user group and using group
		// For task polling, we'll use the user's group as both userGroup and usingGroup
		if specialRatio, hasSpecial := ratio_setting.GetGroupGroupRatio(userGroup, userGroup); hasSpecial {
			userRatio = specialRatio
		}
		
		common.SysLog(fmt.Sprintf("[CustomPass-Billing] 向后兼容计算结果 - 组倍率: %.6f, 用户组倍率: %.6f", groupRatio, userRatio))
	}

	// Create a mock context for ProcessSettlement (it needs gin.Context for logging)
	// In a real implementation, you might want to pass context through the polling service
	c := &gin.Context{}
	
	// Get token information - TODO: improve this by storing token info in task
	var tokenID int = 0
	var tokenName string = "system"
	
	// Perform complete settlement using the billing service
	err := billingService.ProcessSettlement(
		c,
		localTask.UserId,
		localTask.Action,           // model name
		int64(localTask.Quota),     // precharge amount
		actualUsage,                // actual usage
		localTask.ChannelId,        // channel ID
		tokenID,                    // token ID
		tokenName,                  // token name
		userGroup,                  // user group
		groupRatio,
		userRatio,
	)

	if err != nil {
		common.SysError(fmt.Sprintf("Failed to perform settlement for task %s: %v", localTask.TaskID, err))
		common.SysLog(fmt.Sprintf("[CustomPass-TaskPolling-Debug] 结算失败 - 错误: %v", err))
		return
	}

	// Calculate actual amount for task quota update using the same ratios
	actualAmount, err := billingService.CalculateFinalAmount(localTask.Action, actualUsage, groupRatio, userRatio)
	if err != nil {
		common.SysError(fmt.Sprintf("Failed to calculate final amount for task %s: %v", localTask.TaskID, err))
		return
	}

	// Update task quota to actual amount
	updateParams := map[string]interface{}{
		"quota": int(actualAmount),
	}

	err = model.TaskBulkUpdate([]string{localTask.TaskID}, updateParams)
	if err != nil {
		common.SysError(fmt.Sprintf("Failed to update task quota for %s: %v", localTask.TaskID, err))
		return
	}

	common.SysLog(fmt.Sprintf("[CustomPass-TaskPolling-Debug] 结算完成 - 任务ID: %s, 预收费: %d, 实际费用: %d", 
		localTask.TaskID, localTask.Quota, actualAmount))
}

// processFailedTaskDirectRefund processes direct refund for failed tasks using original quota
func (s *TaskPollingService) processFailedTaskDirectRefund(localTask *model.Task, taskInfo *TaskInfo) {
	originalQuota := localTask.Quota
	common.SysLog(fmt.Sprintf("[CustomPass-Failure] 开始失败任务直接退费 - 任务ID: %s, 模型: %s, 原始预收费: %d", 
		localTask.TaskID, localTask.Action, originalQuota))

	// Skip refund if quota is 0 (free tasks or already processed)
	if originalQuota <= 0 {
		common.SysLog(fmt.Sprintf("[CustomPass-Failure] 任务预收费为0，跳过退费 - 任务ID: %s", localTask.TaskID))
		return
	}

	// Direct refund: increase user quota
	err := model.IncreaseUserQuota(localTask.UserId, originalQuota, false)
	if err != nil {
		common.SysError(fmt.Sprintf("Failed to refund quota to user %d for failed task %s: %v", localTask.UserId, localTask.TaskID, err))
		return
	}
	
	// Decrease channel used quota (refund) - use negative quota to reduce used quota
	model.UpdateChannelUsedQuota(localTask.ChannelId, -originalQuota)
	
	// Record system log for refund
	logContent := fmt.Sprintf("CustomPass任务失败退费 - 模型: %s, 任务ID: %s, 补偿 %s, 原因: %s", 
		localTask.Action, localTask.TaskID, common.LogQuota(originalQuota), taskInfo.Error)
	model.RecordLog(localTask.UserId, model.LogTypeSystem, logContent)
	
	common.SysLog(fmt.Sprintf("[CustomPass-Failure] 失败任务直接退费完成 - 任务ID: %s, 用户ID: %d, 渠道ID: %d, 退费金额: %d", 
		localTask.TaskID, localTask.UserId, localTask.ChannelId, originalQuota))
}

// performFailedTaskSettlement performs settlement for failed tasks with zero usage (full refund)
// This function is kept for backward compatibility but should not be used for new failure handling
func (s *TaskPollingService) performFailedTaskSettlement(localTask *model.Task) {
	common.SysLog(fmt.Sprintf("[CustomPass-FailedTask-Settlement] 开始失败任务结算 - 任务ID: %s, 模型: %s, 预收费: %d", 
		localTask.TaskID, localTask.Action, localTask.Quota))

	// Create billing service instance
	billingService := NewCustomPassBillingService()
	
	// Create zero usage for failed task (should result in full refund)
	zeroUsage := &Usage{
		PromptTokens:     0,
		CompletionTokens: 0,
		TotalTokens:      0,
		InputTokens:      0,
		OutputTokens:     0,
	}

	common.SysLog(fmt.Sprintf("[CustomPass-FailedTask-Settlement] 失败任务使用零使用量进行结算 - 模型: %s, usage全部为0", localTask.Action))

	// 使用从任务属性中保存的计费信息，而不是重新计算
	var groupRatio, userRatio float64 = 1.0, 1.0
	var userGroup string = "default"
	
	// 优先使用任务创建时保存的计费信息
	if localTask.Properties.BillingInfo != nil {
		billingInfo := localTask.Properties.BillingInfo
		groupRatio = billingInfo.GroupRatio
		
		// 使用保存的用户组倍率（分组特殊倍率）
		if billingInfo.HasSpecialRatio {
			userRatio = billingInfo.UserGroupRatio
		}
		
		// 打印完整的保存计费信息（失败任务版本）
		common.SysLog(fmt.Sprintf("[CustomPass-FailedTask-Settlement] ========== 使用保存的计费信息（失败任务） =========="))
		common.SysLog(fmt.Sprintf("[CustomPass-FailedTask-Settlement] 任务ID: %s, 模型: %s, 用户ID: %d", localTask.TaskID, localTask.Action, localTask.UserId))
		common.SysLog(fmt.Sprintf("[CustomPass-FailedTask-Settlement] 预收费金额: %d", localTask.Quota))
		common.SysLog(fmt.Sprintf("[CustomPass-FailedTask-Settlement] 保存的计费信息详情:"))
		common.SysLog(fmt.Sprintf("[CustomPass-FailedTask-Settlement]   - 组倍率 (GroupRatio): %.6f", billingInfo.GroupRatio))
		common.SysLog(fmt.Sprintf("[CustomPass-FailedTask-Settlement]   - 用户组倍率 (UserGroupRatio): %.6f", billingInfo.UserGroupRatio))
		common.SysLog(fmt.Sprintf("[CustomPass-FailedTask-Settlement]   - 模型倍率 (ModelRatio): %.6f", billingInfo.ModelRatio))
		common.SysLog(fmt.Sprintf("[CustomPass-FailedTask-Settlement]   - 补全倍率 (CompletionRatio): %.6f", billingInfo.CompletionRatio))
		common.SysLog(fmt.Sprintf("[CustomPass-FailedTask-Settlement]   - 模型价格 (ModelPrice): %.6f", billingInfo.ModelPrice))
		common.SysLog(fmt.Sprintf("[CustomPass-FailedTask-Settlement]   - 计费模式 (BillingMode): %s", billingInfo.BillingMode))
		common.SysLog(fmt.Sprintf("[CustomPass-FailedTask-Settlement]   - 使用特殊倍率 (HasSpecialRatio): %t", billingInfo.HasSpecialRatio))
		common.SysLog(fmt.Sprintf("[CustomPass-FailedTask-Settlement] 最终使用的倍率:"))
		common.SysLog(fmt.Sprintf("[CustomPass-FailedTask-Settlement]   - 组倍率: %.6f", groupRatio))
		common.SysLog(fmt.Sprintf("[CustomPass-FailedTask-Settlement]   - 用户倍率: %.6f", userRatio))
		common.SysLog(fmt.Sprintf("[CustomPass-FailedTask-Settlement] 失败任务将使用零使用量进行结算（全额退费）"))
		common.SysLog(fmt.Sprintf("[CustomPass-FailedTask-Settlement] ================================================"))
	} else {
		// 向后兼容：如果没有保存的计费信息，则使用原有的计算方式
		common.SysLog(fmt.Sprintf("[CustomPass-FailedTask-Settlement] 未找到保存的计费信息，使用向后兼容方式计算倍率"))
		
		// Get user information for group
		if user, err := model.GetUserById(localTask.UserId, false); err == nil {
			userGroup = user.Group
		}

		// Calculate ratios for settlement
		groupRatio = ratio_setting.GetGroupRatio(userGroup)
		
		// Check for user group special ratio
		if specialRatio, hasSpecial := ratio_setting.GetGroupGroupRatio(userGroup, userGroup); hasSpecial {
			userRatio = specialRatio
		}
		
		common.SysLog(fmt.Sprintf("[CustomPass-FailedTask-Settlement] 向后兼容计算结果 - 组倍率: %.6f, 用户组倍率: %.6f", groupRatio, userRatio))
	}

	// Create a mock context for ProcessSettlement
	c := &gin.Context{}
	
	// Get token information - TODO: improve this by storing token info in task
	var tokenID int = 0
	var tokenName string = "system"
	
	// Perform settlement using the billing service (zero usage should result in full refund)
	err := billingService.ProcessSettlement(
		c,
		localTask.UserId,
		localTask.Action,           // model name
		int64(localTask.Quota),     // precharge amount
		zeroUsage,                  // zero usage for failed task
		localTask.ChannelId,        // channel ID
		tokenID,                    // token ID
		tokenName,                  // token name
		userGroup,                  // user group
		groupRatio,
		userRatio,
	)

	if err != nil {
		common.SysError(fmt.Sprintf("Failed to perform failed task settlement for %s: %v", localTask.TaskID, err))
		common.SysLog(fmt.Sprintf("[CustomPass-FailedTask-Settlement] 失败任务结算失败 - 错误: %v", err))
		return
	}

	common.SysLog(fmt.Sprintf("[CustomPass-FailedTask-Settlement] 失败任务结算完成 - 任务ID: %s, 预收费: %d, 应全额退费", 
		localTask.TaskID, localTask.Quota))
}
