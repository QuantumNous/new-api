package controller

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
	"io"
	"net/http"
	"one-api/common"
	"one-api/constant"
	"one-api/dto"
	"one-api/model"
	"one-api/relay"
	"sort"
	"strconv"
	"time"
)

func UpdateTaskBulk() {
	//revocer
	//imageModel := "midjourney"
	for {
		time.Sleep(time.Duration(15) * time.Second)
		common.SysLog("任务进度轮询开始")
		ctx := context.TODO()
		allTasks := model.GetAllUnFinishSyncTasks(500)
		platformTask := make(map[constant.TaskPlatform][]*model.Task)
		for _, t := range allTasks {
			platformTask[t.Platform] = append(platformTask[t.Platform], t)
		}
		for platform, tasks := range platformTask {
			if len(tasks) == 0 {
				continue
			}
			taskChannelM := make(map[int][]string)
			taskM := make(map[string]*model.Task)
			nullTaskIds := make([]int64, 0)
			for _, task := range tasks {
				if task.TaskID == "" {
					// 统计失败的未完成任务
					nullTaskIds = append(nullTaskIds, task.ID)
					continue
				}
				taskM[task.TaskID] = task
				taskChannelM[task.ChannelId] = append(taskChannelM[task.ChannelId], task.TaskID)
			}
			if len(nullTaskIds) > 0 {
				err := model.TaskBulkUpdateByID(nullTaskIds, map[string]any{
					"status":   "FAILURE",
					"progress": "100%",
				})
				if err != nil {
					common.LogError(ctx, fmt.Sprintf("Fix null task_id task error: %v", err))
				} else {
					common.LogInfo(ctx, fmt.Sprintf("Fix null task_id task success: %v", nullTaskIds))
				}
			}
			if len(taskChannelM) == 0 {
				continue
			}

			UpdateTaskByPlatform(platform, taskChannelM, taskM)
		}
		common.SysLog("任务进度轮询完成")
	}
}

func UpdateTaskByPlatform(platform constant.TaskPlatform, taskChannelM map[int][]string, taskM map[string]*model.Task) {
	switch platform {
	case constant.TaskPlatformMidjourney:
		//_ = UpdateMidjourneyTaskAll(context.Background(), tasks)
	case constant.TaskPlatformSuno:
		_ = UpdateSunoTaskAll(context.Background(), taskChannelM, taskM)
	case constant.TaskPlatformKling:
		_ = UpdateVideoTaskAll(context.Background(), taskChannelM, taskM)
	case constant.TaskPlatformCustomPass:
		_ = UpdateCustomPassTaskAll(context.Background(), taskChannelM, taskM)
	default:
		common.SysLog("未知平台")
	}
}

func UpdateSunoTaskAll(ctx context.Context, taskChannelM map[int][]string, taskM map[string]*model.Task) error {
	for channelId, taskIds := range taskChannelM {
		err := updateSunoTaskAll(ctx, channelId, taskIds, taskM)
		if err != nil {
			common.LogError(ctx, fmt.Sprintf("渠道 #%d 更新异步任务失败: %d", channelId, err.Error()))
		}
	}
	return nil
}

func updateSunoTaskAll(ctx context.Context, channelId int, taskIds []string, taskM map[string]*model.Task) error {
	common.LogInfo(ctx, fmt.Sprintf("渠道 #%d 未完成的任务有: %d", channelId, len(taskIds)))
	if len(taskIds) == 0 {
		return nil
	}
	channel, err := model.CacheGetChannel(channelId)
	if err != nil {
		common.SysLog(fmt.Sprintf("CacheGetChannel: %v", err))
		err = model.TaskBulkUpdate(taskIds, map[string]any{
			"fail_reason": fmt.Sprintf("获取渠道信息失败，请联系管理员，渠道ID：%d", channelId),
			"status":      "FAILURE",
			"progress":    "100%",
		})
		if err != nil {
			common.SysError(fmt.Sprintf("UpdateMidjourneyTask error2: %v", err))
		}
		return err
	}
	adaptor := relay.GetTaskAdaptor(constant.TaskPlatformSuno)
	if adaptor == nil {
		return errors.New("adaptor not found")
	}
	resp, err := adaptor.FetchTask(*channel.BaseURL, channel.Key, map[string]any{
		"ids": taskIds,
	})
	if err != nil {
		common.SysError(fmt.Sprintf("Get Task Do req error: %v", err))
		return err
	}
	if resp.StatusCode != http.StatusOK {
		common.LogError(ctx, fmt.Sprintf("Get Task status code: %d", resp.StatusCode))
		return errors.New(fmt.Sprintf("Get Task status code: %d", resp.StatusCode))
	}
	defer resp.Body.Close()
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		common.SysError(fmt.Sprintf("Get Task parse body error: %v", err))
		return err
	}
	var responseItems dto.TaskResponse[[]dto.SunoDataResponse]
	err = json.Unmarshal(responseBody, &responseItems)
	if err != nil {
		common.LogError(ctx, fmt.Sprintf("Get Task parse body error2: %v, body: %s", err, string(responseBody)))
		return err
	}
	if !responseItems.IsSuccess() {
		common.SysLog(fmt.Sprintf("渠道 #%d 未完成的任务有: %d, 成功获取到任务数: %d", channelId, len(taskIds), string(responseBody)))
		return err
	}

	for _, responseItem := range responseItems.Data {
		task := taskM[responseItem.TaskID]
		if !checkTaskNeedUpdate(task, responseItem) {
			continue
		}

		task.Status = lo.If(model.TaskStatus(responseItem.Status) != "", model.TaskStatus(responseItem.Status)).Else(task.Status)
		task.FailReason = lo.If(responseItem.FailReason != "", responseItem.FailReason).Else(task.FailReason)
		task.SubmitTime = lo.If(responseItem.SubmitTime != 0, responseItem.SubmitTime).Else(task.SubmitTime)
		task.StartTime = lo.If(responseItem.StartTime != 0, responseItem.StartTime).Else(task.StartTime)
		task.FinishTime = lo.If(responseItem.FinishTime != 0, responseItem.FinishTime).Else(task.FinishTime)
		if responseItem.FailReason != "" || task.Status == model.TaskStatusFailure {
			common.LogInfo(ctx, task.TaskID+" 构建失败，"+task.FailReason)
			task.Progress = "100%"
			//err = model.CacheUpdateUserQuota(task.UserId) ?
			if err != nil {
				common.LogError(ctx, "error update user quota cache: "+err.Error())
			} else {
				quota := task.Quota
				if quota != 0 {
					err = model.IncreaseUserQuota(task.UserId, quota, false)
					if err != nil {
						common.LogError(ctx, "fail to increase user quota: "+err.Error())
					}
					logContent := fmt.Sprintf("异步任务执行失败 %s，补偿 %s", task.TaskID, common.LogQuota(quota))
					model.RecordLog(task.UserId, model.LogTypeSystem, logContent)
				}
			}
		}
		if responseItem.Status == model.TaskStatusSuccess {
			task.Progress = "100%"
		}
		task.Data = responseItem.Data

		err = task.Update()
		if err != nil {
			common.SysError("UpdateMidjourneyTask task error: " + err.Error())
		}
	}
	return nil
}

func checkTaskNeedUpdate(oldTask *model.Task, newTask dto.SunoDataResponse) bool {

	if oldTask.SubmitTime != newTask.SubmitTime {
		return true
	}
	if oldTask.StartTime != newTask.StartTime {
		return true
	}
	if oldTask.FinishTime != newTask.FinishTime {
		return true
	}
	if string(oldTask.Status) != newTask.Status {
		return true
	}
	if oldTask.FailReason != newTask.FailReason {
		return true
	}
	if oldTask.FinishTime != newTask.FinishTime {
		return true
	}

	if (oldTask.Status == model.TaskStatusFailure || oldTask.Status == model.TaskStatusSuccess) && oldTask.Progress != "100%" {
		return true
	}

	oldData, _ := json.Marshal(oldTask.Data)
	newData, _ := json.Marshal(newTask.Data)

	sort.Slice(oldData, func(i, j int) bool {
		return oldData[i] < oldData[j]
	})
	sort.Slice(newData, func(i, j int) bool {
		return newData[i] < newData[j]
	})

	if string(oldData) != string(newData) {
		return true
	}
	return false
}

func GetAllTask(c *gin.Context) {
	p, _ := strconv.Atoi(c.Query("p"))
	if p < 1 {
		p = 1
	}
	pageSize, _ := strconv.Atoi(c.Query("page_size"))
	if pageSize <= 0 {
		pageSize = common.ItemsPerPage
	}

	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	// 解析其他查询参数
	queryParams := model.SyncTaskQueryParams{
		Platform:       constant.TaskPlatform(c.Query("platform")),
		TaskID:         c.Query("task_id"),
		Status:         c.Query("status"),
		Action:         c.Query("action"),
		StartTimestamp: startTimestamp,
		EndTimestamp:   endTimestamp,
		ChannelID:      c.Query("channel_id"),
	}

	items := model.TaskGetAllTasks((p-1)*pageSize, pageSize, queryParams)
	total := model.TaskCountAllTasks(queryParams)

	c.JSON(200, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"items":     items,
			"total":     total,
			"page":      p,
			"page_size": pageSize,
		},
	})
}

func GetUserTask(c *gin.Context) {
	p, _ := strconv.Atoi(c.Query("p"))
	if p < 1 {
		p = 1
	}
	pageSize, _ := strconv.Atoi(c.Query("page_size"))
	if pageSize <= 0 {
		pageSize = common.ItemsPerPage
	}

	userId := c.GetInt("id")

	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)

	queryParams := model.SyncTaskQueryParams{
		Platform:       constant.TaskPlatform(c.Query("platform")),
		TaskID:         c.Query("task_id"),
		Status:         c.Query("status"),
		Action:         c.Query("action"),
		StartTimestamp: startTimestamp,
		EndTimestamp:   endTimestamp,
	}

	items := model.TaskGetAllUserTask(userId, (p-1)*pageSize, pageSize, queryParams)
	total := model.TaskCountAllUserTask(userId, queryParams)

	c.JSON(200, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"items":     items,
			"total":     total,
			"page":      p,
			"page_size": pageSize,
		},
	})
}

// UpdateCustomPassTaskAll 更新自定义透传渠道任务状态
func UpdateCustomPassTaskAll(ctx context.Context, taskChannelM map[int][]string, taskM map[string]*model.Task) error {
	for channelId, taskIds := range taskChannelM {
		err := updateCustomPassTaskAll(ctx, channelId, taskIds, taskM)
		if err != nil {
			common.LogError(ctx, fmt.Sprintf("渠道 #%d 更新自定义透传任务失败: %s", channelId, err.Error()))
		}
	}
	return nil
}

func updateCustomPassTaskAll(ctx context.Context, channelId int, taskIds []string, taskM map[string]*model.Task) error {
	common.LogInfo(ctx, fmt.Sprintf("渠道 #%d 未完成的自定义透传任务有: %d", channelId, len(taskIds)))
	if len(taskIds) == 0 {
		return nil
	}

	channel, err := model.CacheGetChannel(channelId)
	if err != nil {
		common.SysLog(fmt.Sprintf("CacheGetChannel: %v", err))
		err = model.TaskBulkUpdate(taskIds, map[string]any{
			"fail_reason": fmt.Sprintf("获取渠道信息失败，请联系管理员，渠道ID：%d", channelId),
			"status":      "FAILURE",
			"progress":    "100%",
		})
		if err != nil {
			common.SysError(fmt.Sprintf("UpdateCustomPassTask error: %v", err))
		}
		return err
	}

	adaptor := relay.GetTaskAdaptor(constant.TaskPlatformCustomPass)
	if adaptor == nil {
		return errors.New("adaptor not found")
	}

	// 按模型分组任务ID，因为不同模型需要分别查询
	modelTaskIds := make(map[string][]string)
	for _, taskId := range taskIds {
		task := taskM[taskId]
		if task != nil {
			// 从任务的Properties中获取模型名称，或者从其他地方获取
			// 这里假设模型名称存储在task的某个字段中，需要根据实际情况调整
			modelName := getModelNameFromTask(task)
			if modelName != "" {
				modelTaskIds[modelName] = append(modelTaskIds[modelName], taskId)
			}
		}
	}

	// 对每个模型分别查询任务状态
	for modelName, modelTaskIdList := range modelTaskIds {
		resp, err := adaptor.FetchTask(*channel.BaseURL, channel.Key, map[string]any{
			"model":    modelName,
			"task_ids": modelTaskIdList,
		})
		if err != nil {
			common.SysError(fmt.Sprintf("Get CustomPass Task Do req error: %v", err))
			continue
		}
		if resp.StatusCode != http.StatusOK {
			common.LogError(ctx, fmt.Sprintf("Get CustomPass Task status code: %d", resp.StatusCode))
			continue
		}
		defer resp.Body.Close()

		responseBody, err := io.ReadAll(resp.Body)
		if err != nil {
			common.SysError(fmt.Sprintf("Get CustomPass Task parse body error: %v", err))
			continue
		}

		common.LogInfo(ctx, fmt.Sprintf("CustomPass任务查询响应 - 渠道 #%d: %s", channelId, string(responseBody)))

		var responseItems struct {
			Code int `json:"code"`
			Msg  string `json:"msg"`
			Data []struct {
				TaskId   string                   `json:"task_id"`
				Status   string                   `json:"status"`
				Progress string                   `json:"progress"`
				Result   []map[string]interface{} `json:"result,omitempty"`
				Error    *string                  `json:"error"`
			} `json:"data"`
		}

		err = json.Unmarshal(responseBody, &responseItems)
		if err != nil {
			common.LogError(ctx, fmt.Sprintf("Get CustomPass Task parse body error: %v, body: %s", err, string(responseBody)))
			continue
		}

		if responseItems.Code != 0 {
			common.SysLog(fmt.Sprintf("渠道 #%d 查询自定义透传任务失败: %s", channelId, responseItems.Msg))
			continue
		}

		common.LogInfo(ctx, fmt.Sprintf("CustomPass任务查询成功 - 渠道 #%d，返回任务数量: %d", channelId, len(responseItems.Data)))

		// 处理每个任务的状态更新
		for _, responseItem := range responseItems.Data {
			task := taskM[responseItem.TaskId]
			if task == nil {
				continue
			}

			// 检查任务是否需要更新
			if !checkCustomPassTaskNeedUpdate(task, responseItem) {
				continue
			}

			// 记录更新前的状态
			oldStatus := task.Status
			oldProgress := task.Progress
			common.LogInfo(ctx, fmt.Sprintf("CustomPass任务更新前 - TaskID: %s, 旧状态: %s, 旧进度: %s", task.TaskID, oldStatus, oldProgress))

			// 更新任务状态
			task.Status = convertCustomPassStatus(responseItem.Status)
			task.Progress = responseItem.Progress

			// 处理失败原因：优先使用Error字段，如果没有则从Result中提取error信息
			if responseItem.Error != nil {
				task.FailReason = *responseItem.Error
			} else if task.Status == model.TaskStatusFailure && len(responseItem.Result) > 0 {
				// 当任务失败且没有Error字段时，尝试从Result中提取error信息
				for _, resultItem := range responseItem.Result {
					if errorMsg, exists := resultItem["error"]; exists {
						if errorStr, ok := errorMsg.(string); ok && errorStr != "" {
							task.FailReason = errorStr
							break
						}
					}
				}
			}

			// 设置开始时间和结束时间
			currentTime := time.Now().Unix()

			// 如果任务从未开始状态变为进行中，设置开始时间
			if task.StartTime == 0 && (task.Status == model.TaskStatusInProgress || task.Status == model.TaskStatusSuccess || task.Status == model.TaskStatusFailure) {
				task.StartTime = currentTime
			}

			// 如果任务完成或失败，设置结束时间
			if task.FinishTime == 0 && (task.Status == model.TaskStatusSuccess || task.Status == model.TaskStatusFailure) {
				task.FinishTime = currentTime
			}

			// 如果任务失败，退回扣费
			if task.Status == model.TaskStatusFailure {
				// 确保失败任务的进度设置为100%，避免重复处理
				task.Progress = "100%"
				quota := task.Quota
				if quota != 0 {
					err = model.IncreaseUserQuota(task.UserId, quota, false)
					if err != nil {
						common.LogError(ctx, "fail to increase user quota: "+err.Error())
					}
					modelName := task.Properties.Model
					if modelName == "" {
						modelName = "自定义透传"
					}
					logContent := fmt.Sprintf("%s任务执行失败 %s，补偿 %s", modelName, task.TaskID, common.LogQuota(quota))
					model.RecordLog(task.UserId, model.LogTypeSystem, logContent)
				}
			}

			if task.Status == model.TaskStatusSuccess {
				task.Progress = "100%"
			}

			// 记录更新后的状态
			common.LogInfo(ctx, fmt.Sprintf("CustomPass任务更新后 - TaskID: %s, 新状态: %s, 新进度: %s", task.TaskID, task.Status, task.Progress))

			// 设置任务结果数据
			if len(responseItem.Result) > 0 {
				task.SetData(responseItem.Result)
			}

			// 更新数据库前记录日志
			common.LogInfo(ctx, fmt.Sprintf("CustomPass任务准备更新数据库 - TaskID: %s, ID: %d", task.TaskID, task.ID))

			err = task.Update()
			if err != nil {
				common.SysError("UpdateCustomPassTask task error: " + err.Error())
				common.LogError(ctx, fmt.Sprintf("CustomPass任务数据库更新失败 - TaskID: %s, 错误: %s", task.TaskID, err.Error()))
			} else {
				common.LogInfo(ctx, fmt.Sprintf("CustomPass任务数据库更新成功 - TaskID: %s, 最终状态: %s, 最终进度: %s", task.TaskID, task.Status, task.Progress))
			}
		}
	}
	return nil
}

// getModelNameFromTask 从任务中获取模型名称
func getModelNameFromTask(task *model.Task) string {
	// 从Properties中获取模型名称
	if task.Properties.Model != "" {
		return task.Properties.Model
	}
	// 如果Properties中没有，可以从其他地方获取，比如从Action中解析
	return ""
}

// checkCustomPassTaskNeedUpdate 检查自定义透传任务是否需要更新
func checkCustomPassTaskNeedUpdate(task *model.Task, responseItem interface{}) bool {
	// 将 responseItem 转换为具体的响应结构
	type CustomPassResponseItem struct {
		TaskId   string                   `json:"task_id"`
		Status   string                   `json:"status"`
		Progress string                   `json:"progress"`
		Result   []map[string]interface{} `json:"result,omitempty"`
		Error    *string                  `json:"error"`
	}

	// 尝试将 responseItem 转换为 CustomPassResponseItem
	responseData, ok := responseItem.(struct {
		TaskId   string                   `json:"task_id"`
		Status   string                   `json:"status"`
		Progress string                   `json:"progress"`
		Result   []map[string]interface{} `json:"result,omitempty"`
		Error    *string                  `json:"error"`
	})
	if !ok {
		// 如果转换失败，返回 false 避免重复处理
		return false
	}

	// 转换新的状态
	newStatus := convertCustomPassStatus(responseData.Status)

	// 如果任务已经是最终状态（成功或失败）且进度是100%，不需要更新
	if (task.Status == model.TaskStatusSuccess || task.Status == model.TaskStatusFailure) && task.Progress == "100%" {
		return false
	}

	// 如果状态发生变化，需要更新
	if task.Status != newStatus {
		return true
	}

	// 如果进度发生变化，需要更新
	if task.Progress != responseData.Progress {
		return true
	}

	// 如果错误信息发生变化，需要更新
	if responseData.Error != nil && task.FailReason != *responseData.Error {
		return true
	}

	// 如果任务失败且没有Error字段，检查Result中的error信息是否发生变化
	if newStatus == model.TaskStatusFailure && responseData.Error == nil && len(responseData.Result) > 0 {
		for _, resultItem := range responseData.Result {
			if errorMsg, exists := resultItem["error"]; exists {
				if errorStr, ok := errorMsg.(string); ok && errorStr != "" && task.FailReason != errorStr {
					return true
				}
			}
		}
	}

	// 其他情况不需要更新
	return false
}

// convertCustomPassStatus 转换自定义透传任务状态
func convertCustomPassStatus(status string) model.TaskStatus {
	switch status {
	case "completed":
		return model.TaskStatusSuccess
	case "error", "failed":
		return model.TaskStatusFailure
	case "pendding", "processing":
		return model.TaskStatusInProgress
	default:
		return model.TaskStatusUnknown
	}
}
