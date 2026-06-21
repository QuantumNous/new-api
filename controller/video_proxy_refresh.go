package controller

import (
	"fmt"
	"io"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay"
	taskcommon "github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
)

func lookupVideoProxyTask(userID int, taskID string) (*model.Task, bool, error) {
	if model.IsAdmin(userID) {
		return model.GetByOnlyTaskId(taskID)
	}
	return model.GetByTaskId(userID, taskID)
}

func refreshTaskVideoURL(channel *model.Channel, task *model.Task) (string, []byte, error) {
	if channel == nil || task == nil {
		return "", nil, fmt.Errorf("invalid channel or task")
	}

	adaptor := relay.GetTaskAdaptor(constant.TaskPlatform(strconv.Itoa(channel.Type)))
	if adaptor == nil {
		return "", nil, fmt.Errorf("task adaptor not found for channel type %d", channel.Type)
	}

	baseURL := channel.GetBaseURL()
	if baseURL == "" {
		baseURL = constant.ChannelBaseURLs[channel.Type]
	}
	if baseURL == "" {
		return "", nil, fmt.Errorf("channel base URL is empty")
	}

	upstreamTaskID := task.GetUpstreamTaskID()
	if alt := taskcommon.ExtractUpstreamTaskIDFromJSON(task.Data, task.TaskID); alt != "" {
		upstreamTaskID = alt
	}

	key := channel.Key
	if task.PrivateData.Key != "" {
		key = task.PrivateData.Key
	}

	proxy := channel.GetSetting().Proxy
	resp, err := adaptor.FetchTask(baseURL, key, map[string]any{
		"task_id": upstreamTaskID,
		"action":  task.Action,
		"model":   task.Properties.UpstreamModelName,
	}, proxy)
	if err != nil {
		return "", nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", nil, err
	}

	taskInfo, err := adaptor.ParseTaskResult(body)
	if err != nil {
		return "", body, err
	}
	if taskInfo == nil {
		return "", body, fmt.Errorf("empty task result")
	}

	videoURL := strings.TrimSpace(taskInfo.Url)
	if videoURL == "" || taskcommon.IsTaskProxyContentURL(videoURL, task.TaskID) {
		videoURL = taskcommon.ExtractVideoURLFromJSON(body)
	}
	if videoURL == "" {
		return "", body, fmt.Errorf("video url not found in upstream response")
	}
	return videoURL, body, nil
}

func persistRefreshedTaskVideo(task *model.Task, videoURL string, responseBody []byte) {
	if task == nil || strings.TrimSpace(videoURL) == "" {
		return
	}
	snap := task.Snapshot()
	task.PrivateData.ResultURL = videoURL
	if len(responseBody) > 0 {
		task.Data = responseBody
	}
	if snap.Equal(task.Snapshot()) {
		return
	}
	_, _ = task.UpdateWithStatus(snap.Status)
}
