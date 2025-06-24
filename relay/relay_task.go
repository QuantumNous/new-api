package relay

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/gin-gonic/gin"
	"io"
	"net/http"
	"one-api/common"
	"one-api/constant"
	"one-api/dto"
	"one-api/model"
	relaycommon "one-api/relay/common"
	relayconstant "one-api/relay/constant"
	"one-api/service"
	"one-api/setting/ratio_setting"
)

/*
Task 任务通过平台、Action 区分任务
*/
func RelayTaskSubmit(c *gin.Context, relayMode int) (taskErr *dto.TaskError) {
	platform := constant.TaskPlatform(c.GetString("platform"))
	relayInfo := relaycommon.GenTaskRelayInfo(c)

	adaptor := GetTaskAdaptor(platform)
	if adaptor == nil {
		return service.TaskErrorWrapperLocal(fmt.Errorf("invalid api platform: %s", platform), "invalid_api_platform", http.StatusBadRequest)
	}
	adaptor.Init(relayInfo)
	// get & validate taskRequest 获取并验证文本请求
	taskErr = adaptor.ValidateRequestAndSetAction(c, relayInfo)
	if taskErr != nil {
		return
	}

	modelName := service.CoverTaskActionToModelName(platform, relayInfo.Action)
	if platform == constant.TaskPlatformKling {
		modelName = relayInfo.OriginModelName
	} else if platform == constant.TaskPlatformCustomPass {
		// 对于自定义透传渠道，使用真实的模型名称而不是 custompass_submit
		modelName = relayInfo.OriginModelName
	}

	var quota int
	var modelPrice float64
	var groupRatio float64
	var userQuota int

	// 获取用户配额
	userQuota, err := model.GetUserQuota(relayInfo.UserId, false)
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "get_user_quota_failed", http.StatusInternalServerError)
		return
	}

	if platform == constant.TaskPlatformCustomPass {
		// CustomPass使用动态费用计算，先进行最小预扣费
		groupRatio = ratio_setting.GetGroupRatio(relayInfo.Group)

		// 对于CustomPass，先预扣最小费用（1个quota单位），实际费用在任务提交后根据usage计算
		quota = 1
		if userQuota-quota < 0 {
			taskErr = service.TaskErrorWrapperLocal(errors.New("user quota is not enough"), "quota_not_enough", http.StatusForbidden)
			return
		}
	} else {
		// 其他平台保持原有逻辑
		modelPrice, success := ratio_setting.GetModelPrice(modelName, true)
		if !success {
			defaultPrice, ok := ratio_setting.GetDefaultModelRatioMap()[modelName]
			if !ok {
				modelPrice = 0.1
			} else {
				modelPrice = defaultPrice
			}
		}

		// 预扣
		groupRatio = ratio_setting.GetGroupRatio(relayInfo.Group)
		ratio := modelPrice * groupRatio
		quota = int(ratio * common.QuotaPerUnit)
		if userQuota-quota < 0 {
			taskErr = service.TaskErrorWrapperLocal(errors.New("user quota is not enough"), "quota_not_enough", http.StatusForbidden)
			return
		}
	}

	if relayInfo.OriginTaskID != "" {
		originTask, exist, err := model.GetByTaskId(relayInfo.UserId, relayInfo.OriginTaskID)
		if err != nil {
			taskErr = service.TaskErrorWrapper(err, "get_origin_task_failed", http.StatusInternalServerError)
			return
		}
		if !exist {
			taskErr = service.TaskErrorWrapperLocal(errors.New("task_origin_not_exist"), "task_not_exist", http.StatusBadRequest)
			return
		}
		if originTask.ChannelId != relayInfo.ChannelId {
			channel, err := model.GetChannelById(originTask.ChannelId, true)
			if err != nil {
				taskErr = service.TaskErrorWrapperLocal(err, "channel_not_found", http.StatusBadRequest)
				return
			}
			if channel.Status != common.ChannelStatusEnabled {
				return service.TaskErrorWrapperLocal(errors.New("该任务所属渠道已被禁用"), "task_channel_disable", http.StatusBadRequest)
			}
			c.Set("base_url", channel.GetBaseURL())
			c.Set("channel_id", originTask.ChannelId)
			c.Request.Header.Set("Authorization", fmt.Sprintf("Bearer %s", channel.Key))

			relayInfo.BaseUrl = channel.GetBaseURL()
			relayInfo.ChannelId = originTask.ChannelId
		}
	}

	// build body
	requestBody, err := adaptor.BuildRequestBody(c, relayInfo)
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "build_request_failed", http.StatusInternalServerError)
		return
	}
	// do request
	resp, err := adaptor.DoRequest(c, relayInfo, requestBody)
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "do_request_failed", http.StatusInternalServerError)
		return
	}
	// handle response
	if resp != nil && resp.StatusCode != http.StatusOK {
		responseBody, _ := io.ReadAll(resp.Body)
		taskErr = service.TaskErrorWrapper(fmt.Errorf(string(responseBody)), "fail_to_fetch_task", resp.StatusCode)
		return
	}

	defer func() {
		// release quota
		if relayInfo.ConsumeQuota && taskErr == nil {
			var finalQuota int
			var logContent string
			var other map[string]interface{}

			if platform == constant.TaskPlatformCustomPass {
				// CustomPass使用动态费用计算
				finalQuota = calculateCustomPassFinalQuota(c, modelName, groupRatio)

				// 计算实际需要扣除的费用差额（finalQuota - 预扣的1个quota）
				quotaDelta := finalQuota - quota

				err := service.PostConsumeQuota(relayInfo.RelayInfo, quotaDelta, quota, true)
				if err != nil {
					common.SysError("error consuming token remain quota: " + err.Error())
				}

				if finalQuota != 0 {
					tokenName := c.GetString("token_name")
					logContent = getCustomPassLogContent(c, modelName, groupRatio)
					other = getCustomPassOtherInfo(c, modelName, groupRatio)

					// 获取token数量用于日志记录
					var promptTokens, completionTokens int
					if usageInterface, exists := c.Get("custompass_usage"); exists {
						usage := usageInterface.(*dto.Usage)
						promptTokens = usage.PromptTokens
						completionTokens = usage.CompletionTokens
					}

					model.RecordConsumeLog(c, relayInfo.UserId, relayInfo.ChannelId, promptTokens, completionTokens,
						modelName, tokenName, finalQuota, logContent, relayInfo.TokenId, userQuota, 0, false, relayInfo.Group, other)
					model.UpdateUserUsedQuotaAndRequestCount(relayInfo.UserId, finalQuota)
					model.UpdateChannelUsedQuota(relayInfo.ChannelId, finalQuota)
				}
			} else {
				// 其他平台保持原有逻辑
				err := service.PostConsumeQuota(relayInfo.RelayInfo, quota, 0, true)
				if err != nil {
					common.SysError("error consuming token remain quota: " + err.Error())
				}
				if quota != 0 {
					tokenName := c.GetString("token_name")
					logContent = fmt.Sprintf("模型固定价格 %.2f，分组倍率 %.2f，操作 %s", modelPrice, groupRatio, relayInfo.Action)
					other = make(map[string]interface{})
					other["model_price"] = modelPrice
					other["group_ratio"] = groupRatio
					model.RecordConsumeLog(c, relayInfo.UserId, relayInfo.ChannelId, 0, 0,
						modelName, tokenName, quota, logContent, relayInfo.TokenId, userQuota, 0, false, relayInfo.Group, other)
					model.UpdateUserUsedQuotaAndRequestCount(relayInfo.UserId, quota)
					model.UpdateChannelUsedQuota(relayInfo.ChannelId, quota)
				}
			}
		}
	}()

	taskID, taskData, taskErr := adaptor.DoResponse(c, resp, relayInfo)
	if taskErr != nil {
		return
	}
	relayInfo.ConsumeQuota = true
	// insert task
	task := model.InitTask(platform, relayInfo)
	task.TaskID = taskID
	task.Quota = quota
	task.Data = taskData
	task.Action = relayInfo.Action

	// 为自定义透传渠道保存模型名称和实际消费费用
	if platform == constant.TaskPlatformCustomPass {
		task.Properties.Model = relayInfo.OriginModelName
		// 计算实际消费费用并更新到任务记录中，用于失败时的正确补偿
		finalQuota := calculateCustomPassFinalQuota(c, modelName, groupRatio)
		task.Quota = finalQuota
	}

	err = task.Insert()
	if err != nil {
		taskErr = service.TaskErrorWrapper(err, "insert_task_failed", http.StatusInternalServerError)
		return
	}
	return nil
}

// calculateCustomPassFinalQuota 计算CustomPass的最终费用
func calculateCustomPassFinalQuota(c *gin.Context, modelName string, groupRatio float64) int {
	// 从context中获取usage信息
	var usage *dto.Usage
	if usageInterface, exists := c.Get("custompass_usage"); exists {
		usage = usageInterface.(*dto.Usage)
	}

	// 获取模型价格配置
	modelPrice, usePrice := ratio_setting.GetModelPrice(modelName, false)
	modelRatio, _ := ratio_setting.GetModelRatio(modelName)
	completionRatio := ratio_setting.GetCompletionRatio(modelName)

	quotaInfo := service.CustomPassQuotaInfo{
		ModelName:       modelName,
		GroupRatio:      groupRatio,
		Usage:           usage,
		UsePrice:        usePrice,
		ModelPrice:      modelPrice,
		ModelRatio:      modelRatio,
		CompletionRatio: completionRatio,
	}

	return service.CalculateCustomPassQuota(quotaInfo)
}

// getCustomPassLogContent 获取CustomPass的日志内容
func getCustomPassLogContent(c *gin.Context, modelName string, groupRatio float64) string {
	// 从context中获取usage信息
	var usage *dto.Usage
	if usageInterface, exists := c.Get("custompass_usage"); exists {
		usage = usageInterface.(*dto.Usage)
	}

	if usage != nil && usage.TotalTokens > 0 {
		// 基于usage计费
		modelRatio, _ := ratio_setting.GetModelRatio(modelName)
		completionRatio := ratio_setting.GetCompletionRatio(modelName)
		return fmt.Sprintf("CustomPass usage计费: prompt_tokens=%d, completion_tokens=%d, 模型倍率=%.2f, 补全倍率=%.2f, 分组倍率=%.2f",
			usage.PromptTokens, usage.CompletionTokens, modelRatio, completionRatio, groupRatio)
	}

	// 检查是否为按次计费
	modelPrice, usePrice := ratio_setting.GetModelPrice(modelName, false)
	if usePrice && modelPrice > 0 {
		return fmt.Sprintf("CustomPass 按次计费: 模型价格=%.4f, 分组倍率=%.2f", modelPrice, groupRatio)
	}

	return fmt.Sprintf("CustomPass 0费用: 模型 %s 无usage且未配置按次计费", modelName)
}

// getCustomPassOtherInfo 获取CustomPass的其他信息
func getCustomPassOtherInfo(c *gin.Context, modelName string, groupRatio float64) map[string]interface{} {
	other := make(map[string]interface{})

	// 获取模型价格配置
	modelPrice, usePrice := ratio_setting.GetModelPrice(modelName, false)
	modelRatio, _ := ratio_setting.GetModelRatio(modelName)
	completionRatio := ratio_setting.GetCompletionRatio(modelName)

	// 从context中获取usage信息
	var usage *dto.Usage
	if usageInterface, exists := c.Get("custompass_usage"); exists {
		usage = usageInterface.(*dto.Usage)
		other["usage"] = usage
		other["billing_type"] = "usage"

		// 设置前端价格渲染所需的标准字段
		other["model_ratio"] = modelRatio
		other["completion_ratio"] = completionRatio
		other["group_ratio"] = groupRatio

		// 如果同时配置了按次计费价格，也设置model_price字段
		if usePrice && modelPrice > 0 {
			other["model_price"] = modelPrice
		} else {
			other["model_price"] = -1 // 前端用-1表示使用倍率计费
		}
	} else {
		// 检查是否为按次计费
		if usePrice && modelPrice > 0 {
			other["model_price"] = modelPrice
			other["billing_type"] = "per_request"
			other["group_ratio"] = groupRatio
		} else {
			other["billing_type"] = "free"
			other["model_price"] = -1
			other["model_ratio"] = modelRatio
			other["completion_ratio"] = completionRatio
			other["group_ratio"] = groupRatio
		}
	}

	other["model_name"] = modelName

	return other
}

var fetchRespBuilders = map[int]func(c *gin.Context) (respBody []byte, taskResp *dto.TaskError){
	relayconstant.RelayModeSunoFetchByID:                    sunoFetchByIDRespBodyBuilder,
	relayconstant.RelayModeSunoFetch:                        sunoFetchRespBodyBuilder,
	relayconstant.RelayModeKlingFetchByID:                   videoFetchByIDRespBodyBuilder,
	relayconstant.RelayModeCustomPassTaskFetch:              customPassFetchByIDRespBodyBuilder,
	relayconstant.RelayModeCustomPassTaskFetchByCondition:   customPassFetchByConditionRespBodyBuilder,
}

func RelayTaskFetch(c *gin.Context, relayMode int) (taskResp *dto.TaskError) {
	respBuilder, ok := fetchRespBuilders[relayMode]
	if !ok {
		taskResp = service.TaskErrorWrapperLocal(errors.New("invalid_relay_mode"), "invalid_relay_mode", http.StatusBadRequest)
	}

	respBody, taskErr := respBuilder(c)
	if taskErr != nil {
		return taskErr
	}

	c.Writer.Header().Set("Content-Type", "application/json")
	_, err := io.Copy(c.Writer, bytes.NewBuffer(respBody))
	if err != nil {
		taskResp = service.TaskErrorWrapper(err, "copy_response_body_failed", http.StatusInternalServerError)
		return
	}
	return
}

func sunoFetchRespBodyBuilder(c *gin.Context) (respBody []byte, taskResp *dto.TaskError) {
	userId := c.GetInt("id")
	var condition = struct {
		IDs    []any  `json:"ids"`
		Action string `json:"action"`
	}{}
	err := c.BindJSON(&condition)
	if err != nil {
		taskResp = service.TaskErrorWrapper(err, "invalid_request", http.StatusBadRequest)
		return
	}
	var tasks []any
	if len(condition.IDs) > 0 {
		taskModels, err := model.GetByTaskIds(userId, condition.IDs)
		if err != nil {
			taskResp = service.TaskErrorWrapper(err, "get_tasks_failed", http.StatusInternalServerError)
			return
		}
		for _, task := range taskModels {
			tasks = append(tasks, TaskModel2Dto(task))
		}
	} else {
		tasks = make([]any, 0)
	}
	respBody, err = json.Marshal(dto.TaskResponse[[]any]{
		Code: "success",
		Data: tasks,
	})
	return
}

func sunoFetchByIDRespBodyBuilder(c *gin.Context) (respBody []byte, taskResp *dto.TaskError) {
	taskId := c.Param("id")
	userId := c.GetInt("id")

	originTask, exist, err := model.GetByTaskId(userId, taskId)
	if err != nil {
		taskResp = service.TaskErrorWrapper(err, "get_task_failed", http.StatusInternalServerError)
		return
	}
	if !exist {
		taskResp = service.TaskErrorWrapperLocal(errors.New("task_not_exist"), "task_not_exist", http.StatusBadRequest)
		return
	}

	respBody, err = json.Marshal(dto.TaskResponse[any]{
		Code: "success",
		Data: TaskModel2Dto(originTask),
	})
	return
}

func videoFetchByIDRespBodyBuilder(c *gin.Context) (respBody []byte, taskResp *dto.TaskError) {
	taskId := c.Param("id")
	userId := c.GetInt("id")

	originTask, exist, err := model.GetByTaskId(userId, taskId)
	if err != nil {
		taskResp = service.TaskErrorWrapper(err, "get_task_failed", http.StatusInternalServerError)
		return
	}
	if !exist {
		taskResp = service.TaskErrorWrapperLocal(errors.New("task_not_exist"), "task_not_exist", http.StatusBadRequest)
		return
	}

	respBody, err = json.Marshal(dto.TaskResponse[any]{
		Code: "success",
		Data: TaskModel2Dto(originTask),
	})
	return
}

func customPassFetchByIDRespBodyBuilder(c *gin.Context) (respBody []byte, taskResp *dto.TaskError) {
	taskId := c.Param("task_id")
	userId := c.GetInt("id")

	originTask, exist, err := model.GetByTaskId(userId, taskId)
	if err != nil {
		taskResp = service.TaskErrorWrapper(err, "get_task_failed", http.StatusInternalServerError)
		return
	}
	if !exist {
		taskResp = service.TaskErrorWrapperLocal(errors.New("task_not_exist"), "task_not_exist", http.StatusBadRequest)
		return
	}

	// 构建 CustomPass 格式的响应
	customPassResp := map[string]interface{}{
		"task_id":  originTask.TaskID,
		"status":   convertTaskStatusToCustomPass(originTask.Status),
		"progress": originTask.Progress,
	}

	// 如果任务完成，添加结果
	if originTask.Status == model.TaskStatusSuccess && len(originTask.Data) > 0 {
		var result interface{}
		if err := json.Unmarshal(originTask.Data, &result); err == nil {
			customPassResp["result"] = result
		}
	}

	// 如果任务失败，添加错误信息
	if originTask.Status == model.TaskStatusFailure && originTask.FailReason != "" {
		customPassResp["error"] = originTask.FailReason
	}

	respBody, err = json.Marshal(customPassResp)
	if err != nil {
		taskResp = service.TaskErrorWrapper(err, "marshal_response_failed", http.StatusInternalServerError)
	}
	return
}

func customPassFetchByConditionRespBodyBuilder(c *gin.Context) (respBody []byte, taskResp *dto.TaskError) {
	userId := c.GetInt("id")

	var condition struct {
		TaskIds []string `json:"task_ids"`
	}

	if err := c.ShouldBindJSON(&condition); err != nil {
		taskResp = service.TaskErrorWrapperLocal(err, "invalid_request", http.StatusBadRequest)
		return
	}

	if len(condition.TaskIds) == 0 {
		taskResp = service.TaskErrorWrapperLocal(errors.New("task_ids is required"), "invalid_request", http.StatusBadRequest)
		return
	}

	// 获取任务列表
	tasks := make([]map[string]interface{}, 0)
	for _, taskId := range condition.TaskIds {
		originTask, exist, err := model.GetByTaskId(userId, taskId)
		if err != nil {
			continue // 跳过错误的任务
		}
		if !exist {
			continue // 跳过不存在的任务
		}

		// 构建 CustomPass 格式的响应
		customPassTask := map[string]interface{}{
			"task_id":  originTask.TaskID,
			"status":   convertTaskStatusToCustomPass(originTask.Status),
			"progress": originTask.Progress,
		}

		// 如果任务完成，添加结果
		if originTask.Status == model.TaskStatusSuccess && len(originTask.Data) > 0 {
			var result interface{}
			if err := json.Unmarshal(originTask.Data, &result); err == nil {
				customPassTask["result"] = result
			}
		}

		// 如果任务失败，添加错误信息
		if originTask.Status == model.TaskStatusFailure && originTask.FailReason != "" {
			customPassTask["error"] = originTask.FailReason
		}

		tasks = append(tasks, customPassTask)
	}

	// 构建最终响应
	response := map[string]interface{}{
		"code": 0,
		"msg":  "success",
		"data": tasks,
	}

	respBody, err := json.Marshal(response)
	if err != nil {
		taskResp = service.TaskErrorWrapper(err, "marshal_response_failed", http.StatusInternalServerError)
	}
	return
}

// convertTaskStatusToCustomPass 将内部任务状态转换为 CustomPass 格式
func convertTaskStatusToCustomPass(status model.TaskStatus) string {
	switch status {
	case model.TaskStatusSuccess:
		return "completed"
	case model.TaskStatusFailure:
		return "failed"
	case model.TaskStatusInProgress, model.TaskStatusQueued, model.TaskStatusSubmitted:
		return "processing"
	case model.TaskStatusNotStart:
		return "pendding"
	default:
		return "unknown"
	}
}

func TaskModel2Dto(task *model.Task) *dto.TaskDto {
	return &dto.TaskDto{
		TaskID:     task.TaskID,
		Action:     task.Action,
		Status:     string(task.Status),
		FailReason: task.FailReason,
		SubmitTime: task.SubmitTime,
		StartTime:  task.StartTime,
		FinishTime: task.FinishTime,
		Progress:   task.Progress,
		Data:       task.Data,
	}
}
