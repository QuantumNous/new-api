package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
)

func CovertMjpActionToModelName(mjAction string) string {
	modelName := "mj_" + strings.ToLower(mjAction)
	if mjAction == constant.MjActionSwapFace {
		modelName = "swap_face"
	}
	return modelName
}

// MidjourneySubmit is the local submission context, before funding or upstream I/O.
type MidjourneySubmit struct {
	Request         dto.MidjourneyRequest
	ModelName       string
	ConsumeQuota    bool
	OriginChannelID int
}

// PrepareMidjourneySubmit shares validation and origin-task lookup between
// distribution, real submission and quoting. The cached value is request-local.
func PrepareMidjourneySubmit(c *gin.Context, userID, relayMode int) (*MidjourneySubmit, *dto.MidjourneyResponse) {
	const contextKey = "prepared_midjourney_submit"
	if cached, exists := c.Get(contextKey); exists {
		return cached.(*MidjourneySubmit), nil
	}
	prepared := &MidjourneySubmit{ConsumeQuota: true}
	request := &prepared.Request
	if relayMode == relayconstant.RelayModeSwapFace {
		var swap dto.SwapFaceRequest
		if err := common.UnmarshalBodyReusable(c, &swap); err != nil {
			return nil, MidjourneyErrorWrapper(constant.MjRequestError, "bind_request_body_failed")
		}
		if swap.SourceBase64 == "" || swap.TargetBase64 == "" {
			return nil, MidjourneyErrorWrapper(constant.MjRequestError, "sour_base64_and_target_base64_is_required")
		}
		request.Action = constant.MjActionSwapFace
	} else {
		if err := common.UnmarshalBodyReusable(c, request); err != nil {
			return nil, MidjourneyErrorWrapper(constant.MjRequestError, "bind_request_body_failed")
		}
		if relayMode == relayconstant.RelayModeMidjourneyAction {
			if mjErr := CoverPlusActionToNormalAction(request); mjErr != nil {
				return nil, mjErr
			}
			relayMode = relayconstant.RelayModeMidjourneyChange
		}
		derived := false
		switch relayMode {
		case relayconstant.RelayModeMidjourneyImagine:
			if request.Prompt == "" {
				return nil, MidjourneyErrorWrapper(constant.MjRequestError, "prompt_is_required")
			}
			request.Action = constant.MjActionImagine
		case relayconstant.RelayModeMidjourneyDescribe:
			request.Action = constant.MjActionDescribe
		case relayconstant.RelayModeMidjourneyEdits:
			request.Action = constant.MjActionEdits
		case relayconstant.RelayModeMidjourneyShorten:
			request.Action = constant.MjActionShorten
		case relayconstant.RelayModeMidjourneyBlend:
			request.Action = constant.MjActionBlend
		case relayconstant.RelayModeMidjourneyUpload:
			request.Action = constant.MjActionUpload
		case relayconstant.RelayModeMidjourneyChange:
			if request.Action == "" || request.Index <= 0 {
				return nil, MidjourneyErrorWrapper(constant.MjRequestError, "invalid_request")
			}
			derived = true
		case relayconstant.RelayModeMidjourneySimpleChange:
			params := ConvertSimpleChangeParams(request.Content)
			if params == nil {
				return nil, MidjourneyErrorWrapper(constant.MjRequestError, "content_parse_failed")
			}
			request.TaskId, request.Action, request.Index = params.TaskId, params.Action, params.Index
			derived = true
		case relayconstant.RelayModeMidjourneyModal:
			request.Action = constant.MjActionModal
			derived = true
		case relayconstant.RelayModeMidjourneyVideo:
			request.Action = constant.MjActionVideo
			derived = request.TaskId != ""
		default:
			return nil, MidjourneyErrorWrapper(constant.MjRequestError, "unknown_relay_action")
		}
		if derived {
			if request.TaskId == "" {
				return nil, MidjourneyErrorWrapper(constant.MjRequestError, "task_id_is_required")
			}
			origin := model.GetByMJId(userID, request.TaskId)
			if origin == nil {
				return nil, MidjourneyErrorWrapper(constant.MjRequestError, "task_not_found")
			}
			if origin.ChannelId <= 0 {
				return nil, MidjourneyErrorWrapper(constant.MjRequestError, "get_channel_info_failed")
			}
			if setting.MjActionCheckSuccessEnabled && origin.Status != "SUCCESS" && relayMode != relayconstant.RelayModeMidjourneyModal {
				return nil, MidjourneyErrorWrapper(constant.MjRequestError, "task_status_not_success")
			}
			prepared.OriginChannelID = origin.ChannelId
			request.Prompt = origin.Prompt
		}
	}
	prepared.ModelName = CovertMjpActionToModelName(request.Action)
	prepared.ConsumeQuota = request.Action != constant.MjActionInPaint && request.Action != constant.MjActionCustomZoom
	c.Set(contextKey, prepared)
	return prepared, nil
}

// PrepareMidjourneyTaskBilling sets the durable refund marker before the task is inserted.
func PrepareMidjourneyTaskBilling(relayInfo *relaycommon.RelayInfo, task *model.Midjourney, quota int, shouldBill bool) (bool, error) {
	if task == nil {
		return false, errors.New("Midjourney task is nil")
	}
	task.Quota = 0
	task.TokenId = 0
	task.BillingChannelId = 0
	if !shouldBill {
		return false, nil
	}
	if relayInfo == nil {
		return false, errors.New("relay info is nil")
	}
	if quota < 0 {
		return false, errors.New("quota cannot be negative")
	}
	if relayInfo.BillingSource == BillingSourceSubscription {
		return false, errors.New("legacy Midjourney billing does not support subscriptions")
	}

	task.Quota = quota
	task.BillingChannelId = task.ChannelId
	if relayInfo.ChannelMeta != nil && relayInfo.ChannelId > 0 {
		task.BillingChannelId = relayInfo.ChannelId
	}
	return true, nil
}

// SettleMidjourneyTaskBilling charges a persisted legacy task and records the applied stages.
func SettleMidjourneyTaskBilling(relayInfo *relaycommon.RelayInfo, task *model.Midjourney, prepared bool) (bool, error) {
	if !prepared {
		return false, nil
	}
	if relayInfo == nil {
		return false, errors.New("relay info is nil")
	}
	if task == nil || task.Id == 0 {
		return false, errors.New("Midjourney task must be persisted before billing")
	}

	result, billingErr := postConsumeQuotaWithResult(relayInfo, task.Quota, 0, true)
	if !result.FundingApplied {
		task.Quota = 0
		task.TokenId = 0
		task.BillingChannelId = 0
		if updateErr := task.UpdateBillingState(); updateErr != nil {
			return false, errors.Join(billingErr, fmt.Errorf("clear Midjourney billing state: %w", updateErr))
		}
		return false, billingErr
	}

	task.TokenId = 0
	if result.TokenApplied {
		task.TokenId = relayInfo.TokenId
	}
	if updateErr := task.UpdateBillingState(); updateErr != nil {
		return true, errors.Join(billingErr, fmt.Errorf("update Midjourney billing state: %w", updateErr))
	}
	return true, billingErr
}

// RefundMidjourneyQuota reverses every accounting element recorded for a billed legacy task.
func RefundMidjourneyQuota(ctx context.Context, task *model.Midjourney, reason string) bool {
	quota := task.Quota
	if quota == 0 {
		return true
	}

	if err := model.IncreaseUserQuota(task.UserId, quota, false); err != nil {
		logger.LogWarn(ctx, common.LogText("failed to refund Midjourney user quota, task %s: %s", task.MjId, err.Error()))
		return false
	}

	if task.TokenId > 0 {
		tokenKey := resolveTokenKey(ctx, task.TokenId, task.MjId)
		if tokenKey != "" {
			if err := model.IncreaseTokenQuota(task.TokenId, tokenKey, quota); err != nil {
				logger.LogWarn(ctx, common.LogText("failed to refund Midjourney token quota, task %s: %s", task.MjId, err.Error()))
			}
		}
	}

	billingChannelId := task.GetBillingChannelId()
	model.UpdateUserUsedQuota(task.UserId, -quota)
	model.UpdateChannelUsedQuota(billingChannelId, -quota)
	other := model.NewLogOther()
	other.SetPublic("task_id", task.MjId)
	other.SetPublic("reason", reason)
	model.RecordTaskBillingLog(model.RecordTaskBillingLogParams{
		UserId:    task.UserId,
		LogType:   model.LogTypeRefund,
		ChannelId: billingChannelId,
		ModelName: CovertMjpActionToModelName(task.Action),
		Quota:     quota,
		TokenId:   task.TokenId,
		Other:     other,
	})

	task.Quota = 0
	if err := task.UpdateBillingState(); err != nil {
		logger.LogError(ctx, common.LogText("Midjourney refund succeeded but clearing the quota failed, task %s: %s", task.MjId, err.Error()))
	}
	return true
}

func CoverPlusActionToNormalAction(midjRequest *dto.MidjourneyRequest) *dto.MidjourneyResponse {
	// "customId": "MJ::JOB::upsample::2::3dbbd469-36af-4a0f-8f02-df6c579e7011"
	customId := midjRequest.CustomId
	if customId == "" {
		return MidjourneyErrorWrapper(constant.MjRequestError, "custom_id_is_required")
	}
	splits := strings.Split(customId, "::")
	if len(splits) < 3 {
		return MidjourneyErrorWrapper(constant.MjRequestError, "invalid_custom_id")
	}
	var action string
	if splits[1] == "JOB" {
		action = splits[2]
	} else {
		action = splits[1]
	}

	if action == "" {
		return MidjourneyErrorWrapper(constant.MjRequestError, "unknown_action")
	}
	if strings.Contains(action, "upsample") {
		if len(splits) < 4 {
			return MidjourneyErrorWrapper(constant.MjRequestError, "index_parse_failed")
		}
		index, err := strconv.Atoi(splits[3])
		if err != nil {
			return MidjourneyErrorWrapper(constant.MjRequestError, "index_parse_failed")
		}
		midjRequest.Index = index
		midjRequest.Action = constant.MjActionUpscale
	} else if strings.Contains(action, "variation") {
		midjRequest.Index = 1
		if action == "variation" {
			if len(splits) < 4 {
				return MidjourneyErrorWrapper(constant.MjRequestError, "index_parse_failed")
			}
			index, err := strconv.Atoi(splits[3])
			if err != nil {
				return MidjourneyErrorWrapper(constant.MjRequestError, "index_parse_failed")
			}
			midjRequest.Index = index
			midjRequest.Action = constant.MjActionVariation
		} else if action == "low_variation" {
			midjRequest.Action = constant.MjActionLowVariation
		} else if action == "high_variation" {
			midjRequest.Action = constant.MjActionHighVariation
		} else {
			return MidjourneyErrorWrapper(constant.MjRequestError, "unknown_action")
		}
	} else if strings.Contains(action, "pan") {
		midjRequest.Action = constant.MjActionPan
		midjRequest.Index = 1
	} else if strings.Contains(action, "reroll") {
		midjRequest.Action = constant.MjActionReRoll
		midjRequest.Index = 1
	} else if action == "Outpaint" {
		midjRequest.Action = constant.MjActionZoom
		midjRequest.Index = 1
	} else if action == "CustomZoom" {
		midjRequest.Action = constant.MjActionCustomZoom
		midjRequest.Index = 1
	} else if action == "Inpaint" {
		midjRequest.Action = constant.MjActionInPaint
		midjRequest.Index = 1
	} else {
		return MidjourneyErrorWrapper(constant.MjRequestError, "unknown_action")
	}
	return nil
}

func ConvertSimpleChangeParams(content string) *dto.MidjourneyRequest {
	split := strings.Split(content, " ")
	if len(split) != 2 || split[0] == "" || split[1] == "" {
		return nil
	}

	action := strings.ToLower(split[1])
	changeParams := &dto.MidjourneyRequest{}
	changeParams.TaskId = split[0]

	if len(action) == 2 && action[0] == 'u' {
		changeParams.Action = "UPSCALE"
	} else if len(action) == 2 && action[0] == 'v' {
		changeParams.Action = "VARIATION"
	} else if action == "r" {
		changeParams.Action = "REROLL"
		return changeParams
	} else {
		return nil
	}

	index, err := strconv.Atoi(action[1:2])
	if err != nil || index < 1 || index > 4 {
		return nil
	}
	changeParams.Index = index
	return changeParams
}

// RecordMidjourneyPolicyResponse distinguishes accepted tasks from errors inside
// HTTP 200 responses. Submissions are single-attempt: an ambiguous transport
// failure must never create a duplicate task on another channel.
func RecordMidjourneyPolicyResponse(c *gin.Context, response *dto.MidjourneyResponseWithStatusCode, requestErr error) bool {
	if response == nil {
		response = MidjourneyErrorWithStatusCodeWrapper(constant.MjErrorUnknown, "empty_response", http.StatusBadGateway)
	}
	accepted := requestErr == nil && response.StatusCode == http.StatusOK && (response.Response.Code == 1 || response.Response.Code == 21 || response.Response.Code == 22)
	if accepted {
		properties, _ := response.Response.Properties.(map[string]any)
		if properties["status"] != "FAILURE" {
			return true
		}
	}
	state := RequestPolicy(c)
	event := PolicyEvent{ChannelID: c.GetInt("channel_id"), Status: response.StatusCode, ErrorCode: strconv.Itoa(response.Response.Code), ErrorSource: "upstream", Decision: PolicyDecision{Action: "failure", Reason: "upstream_failure", Source: "upstream"}}
	state.AddEvent(event)
	event.Decision, event.Health = PolicyDecision{Action: "stop", Reason: "non_retryable_error", Source: "system"}, "unchanged"
	if accepted {
		event.Decision.Reason = "task_accepted"
	}
	state.AddEvent(event)
	return false
}

func DoMidjourneyHttpRequest(c *gin.Context, timeout time.Duration, fullRequestURL string) (*dto.MidjourneyResponseWithStatusCode, []byte, error) {
	var nullBytes []byte
	//var requestBody io.Reader
	//requestBody = c.Request.Body
	// read request body to json, delete accountFilter and notifyHook
	var mapResult map[string]any
	// if get request, no need to read request body
	if c.Request.Method != "GET" {
		err := common.DecodeJson(c.Request.Body, &mapResult)
		if err != nil {
			return MidjourneyErrorWithStatusCodeWrapper(constant.MjErrorUnknown, "read_request_body_failed", http.StatusInternalServerError), nullBytes, err
		}
		if !setting.MjAccountFilterEnabled {
			delete(mapResult, "accountFilter")
		}
		if !setting.MjNotifyEnabled {
			delete(mapResult, "notifyHook")
		}
		//req, err := http.NewRequest(c.Request.Method, fullRequestURL, requestBody)
		// make new request with mapResult
	}
	if setting.MjModeClearEnabled {
		if prompt, ok := mapResult["prompt"].(string); ok {
			prompt = strings.Replace(prompt, "--fast", "", -1)
			prompt = strings.Replace(prompt, "--relax", "", -1)
			prompt = strings.Replace(prompt, "--turbo", "", -1)

			mapResult["prompt"] = prompt
		}
	}
	reqBody, err := common.Marshal(mapResult)
	if err != nil {
		return MidjourneyErrorWithStatusCodeWrapper(constant.MjErrorUnknown, "marshal_request_body_failed", http.StatusInternalServerError), nullBytes, err
	}
	req, err := http.NewRequest(c.Request.Method, fullRequestURL, strings.NewReader(string(reqBody)))
	if err != nil {
		return MidjourneyErrorWithStatusCodeWrapper(constant.MjErrorUnknown, "create_request_failed", http.StatusInternalServerError), nullBytes, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	// 使用带有超时的 context 创建新的请求
	req = req.WithContext(ctx)
	req.Header.Set("Content-Type", c.Request.Header.Get("Content-Type"))
	req.Header.Set("Accept", c.Request.Header.Get("Accept"))
	auth := common.GetContextKeyString(c, constant.ContextKeyChannelKey)
	if auth != "" {
		auth = strings.TrimPrefix(auth, "Bearer ")
		req.Header.Set("mj-api-secret", auth)
	}
	defer cancel()
	resp, err := GetHttpClient().Do(req)
	if err != nil {
		common.SysLog(common.LogText("do request failed: %s", err.Error()))
		return MidjourneyErrorWithStatusCodeWrapper(constant.MjErrorUnknown, "do_request_failed", http.StatusInternalServerError), nullBytes, err
	}
	statusCode := resp.StatusCode
	//if statusCode != 200  {
	//	return MidjourneyErrorWithStatusCodeWrapper(constant.MjErrorUnknown, "bad_response_status_code", statusCode), nullBytes, nil
	//}
	err = req.Body.Close()
	if err != nil {
		return MidjourneyErrorWithStatusCodeWrapper(constant.MjErrorUnknown, "close_request_body_failed", statusCode), nullBytes, err
	}
	err = c.Request.Body.Close()
	if err != nil {
		return MidjourneyErrorWithStatusCodeWrapper(constant.MjErrorUnknown, "close_request_body_failed", statusCode), nullBytes, err
	}
	var midjResponse dto.MidjourneyResponse
	var midjourneyUploadsResponse dto.MidjourneyUploadResponse
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return MidjourneyErrorWithStatusCodeWrapper(constant.MjErrorUnknown, "read_response_body_failed", statusCode), nullBytes, err
	}
	CloseResponseBodyGracefully(resp)
	logger.LogDebug(c, "midjourney response body: %s", responseBody)
	if len(responseBody) == 0 {
		return MidjourneyErrorWithStatusCodeWrapper(constant.MjErrorUnknown, "empty_response_body", statusCode), responseBody, nil
	} else {
		err = common.Unmarshal(responseBody, &midjResponse)
		if err != nil {
			err2 := common.Unmarshal(responseBody, &midjourneyUploadsResponse)
			if err2 != nil {
				return MidjourneyErrorWithStatusCodeWrapper(constant.MjErrorUnknown, "unmarshal_response_body_failed", statusCode), responseBody, err
			}
		}
	}
	//for k, v := range resp.Header {
	//	c.Writer.Header().Set(k, v[0])
	//}
	return &dto.MidjourneyResponseWithStatusCode{
		StatusCode: statusCode,
		Response:   midjResponse,
	}, responseBody, nil
}
