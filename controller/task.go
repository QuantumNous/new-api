package controller

import (
	"context"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func GetAllTask(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)

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

	items := model.TaskGetAllTasks(pageInfo.GetStartIdx(), pageInfo.GetPageSize(), queryParams)
	total := model.TaskCountAllTasks(queryParams)
	pageInfo.SetTotal(int(total))
	dtos, err := tasksToDto(c.Request.Context(), items, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetItems(dtos)
	common.ApiSuccess(c, pageInfo)
}

func GetUserTask(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)

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

	items := model.TaskGetAllUserTask(userId, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), queryParams)
	total := model.TaskCountAllUserTask(userId, queryParams)
	pageInfo.SetTotal(int(total))
	dtos, err := tasksToDto(c.Request.Context(), items, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetItems(dtos)
	common.ApiSuccess(c, pageInfo)
}

func tasksToDto(ctx context.Context, tasks []*model.Task, fillUser bool) ([]*dto.TaskDto, error) {
	var userIdMap map[int]*model.UserBase
	if fillUser {
		userIdMap = make(map[int]*model.UserBase)
		userIds := types.NewSet[int]()
		for _, task := range tasks {
			userIds.Add(task.UserId)
		}
		for _, userId := range userIds.Items() {
			cacheUser, err := model.GetUserCache(userId)
			if err == nil {
				userIdMap[userId] = cacheUser
			}
		}
	}
	result := make([]*dto.TaskDto, len(tasks))
	asyncTaskIDs := make([]int64, 0, len(tasks))
	for _, task := range tasks {
		if task.Platform == constant.TaskPlatformAsyncImage {
			asyncTaskIDs = append(asyncTaskIDs, task.ID)
		}
	}
	asyncJobs, err := model.ListAsyncJobsByTaskIDs(ctx, asyncTaskIDs)
	if err != nil {
		return nil, err
	}
	for i, task := range tasks {
		if fillUser {
			if user, ok := userIdMap[task.UserId]; ok {
				task.Username = user.Username
			}
		}
		item := relay.TaskModel2Dto(task)
		if job, ok := asyncJobs[task.ID]; ok {
			item.Async = &dto.AsyncTaskMeta{
				ExecutionStatus: string(job.ExecutionStatus),
				WorkerID:        job.WorkerID,
				Attempt:         job.Attempt,
				RequestSentAt:   job.RequestSentAt,
				ErrorPhase:      job.ErrorPhase,
				ErrorCode:       job.ErrorCode,
				BillingStatus:   job.BillingStatus,
			}
		}
		result[i] = item
	}
	return result, nil
}
