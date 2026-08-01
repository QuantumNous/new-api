package controller

import (
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func TestShouldRetryTaskRelayNeverReplaysCtyunCreation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(nil)
	baseURL := "https://ai.ctaigw.cn/v1"
	channel := &model.Channel{
		Id:      101,
		Type:    constant.ChannelTypeDoubaoVideo,
		BaseURL: &baseURL,
	}

	for _, status := range []int{http.StatusTooManyRequests, http.StatusInternalServerError, http.StatusBadGateway} {
		taskErr := &dto.TaskError{StatusCode: status, Message: "upstream submission result unknown"}
		if shouldRetryTaskRelay(ctx, channel, taskErr, 3) {
			t.Fatalf("Ctyun task creation must not retry after status %d", status)
		}
	}
}

func TestShouldRetryTaskRelayKeepsExistingDoubaoBehavior(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(nil)
	baseURL := "https://ark.cn-beijing.volces.com"
	channel := &model.Channel{
		Id:      102,
		Type:    constant.ChannelTypeDoubaoVideo,
		BaseURL: &baseURL,
	}
	taskErr := &dto.TaskError{StatusCode: http.StatusBadGateway, Message: "temporary upstream error"}

	if !shouldRetryTaskRelay(ctx, channel, taskErr, 1) {
		t.Fatal("existing DoubaoVideo retry behavior unexpectedly changed")
	}
}
