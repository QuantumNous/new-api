package taskcommon

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
)

// BindSeedanceRequest is the shared entry point every seedance-based channel
// calls from its ValidateRequestAndSetAction. It:
//
//  1. parses the inbound body as the provider-neutral dto.SeedanceVideoRequest
//     (the universal "official seedance content[]" format new-api exposes);
//  2. validates the minimal contract (a text prompt OR an image/video ref);
//  3. synthesizes a TaskSubmitReq (prompt + image URLs) and stores it in the
//     gin context so downstream billing / logging / task records see sane
//     values even though the real request lives in content[];
//  4. sets info.Action.
//
// It returns the parsed request so the caller can run channel-specific value
// checks (e.g. the supported resolution set). The body stays reusable, so the
// channel's BuildRequestBody can re-parse it (plus any channel-extension
// fields) and translate it into that channel's upstream wire format.
//
// The error is returned raw; the caller wraps it with
// service.TaskErrorWrapperLocal — taskcommon must NOT import service, which
// would create an import cycle (service already imports taskcommon).
//
// See "新增 seedance 系渠道适配器 SOP" in relay/channel/task/AGENTS.md.
// seedanceRequestContextKey caches the *dto.SeedanceVideoRequest parsed by
// BindSeedanceRequest so read-only consumers later in the same request (e.g. a
// channel's EstimateBilling) can reuse it via GetSeedanceRequest instead of
// re-decoding the body.
const seedanceRequestContextKey = "seedance_request"

func BindSeedanceRequest(c *gin.Context, info *relaycommon.RelayInfo, action string) (*dto.SeedanceVideoRequest, error) {
	var req dto.SeedanceVideoRequest
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		return nil, err
	}
	if err := req.Validate(); err != nil {
		return nil, err
	}

	taskReq := relaycommon.TaskSubmitReq{
		Model:      req.Model,
		Prompt:     req.PromptText(),
		Resolution: req.Resolution,
		Ratio:      req.Ratio,
	}
	// Carry an explicit positive duration so duration-based billing/logging
	// downstream sees the requested length (-1 = model-chosen, leave unset).
	if req.Duration != nil && *req.Duration > 0 {
		taskReq.Duration = *req.Duration
	}
	for _, m := range req.Images() {
		taskReq.Images = append(taskReq.Images, m.URL)
	}

	relaycommon.StoreTaskRequest(c, info, action, taskReq)
	c.Set(seedanceRequestContextKey, &req)
	return &req, nil
}

// GetSeedanceRequest returns the seedance request parsed by BindSeedanceRequest
// earlier in the same request, avoiding a redundant body decode for read-only
// consumers (e.g. a channel's EstimateBilling). If no bound request is cached —
// e.g. the consumer runs in isolation or before Bind — it decodes the reusable
// body once as a fallback. The body stays reusable either way.
func GetSeedanceRequest(c *gin.Context) (*dto.SeedanceVideoRequest, error) {
	if v, ok := c.Get(seedanceRequestContextKey); ok {
		if req, ok := v.(*dto.SeedanceVideoRequest); ok && req != nil {
			return req, nil
		}
	}
	var req dto.SeedanceVideoRequest
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		return nil, err
	}
	return &req, nil
}
