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
	relaycommon "one-api/relay/common"
	"one-api/relay/helper"
	"one-api/service"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// AsyncAdaptor interface defines asynchronous task operations for CustomPass
type AsyncAdaptor interface {
	// SubmitTask submits an asynchronous task and returns task information
	SubmitTask(c *gin.Context, channel *model.Channel, modelName string) (*TaskSubmitResponse, error)

	// QueryTasks queries multiple tasks by their IDs
	QueryTasks(taskIDs []string, channel *model.Channel, modelName string) (*TaskQueryResponse, error)

	// ProcessTaskSubmission processes task submission with precharge
	ProcessTaskSubmission(c *gin.Context, channel *model.Channel, modelName string, requestBody []byte) (*model.Task, error)

	// HandleTaskCompletion handles task completion and settlement
	HandleTaskCompletion(task *model.Task, taskInfo *TaskInfo, channel *model.Channel) error

	// BuildTaskQueryURL builds the URL for task query endpoint
	BuildTaskQueryURL(baseURL, modelName string) string

	// BuildTaskSubmitURL builds the URL for task submission
	BuildTaskSubmitURL(baseURL, modelName string) string
}

// AsyncAdaptorImpl implements AsyncAdaptor interface
type AsyncAdaptorImpl struct {
	authService      service.CustomPassAuthService
	prechargeService service.CustomPassPrechargeService
	billingService   service.CustomPassBillingService
	httpClient       *http.Client
}

// NewAsyncAdaptor creates a new asynchronous CustomPass adaptor
func NewAsyncAdaptor() AsyncAdaptor {
	return &AsyncAdaptorImpl{
		authService:      service.NewCustomPassAuthService(),
		prechargeService: service.NewCustomPassPrechargeService(),
		billingService:   service.NewCustomPassBillingService(),
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// SubmitTask submits an asynchronous task with two-request flow and returns task information
func (a *AsyncAdaptorImpl) SubmitTask(c *gin.Context, channel *model.Channel, modelName string) (*TaskSubmitResponse, error) {
	// Get user token from context
	userToken := c.GetString("token_key")
	if userToken == "" {
		userToken = c.GetString("token")
	}
	if userToken == "" {
		return nil, &CustomPassError{
			Code:    ErrCodeInvalidRequest,
			Message: "用户token缺失",
		}
	}

	// Validate user token
	user, err := a.authService.ValidateUserToken(userToken)
	if err != nil {
		return nil, &CustomPassError{
			Code:    ErrCodeInvalidRequest,
			Message: "用户认证失败",
			Details: err.Error(),
		}
	}

	// Validate channel access
	err = a.authService.ValidateChannelAccess(user, channel)
	if err != nil {
		return nil, &CustomPassError{
			Code:    ErrCodeInvalidRequest,
			Message: "渠道访问验证失败",
			Details: err.Error(),
		}
	}

	// Get request body
	requestBody, err := common.GetRequestBody(c)
	if err != nil {
		return nil, &CustomPassError{
			Code:    ErrCodeInvalidRequest,
			Message: "读取请求体失败",
			Details: err.Error(),
		}
	}

	// Create initial task record (without precharge)
	task, err := a.ProcessTaskSubmission(c, channel, modelName, requestBody)
	if err != nil {
		return nil, err
	}

	// Check if model requires billing first, like sync adaptor does
	requiresBilling, err := a.checkModelBilling(modelName)
	if err != nil {
		// Update task status to failed on billing check failure
		task.Status = model.TaskStatusFailure
		task.FailReason = err.Error()
		task.Update()
		return nil, err
	}

	var submitResp *TaskSubmitResponse
	var prechargeAmount int64 = 0
	var responseUsage *Usage

	if requiresBilling {
		// Submit task to upstream API using two-request flow (with precharge)
		common.SysLog(fmt.Sprintf("[CustomPass-Async-Debug] 模型%s需要计费，开始异步任务预扣费流程", modelName))
		submitResp, prechargeAmount, responseUsage, err = a.submitTaskToUpstream(c, channel, modelName, requestBody, task)
		if err != nil {
			// Update task status to failed on submission failure
			task.Status = model.TaskStatusFailure
			task.FailReason = err.Error()
			task.Update()
			return nil, err
		}
	} else {
		// Model doesn't require billing, submit task directly without precharge
		common.SysLog(fmt.Sprintf("[CustomPass-Async-Debug] 模型%s不需要计费，直接提交异步任务", modelName))
		submitResp, err = a.submitTaskDirectly(c, channel, modelName, requestBody)
		if err != nil {
			// Update task status to failed on submission failure
			task.Status = model.TaskStatusFailure
			task.FailReason = err.Error()
			task.Update()
			return nil, err
		}
	}

	// Extract task ID from response
	upstreamTaskID, err := submitResp.ExtractTaskID()
	if err != nil {
		// Refund precharge amount and update task status to failed on invalid response
		if prechargeAmount > 0 {
			common.SysLog(fmt.Sprintf("[CustomPass-Async-Debug] 提取任务ID失败，退还预扣费: %d", prechargeAmount))
			if refundErr := a.prechargeService.ProcessRefund(user.Id, prechargeAmount, 0); refundErr != nil {
				common.SysError(fmt.Sprintf("预扣费退款失败: %v", refundErr))
			}
		}
		task.Status = model.TaskStatusFailure
		task.FailReason = err.Error()
		task.Update()
		return nil, err
	}

	// Update task with upstream task ID, status and actual precharge amount
	task.TaskID = upstreamTaskID
	task.Status = model.TaskStatusSubmitted
	task.Progress = "0%"
	task.StartTime = time.Now().Unix()
	task.Quota = int(prechargeAmount) // Set the actual precharge amount that was deducted

	// Store upstream response data
	task.SetData(submitResp.Data)

	err = task.Update()
	if err != nil {
		common.SysError(fmt.Sprintf("更新任务状态失败: %v", err))
	}

	// Record precharge consumption log using system standard mechanism (like sync mode)
	if prechargeAmount > 0 && responseUsage != nil {
		a.recordPrechargeConsumptionLog(c, user, task, modelName, prechargeAmount, responseUsage)
	}

	common.SysLog(fmt.Sprintf("[CustomPass-Async-Debug] 异步任务提交完成 - 任务ID: %s, 预扣费: %d", upstreamTaskID, prechargeAmount))

	return submitResp, nil
}

// QueryTasks queries multiple tasks by their IDs from upstream API
func (a *AsyncAdaptorImpl) QueryTasks(taskIDs []string, channel *model.Channel, modelName string) (*TaskQueryResponse, error) {
	if len(taskIDs) == 0 {
		return &TaskQueryResponse{
			UpstreamResponse: UpstreamResponse{
				Code: 0,
				Data: []*TaskInfo{},
			},
			Data: []*TaskInfo{},
		}, nil
	}

	// Build query request
	queryReq := &TaskQueryRequest{
		TaskIDs: taskIDs,
	}

	requestBody, err := json.Marshal(queryReq)
	if err != nil {
		return nil, &CustomPassError{
			Code:    ErrCodeSystemError,
			Message: "构建查询请求失败",
			Details: err.Error(),
		}
	}

	// Build query URL
	queryURL := a.BuildTaskQueryURL(channel.GetBaseURL(), modelName)

	// Make query request
	queryResp, err := a.makeUpstreamRequest(nil, channel, "POST", queryURL, requestBody)
	if err != nil {
		return nil, err
	}

	// Parse response as TaskQueryResponse
	var taskQueryResp TaskQueryResponse

	// Copy the base response fields
	taskQueryResp.UpstreamResponse = *queryResp

	// Parse the Data field as []*TaskInfo
	if queryResp.Data != nil {
		dataBytes, err := json.Marshal(queryResp.Data)
		if err != nil {
			return nil, &CustomPassError{
				Code:    ErrCodeUpstreamError,
				Message: "序列化任务数据失败",
				Details: err.Error(),
			}
		}

		var taskInfos []*TaskInfo
		if err := json.Unmarshal(dataBytes, &taskInfos); err != nil {
			return nil, &CustomPassError{
				Code:    ErrCodeUpstreamError,
				Message: "解析任务信息失败",
				Details: err.Error(),
			}
		}

		taskQueryResp.Data = taskInfos
	} else {
		taskQueryResp.Data = []*TaskInfo{}
	}

	// Validate task information
	for _, taskInfo := range taskQueryResp.Data {
		if err := taskInfo.ValidateTaskInfo(); err != nil {
			common.SysError(fmt.Sprintf("任务信息验证失败: %v", err))
		}
	}

	return &taskQueryResp, nil
}

// ProcessTaskSubmission processes task submission without precharge logic
// The precharge will be handled by the two-request flow in submitTaskToUpstream
func (a *AsyncAdaptorImpl) ProcessTaskSubmission(c *gin.Context, channel *model.Channel, modelName string, requestBody []byte) (*model.Task, error) {
	// Get user from context
	userToken := c.GetString("token_key")
	if userToken == "" {
		userToken = c.GetString("token")
	}
	user, err := a.authService.ValidateUserToken(userToken)
	if err != nil {
		return nil, err
	}

	// Create task record without precharge (will be handled in two-request flow)
	task := &model.Task{
		Platform:   constant.TaskPlatformCustomPass,
		UserId:     user.Id,
		ChannelId:  channel.Id,
		Action:     modelName, // Use model name as action
		Status:     model.TaskStatusNotStart,
		Progress:   "0%",
		SubmitTime: time.Now().Unix(),
		Properties: model.Properties{
			Input: string(requestBody),
		},
		Quota: 0, // Will be set after two-request flow completes
	}

	// Insert task into database (skip in test environment)
	if model.DB != nil {
		err = task.Insert()
		if err != nil {
			return nil, &CustomPassError{
				Code:    ErrCodeSystemError,
				Message: "创建任务记录失败",
				Details: err.Error(),
			}
		}
	} else {
		// In test environment, simulate successful insertion
		task.ID = 1
	}

	return task, nil
}

// HandleTaskCompletion handles task completion and performs settlement
func (a *AsyncAdaptorImpl) HandleTaskCompletion(task *model.Task, taskInfo *TaskInfo, channel *model.Channel) error {
	// Get status mapping configuration
	config := GetDefaultConfig()
	statusMapping := config.GetStatusMapping()

	// Update task status based on upstream status
	if taskInfo.IsCompleted(statusMapping) {
		task.Status = model.TaskStatusSuccess
		task.Progress = "100%"
		task.FinishTime = time.Now().Unix()

		// Keep original upstream response data - do not overwrite

		// Handle billing settlement if task has precharge
		if task.Quota > 0 {
			err := a.handleTaskSettlement(task, taskInfo)
			if err != nil {
				common.SysError(fmt.Sprintf("任务结算失败: %v", err))
			}
		}

		// Record settlement log (not consumption log, since precharge consumption was already recorded at submission)
		if taskInfo.Usage != nil {
			a.recordTaskSettlementLog(task, taskInfo.Usage)
		}

	} else if taskInfo.IsFailed(statusMapping) {
		task.Status = model.TaskStatusFailure
		task.FailReason = taskInfo.Error
		task.FinishTime = time.Now().Unix()

		// Refund precharge amount for failed tasks
		if task.Quota > 0 {
			err := a.prechargeService.ProcessRefund(task.UserId, int64(task.Quota), 0)
			if err != nil {
				common.SysError(fmt.Sprintf("任务失败退款失败: %v", err))
			}
		}

	} else if taskInfo.IsProcessing(statusMapping) {
		task.Status = model.TaskStatusInProgress
		if taskInfo.Progress != "" {
			task.Progress = taskInfo.Progress
		}
	}

	// Update task in database (skip in test environment)
	if model.DB != nil {
		return task.Update()
	}
	return nil
}

// BuildTaskQueryURL builds the URL for task query endpoint
func (a *AsyncAdaptorImpl) BuildTaskQueryURL(baseURL, modelName string) string {
	// Remove /submit suffix from model name for URL construction
	cleanModelName := strings.TrimSuffix(modelName, "/submit")
	return fmt.Sprintf("%s/%s/task/list-by-condition", strings.TrimSuffix(baseURL, "/"), cleanModelName)
}

// BuildTaskSubmitURL builds the URL for task submission
func (a *AsyncAdaptorImpl) BuildTaskSubmitURL(baseURL, modelName string) string {
	// Remove /submit suffix from model name for URL construction
	cleanModelName := strings.TrimSuffix(modelName, "/submit")
	return fmt.Sprintf("%s/%s/submit", strings.TrimSuffix(baseURL, "/"), cleanModelName)
}

// submitTaskToUpstream submits task to upstream API using two-stage request pattern with proper precharge handling
func (a *AsyncAdaptorImpl) submitTaskToUpstream(c *gin.Context, channel *model.Channel, modelName string, requestBody []byte, task *model.Task) (*TaskSubmitResponse, int64, *Usage, error) {
	// Get user from context for two-request flow
	userToken := c.GetString("token_key")
	if userToken == "" {
		userToken = c.GetString("token")
	}
	user, err := a.authService.ValidateUserToken(userToken)
	if err != nil {
		return nil, 0, nil, &CustomPassError{
			Code:    ErrCodeInvalidRequest,
			Message: "用户认证失败",
			Details: err.Error(),
		}
	}

	// Use the common two-request flow for upstream requests
	params := &TwoRequestParams{
		User:             user,
		Channel:          channel,
		ModelName:        modelName,
		RequestBody:      requestBody,
		AuthService:      a.authService,
		PrechargeService: a.prechargeService,
		BillingService:   a.billingService,
		HTTPClient:       a.httpClient,
	}

	// Execute two-request flow with precharge first, then real request
	common.SysLog(fmt.Sprintf("[CustomPass-Async-Debug] 开始异步任务的二次请求流程 - 模型: %s", modelName))
	result, err := ExecuteTwoRequestFlow(c, params)
	if err != nil {
		common.SysError(fmt.Sprintf("[CustomPass-Async-Debug] 异步任务二次请求失败: %v", err))
		return nil, 0, nil, err
	}

	common.SysLog(fmt.Sprintf("[CustomPass-Async-Debug] 异步任务二次请求完成 - 请求次数: %d, 预扣费金额: %d", 
		result.RequestCount, result.PrechargeAmount))

	// Check if response is successful
	if !result.Response.IsSuccess() {
		// If precharge was done but request failed, the ExecuteTwoRequestFlow should have already handled refund
		// But we add extra protection here
		if result.PrechargeAmount > 0 {
			common.SysLog(fmt.Sprintf("[CustomPass-Async-Debug] 任务提交失败，确保退还预扣费: %d", result.PrechargeAmount))
			if refundErr := a.prechargeService.ProcessRefund(user.Id, result.PrechargeAmount, 0); refundErr != nil {
				common.SysError(fmt.Sprintf("预扣费退款失败: %v", refundErr))
			}
		}
		return nil, 0, nil, &CustomPassError{
			Code:    ErrCodeUpstreamError,
			Message: "任务提交失败",
			Details: result.Response.GetMessage(),
		}
	}

	// For async tasks, we need to handle the response differently based on the submit endpoint
	// Since we're using the submit endpoint, we need to parse the response correctly
	var submitResp TaskSubmitResponse
	
	// If the result response contains task submission data, parse it
	if result.Response.Data != nil {
		respData, err := json.Marshal(result.Response)
		if err != nil {
			// If precharge was done but parsing failed, refund the precharge
			if result.PrechargeAmount > 0 {
				common.SysLog(fmt.Sprintf("[CustomPass-Async-Debug] 响应序列化失败，退还预扣费: %d", result.PrechargeAmount))
				if refundErr := a.prechargeService.ProcessRefund(user.Id, result.PrechargeAmount, 0); refundErr != nil {
					common.SysError(fmt.Sprintf("预扣费退款失败: %v", refundErr))
				}
			}
			return nil, 0, nil, &CustomPassError{
				Code:    ErrCodeUpstreamError,
				Message: "序列化任务提交响应失败",
				Details: err.Error(),
			}
		}
		
		if err := json.Unmarshal(respData, &submitResp); err != nil {
			// If precharge was done but parsing failed, refund the precharge
			if result.PrechargeAmount > 0 {
				common.SysLog(fmt.Sprintf("[CustomPass-Async-Debug] 响应解析失败，退还预扣费: %d", result.PrechargeAmount))
				if refundErr := a.prechargeService.ProcessRefund(user.Id, result.PrechargeAmount, 0); refundErr != nil {
					common.SysError(fmt.Sprintf("预扣费退款失败: %v", refundErr))
				}
			}
			return nil, 0, nil, &CustomPassError{
				Code:    ErrCodeUpstreamError,
				Message: "解析任务提交响应失败",
				Details: err.Error(),
			}
		}
	} else {
		// If no data in response, create a basic response structure
		submitResp = TaskSubmitResponse{
			UpstreamResponse: *result.Response,
		}
	}

	// Return the response, the actual precharge amount that was deducted, and the usage information from precharge
	common.SysLog(fmt.Sprintf("[CustomPass-Async-Debug] 异步任务提交成功，预扣费金额: %d", result.PrechargeAmount))
	return &submitResp, result.PrechargeAmount, result.PrechargeUsage, nil
}

// submitTaskDirectly submits task to upstream API without precharge for free models
func (a *AsyncAdaptorImpl) submitTaskDirectly(c *gin.Context, channel *model.Channel, modelName string, requestBody []byte) (*TaskSubmitResponse, error) {
	// Build submit URL
	submitURL := a.BuildTaskSubmitURL(channel.GetBaseURL(), modelName)

	// Make direct request without precharge
	upstreamResp, err := a.makeUpstreamRequest(c, channel, "POST", submitURL, requestBody)
	if err != nil {
		return nil, err
	}

	// Check if response is successful
	if !upstreamResp.IsSuccess() {
		return nil, &CustomPassError{
			Code:    ErrCodeUpstreamError,
			Message: "任务提交失败",
			Details: upstreamResp.GetMessage(),
		}
	}

	// Parse response as TaskSubmitResponse
	var submitResp TaskSubmitResponse
	respData, _ := json.Marshal(upstreamResp)
	if err := json.Unmarshal(respData, &submitResp); err != nil {
		return nil, &CustomPassError{
			Code:    ErrCodeUpstreamError,
			Message: "解析任务提交响应失败",
			Details: err.Error(),
		}
	}

	return &submitResp, nil
}

func (a *AsyncAdaptorImpl) makeUpstreamRequest(c *gin.Context, channel *model.Channel, method, url string, body []byte) (*UpstreamResponse, error) {
	// Create request with context
	var ctx context.Context
	var cancel context.CancelFunc
	if c != nil {
		ctx, cancel = context.WithTimeout(c.Request.Context(), 30*time.Second)
	} else {
		ctx, cancel = context.WithTimeout(context.Background(), 30*time.Second)
	}
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, method, url, bytes.NewReader(body))
	if err != nil {
		return nil, &CustomPassError{
			Code:    ErrCodeSystemError,
			Message: "创建上游请求失败",
			Details: err.Error(),
		}
	}

	// Build authentication headers
	var userToken string
	if c != nil {
		// Use full_token if available (for CustomPass), otherwise use token_key or token
		userToken = c.GetString("full_token")
		if userToken == "" {
			userToken = c.GetString("token_key")
		}
		if userToken == "" {
			userToken = c.GetString("token")
		}
	}
	headers := a.authService.BuildUpstreamHeaders(channel.Key, userToken)

	// Set headers
	for key, value := range headers {
		req.Header.Set(key, value)
	}

	// Log upstream request details
	common.SysLog(fmt.Sprintf("[CustomPass-Request-Debug] 异步适配器上游API - URL: %s", url))
	common.SysLog(fmt.Sprintf("[CustomPass-Request-Debug] 异步适配器Headers: %+v", headers))
	common.SysLog(fmt.Sprintf("[CustomPass-Request-Debug] 异步适配器Body: %s", string(body)))

	// Make request
	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, &CustomPassError{
			Code:    ErrCodeTimeout,
			Message: "上游API请求失败",
			Details: err.Error(),
		}
	}
	defer resp.Body.Close()

	// Read response body
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, &CustomPassError{
			Code:    ErrCodeUpstreamError,
			Message: "读取上游响应失败",
			Details: err.Error(),
		}
	}

	// Log upstream response
	common.SysLog(fmt.Sprintf("[CustomPass-Response-Debug] 异步适配器响应状态码: %d", resp.StatusCode))
	common.SysLog(fmt.Sprintf("[CustomPass-Response-Debug] 异步适配器响应Body: %s", string(respBody)))

	// Parse response
	upstreamResp, err := ParseUpstreamResponse(respBody)
	if err != nil {
		return nil, err
	}

	// Validate response structure
	if err := upstreamResp.ValidateResponse(); err != nil {
		return nil, err
	}

	return upstreamResp, nil
}

// handleTaskSettlement handles billing settlement for completed tasks
func (a *AsyncAdaptorImpl) handleTaskSettlement(task *model.Task, taskInfo *TaskInfo) error {
	prechargeAmount := int64(task.Quota)
	var actualAmount int64 = prechargeAmount // Default to precharge amount

	// Calculate actual amount if usage is provided
	if taskInfo.Usage != nil {
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
				common.SysError(fmt.Sprintf("获取用户信息失败: %v", err))
				return err
			}
			userGroup = user.Group
		}

		// Calculate actual amount based on real usage using billingService
		groupRatio := a.billingService.CalculateGroupRatio(userGroup)
		userRatio := a.billingService.CalculateUserRatio(task.UserId)
		
		calculatedAmount, err := a.billingService.CalculatePrechargeAmount(task.Action, serviceUsage, groupRatio, userRatio)
		if err != nil {
			common.SysError(fmt.Sprintf("计算实际费用失败: %v", err))
			// Use precharge amount as fallback
		} else {
			actualAmount = calculatedAmount
		}
	}

	// Process settlement (refund or additional charge)
	return a.prechargeService.ProcessSettlement(task.UserId, prechargeAmount, actualAmount)
}

// checkModelBilling checks if the model requires billing
func (a *AsyncAdaptorImpl) checkModelBilling(modelName string) (bool, error) {
	// Handle test environment where DB might be nil
	if model.DB == nil {
		// In test environment, assume billing is required for testing purposes
		// unless the model name contains "free"
		return !strings.Contains(strings.ToLower(modelName), "free"), nil
	}

	// Check if model exists in ability table
	var abilityCount int64
	err := model.DB.Model(&model.Ability{}).Where("model = ? AND enabled = ?", modelName, true).Count(&abilityCount).Error
	if err != nil {
		return false, &CustomPassError{
			Code:    ErrCodeSystemError,
			Message: "查询模型配置失败",
			Details: err.Error(),
		}
	}

	// If model not found in ability table, treat as free model
	return abilityCount > 0, nil
}

// recordPrechargeConsumptionLog records precharge consumption log when task is submitted (like sync mode)
func (a *AsyncAdaptorImpl) recordPrechargeConsumptionLog(c *gin.Context, user *model.User, task *model.Task, modelName string, prechargeAmount int64, usage *Usage) {
	// Skip if not in a real environment
	if model.DB == nil || model.LOG_DB == nil {
		common.SysLog("[CustomPass-Async-Debug] 跳过预扣费日志记录（测试环境）")
		return
	}

	// Build RelayInfo to get consistent group information (like sync adaptor does)
	relayInfo := relaycommon.GenRelayInfo(c)
	
	// Get context information for logging
	tokenName := c.GetString("token_name")
	
	// Use actual usage from the precharge response (not final response - same as sync mode!)
	inputTokens := usage.GetInputTokens()
	outputTokens := usage.GetOutputTokens()
	
	common.SysLog(fmt.Sprintf("[CustomPass-Async-Debug] 使用precharge响应的usage记录日志 - 输入:%d, 输出:%d tokens", inputTokens, outputTokens))
	
	// Get model price data using helper (same as sync adaptor)
	priceData, err := helper.ModelPriceHelper(c, relayInfo, inputTokens, outputTokens)
	if err != nil {
		common.LogError(c.Request.Context(), fmt.Sprintf("获取模型价格数据失败: %v", err))
		// Use default values if price data retrieval fails
		priceData = helper.PriceData{
			ModelRatio:      1.0,
			ModelPrice:      0.0,
			CompletionRatio: 1.0,
			GroupRatioInfo: helper.GroupRatioInfo{
				GroupRatio: a.billingService.CalculateGroupRatio(relayInfo.UsingGroup),
			},
		}
	}
	
	// Generate other info for logging using standard function (same as sync adaptor)
	other := service.GenerateTextOtherInfo(
		c,
		relayInfo,
		priceData.ModelRatio,
		priceData.GroupRatioInfo.GroupRatio,
		priceData.CompletionRatio,
		0,     // cacheTokens
		0.0,   // cacheRatio
		priceData.ModelPrice,
		priceData.GroupRatioInfo.GroupSpecialRatio,
	)
	
	// Record precharge consumption log using the standard function (same as sync adaptor)
	model.RecordConsumeLog(c, user.Id, model.RecordConsumeLogParams{
		ChannelId:        relayInfo.ChannelId,
		PromptTokens:     inputTokens,
		CompletionTokens: outputTokens,
		ModelName:        modelName,
		TokenName:        tokenName,
		Quota:            int(prechargeAmount),
		Content:          fmt.Sprintf("CustomPass异步任务预扣费: %s", modelName),
		IsStream:         false,
		Group:            relayInfo.UsingGroup,
		Other:            other,
	})
	
	common.SysLog(fmt.Sprintf("[CustomPass-Async-Debug] 异步任务预扣费日志记录成功 - 任务ID: %s, 用户: %s, 预扣费配额: %d, 实际tokens(输入:%d,输出:%d)", 
		task.TaskID, user.Username, prechargeAmount, inputTokens, outputTokens))
}

// recordTaskSettlementLog records settlement information for completed tasks (not consumption, since that was recorded at submission)
func (a *AsyncAdaptorImpl) recordTaskSettlementLog(task *model.Task, usage *Usage) {
	// Log settlement details asynchronously to avoid blocking the response
	go func() {
		// Check if LOG_DB is available (might be nil in test environment)
		if model.LOG_DB == nil {
			common.SysError("LOG_DB is not initialized, skipping settlement log")
			return
		}

		// Get user information for proper logging
		user, err := model.GetUserById(task.UserId, false)
		if err != nil {
			common.SysError(fmt.Sprintf("获取用户信息失败，无法记录结算日志: %v", err))
			return
		}

		// Create settlement info log entry (not consumption, since that was already recorded at submission)
		// This is just for tracking the actual usage vs precharge amount
		settlementContent := fmt.Sprintf("CustomPass异步任务结算: %s - 实际使用 输入:%d 输出:%d tokens", 
			task.Action, usage.GetInputTokens(), usage.GetOutputTokens())
		
		if err := model.LOG_DB.Create(&model.Log{
			UserId:           task.UserId,
			CreatedAt:        time.Now().Unix(),
			Type:             model.LogTypeSystem, // Use system log type for settlement tracking
			Content:          settlementContent,
			ModelName:        task.Action,
			Quota:            0, // No quota change, since settlement was handled by prechargeService
			PromptTokens:     usage.GetInputTokens(),
			CompletionTokens: usage.GetOutputTokens(),
			ChannelId:        task.ChannelId,
			TokenName:        "", // Token name not available in async context
			Username:         user.Username,
		}).Error; err != nil {
			common.SysError(fmt.Sprintf("记录结算日志失败: %v", err))
		} else {
			common.SysLog(fmt.Sprintf("[CustomPass-Async-Debug] 异步任务结算日志记录成功 - 任务ID: %s, 用户: %s, 实际使用: 输入%d 输出%d tokens", 
				task.TaskID, user.Username, usage.GetInputTokens(), usage.GetOutputTokens()))
		}
	}()
}

// Convenience functions for external use

// ProcessAsyncTaskSubmission processes an asynchronous task submission
func ProcessAsyncTaskSubmission(c *gin.Context, channel *model.Channel, modelName string) (*TaskSubmitResponse, error) {
	adaptor := NewAsyncAdaptor()
	return adaptor.SubmitTask(c, channel, modelName)
}

// QueryAsyncTasks queries multiple async tasks by their IDs
func QueryAsyncTasks(taskIDs []string, channel *model.Channel, modelName string) (*TaskQueryResponse, error) {
	adaptor := NewAsyncAdaptor()
	return adaptor.QueryTasks(taskIDs, channel, modelName)
}

// BuildAsyncTaskQueryURL builds URL for async task queries
func BuildAsyncTaskQueryURL(baseURL, modelName string) string {
	adaptor := NewAsyncAdaptor()
	return adaptor.BuildTaskQueryURL(baseURL, modelName)
}

// BuildAsyncTaskSubmitURL builds URL for async task submission
func BuildAsyncTaskSubmitURL(baseURL, modelName string) string {
	adaptor := NewAsyncAdaptor()
	return adaptor.BuildTaskSubmitURL(baseURL, modelName)
}

// HandleAsyncTaskCompletion handles completion of an async task
func HandleAsyncTaskCompletion(task *model.Task, taskInfo *TaskInfo, channel *model.Channel) error {
	adaptor := NewAsyncAdaptor()
	return adaptor.HandleTaskCompletion(task, taskInfo, channel)
}
