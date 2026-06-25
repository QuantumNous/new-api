package service

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

// ImageTaskTarget is one upstream channel candidate (the primary submission or
// a hedge submitted to a second channel) being raced for an image task result.
type ImageTaskTarget struct {
	ChannelID int
	BaseURL   string
	APIKey    string
	TaskID    string
}

// SubmitImageGenerationToChannel re-submits the same already-converted request body
// (as built once for the primary channel) to a different channel, for the gpt-image-2
// race fallback. Channels racing for the same model are all OpenAI-compatible image
// hubs, so the converted JSON body is reused verbatim — only base_url/key differ.
func SubmitImageGenerationToChannel(ctx context.Context, channel *model.Channel, requestBody []byte, asyncPath bool) (taskID string, err error) {
	if channel == nil {
		return "", fmt.Errorf("submit image generation: channel is nil")
	}
	key, _, apiErr := channel.GetNextEnabledKey()
	if apiErr != nil {
		return "", apiErr.Err
	}
	path := "/v1/images/generations"
	if asyncPath {
		path += "/async"
	}
	url := strings.TrimRight(channel.GetBaseURL(), "/") + path

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(requestBody))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+key)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("submit image generation to channel #%d: status %d: %s", channel.Id, resp.StatusCode, string(body))
	}

	var parsed struct {
		Data []struct {
			TaskID string `json:"task_id"`
		} `json:"data"`
	}
	if common.Unmarshal(body, &parsed) != nil || len(parsed.Data) == 0 || strings.TrimSpace(parsed.Data[0].TaskID) == "" {
		return "", fmt.Errorf("submit image generation to channel #%d: no task_id in response", channel.Id)
	}
	return parsed.Data[0].TaskID, nil
}

type imageRaceResult struct {
	target   ImageTaskTarget
	status   string
	imageURL string
}

// RaceImageTask polls every target until one succeeds or the shared deadline passes.
// Targets that fail or time out don't short-circuit the race — only an all-targets
// failure does. The loser (if it later completes) is not cancelled, just ignored.
func RaceImageTask(targets []ImageTaskTarget, deadline time.Time) (won ImageTaskTarget, imageURL string, ok bool) {
	if len(targets) == 0 {
		return ImageTaskTarget{}, "", false
	}
	resultCh := make(chan imageRaceResult, len(targets))
	for _, t := range targets {
		t := t
		go func() {
			status, url, _ := pollUpstreamImageTaskStatus(t.BaseURL, t.APIKey, t.TaskID, deadline)
			resultCh <- imageRaceResult{target: t, status: status, imageURL: url}
		}()
	}
	for i := 0; i < len(targets); i++ {
		r := <-resultCh
		switch r.status {
		case "succeeded", "success", "completed":
			return r.target, r.imageURL, true
		}
	}
	return ImageTaskTarget{}, "", false
}

// CheckImageTaskTargetsOnce issues a single non-blocking status check against every
// target (used by the client-poll controller, which must respond to one GET quickly
// rather than block for the full race deadline like RaceImageTask does).
func CheckImageTaskTargetsOnce(targets []ImageTaskTarget) (won ImageTaskTarget, status string, imageURL string, failReason string, failCode string) {
	if len(targets) == 0 {
		return ImageTaskTarget{}, "", "", "", ""
	}
	type checkResult struct {
		target     ImageTaskTarget
		status     string
		imageURL   string
		failReason string
		failCode   string
	}
	resultCh := make(chan checkResult, len(targets))
	for _, t := range targets {
		t := t
		go func() {
			poll, err := fetchImageTaskStatusOnce(t.BaseURL, t.APIKey, t.TaskID)
			if err != nil {
				poll.Status = ""
			}
			resultCh <- checkResult{
				target:     t,
				status:     poll.Status,
				imageURL:   poll.ImageURL,
				failReason: poll.FailReason,
				failCode:   poll.FailCode,
			}
		}()
	}
	results := make([]checkResult, 0, len(targets))
	for i := 0; i < len(targets); i++ {
		results = append(results, <-resultCh)
	}
	// succeeded wins outright
	for _, r := range results {
		switch r.status {
		case "succeeded", "success", "completed":
			return r.target, r.status, r.imageURL, "", ""
		}
	}
	// otherwise report the first definitive failure only if every target failed
	allFailed := true
	var firstFailure checkResult
	for _, r := range results {
		switch r.status {
		case "failed", "error", "cancelled":
			if firstFailure.status == "" {
				firstFailure = r
			}
		default:
			allFailed = false
		}
	}
	if allFailed && firstFailure.status != "" {
		display := FormatImageTaskFailReason(firstFailure.failCode, firstFailure.failReason)
		return firstFailure.target, firstFailure.status, "", display, firstFailure.failCode
	}
	return ImageTaskTarget{}, "pending", "", "", ""
}
