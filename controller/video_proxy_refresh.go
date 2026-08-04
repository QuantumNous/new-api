package controller

import (
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
)

func lookupVideoProxyTask(userID int, taskID string) (*model.Task, bool, error) {
	if model.IsAdmin(userID) {
		return model.GetByOnlyTaskId(taskID)
	}
	return model.GetByTaskId(userID, taskID)
}

func refreshTaskVideoURL(channel *model.Channel, task *model.Task) (string, []byte, error) {
	return service.RefreshTaskVideoURL(channel, task)
}

func persistRefreshedTaskVideo(task *model.Task, videoURL string, responseBody []byte) {
	service.PersistRefreshedTaskVideo(task, videoURL, responseBody)
}

func repairTaskResultURLIfNeeded(task *model.Task) {
	service.RepairTaskResultURLIfNeeded(task)
}
