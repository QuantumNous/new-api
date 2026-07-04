package controller

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

type replayFailedRequestPayload struct {
	ChannelId int    `json:"channel_id"`
	Token     string `json:"token"`
}

func GetFailedRequestSnapshot(c *gin.Context) {
	requestId := strings.TrimSpace(c.Param("request_id"))
	snapshot, err := model.GetFailedRequestSnapshotByRequestId(requestId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, snapshot)
}

func ReplayFailedRequestSnapshot(c *gin.Context) {
	requestId := strings.TrimSpace(c.Param("request_id"))
	snapshot, err := model.GetFailedRequestSnapshotByRequestId(requestId)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	var payload replayFailedRequestPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		common.ApiError(c, err)
		return
	}
	if payload.ChannelId <= 0 {
		common.ApiError(c, fmt.Errorf("channel_id is required"))
		return
	}
	token := strings.TrimSpace(payload.Token)
	if token == "" {
		token = strings.TrimSpace(c.GetHeader("X-Replay-Token"))
	}
	token = strings.TrimPrefix(strings.TrimPrefix(token, "Bearer "), "bearer ")
	token = strings.TrimPrefix(token, "sk-")
	if token == "" {
		common.ApiError(c, fmt.Errorf("replay token is required"))
		return
	}

	replayURL, err := buildReplayURL(c, snapshot.RequestPath)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	method := strings.TrimSpace(snapshot.Method)
	if method == "" {
		method = http.MethodPost
	}
	req, err := service.BuildReplayRequest(snapshot, payload.ChannelId, token)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	req.URL, err = url.Parse(replayURL)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	req.Method = method

	client := &http.Client{Timeout: 5 * time.Minute}
	resp, err := client.Do(req)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	defer resp.Body.Close()
	body, readErr := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if readErr != nil {
		common.ApiError(c, readErr)
		return
	}

	common.ApiSuccess(c, gin.H{
		"request_id":          snapshot.RequestId,
		"replay_channel_id":   payload.ChannelId,
		"replay_url":          replayURL,
		"status_code":         resp.StatusCode,
		"response_body":       string(body),
		"response_body_bytes": len(body),
		"headers":             resp.Header,
	})
}

func buildReplayURL(c *gin.Context, requestPath string) (string, error) {
	requestPath = strings.TrimSpace(requestPath)
	if requestPath == "" {
		return "", fmt.Errorf("snapshot request_path is empty")
	}
	parsed, err := url.Parse(requestPath)
	if err != nil {
		return "", err
	}
	if parsed.IsAbs() {
		return parsed.String(), nil
	}
	scheme := "http"
	if c.Request != nil && c.Request.TLS != nil {
		scheme = "https"
	}
	if forwardedProto := strings.TrimSpace(c.GetHeader("X-Forwarded-Proto")); forwardedProto != "" {
		scheme = strings.Split(forwardedProto, ",")[0]
	}
	host := ""
	if c.Request != nil {
		host = c.Request.Host
	}
	if host == "" {
		host = "127.0.0.1"
		if common.Port != nil {
			host += ":" + strconv.Itoa(*common.Port)
		}
	}
	return fmt.Sprintf("%s://%s%s", scheme, host, requestPath), nil
}
