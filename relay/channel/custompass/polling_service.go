package custompass

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
	"one-api/service"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

// PollingService interface defines task polling operations for CustomPass
type PollingService interface {
	// Start starts the polling service
	Start() error

	// Stop stops the polling service
	Stop() error

	// PollTasks polls all active tasks and updates their status
	PollTasks() error

	// ProcessTaskUpdates processes task updates from upstream API
	ProcessTaskUpdates(tasks []*model.Task, taskInfos []*TaskInfo, mapping *CustomPassStatusMapping) error

	// HandleTaskCompletion handles completed task settlement
	HandleTaskCompletion(task *model.Task, taskInfo *TaskInfo) error

	// HandleTaskFailure handles failed task refund
	HandleTaskFailure(task *model.Task, taskInfo *TaskInfo) error

	// QueryChannelTasks queries tasks for a specific channel
	QueryChannelTasks(channel *model.Channel, tasks []*model.Task) error
}

// PollingServiceImpl implements PollingService
type PollingServiceImpl struct {
	config           *CustomPassConfig
	prechargeService service.CustomPassPrechargeService
	authService      service.CustomPassAuthService
	billingService   service.CustomPassBillingService
	httpClient       *http.Client

	// Control channels for start/stop
	ctx       context.Context
	cancel    context.CancelFunc
	stopCh    chan struct{}
	isRunning bool
	mu        sync.RWMutex

	// Concurrency control
	semaphore chan struct{}
}

// NewPollingService creates a new CustomPass polling service instance
func NewPollingService() PollingService {
	config := loadPollingConfigFromEnv()

	httpClient := &http.Client{
		Timeout: time.Duration(config.TaskTimeout) * time.Second,
	}

	service := &PollingServiceImpl{
		config:           config,
		prechargeService: service.NewCustomPassPrechargeService(),
		authService:      service.NewCustomPassAuthService(),
		billingService:   service.NewCustomPassBillingService(),
		httpClient:       httpClient,
		stopCh:           make(chan struct{}),
		semaphore:        make(chan struct{}, config.MaxConcurrent),
	}

	return service
}

// loadPollingConfigFromEnv loads polling configuration from environment variables
func loadPollingConfigFromEnv() *CustomPassConfig {
	config := GetDefaultConfig()

	// Load from environment variables
	if pollInterval := os.Getenv(EnvPollInterval); pollInterval != "" {
		if interval, err := strconv.Atoi(pollInterval); err == nil && interval > 0 {
			config.PollInterval = interval
		}
	}

	if taskTimeout := os.Getenv(EnvTaskTimeout); taskTimeout != "" {
		if timeout, err := strconv.Atoi(taskTimeout); err == nil && timeout > 0 {
			config.TaskTimeout = timeout
		}
	}

	if maxConcurrent := os.Getenv(EnvMaxConcurrent); maxConcurrent != "" {
		if concurrent, err := strconv.Atoi(maxConcurrent); err == nil && concurrent > 0 {
			config.MaxConcurrent = concurrent
		}
	}

	if taskMaxLifetime := os.Getenv(EnvTaskMaxLifetime); taskMaxLifetime != "" {
		if lifetime, err := strconv.Atoi(taskMaxLifetime); err == nil && lifetime > 0 {
			config.TaskMaxLifetime = lifetime
		}
	}

	if batchSize := os.Getenv(EnvBatchSize); batchSize != "" {
		if size, err := strconv.Atoi(batchSize); err == nil && size > 0 && size <= 1000 {
			config.BatchSize = size
		}
	}

	// Load status mappings
	if statusSuccess := os.Getenv(EnvStatusSuccess); statusSuccess != "" {
		config.StatusSuccess = strings.Split(statusSuccess, ",")
	}

	if statusFailed := os.Getenv(EnvStatusFailed); statusFailed != "" {
		config.StatusFailed = strings.Split(statusFailed, ",")
	}

	if statusProcessing := os.Getenv(EnvStatusProcessing); statusProcessing != "" {
		config.StatusProcessing = strings.Split(statusProcessing, ",")
	}

	return config
}

// Start starts the polling service
func (s *PollingServiceImpl) Start() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.isRunning {
		return fmt.Errorf("polling service is already running")
	}

	// Validate configuration
	if err := s.config.ValidateConfig(); err != nil {
		return fmt.Errorf("invalid polling configuration: %w", err)
	}

	// Create context for cancellation
	s.ctx, s.cancel = context.WithCancel(context.Background())
	s.isRunning = true

	// Start polling goroutine
	go s.pollingLoop()

	common.SysLog(fmt.Sprintf("CustomPass polling service started with interval: %ds, batch size: %d, max concurrent: %d",
		s.config.PollInterval, s.config.BatchSize, s.config.MaxConcurrent))

	return nil
}

// Stop stops the polling service
func (s *PollingServiceImpl) Stop() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.isRunning {
		return fmt.Errorf("polling service is not running")
	}

	// Cancel context and wait for goroutine to finish
	s.cancel()
	s.isRunning = false

	// Send stop signal
	select {
	case s.stopCh <- struct{}{}:
	default:
	}

	common.SysLog("CustomPass polling service stopped")
	return nil
}

// pollingLoop runs the main polling loop
func (s *PollingServiceImpl) pollingLoop() {
	ticker := time.NewTicker(time.Duration(s.config.PollInterval) * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-s.ctx.Done():
			return
		case <-s.stopCh:
			return
		case <-ticker.C:
			if err := s.PollTasks(); err != nil {
				common.SysError(fmt.Sprintf("CustomPass polling error: %v", err))
			}
		}
	}
}

// PollTasks polls all active tasks and updates their status
func (s *PollingServiceImpl) PollTasks() error {
	// Get all active CustomPass tasks
	tasks := s.getActiveTasks()
	common.SysLog(fmt.Sprintf("[CustomPass-Polling-Debug] 开始轮询任务 - 发现活跃任务数量: %d", len(tasks)))
	
	if len(tasks) == 0 {
		return nil
	}

	common.SysLog(fmt.Sprintf("CustomPass polling %d active tasks", len(tasks)))

	// Group tasks by channel
	taskGroups := s.groupTasksByChannel(tasks)

	// Process each channel concurrently
	var wg sync.WaitGroup
	for channelID, channelTasks := range taskGroups {
		wg.Add(1)
		go func(chID int, tasks []*model.Task) {
			defer wg.Done()

			// Acquire semaphore for concurrency control
			s.semaphore <- struct{}{}
			defer func() { <-s.semaphore }()

			if err := s.processChannelTasks(chID, tasks); err != nil {
				common.SysError(fmt.Sprintf("CustomPass polling error for channel %d: %v", chID, err))
			}
		}(channelID, channelTasks)
	}

	wg.Wait()
	return nil
}

// getActiveTasks gets all active CustomPass tasks that need polling
func (s *PollingServiceImpl) getActiveTasks() []*model.Task {
	var tasks []*model.Task

	// Query tasks that are not in final state and belong to CustomPass platform
	err := model.DB.Where("platform = ? AND status NOT IN (?, ?) AND submit_time > ?",
		constant.TaskPlatformCustomPass,
		model.TaskStatusSuccess,
		model.TaskStatusFailure,
		time.Now().Unix()-int64(s.config.TaskMaxLifetime)).
		Order("submit_time ASC").
		Limit(s.config.BatchSize * 10). // Allow more tasks to be fetched for grouping
		Find(&tasks).Error

	if err != nil {
		common.SysError(fmt.Sprintf("Failed to get active CustomPass tasks: %v", err))
		return nil
	}

	// Filter out expired tasks and mark them as failed
	var activeTasks []*model.Task
	now := time.Now().Unix()
	maxLifetime := int64(s.config.TaskMaxLifetime)

	for _, task := range tasks {
		if now-task.SubmitTime > maxLifetime {
			// Task has exceeded maximum lifetime, mark as failed
			s.handleExpiredTask(task)
		} else {
			activeTasks = append(activeTasks, task)
		}
	}

	return activeTasks
}

// groupTasksByChannel groups tasks by their channel ID
func (s *PollingServiceImpl) groupTasksByChannel(tasks []*model.Task) map[int][]*model.Task {
	groups := make(map[int][]*model.Task)

	for _, task := range tasks {
		groups[task.ChannelId] = append(groups[task.ChannelId], task)
	}

	return groups
}

// groupTasksByModel groups tasks by their model name (Action field)
func (s *PollingServiceImpl) groupTasksByModel(tasks []*model.Task) map[string][]*model.Task {
	groups := make(map[string][]*model.Task)

	for _, task := range tasks {
		modelName := task.Action
		if modelName == "" {
			// Use default model name if Action is empty
			modelName = "default"
		}
		groups[modelName] = append(groups[modelName], task)
	}

	return groups
}

// processChannelTasks processes tasks for a specific channel
func (s *PollingServiceImpl) processChannelTasks(channelID int, tasks []*model.Task) error {
	// Get channel information
	channel, err := model.GetChannelById(channelID, false)
	if err != nil {
		return fmt.Errorf("failed to get channel %d: %w", channelID, err)
	}

	if channel == nil {
		return fmt.Errorf("channel %d not found", channelID)
	}

	// Check if channel is enabled
	if channel.Status != 1 {
		// Channel is disabled, mark all tasks as failed
		for _, task := range tasks {
			s.handleChannelDisabledTask(task)
		}
		return nil
	}

	// Group tasks by model (Action field contains model name)
	tasksByModel := s.groupTasksByModel(tasks)

	// Process each model's tasks separately
	for modelName, modelTasks := range tasksByModel {
		// Process tasks in batches for each model
		batchSize := s.config.BatchSize
		for i := 0; i < len(modelTasks); i += batchSize {
			end := i + batchSize
			if end > len(modelTasks) {
				end = len(modelTasks)
			}

			batch := modelTasks[i:end]
			if err := s.QueryChannelModelTasks(channel, batch, modelName); err != nil {
				common.SysError(fmt.Sprintf("Failed to query tasks for channel %d model %s: %v", channelID, modelName, err))
				// Continue with next batch even if current batch fails
			}
		}
	}

	return nil
}

// QueryChannelModelTasks queries tasks for a specific channel and model
func (s *PollingServiceImpl) QueryChannelModelTasks(channel *model.Channel, tasks []*model.Task, modelName string) error {
	if len(tasks) == 0 {
		return nil
	}

	// Extract task IDs
	taskIDs := make([]string, len(tasks))
	for i, task := range tasks {
		taskIDs[i] = task.TaskID
	}

	// Build query request
	queryRequest := &TaskQueryRequest{
		TaskIDs: taskIDs,
	}

	// Build query URL using model-specific endpoint
	baseURL := channel.GetBaseURL()
	if !strings.HasSuffix(baseURL, "/") {
		baseURL += "/"
	}
	// Remove /submit suffix from model name for URL construction
	cleanModelName := strings.TrimSuffix(modelName, "/submit")
	queryURL := fmt.Sprintf("%s%s/task/list-by-condition", baseURL, cleanModelName)

	// Build request body
	requestBody, err := json.Marshal(queryRequest)
	if err != nil {
		return fmt.Errorf("failed to marshal query request: %w", err)
	}

	// Create HTTP request
	req, err := http.NewRequestWithContext(s.ctx, "POST", queryURL, bytes.NewBuffer(requestBody))
	if err != nil {
		return fmt.Errorf("failed to create query request: %w", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+channel.Key)

	// Send request
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send query request: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read query response: %w", err)
	}

	// Log raw response before parsing
	common.SysLog(fmt.Sprintf("[CustomPass-Polling-Debug] 原始查询响应: %s", string(responseBody)))
	
	// Parse response
	var queryResponse TaskQueryResponse
	if err := json.Unmarshal(responseBody, &queryResponse); err != nil {
		return fmt.Errorf("failed to parse query response: %w", err)
	}

	// Log parsed response structure before validation
	common.SysLog(fmt.Sprintf("[CustomPass-Polling-Debug] 验证前的查询响应内容 - Code: %v, Message: %s, Msg: %s, Data数量: %d", 
		queryResponse.Code, queryResponse.Message, queryResponse.Msg, len(queryResponse.Data)))
	
	// Validate response
	if err := queryResponse.ValidateResponse(); err != nil {
		common.SysError(fmt.Sprintf("[CustomPass-Polling-Debug] 查询响应验证失败: %v", err))
		return fmt.Errorf("invalid query response: %w", err)
	}

	// Check if response indicates success
	if !queryResponse.IsSuccess() {
		return fmt.Errorf("query request failed: %s", queryResponse.GetMessage())
	}

	// Process task updates
	statusMapping := s.config.GetStatusMapping()
	return s.ProcessTaskUpdates(tasks, queryResponse.Data, statusMapping)
}

// QueryChannelTasks queries tasks for a specific channel (backward compatibility)
// This method groups tasks by model and queries each model separately
func (s *PollingServiceImpl) QueryChannelTasks(channel *model.Channel, tasks []*model.Task) error {
	// Group tasks by model
	tasksByModel := s.groupTasksByModel(tasks)

	// Query each model's tasks separately
	for modelName, modelTasks := range tasksByModel {
		if err := s.QueryChannelModelTasks(channel, modelTasks, modelName); err != nil {
			return err
		}
	}

	return nil
}

// ProcessTaskUpdates processes task updates from upstream API
func (s *PollingServiceImpl) ProcessTaskUpdates(tasks []*model.Task, taskInfos []*TaskInfo, mapping *CustomPassStatusMapping) error {
	if len(taskInfos) == 0 {
		return nil
	}

	// Create a map for quick lookup
	taskInfoMap := make(map[string]*TaskInfo)
	for _, taskInfo := range taskInfos {
		if err := taskInfo.ValidateTaskInfo(); err != nil {
			common.SysError(fmt.Sprintf("Invalid task info for task %s: %v", taskInfo.TaskID, err))
			continue
		}
		taskInfoMap[taskInfo.TaskID] = taskInfo
	}

	// Process each task
	for _, task := range tasks {
		taskInfo, exists := taskInfoMap[task.TaskID]
		if !exists {
			// Task not found in response, might be deleted or not available
			common.SysLog(fmt.Sprintf("Task %s not found in query response", task.TaskID))
			continue
		}

		if err := s.processTaskUpdate(task, taskInfo, mapping); err != nil {
			common.SysError(fmt.Sprintf("Failed to process task update for %s: %v", task.TaskID, err))
		}
	}

	return nil
}

// processTaskUpdate processes a single task update
func (s *PollingServiceImpl) processTaskUpdate(task *model.Task, taskInfo *TaskInfo, mapping *CustomPassStatusMapping) error {
	// Map upstream status to system status
	mappedStatus := MapUpstreamStatus(taskInfo.Status, mapping)

	// Check if status has changed
	currentStatus := string(task.Status)
	if currentStatus == mappedStatus {
		// Status hasn't changed, only update progress if available
		if taskInfo.Progress != "" && taskInfo.Progress != task.Progress {
			task.Progress = taskInfo.Progress
			task.UpdatedAt = time.Now().Unix()
			// Skip database update in test environment
			if model.DB != nil {
				if err := task.Update(); err != nil {
					return fmt.Errorf("failed to update task progress: %w", err)
				}
			}
		}
		return nil
	}

	// Status has changed, update task
	task.Status = model.TaskStatus(mappedStatus)
	task.UpdatedAt = time.Now().Unix()

	// Update progress if available
	if taskInfo.Progress != "" {
		task.Progress = taskInfo.Progress
	}

	// Update task data with latest upstream query response
	if queryRespBytes, err := json.Marshal(taskInfo); err == nil {
		task.Data = json.RawMessage(queryRespBytes)
	}

	// Handle status-specific logic
	switch mappedStatus {
	case "SUCCESS":
		task.FinishTime = time.Now().Unix()
		if taskInfo.Progress == "" {
			task.Progress = "100%"
		}
		if err := s.HandleTaskCompletion(task, taskInfo); err != nil {
			return fmt.Errorf("failed to handle task completion: %w", err)
		}

	case "FAILURE":
		task.FinishTime = time.Now().Unix()
		if taskInfo.Error != "" {
			task.FailReason = taskInfo.Error
		}
		if err := s.HandleTaskFailure(task, taskInfo); err != nil {
			return fmt.Errorf("failed to handle task failure: %w", err)
		}

	case "IN_PROGRESS":
		if task.StartTime == 0 {
			task.StartTime = time.Now().Unix()
		}
	}

	// Save task updates (skip in test environment)
	if model.DB != nil {
		if err := task.Update(); err != nil {
			return fmt.Errorf("failed to update task: %w", err)
		}
	}

	common.SysLog(fmt.Sprintf("Task %s status updated from %s to %s", task.TaskID, currentStatus, mappedStatus))
	return nil
}

// HandleTaskCompletion handles completed task settlement
func (s *PollingServiceImpl) HandleTaskCompletion(task *model.Task, taskInfo *TaskInfo) error {
	common.SysLog(fmt.Sprintf("[CustomPass-TaskCompletion-Debug] 开始处理任务完成结算 - 任务ID: %s, 模型: %s, 预收费: %d", 
		task.TaskID, task.Action, task.Quota))

	// If task has usage information, perform settlement
	if taskInfo.Usage != nil {
		common.SysLog(fmt.Sprintf("[CustomPass-TaskCompletion-Debug] 发现使用量信息 - 输入tokens: %d, 输出tokens: %d, 总tokens: %d", 
			taskInfo.Usage.GetInputTokens(), taskInfo.Usage.GetOutputTokens(), taskInfo.Usage.TotalTokens))

		// Convert TaskInfo.Usage to service.Usage
		serviceUsage := &service.Usage{
			PromptTokens:     taskInfo.Usage.PromptTokens,
			CompletionTokens: taskInfo.Usage.CompletionTokens,
			TotalTokens:      taskInfo.Usage.TotalTokens,
			InputTokens:      taskInfo.Usage.InputTokens,
			OutputTokens:     taskInfo.Usage.OutputTokens,
		}

		// Get user information for group calculation (skip in test environment)
		var userGroup string = "default"
		if model.DB != nil {
			user, err := model.GetUserById(task.UserId, false)
			if err != nil {
				common.SysError(fmt.Sprintf("Failed to get user info for task %s: %v", task.TaskID, err))
			} else {
				userGroup = user.Group
				common.SysLog(fmt.Sprintf("[CustomPass-TaskCompletion-Debug] 获取用户组信息 - 用户ID: %d, 用户组: %s", task.UserId, userGroup))
			}
		}

		common.SysLog(fmt.Sprintf("[CustomPass-TaskCompletion-Debug] 开始计算实际配额 - 模型: %s, 用户组: %s", task.Action, userGroup))

		// Calculate actual quota based on usage using billingService
		groupRatio := s.billingService.CalculateGroupRatio(userGroup)
		userRatio := s.billingService.CalculateUserRatio(task.UserId)
		
		actualQuota, err := s.billingService.CalculatePrechargeAmount(task.Action, serviceUsage, groupRatio, userRatio)
		if err != nil {
			common.SysError(fmt.Sprintf("Failed to calculate actual quota for task %s: %v", task.TaskID, err))
			common.SysLog(fmt.Sprintf("[CustomPass-TaskCompletion-Debug] 计算实际配额失败 - 错误: %v", err))
			// Don't fail the completion, just log the error
		} else {
			common.SysLog(fmt.Sprintf("[CustomPass-TaskCompletion-Debug] 实际配额计算完成 - 实际配额: %d", actualQuota))

			// Perform settlement (refund or additional charge)
			prechargeQuota := int64(task.Quota)
			common.SysLog(fmt.Sprintf("[CustomPass-TaskCompletion-Debug] 开始结算 - 预收费: %d, 实际费用: %d", prechargeQuota, actualQuota))

			if err := s.prechargeService.ProcessSettlement(task.UserId, prechargeQuota, actualQuota); err != nil {
				common.SysError(fmt.Sprintf("Failed to settle task %s: %v", task.TaskID, err))
				common.SysLog(fmt.Sprintf("[CustomPass-TaskCompletion-Debug] 结算失败 - 错误: %v", err))
				// Don't fail the completion, just log the error
			} else {
				// Update task quota to actual amount
				task.Quota = int(actualQuota)
				common.SysLog(fmt.Sprintf("Task %s settled: precharge=%d, actual=%d", task.TaskID, prechargeQuota, actualQuota))
				common.SysLog(fmt.Sprintf("[CustomPass-TaskCompletion-Debug] 结算成功 - 任务配额已更新为: %d", task.Quota))
			}
		}
	} else {
		common.SysLog(fmt.Sprintf("[CustomPass-TaskCompletion-Debug] 任务没有使用量信息，跳过结算 - 任务ID: %s", task.TaskID))
	}

	return nil
}

// HandleTaskFailure handles failed task refund
func (s *PollingServiceImpl) HandleTaskFailure(task *model.Task, taskInfo *TaskInfo) error {
	// Refund the entire precharge amount for failed tasks
	prechargeQuota := int64(task.Quota)
	if prechargeQuota > 0 {
		if err := s.prechargeService.ProcessRefund(task.UserId, prechargeQuota, 0); err != nil {
			common.SysError(fmt.Sprintf("Failed to refund task %s: %v", task.TaskID, err))
			// Don't fail the failure handling, just log the error
		} else {
			common.SysLog(fmt.Sprintf("Task %s refunded: %d quota", task.TaskID, prechargeQuota))
		}
	}

	return nil
}

// handleExpiredTask handles tasks that have exceeded maximum lifetime
func (s *PollingServiceImpl) handleExpiredTask(task *model.Task) {
	task.Status = model.TaskStatusFailure
	task.FinishTime = time.Now().Unix()
	task.FailReason = "Task exceeded maximum lifetime"
	task.UpdatedAt = time.Now().Unix()

	// Refund precharge amount
	prechargeQuota := int64(task.Quota)
	if prechargeQuota > 0 {
		if err := s.prechargeService.ProcessRefund(task.UserId, prechargeQuota, 0); err != nil {
			common.SysError(fmt.Sprintf("Failed to refund expired task %s: %v", task.TaskID, err))
		} else {
			common.SysLog(fmt.Sprintf("Expired task %s refunded: %d quota", task.TaskID, prechargeQuota))
		}
	}

	// Skip database update in test environment
	if model.DB != nil {
		if err := task.Update(); err != nil {
			common.SysError(fmt.Sprintf("Failed to update expired task %s: %v", task.TaskID, err))
		} else {
			common.SysLog(fmt.Sprintf("Task %s marked as expired and failed", task.TaskID))
		}
	}
}

// handleChannelDisabledTask handles tasks for disabled channels
func (s *PollingServiceImpl) handleChannelDisabledTask(task *model.Task) {
	task.Status = model.TaskStatusFailure
	task.FinishTime = time.Now().Unix()
	task.FailReason = "Channel is disabled"
	task.UpdatedAt = time.Now().Unix()

	// Refund precharge amount
	prechargeQuota := int64(task.Quota)
	if prechargeQuota > 0 {
		if err := s.prechargeService.ProcessRefund(task.UserId, prechargeQuota, 0); err != nil {
			common.SysError(fmt.Sprintf("Failed to refund task %s for disabled channel: %v", task.TaskID, err))
		} else {
			common.SysLog(fmt.Sprintf("Task %s refunded for disabled channel: %d quota", task.TaskID, prechargeQuota))
		}
	}

	// Skip database update in test environment
	if model.DB != nil {
		if err := task.Update(); err != nil {
			common.SysError(fmt.Sprintf("Failed to update task %s for disabled channel: %v", task.TaskID, err))
		} else {
			common.SysLog(fmt.Sprintf("Task %s marked as failed due to disabled channel", task.TaskID))
		}
	}
}

// IsRunning returns whether the polling service is currently running
func (s *PollingServiceImpl) IsRunning() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.isRunning
}

// GetConfig returns the current polling configuration
func (s *PollingServiceImpl) GetConfig() *CustomPassConfig {
	return s.config
}

// UpdateConfig updates the polling configuration (requires restart to take effect)
func (s *PollingServiceImpl) UpdateConfig(config *CustomPassConfig) error {
	if err := config.ValidateConfig(); err != nil {
		return fmt.Errorf("invalid configuration: %w", err)
	}

	s.config = config
	s.httpClient.Timeout = time.Duration(config.TaskTimeout) * time.Second
	s.semaphore = make(chan struct{}, config.MaxConcurrent)

	return nil
}

// Global polling service instance
var globalPollingService PollingService

// InitPollingService initializes the global CustomPass polling service
func InitPollingService() error {
	if globalPollingService != nil {
		return fmt.Errorf("CustomPass polling service already initialized")
	}

	globalPollingService = NewPollingService()
	return globalPollingService.Start()
}

// StopPollingService stops the global CustomPass polling service
func StopPollingService() error {
	if globalPollingService == nil {
		return fmt.Errorf("CustomPass polling service not initialized")
	}

	return globalPollingService.Stop()
}

// GetPollingService returns the global CustomPass polling service
func GetPollingService() PollingService {
	return globalPollingService
}
