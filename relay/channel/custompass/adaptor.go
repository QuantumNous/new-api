package custompass

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"github.com/gin-gonic/gin"
	"io"
	"net/http"
	"one-api/common"
	"one-api/constant"
	"one-api/dto"
	"one-api/relay/channel"
	relaycommon "one-api/relay/common"
	"one-api/service"
	"strings"
	"time"
)

type TaskAdaptor struct {
	ChannelType int
}



// SubmitRequest 提交请求结构
type SubmitRequest struct {
	// 这里可以是任意的JSON结构，因为是透传
	Data map[string]interface{} `json:"-"`
}

// SubmitResponse 提交响应结构
type SubmitResponse struct {
	Code  int         `json:"code"`
	Msg   string      `json:"msg"`
	Data  interface{} `json:"data"` // 支持任意类型的data字段，可以是string、map或其他类型
	Usage *dto.Usage  `json:"usage,omitempty"`
}

// TaskQueryRequest 任务查询请求结构
type TaskQueryRequest struct {
	TaskIds []string `json:"task_ids"`
	Status  []string `json:"status,omitempty"`
}

// TaskQueryResponse 任务查询响应结构
type TaskQueryResponse struct {
	Code int        `json:"code"`
	Msg  string     `json:"msg"`
	Data []TaskInfo `json:"data"`
}

// TaskInfo 任务信息
type TaskInfo struct {
	TaskId   string  `json:"task_id"`
	Status   string  `json:"status"`
	Progress string  `json:"progress"`
	Error    *string `json:"error"`
}

func (a *TaskAdaptor) ParseResultUrl(resp map[string]any) (string, error) {
	return "", nil // 自定义透传渠道不需要解析结果URL
}

func (a *TaskAdaptor) Init(info *relaycommon.TaskRelayInfo) {
	a.ChannelType = info.ChannelType
}

// ValidateRequestAndSetAction 验证请求并设置动作
func (a *TaskAdaptor) ValidateRequestAndSetAction(c *gin.Context, info *relaycommon.TaskRelayInfo) *dto.TaskError {
	if c == nil {
		return service.TaskErrorWrapperLocal(fmt.Errorf("gin context is nil"), "invalid_request", http.StatusBadRequest)
	}
	if info == nil {
		return service.TaskErrorWrapperLocal(fmt.Errorf("TaskRelayInfo is nil"), "invalid_request", http.StatusBadRequest)
	}

	// 从 info.OriginModelName 中获取模型名称
	// 对于submit任务，模型名称格式为 "model/submit"
	model := info.OriginModelName
	if model == "" {
		return service.TaskErrorWrapperLocal(fmt.Errorf("model is required"), "invalid_request", http.StatusBadRequest)
	}

	// 验证是否为submit任务
	if !strings.HasSuffix(model, "/submit") {
		return service.TaskErrorWrapperLocal(fmt.Errorf("invalid submit model: %s", model), "invalid_request", http.StatusBadRequest)
	}

	// 对于submit任务，action固定为"submit"
	info.Action = "submit"

	// 根据HTTP方法处理请求数据
	var requestData map[string]interface{}
	if c.Request.Method == "GET" {
		// GET请求：从查询参数中获取数据
		requestData = make(map[string]interface{})
		if c.Request != nil && c.Request.URL != nil {
			for key, values := range c.Request.URL.Query() {
				if len(values) == 1 {
					requestData[key] = values[0]
				} else {
					requestData[key] = values
				}
			}
		}
	} else {
		// POST请求：从请求体中读取数据
		if err := common.UnmarshalBodyReusable(c, &requestData); err != nil {
			return service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
		}
	}

	c.Set("custompass_request", requestData)
	return nil
}

// BuildRequestURL 构建请求URL
func (a *TaskAdaptor) BuildRequestURL(info *relaycommon.TaskRelayInfo) (string, error) {
	if info == nil {
		return "", fmt.Errorf("TaskRelayInfo is nil")
	}

	// 检查BaseUrl是否为空
	if info.BaseUrl == "" {
		return "", fmt.Errorf("base_url is required for CustomPass channel")
	}

	// 构建上游URL: baseurl/{model}
	// info.OriginModelName 现在是完整的模型名称格式，如 "gpt-4/submit"
	// 直接使用模型名称构建上游URL
	modelName := info.OriginModelName
	if modelName == "" {
		return "", fmt.Errorf("model name is required")
	}
	baseURL := fmt.Sprintf("%s/%s", info.BaseUrl, modelName)
	return baseURL, nil
}

// BuildRequestHeader 构建请求头
func (a *TaskAdaptor) BuildRequestHeader(c *gin.Context, req *http.Request, info *relaycommon.TaskRelayInfo) error {
	if req == nil {
		return fmt.Errorf("http request is nil")
	}
	if info == nil {
		return fmt.Errorf("TaskRelayInfo is nil")
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+info.ApiKey)
	// 只有在配置了环境变量且TokenKey不为空时才添加客户端token到header中
	if constant.CustomPassHeaderKey != "" && info.TokenKey != "" {
		req.Header.Set(constant.CustomPassHeaderKey, info.TokenKey)
	}
	return nil
}

// BuildRequestBody 构建请求体
func (a *TaskAdaptor) BuildRequestBody(c *gin.Context, info *relaycommon.TaskRelayInfo) (io.Reader, error) {
	// GET请求通常没有请求体
	if c.Request.Method == "GET" {
		return nil, nil
	}

	v, exists := c.Get("custompass_request")
	if !exists {
		return nil, fmt.Errorf("request not found in context")
	}

	requestData := v.(map[string]interface{})
	data, err := json.Marshal(requestData)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(data), nil
}

// DoRequest 执行请求
func (a *TaskAdaptor) DoRequest(c *gin.Context, info *relaycommon.TaskRelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoTaskApiRequest(a, c, info, requestBody)
}

// DoResponse 处理响应
func (a *TaskAdaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.TaskRelayInfo) (taskID string, taskData []byte, taskErr *dto.TaskError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "read_response_body_failed", http.StatusInternalServerError)
		return
	}

	// 如果启用了完全透传模式，需要先提取usage信息再返回上游响应
	if constant.CustomPassFullPassthrough {
		// 尝试从响应中提取usage信息用于计费
		a.extractUsageFromResponse(responseBody, c)

		// 直接返回上游响应
		c.Data(resp.StatusCode, resp.Header.Get("Content-Type"), responseBody)
		return "", responseBody, nil
	}

	// 判断是否为提交任务的action
	// 如果action包含"submit"关键词，则认为是提交任务
	isSubmitAction := a.isSubmitAction(info.Action, responseBody)

	if !isSubmitAction {
		// 普通action，直接返回上游响应
		c.Data(resp.StatusCode, resp.Header.Get("Content-Type"), responseBody)
		return "", responseBody, nil
	}

	// 提交任务的处理逻辑
	var submitResp SubmitResponse
	if err := json.Unmarshal(responseBody, &submitResp); err != nil {
		taskErr = service.TaskErrorWrapper(err, "parse_response_failed", http.StatusInternalServerError)
		// 将原始响应体添加到错误信息中
		taskErr.Data = map[string]interface{}{
			"raw_response": string(responseBody),
		}
		return
	}

	// 检查响应状态
	if submitResp.Code != 0 {
		taskErr = service.TaskErrorWrapper(fmt.Errorf(submitResp.Msg), "upstream_error", http.StatusBadRequest)
		// 将原始响应体添加到错误信息中
		taskErr.Data = map[string]interface{}{
			"raw_response": string(responseBody),
		}
		return
	}

	// 从响应中提取task_id
	if submitResp.Data != nil {
		// 尝试处理不同类型的data字段
		switch dataValue := submitResp.Data.(type) {
		case map[string]interface{}:
			// data是map类型，从中提取task_id
			if taskIdInterface, exists := dataValue["task_id"]; exists {
				if taskIdStr, ok := taskIdInterface.(string); ok {
					taskID = taskIdStr
				} else {
					taskErr = service.TaskErrorWrapper(fmt.Errorf("invalid task_id format"), "invalid_task_id", http.StatusInternalServerError)
					// 将原始响应体添加到错误信息中
					taskErr.Data = map[string]interface{}{
						"raw_response": string(responseBody),
					}
					return
				}
			} else {
				taskErr = service.TaskErrorWrapper(fmt.Errorf("task_id not found in response"), "task_id_not_found", http.StatusInternalServerError)
				// 将原始响应体添加到错误信息中
				taskErr.Data = map[string]interface{}{
					"raw_response": string(responseBody),
				}
				return
			}
		case string:
			// data是字符串类型，返回错误提示用户data中必须要有task_id
			taskErr = service.TaskErrorWrapper(fmt.Errorf("data field is string type, but task_id must be provided in data object"), "task_id_required_in_data", http.StatusBadRequest)
			// 将原始响应体添加到错误信息中
			taskErr.Data = map[string]interface{}{
				"raw_response": string(responseBody),
			}
			return
		default:
			// data是其他类型，返回错误
			taskErr = service.TaskErrorWrapper(fmt.Errorf("unsupported data type for task_id extraction: %T, data must be an object containing task_id", dataValue), "unsupported_data_type", http.StatusBadRequest)
			// 将原始响应体添加到错误信息中
			taskErr.Data = map[string]interface{}{
				"raw_response": string(responseBody),
			}
			return
		}
	} else {
		taskErr = service.TaskErrorWrapper(fmt.Errorf("response data is nil"), "response_data_nil", http.StatusInternalServerError)
		// 将原始响应体添加到错误信息中
		taskErr.Data = map[string]interface{}{
			"raw_response": string(responseBody),
		}
		return
	}

	// 提取usage信息并存储到context中，用于后续费用计算
	if submitResp.Usage != nil {
		c.Set("custompass_usage", submitResp.Usage)
		common.SysLog(fmt.Sprintf("CustomPass 提取到usage信息: prompt_tokens=%d, completion_tokens=%d, total_tokens=%d",
			submitResp.Usage.PromptTokens, submitResp.Usage.CompletionTokens, submitResp.Usage.TotalTokens))
	} else {
		common.SysLog("CustomPass 未检测到usage信息，将使用按次计费或0费用")
	}

	// 返回任务ID给客户端
	c.JSON(http.StatusOK, gin.H{"task_id": taskID})
	return taskID, responseBody, nil
}

// isSubmitAction 判断是否为提交任务的action
func (a *TaskAdaptor) isSubmitAction(action string, responseBody []byte) bool {
	// 1. 根据action名称判断
	submitKeywords := []string{"submit"}
	actionLower := strings.ToLower(action)
	for _, keyword := range submitKeywords {
		if strings.Contains(actionLower, keyword) {
			return true
		}
	}
	return false
}

// extractUsageFromResponse 从响应中提取usage信息用于计费
func (a *TaskAdaptor) extractUsageFromResponse(responseBody []byte, c *gin.Context) {
	// 尝试解析响应为JSON
	var respData map[string]interface{}
	if err := json.Unmarshal(responseBody, &respData); err != nil {
		common.SysLog("CustomPass 完全透传模式：无法解析响应为JSON，跳过usage提取")
		return
	}

	// 方法1：尝试从根级别的usage字段提取
	if usageData, exists := respData["usage"]; exists {
		if usage := a.parseUsageFromInterface(usageData); usage != nil {
			c.Set("custompass_usage", usage)
			common.SysLog(fmt.Sprintf("CustomPass 完全透传模式：从根级别提取到usage信息: prompt_tokens=%d, completion_tokens=%d, total_tokens=%d",
				usage.PromptTokens, usage.CompletionTokens, usage.TotalTokens))
			return
		}
	}

	// 方法2：尝试从data.usage字段提取（适用于某些API格式）
	if dataField, exists := respData["data"]; exists {
		if dataMap, ok := dataField.(map[string]interface{}); ok {
			if usageData, exists := dataMap["usage"]; exists {
				if usage := a.parseUsageFromInterface(usageData); usage != nil {
					c.Set("custompass_usage", usage)
					common.SysLog(fmt.Sprintf("CustomPass 完全透传模式：从data字段提取到usage信息: prompt_tokens=%d, completion_tokens=%d, total_tokens=%d",
						usage.PromptTokens, usage.CompletionTokens, usage.TotalTokens))
					return
				}
			}
		}
	}

	common.SysLog("CustomPass 完全透传模式：未检测到usage信息，将使用按次计费或0费用")
}

// parseUsageFromInterface 从interface{}中解析usage信息
func (a *TaskAdaptor) parseUsageFromInterface(usageData interface{}) *dto.Usage {
	usageMap, ok := usageData.(map[string]interface{})
	if !ok {
		return nil
	}

	var usage dto.Usage
	var hasValidData bool

	// 提取prompt_tokens
	if promptTokens, ok := usageMap["prompt_tokens"].(float64); ok {
		usage.PromptTokens = int(promptTokens)
		hasValidData = true
	}

	// 提取completion_tokens
	if completionTokens, ok := usageMap["completion_tokens"].(float64); ok {
		usage.CompletionTokens = int(completionTokens)
		hasValidData = true
	}

	// 提取total_tokens
	if totalTokens, ok := usageMap["total_tokens"].(float64); ok {
		usage.TotalTokens = int(totalTokens)
		hasValidData = true
	} else if hasValidData {
		// 如果没有total_tokens但有其他token信息，计算总数
		usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
	}

	// 只有在提取到有效数据且总token数大于0时才返回usage
	if hasValidData && usage.TotalTokens > 0 {
		return &usage
	}

	return nil
}

// FetchTask 获取任务状态
func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any) (*http.Response, error) {
	// 检查baseUrl是否为空
	if baseUrl == "" {
		return nil, fmt.Errorf("base_url is required for CustomPass channel")
	}

	// 从body中提取模型名称和task_ids
	modelName, ok := body["model"].(string)
	if !ok {
		return nil, fmt.Errorf("model is required")
	}

	// 对于任务查询，需要去掉模型名称中的 /submit 后缀
	// 因为查询URL应该是 baseUrl/model/task/list-by-condition
	// 而不是 baseUrl/model/submit/task/list-by-condition
	if modelName == "" {
		return nil, fmt.Errorf("model name is required")
	}

	// 如果模型名称以 /submit 结尾，去掉这个后缀
	if strings.HasSuffix(modelName, "/submit") {
		modelName = strings.TrimSuffix(modelName, "/submit")
	}

	taskIds, ok := body["task_ids"].([]string)
	if !ok {
		return nil, fmt.Errorf("task_ids is required")
	}

	// 构建查询请求
	queryReq := TaskQueryRequest{
		TaskIds: taskIds,
	}

	requestUrl := fmt.Sprintf("%s/%s/task/list-by-condition", baseUrl, modelName)
	common.SysLog(fmt.Sprintf("CustomPass FetchTask 请求URL: %s, 任务数量: %d", requestUrl, len(taskIds)))

	byteBody, err := json.Marshal(queryReq)
	if err != nil {
		return nil, err
	}

	common.SysLog(fmt.Sprintf("CustomPass FetchTask 请求体: %s", string(byteBody)))

	req, err := http.NewRequest("POST", requestUrl, bytes.NewBuffer(byteBody))
	if err != nil {
		return nil, err
	}

	// 设置超时时间
	timeout := time.Second * 15
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	req = req.WithContext(ctx)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+key)

	// 只有在配置了环境变量时才从body中获取客户端token并添加到header中
	if constant.CustomPassHeaderKey != "" {
		if clientToken, exists := body["client_token"].(string); exists && clientToken != "" {
			req.Header.Set(constant.CustomPassHeaderKey, clientToken)
			common.SysLog(fmt.Sprintf("CustomPass FetchTask 添加客户端token到header: %s (key: %s)", clientToken, constant.CustomPassHeaderKey))
		}
	}

	return service.GetHttpClient().Do(req)
}

func (a *TaskAdaptor) GetModelList() []string {
	// 自定义透传渠道支持任意模型名称
	return []string{}
}

func (a *TaskAdaptor) GetChannelName() string {
	return "custompass"
}

// extractModelAndActionFromModelAction 从 model_action 中分离出 model 和 action
// 例如：gpt-4/chat -> model: gpt-4, action: chat
func extractModelAndActionFromModelAction(modelAction string) (string, string) {
	// 查找最后一个 "/" 的位置，以支持 model 名称中包含 "/"
	lastSlashIndex := strings.LastIndex(modelAction, "/")
	if lastSlashIndex == -1 || lastSlashIndex == len(modelAction)-1 {
		return "", ""
	}

	model := modelAction[:lastSlashIndex]
	action := modelAction[lastSlashIndex+1:]
	return model, action
}
