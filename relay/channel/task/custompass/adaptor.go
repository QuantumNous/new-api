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
	Code  int                    `json:"code"`
	Msg   string                 `json:"msg"`
	Data  map[string]interface{} `json:"data"`
	Usage *dto.Usage             `json:"usage,omitempty"`
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
	TaskId   string                 `json:"task_id"`
	Status   string                 `json:"status"`
	Progress string                 `json:"progress"`
	Result   []map[string]interface{} `json:"result,omitempty"`
	Error    *string                `json:"error"`
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

	// 从URL路径中获取action
	action := c.Param("action")
	if action == "" {
		return service.TaskErrorWrapperLocal(fmt.Errorf("action is required"), "invalid_request", http.StatusBadRequest)
	}

	info.Action = action

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

	// 构建上游URL: baseurl/{model}/{action}
	model := info.OriginModelName
	action := info.Action
	baseURL := fmt.Sprintf("%s/%s/%s", info.BaseUrl, model, action)
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

	// 判断是否为提交任务的action
	// 如果action包含"submit"、"create"、"generate"等关键词，或者响应中包含task_id，则认为是提交任务
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
		return
	}

	// 检查响应状态
	if submitResp.Code != 0 {
		taskErr = service.TaskErrorWrapper(fmt.Errorf(submitResp.Msg), "upstream_error", http.StatusBadRequest)
		return
	}

	// 从响应中提取task_id
	if submitResp.Data != nil {
		if taskIdInterface, exists := submitResp.Data["task_id"]; exists {
			if taskIdStr, ok := taskIdInterface.(string); ok {
				taskID = taskIdStr
			} else {
				taskErr = service.TaskErrorWrapper(fmt.Errorf("invalid task_id format"), "invalid_task_id", http.StatusInternalServerError)
				return
			}
		} else {
			taskErr = service.TaskErrorWrapper(fmt.Errorf("task_id not found in response"), "task_id_not_found", http.StatusInternalServerError)
			return
		}
	} else {
		taskErr = service.TaskErrorWrapper(fmt.Errorf("response data is nil"), "response_data_nil", http.StatusInternalServerError)
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

	// 2. 尝试解析响应，如果包含task_id字段，则认为是提交任务
	var respData map[string]interface{}
	if err := json.Unmarshal(responseBody, &respData); err == nil {
		if data, ok := respData["data"].(map[string]interface{}); ok {
			if _, hasTaskId := data["task_id"]; hasTaskId {
				return true
			}
		}
		// 也检查顶层是否有task_id
		if _, hasTaskId := respData["task_id"]; hasTaskId {
			return true
		}
	}

	return false
}

// FetchTask 获取任务状态
func (a *TaskAdaptor) FetchTask(baseUrl, key string, body map[string]any) (*http.Response, error) {
	// 从body中提取model和task_ids
	model, ok := body["model"].(string)
	if !ok {
		return nil, fmt.Errorf("model is required")
	}
	
	taskIds, ok := body["task_ids"].([]string)
	if !ok {
		return nil, fmt.Errorf("task_ids is required")
	}

	// 构建查询请求
	queryReq := TaskQueryRequest{
		TaskIds: taskIds,
	}

	requestUrl := fmt.Sprintf("%s/%s/task/list-by-condition", baseUrl, model)
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

	return service.GetHttpClient().Do(req)
}

func (a *TaskAdaptor) GetModelList() []string {
	// 自定义透传渠道支持任意模型名称
	return []string{}
}

func (a *TaskAdaptor) GetChannelName() string {
	return "custompass"
}
