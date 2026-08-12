package mao

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
)

// TryResubmitOnFailure re-POSTs the stored upstream create body on the same channel
// after a transient async failure. On POST/parse failure returns (false, "", nil)
// (terminal for this poll); RetryCount is already incremented.
func (a *TaskAdaptor) TryResubmitOnFailure(ctx context.Context, ch *model.Channel, task *model.Task, failReason string) (resubmitted bool, progress string, err error) {
	if task == nil || ch == nil {
		return false, "", nil
	}
	if !shouldAttemptResubmit(task.PrivateData.RequestBody, task.PrivateData.RetryCount, resolveSameChannelMaxRetries(task), failReason) {
		return false, "", nil
	}

	task.PrivateData.RetryCount++

	key := strings.TrimSpace(ch.Key)
	if k := strings.TrimSpace(task.PrivateData.Key); k != "" {
		key = k
	}

	url := apiOrigin(ch.GetBaseURL()) + createPath
	proxy := ch.GetSetting().Proxy

	req, reqErr := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBufferString(task.PrivateData.RequestBody))
	if reqErr != nil {
		return false, "", nil
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+key)

	client, clientErr := service.GetHttpClientWithProxy(proxy)
	if clientErr != nil {
		return false, "", nil
	}
	if client == nil {
		client = http.DefaultClient
	}
	resp, doErr := client.Do(req)
	if doErr != nil {
		return false, "", nil
	}
	defer resp.Body.Close()

	body, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		return false, "", nil
	}

	newID, parseErr := parseCreateTaskID(body)
	if parseErr != nil || strings.TrimSpace(newID) == "" {
		return false, "", nil
	}

	task.PrivateData.UpstreamTaskID = newID
	task.Status = model.TaskStatusQueued
	task.FailReason = ""
	task.FinishTime = 0
	maxRetries := resolveSameChannelMaxRetries(task)
	return true, retryProgressLabel(task.PrivateData.RetryCount, maxRetries), nil
}
