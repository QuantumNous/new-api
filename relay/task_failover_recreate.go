package relay

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	taskcommon "github.com/QuantumNous/new-api/relay/channel/task/taskcommon"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

// RecreateAsyncTaskOnChannel creates a new upstream task on next using the
// stored client request body. Does not PreConsume or allocate a new local task id.
func RecreateAsyncTaskOnChannel(ctx context.Context, task *model.Task, next *model.Channel) (*service.TaskFailoverRecreateResult, error) {
	if task == nil || next == nil {
		return nil, fmt.Errorf("task or channel is nil")
	}
	clientBody := strings.TrimSpace(task.PrivateData.ClientRequestBody)
	if clientBody == "" {
		return nil, fmt.Errorf("empty client_request_body")
	}

	modelName := ""
	if task.PrivateData.BillingContext != nil {
		modelName = task.PrivateData.BillingContext.OriginModelName
	}
	if modelName == "" {
		modelName = task.Properties.OriginModelName
	}
	if modelName == "" {
		return nil, fmt.Errorf("missing origin model name")
	}

	gin.SetMode(gin.ReleaseMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req := httptest.NewRequestWithContext(ctx, http.MethodPost, "/v1/videos", bytes.NewBufferString(clientBody))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req

	c.Set(common.KeyRequestBody, []byte(clientBody))
	common.SetContextKey(c, constant.ContextKeyUserId, task.UserId)
	if task.PrivateData.TokenId > 0 {
		common.SetContextKey(c, constant.ContextKeyTokenId, task.PrivateData.TokenId)
	}
	if task.Group != "" {
		common.SetContextKey(c, constant.ContextKeyUsingGroup, task.Group)
	}

	if setupErr := middleware.SetupContextForSelectedChannel(c, next, modelName); setupErr != nil {
		return nil, setupErr
	}

	info, err := relaycommon.GenRelayInfo(c, types.RelayFormatTask, nil, nil)
	if err != nil {
		return nil, err
	}
	info.OriginModelName = modelName
	info.SkipPreConsume = true
	info.PublicTaskID = task.TaskID
	info.UserId = task.UserId
	info.UsingGroup = task.Group
	if task.PrivateData.BillingContext != nil && task.PrivateData.BillingContext.OtherRatios != nil {
		for k, v := range task.PrivateData.BillingContext.OtherRatios {
			info.PriceData.AddOtherRatio(k, v)
		}
	}

	result, taskErr := RelayTaskSubmit(c, info)
	if taskErr != nil {
		msg := taskErr.Message
		if msg == "" && taskErr.Error != nil {
			msg = taskErr.Error.Error()
		}
		return nil, fmt.Errorf("recreate submit failed: %s", msg)
	}
	if result == nil || strings.TrimSpace(result.UpstreamTaskID) == "" {
		return nil, fmt.Errorf("recreate returned empty upstream task id")
	}

	upstreamBody := ""
	if v, ok := c.Get(taskcommon.GinKeyUpstreamRequestBody); ok {
		if s, ok := v.(string); ok {
			upstreamBody = s
		}
	}

	return &service.TaskFailoverRecreateResult{
		UpstreamTaskID: result.UpstreamTaskID,
		UpstreamBody:   upstreamBody,
		TaskData:       result.TaskData,
		Platform:       string(result.Platform),
	}, nil
}
