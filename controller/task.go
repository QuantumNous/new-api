package controller

import (
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/go-fuego/fuego"
)

// UpdateTaskBulk 薄入口，实际轮询逻辑在 service 层
func UpdateTaskBulk() {
	service.TaskPollingLoop()
}

func GetAllTask(c fuego.ContextWithParams[dto.GetAllTaskParams]) (*dto.Response[dto.PageData[*dto.TaskDto]], error) {
	p, _ := dto.ParseParams[dto.GetAllTaskParams](c)
	pageInfo := dto.PageInfo(c)

	// 解析其他查询参数
	queryParams := model.SyncTaskQueryParams{
		Platform:       constant.TaskPlatform(p.Platform),
		TaskID:         p.TaskID,
		Status:         p.Status,
		Action:         p.Action,
		StartTimestamp: p.StartTimestamp,
		EndTimestamp:   p.EndTimestamp,
		ChannelID:      p.ChannelID,
	}

	items := model.TaskGetAllTasks(pageInfo.GetStartIdx(), pageInfo.GetPageSize(), queryParams)
	total := model.TaskCountAllTasks(queryParams)
	return dto.OkPage(pageInfo, tasksToDto(items, true), int(total))
}

func GetUserTask(c fuego.ContextWithParams[dto.GetUserTaskParams]) (*dto.Response[dto.PageData[*dto.TaskDto]], error) {
	p, _ := dto.ParseParams[dto.GetUserTaskParams](c)
	pageInfo := dto.PageInfo(c)

	userId := dto.UserID(c)

	queryParams := model.SyncTaskQueryParams{
		Platform:       constant.TaskPlatform(p.Platform),
		TaskID:         p.TaskID,
		Status:         p.Status,
		Action:         p.Action,
		StartTimestamp: p.StartTimestamp,
		EndTimestamp:   p.EndTimestamp,
	}

	items := model.TaskGetAllUserTask(userId, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), queryParams)
	total := model.TaskCountAllUserTask(userId, queryParams)
	return dto.OkPage(pageInfo, tasksToDto(items, false), int(total))
}

func tasksToDto(tasks []*model.Task, fillUser bool) []*dto.TaskDto {
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
	for i, task := range tasks {
		if fillUser {
			if user, ok := userIdMap[task.UserId]; ok {
				task.Username = user.Username
			}
		}
		result[i] = relay.TaskModel2Dto(task)
	}
	return result
}
