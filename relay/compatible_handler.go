package relay

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/internal/policy"
	"github.com/QuantumNous/new-api/internal/skill/enums"
	"github.com/QuantumNous/new-api/internal/skill/errcodes"
	skillrelay "github.com/QuantumNous/new-api/internal/skill/relay"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/samber/lo"

	"github.com/gin-gonic/gin"
)

func TextHelper(c *gin.Context, info *relaycommon.RelayInfo) (newAPIError *types.NewAPIError) {
	info.InitChannelMeta(c)

	textReq, ok := info.Request.(*dto.GeneralOpenAIRequest)
	if !ok {
		return types.NewErrorWithStatusCode(fmt.Errorf("invalid request type, expected dto.GeneralOpenAIRequest, got %T", info.Request), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}

	request, err := common.DeepCopy(textReq)
	if err != nil {
		return types.NewError(fmt.Errorf("failed to copy request to GeneralOpenAIRequest: %w", err), types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}

	if request.WebSearchOptions != nil {
		c.Set("chat_completion_web_search_context_size", request.WebSearchOptions.SearchContextSize)
	}

	// DR-64: skill relay entry point - resolve user identity and load the target Skill
	// for requests that carry deeprouter.skill_id (tasks/05 section 5.1 steps 1-6).
	// Anonymous callers are rejected here with AUTH_REQUIRED before any prompt load.
	publicRoutingAPI := common.GetContextKeyBool(c, constant.ContextKeySkillPublicRoutingAPI)
	if publicRoutingAPI && (request.Deeprouter == nil || request.Deeprouter.SkillID == "") {
		return types.NewErrorWithStatusCode(
			fmt.Errorf("deeprouter.skill_id is required"),
			types.ErrorCodeInvalidRequest,
			http.StatusBadRequest,
			types.ErrOptionWithSkipRetry(),
		)
	}

	// Track whether the original request carried any deeprouter extension before stripping,
	// so the pass-through guard below can block raw-body forwarding for partial extensions
	// (e.g. {entry_point: "skill_package"} with no skill_id) just as it does for full ones.
	hadDeeprouterExtension := request.Deeprouter != nil
	if hadDeeprouterExtension {
		if request.Deeprouter.SkillID != "" {
			entryPoint, entryPointErr := resolveDirectSkillEntryPoint(c, request)
			if entryPointErr != nil {
				return entryPointErr
			}
			// TOCTOU guard: if Distribute's prepareSkillRelayForDistribution already
			// ran, SkillRelayContext has a pinned SkillVersionID. Re-calling Resolve
			// would return a fresh zero-SkillVersionID context; skillrelay.Set below
			// would overwrite the pin, causing the LoadAndApply block to re-load the
			// snapshot - which may differ from the one used for channel selection if
			// active_version_id changed between Distribute and TextHelper.
			// Direct path (unit tests / non-Distribute callers): no context exists yet.
			var skillCtx *skillrelay.SkillRelayContext
			if existing, alreadyLoaded := skillrelay.Get(c); alreadyLoaded && existing.SkillVersionID != "" {
				skillCtx = existing // Distribute path: reuse pinned context
			} else {
				resolved, errCode := skillrelay.ResolveVersion(c, request.Deeprouter.SkillID, request.Deeprouter.SkillVersionID)
				if errCode != "" {
					skillrelay.AbortSkillRelayBlocked(c, skillrelay.AbortSkillRelayBlockedInput{
						ErrorCode:  errCode,
						EntryPoint: entryPoint,
						SkillID:    request.Deeprouter.SkillID,
					}, nil)
					return types.NewErrorWithStatusCode(
						fmt.Errorf("%s", errCode),
						skillRelayErrType(errCode),
						errcodes.HTTPStatusFor(errCode),
						types.ErrOptionWithSkipRetry(),
					)
				}
				skillCtx = resolved
			}
			// Carry the already-validated real entry_point into relay context for analytics.
			skillCtx.EntryPoint = entryPoint
			skillrelay.Set(c, skillCtx)
		}
		request.Deeprouter = nil // always strip vendor extension before provider forwarding
	}

	// Airbotix / DeepRouter policy check.
	// Two paths reach here:
	//   a) Direct (unit tests / non-Distribute callers): request.Model is still the
	//      client-supplied model, so policy sees the original client model name. The
	//      LoadAndApply block below then overwrites it with the server snapshot model.
	//   b) Distribute (public routing API): prepareSkillRelayForDistribution already
	//      called LoadAndApply and replaced the request body, so request.Model is the
	//      server whitelist model (e.g. "deeprouter-auto") by the time we reach here.
	//      Kids-mode filtering against virtual alias names is intentionally out of scope
	//      for V1 (DR-68 PRD section kids-session); the Distribute path's rewrite is applied
	//      before channel model_mapping so a kids_mode whitelist entry for a real model
	//      name is still honoured once smart-router resolves the virtual alias.
	//      TODO(DR-68-kids): assert that no virtual alias (e.g. "deeprouter-auto")
	//      appears in kids_mode_models to prevent a misconfigured whitelist bypassing
	//      the kids-safe constraint via smart-router resolution.
	if d, ok := common.GetContextKey(c, constant.ContextKeyPolicyDecision); ok {
		if decision, castOk := d.(policy.Decision); castOk {
			if reject := applyAirbotixPolicy(decision, info.ChannelType, request); reject != "" {
				return types.NewErrorWithStatusCode(fmt.Errorf("%s", reject), types.ErrorCodeChannelModelMappedError, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
			}
		}
	}

	// DR-68: for skill relay requests, load version snapshot and rewrite request
	// (server-authoritative model selection + FR-G19 single-turn enforcement).
	//
	// Two paths:
	//   a) Direct (unit tests / non-Distribute callers): Resolve already bound the
	//      immutable SkillVersion snapshot; LoadAndApply consumes it here and rewrites
	//      the request after applyAirbotixPolicy so kids-mode sees the original model.
	//   b) Distribute path: prepareSkillRelayForDistribution may have already rewritten
	//      the request and stored the bound SkillVersion snapshot. Re-running
	//      LoadAndApply here is safe because it consumes that bound snapshot instead
	//      of resolving mutable active_version_id state again.
	if skillCtx, isSkill := skillrelay.Get(c); isSkill && (skillCtx.SkillVersion != nil || skillCtx.SkillVersionID == "") {
		rewritten, execErrCode := skillrelay.LoadAndApply(skillCtx, request)
		if execErrCode != "" {
			skillrelay.AbortSkillRelayBlocked(c, skillrelay.AbortSkillRelayBlockedInput{
				ErrorCode:  execErrCode,
				EntryPoint: skillCtx.EntryPoint,
				SkillID:    skillCtx.SkillID,
			}, nil)
			return types.NewErrorWithStatusCode(
				fmt.Errorf("%s", execErrCode),
				skillRelayErrType(execErrCode),
				errcodes.HTTPStatusFor(execErrCode),
				types.ErrOptionWithSkipRetry(),
			)
		}
		request = rewritten
		// Explicit re-store: LoadAndApply mutated skillCtx.SkillVersionID through the
		// pointer. Re-calling Set makes the update safe against any future refactor of
		// skillrelay.Get that returns a copy instead of the stored pointer.
		skillrelay.Set(c, skillCtx)
	}

	err = helper.ModelMappedHelper(c, info, request)
	if err != nil {
		return types.NewError(err, types.ErrorCodeChannelModelMappedError, types.ErrOptionWithSkipRetry())
	}

	includeUsage := true
	// Determine whether the client requested usage stats in the response.
	if request.StreamOptions != nil {
		includeUsage = request.StreamOptions.IncludeUsage
	}

	// Clear StreamOptions when the channel doesn't support it or streaming is off.
	if !info.SupportStreamOptions || !lo.FromPtrOr(request.Stream, false) {
		request.StreamOptions = nil
	} else {
		// Channel supports StreamOptions and stream is on: apply ForceStreamOption config if set.
		if constant.ForceStreamOption {
			request.StreamOptions = &dto.StreamOptions{
				IncludeUsage: true,
			}
		}
	}

	info.ShouldIncludeUsage = includeUsage

	adaptor := GetAdaptor(info.ApiType)
	if adaptor == nil {
		return types.NewError(fmt.Errorf("invalid api type: %d", info.ApiType), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
	}
	adaptor.Init(info)

	passThroughGlobal := model_setting.GetGlobalSettings().PassThroughRequestEnabled
	if info.RelayMode == relayconstant.RelayModeChatCompletions &&
		!passThroughGlobal &&
		!info.ChannelSetting.PassThroughBodyEnabled &&
		service.ShouldChatCompletionsUseResponsesGlobal(info.ChannelId, info.ChannelType, info.OriginModelName) {
		applySystemPromptIfNeeded(c, info, request)
		usage, newApiErr := chatCompletionsViaResponses(c, info, adaptor, request)
		if newApiErr != nil {
			return newApiErr
		}

		var containAudioTokens = usage.CompletionTokenDetails.AudioTokens > 0 || usage.PromptTokensDetails.AudioTokens > 0
		var containsAudioRatios = ratio_setting.ContainsAudioRatio(info.OriginModelName) || ratio_setting.ContainsAudioCompletionRatio(info.OriginModelName)

		if containAudioTokens && containsAudioRatios {
			service.PostAudioConsumeQuota(c, info, usage, "")
		} else {
			service.PostTextConsumeQuota(c, info, usage, nil)
		}
		return nil
	}

	var requestBody io.Reader

	if passThroughGlobal || info.ChannelSetting.PassThroughBodyEnabled {
		// Pass-through sends raw BodyStorage bytes directly to the provider, bypassing
		// the Go struct. The request.Deeprouter = nil strip above has no effect on the
		// already-buffered raw body, so any deeprouter vendor extension  including
		// partial extensions without a skill_id  would be forwarded upstream unchanged.
		// Reject any request that carried a deeprouter extension.
		if hadDeeprouterExtension {
			return types.NewErrorWithStatusCode(
				fmt.Errorf("%s", errcodes.ErrSkillInternalError),
				types.ErrorCodeDoRequestFailed,
				http.StatusInternalServerError,
				types.ErrOptionWithSkipRetry(),
			)
		}
		storage, err := common.GetBodyStorage(c)
		if err != nil {
			return types.NewErrorWithStatusCode(err, types.ErrorCodeReadRequestBodyFailed, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
		if common.DebugEnabled {
			if debugBytes, bErr := storage.Bytes(); bErr == nil {
				println("requestBody: ", string(debugBytes))
			}
		}
		requestBody = common.ReaderOnly(storage)
	} else {
		convertedRequest, err := adaptor.ConvertOpenAIRequest(c, info, request)
		if err != nil {
			return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
		}
		relaycommon.AppendRequestConversionFromRequest(info, convertedRequest)

		if info.ChannelSetting.SystemPrompt != "" {
			// Skill relay: instruction_template from the SkillVersion snapshot is the
			// authoritative system message (DR-68); channel-level SystemPrompt must not
			// prepend or override it. For non-skill relay requests, inject as usual.
			if _, isSkillRelay := skillrelay.Get(c); !isSkillRelay {
				request, ok := convertedRequest.(*dto.GeneralOpenAIRequest)
				if ok {
					containSystemPrompt := false
					for _, message := range request.Messages {
						if message.Role == request.GetSystemRoleName() {
							containSystemPrompt = true
							break
						}
					}
					if !containSystemPrompt {
						// No system message yet: prepend one.
						systemMessage := dto.Message{
							Role:    request.GetSystemRoleName(),
							Content: info.ChannelSetting.SystemPrompt,
						}
						request.Messages = append([]dto.Message{systemMessage}, request.Messages...)
					} else if info.ChannelSetting.SystemPromptOverride {
						common.SetContextKey(c, constant.ContextKeySystemPromptOverride, true)
						// System prompt override enabled: prepend channel prompt ahead of the existing one.
						for i, message := range request.Messages {
							if message.Role == request.GetSystemRoleName() {
								if message.IsStringContent() {
									request.Messages[i].SetStringContent(info.ChannelSetting.SystemPrompt + "\n" + message.StringContent())
								} else {
									contents := message.ParseContent()
									contents = append([]dto.MediaContent{
										{
											Type: dto.ContentTypeText,
											Text: info.ChannelSetting.SystemPrompt,
										},
									}, contents...)
									request.Messages[i].Content = contents
								}
								break
							}
						}
					}
				}
			}
		}

		jsonData, err := common.Marshal(convertedRequest)
		if err != nil {
			return types.NewError(err, types.ErrorCodeJsonMarshalFailed, types.ErrOptionWithSkipRetry())
		}

		// remove disabled fields for OpenAI API
		jsonData, err = relaycommon.RemoveDisabledFields(jsonData, info.ChannelOtherSettings, info.ChannelSetting.PassThroughBodyEnabled)
		if err != nil {
			return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
		}

		// apply param override
		if len(info.ParamOverride) > 0 {
			jsonData, err = relaycommon.ApplyParamOverrideWithRelayInfo(jsonData, info)
			if err != nil {
				return newAPIErrorFromParamOverride(err)
			}
		}

		logger.LogDebug(c, fmt.Sprintf("text request body: %s", string(jsonData)))

		requestBody = bytes.NewBuffer(jsonData)
	}

	var httpResp *http.Response
	resp, err := adaptor.DoRequest(c, info, requestBody)
	if err != nil {
		return types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
	}

	statusCodeMappingStr := c.GetString("status_code_mapping")

	if resp != nil {
		httpResp = resp.(*http.Response)
		info.IsStream = info.IsStream || strings.HasPrefix(httpResp.Header.Get("Content-Type"), "text/event-stream")
		if httpResp.StatusCode != http.StatusOK {
			newApiErr := service.RelayErrorHandler(c.Request.Context(), httpResp, false)
			// reset status code
			service.ResetStatusCode(newApiErr, statusCodeMappingStr)
			return newApiErr
		}
	}

	usage, newApiErr := adaptor.DoResponse(c, httpResp, info)
	if newApiErr != nil {
		// reset status code
		service.ResetStatusCode(newApiErr, statusCodeMappingStr)
		return newApiErr
	}

	var containAudioTokens = usage.(*dto.Usage).CompletionTokenDetails.AudioTokens > 0 || usage.(*dto.Usage).PromptTokensDetails.AudioTokens > 0
	var containsAudioRatios = ratio_setting.ContainsAudioRatio(info.OriginModelName) || ratio_setting.ContainsAudioCompletionRatio(info.OriginModelName)

	if containAudioTokens && containsAudioRatios {
		service.PostAudioConsumeQuota(c, info, usage.(*dto.Usage), "")
	} else {
		service.PostTextConsumeQuota(c, info, usage.(*dto.Usage), nil)
	}
	return nil
}

func resolveDirectSkillEntryPoint(c *gin.Context, request *dto.GeneralOpenAIRequest) (string, *types.NewAPIError) {
	requested := ""
	if request.Deeprouter != nil {
		requested = request.Deeprouter.EntryPoint
	}
	entryPoint, errCode := skillrelay.ResolveEffectiveEntryPoint(
		common.GetContextKeyString(c, constant.ContextKeySkillRelayEntryPoint),
		requested,
		string(enums.EntryPointPlaygroundPicker),
	)
	if errCode != "" {
		return "", types.NewErrorWithStatusCode(
			fmt.Errorf("invalid entry_point: %q", requested),
			types.ErrorCodeInvalidRequest,
			http.StatusBadRequest,
			types.ErrOptionWithSkipRetry(),
		)
	}
	return entryPoint, nil
}

// skillRelayErrType maps a skill errcodes.ErrorCode to the appropriate
// types.ErrorCode (OpenAI error envelope "type" field), keyed by HTTP status
// category. Using access_denied for 404 or 500 would mislead OpenAI-compatible
// clients that inspect the type field to categorise errors.
func skillRelayErrType(errCode errcodes.ErrorCode) types.ErrorCode {
	switch errcodes.HTTPStatusFor(errCode) {
	case http.StatusUnauthorized, http.StatusForbidden:
		return types.ErrorCodeAccessDenied
	case http.StatusNotFound, http.StatusBadRequest:
		return types.ErrorCodeInvalidRequest
	default: // 429, 500, 504,
		return types.ErrorCodeDoRequestFailed
	}
}
