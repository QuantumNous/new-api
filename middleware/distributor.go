package middleware

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	taskdto "github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

type ModelRequest struct {
	Model    string `json:"model"`
	Group    string `json:"group,omitempty"`
	Workload string `json:"workload,omitempty"`
}

func Distribute() func(c *gin.Context) {
	return func(c *gin.Context) {
		var channel *model.Channel
		constraints := service.GetChannelConstraints(c)
		constraints.AddFilter(taskdto.ChannelFilter{
			Kind:        taskdto.FilterRequestPath,
			RequestPath: c.Request.URL.Path,
		})
		service.AppendTaskPluginIdentityFilter(c, c.GetString("expected_task_plugin_key"))
		modelRequest, shouldSelectChannel, err := getModelRequest(c)
		if err != nil {
			abortWithOpenAiMessage(c, http.StatusBadRequest, i18n.T(c, i18n.MsgDistributorInvalidRequest, map[string]any{"Error": err.Error()}))
			return
		}

		if workload := strings.TrimSpace(modelRequest.Workload); workload != "" {
			common.SetContextKey(c, constant.ContextKeySchedulerWorkload, workload)
		}

		pin, pinFound, overridden := constraints.ResolvedPin()
		if pinFound {
			for _, lost := range overridden {
				logger.LogWarn(c, fmt.Sprintf(
					"channel pin overridden: winning_source=%s winning_channel_id=%d overridden_source=%s overridden_channel_id=%d",
					pin.Source, pin.ChannelId, lost.Source, lost.ChannelId,
				))
			}
			channel, err = model.CacheGetChannel(pin.ChannelId)
			if err != nil {
				if pin.Source == taskdto.PinSourceOriginTask {
					abortWithOpenAiMessage(c, http.StatusBadRequest, "origin_task_channel_disabled", types.ErrorCode("origin_task_channel_disabled"))
				} else {
					abortWithOpenAiMessage(c, http.StatusBadRequest, i18n.T(c, i18n.MsgDistributorInvalidChannelId))
				}
				return
			}
			if channel.Status != common.ChannelStatusEnabled {
				if pin.Source == taskdto.PinSourceOriginTask {
					abortWithOpenAiMessage(c, http.StatusBadRequest, "origin_task_channel_disabled", types.ErrorCode("origin_task_channel_disabled"))
				} else {
					abortWithOpenAiMessage(c, http.StatusForbidden, i18n.T(c, i18n.MsgDistributorChannelDisabled))
				}
				return
			}
			if ok, kind := model.ChannelSatisfiesFilters(channel, modelRequest.Model, constraints.Filters); !ok {
				if kind == taskdto.FilterTaskPluginIdentity {
					logTaskPluginChannelDecision(c, channel, modelRequest.Model, "channel_rejected", "identity_mismatch")
				}
				abortWithOpenAiMessage(c, http.StatusBadRequest, i18n.T(c, i18n.MsgDistributorNoAvailableChannel, map[string]any{"Group": common.GetContextKeyString(c, constant.ContextKeyUsingGroup), "Model": modelRequest.Model}), types.ErrorCode(kind))
				return
			}
		} else {
			modelLimitEnable := common.GetContextKeyBool(c, constant.ContextKeyTokenModelLimitEnabled)
			if modelLimitEnable {
				s, ok := common.GetContextKey(c, constant.ContextKeyTokenModelLimit)
				if !ok {
					abortWithOpenAiMessage(c, http.StatusForbidden, i18n.T(c, i18n.MsgDistributorTokenNoModelAccess))
					return
				}
				var tokenModelLimit map[string]bool
				tokenModelLimit, ok = s.(map[string]bool)
				if !ok {
					tokenModelLimit = map[string]bool{}
				}
				matchName := ratio_setting.FormatMatchingModelName(modelRequest.Model)
				if _, ok := tokenModelLimit[matchName]; !ok {
					abortWithOpenAiMessage(c, http.StatusForbidden, i18n.T(c, i18n.MsgDistributorTokenModelForbidden, map[string]any{"Model": modelRequest.Model}))
					return
				}
			}

			if shouldSelectChannel {
				if modelRequest.Model == "" {
					abortWithOpenAiMessage(c, http.StatusBadRequest, i18n.T(c, i18n.MsgDistributorModelNameRequired))
					return
				}

				var selectGroup string
				usingGroup := common.GetContextKeyString(c, constant.ContextKeyUsingGroup)
				if strings.HasPrefix(c.Request.URL.Path, "/pg/chat/completions") {
					playgroundRequest := &dto.PlayGroundRequest{}
					err = common.UnmarshalBodyReusable(c, playgroundRequest)
					if err != nil {
						abortWithOpenAiMessage(c, http.StatusBadRequest, i18n.T(c, i18n.MsgDistributorInvalidPlayground, map[string]any{"Error": err.Error()}))
						return
					}
					if playgroundRequest.Group != "" {
						if !service.GroupInUserUsableGroups(usingGroup, playgroundRequest.Group) && playgroundRequest.Group != usingGroup {
							abortWithOpenAiMessage(c, http.StatusForbidden, i18n.T(c, i18n.MsgDistributorGroupAccessDenied))
							return
						}
						usingGroup = playgroundRequest.Group
						common.SetContextKey(c, constant.ContextKeyUsingGroup, usingGroup)
					}
				}

				if service.SchedulerClient().Enabled {
					setSchedulerAllowedChannelIDs(c, modelRequest.Model, usingGroup, c.Request.URL.Path)
				}
				if service.SchedulerEnforcedForRequest(c) {
					if preferredChannelID, found := service.GetPreferredChannelByAffinity(c, modelRequest.Model, usingGroup); found {
						common.SetContextKey(c, constant.ContextKeySchedulerAffinityChannelID, preferredChannelID)
					}
					if err := service.RunSchedulerShadow(c, modelRequest.Model, usingGroup); err != nil {
						if service.IsSchedulerTransientUnavailable(err) && service.SchedulerEmergencyNativeAllowed(modelRequest.Model, usingGroup) {
							service.MarkSchedulerEmergency(c, err)
							common.SysLog(fmt.Sprintf("scheduler emergency native routing enabled: request_id=%s model=%s group=%s error=%v", c.GetString(common.RequestIdKey), modelRequest.Model, usingGroup, err))
						} else {
							abortWithOpenAiMessage(c, http.StatusServiceUnavailable, "scheduler unavailable: "+err.Error(), types.ErrorCodeModelNotFound)
							return
						}
					} else {
						candidate, found := service.SchedulerCandidateForInitial(c)
						if !found {
							abortWithOpenAiMessage(c, http.StatusServiceUnavailable, "scheduler returned no usable candidate", types.ErrorCodeModelNotFound)
							return
						}
						candidateChannel, candidateErr := model.GetChannelById(candidate.ChannelID, true)
						if candidateErr != nil || candidateChannel == nil || candidateChannel.Status != common.ChannelStatusEnabled ||
							!channelSupportsRequestPath(candidateChannel, c.Request.URL.Path, modelRequest.Model) {
							abortWithOpenAiMessage(c, http.StatusServiceUnavailable, fmt.Sprintf("scheduler candidate channel %d unavailable", candidate.ChannelID), types.ErrorCodeModelNotFound)
							return
						}
						if usingGroup == "auto" {
							userGroup := common.GetContextKeyString(c, constant.ContextKeyUserGroup)
							for _, g := range service.GetRequestAutoGroups(c, userGroup) {
								if model.IsChannelEnabledForGroupModel(g, modelRequest.Model, candidateChannel.Id) {
									selectGroup = g
									common.SetContextKey(c, constant.ContextKeyAutoGroup, g)
									break
								}
							}
							if selectGroup == "" {
								abortWithOpenAiMessage(c, http.StatusServiceUnavailable, fmt.Sprintf("scheduler candidate channel %d is not enabled for model %s", candidate.ChannelID, modelRequest.Model), types.ErrorCodeModelNotFound)
								return
							}
						} else {
							if !model.IsChannelEnabledForGroupModel(usingGroup, modelRequest.Model, candidateChannel.Id) {
								abortWithOpenAiMessage(c, http.StatusServiceUnavailable, fmt.Sprintf("scheduler candidate channel %d is not enabled for group %s and model %s", candidate.ChannelID, usingGroup, modelRequest.Model), types.ErrorCodeModelNotFound)
								return
							}
							selectGroup = usingGroup
						}
						channel = candidateChannel
					}
				}

				if channel == nil {
					if preferredChannelID, found := service.GetPreferredChannelByAffinity(c, modelRequest.Model, usingGroup); found {
						affinityUsable := false
						preferred, err := model.CacheGetChannel(preferredChannelID)
						affinitySatisfied := false
						if err == nil && preferred != nil && preferred.Status == common.ChannelStatusEnabled {
							affinitySatisfied, _ = model.ChannelSatisfiesFilters(preferred, modelRequest.Model, constraints.Filters)
						}
						if affinitySatisfied {
							if usingGroup == "auto" {
								userGroup := common.GetContextKeyString(c, constant.ContextKeyUserGroup)
								for _, g := range service.GetRequestAutoGroups(c, userGroup) {
									if model.IsChannelEnabledForGroupModel(g, modelRequest.Model, preferred.Id) {
										selectGroup = g
										common.SetContextKey(c, constant.ContextKeyAutoGroup, g)
										channel = preferred
										affinityUsable = true
										service.MarkChannelAffinityUsed(c, g, preferred.Id)
										break
									}
								}
							} else if model.IsChannelEnabledForGroupModel(usingGroup, modelRequest.Model, preferred.Id) {
								channel = preferred
								selectGroup = usingGroup
								affinityUsable = true
								service.MarkChannelAffinityUsed(c, usingGroup, preferred.Id)
							}
						}
						if !affinityUsable && !service.ShouldKeepChannelAffinityOnChannelDisabled() {
							service.ClearCurrentChannelAffinityCache(c)
						}
					}

					if channel == nil {
						channel, selectGroup, err = service.CacheGetRandomSatisfiedChannel(&service.RetryParam{
							Ctx:         c,
							ModelName:   modelRequest.Model,
							TokenGroup:  usingGroup,
							RequestPath: c.Request.URL.Path,
							Retry:       common.GetPointer(0),
						})
						if err != nil {
							showGroup := usingGroup
							if usingGroup == "auto" {
								showGroup = fmt.Sprintf("auto(%s)", selectGroup)
							}
							message := i18n.T(c, i18n.MsgDistributorGetChannelFailed, map[string]any{"Group": showGroup, "Model": modelRequest.Model, "Error": err.Error()})
							abortWithOpenAiMessage(c, http.StatusServiceUnavailable, message, types.ErrorCodeModelNotFound)
							return
						}
						if channel == nil {
							abortWithOpenAiMessage(c, http.StatusServiceUnavailable, i18n.T(c, i18n.MsgDistributorNoAvailableChannel, map[string]any{"Group": usingGroup, "Model": modelRequest.Model}), types.ErrorCodeModelNotFound)
							return
						}
					}
				}
			}
		}

		if channel != nil {
			if ok, kind := model.ChannelSatisfiesFilters(channel, modelRequest.Model, constraints.Filters); !ok {
				if kind == taskdto.FilterTaskPluginIdentity {
					logTaskPluginChannelDecision(c, channel, modelRequest.Model, "channel_rejected", "identity_mismatch")
				}
				abortWithOpenAiMessage(c, http.StatusServiceUnavailable, i18n.T(c, i18n.MsgDistributorNoAvailableChannel, map[string]any{"Group": common.GetContextKeyString(c, constant.ContextKeyUsingGroup), "Model": modelRequest.Model}), types.ErrorCodeModelNotFound)
				return
			}
		}
		common.SetContextKey(c, constant.ContextKeyRequestStartTime, time.Now())
		SetupContextForSelectedChannel(c, channel, modelRequest.Model)
		if !pinFound && channel != nil && !service.SchedulerEnforcedForRequest(c) && !common.GetContextKeyBool(c, constant.ContextKeySchedulerAttemptReported) {
			if err := service.RunSchedulerShadow(c, modelRequest.Model, common.GetContextKeyString(c, constant.ContextKeyUsingGroup)); err != nil {
				common.SysLog(fmt.Sprintf("scheduler shadow skipped: %v", err))
			}
		}
		c.Next()
		if service.SchedulerEmergencyNativeActive(c) {
			common.SysLog(fmt.Sprintf("scheduler degraded native selected: request_id=%s model=%s group=%s channel_id=%d status=%d", c.GetString(common.RequestIdKey), modelRequest.Model, common.GetContextKeyString(c, constant.ContextKeyUsingGroup), common.GetContextKeyInt(c, constant.ContextKeyChannelId), c.Writer.Status()))
		}
		if !pinFound && channel != nil && !common.GetContextKeyBool(c, constant.ContextKeySchedulerAttemptReported) {
			if err := service.ReportSchedulerShadowAttempt(c); err != nil {
				common.SysLog(fmt.Sprintf("scheduler shadow attempt report skipped: %v", err))
			}
		}
		if channel != nil && c.Writer != nil && c.Writer.Status() < http.StatusBadRequest {
			service.RecordChannelAffinity(c, channel.Id)
		}
	}
}

func channelSupportsRequestPath(channel *model.Channel, requestPath string, requestModel string) bool {
	if channel == nil {
		return false
	}
	if channel.Type != constant.ChannelTypeAdvancedCustom {
		return true
	}
	config := channel.GetOtherSettings().AdvancedCustom
	return config != nil && config.SupportsPathForModel(requestPath, requestModel)
}

func channelMatchesExpectedTaskPlugin(c *gin.Context, channel *model.Channel, expected string) bool {
	if channel == nil {
		return false
	}
	if c != nil {
		if _, matched := pinnedEndpointCandidateForChannel(c, channel, expected); matched {
			return true
		}
	}
	if channel.Type == constant.ChannelTypeTaskPlugin {
		return expected != "" && channel.GetSetting().TaskPluginKey == expected
	}
	if expected == "" {
		return true
	}

	if c == nil {
		return false
	}
	value, exists := c.Get(jsplugin.ContextKeyPinnedPlugin)
	pinned, ok := value.(jsplugin.PinnedPlugin)
	if !exists || !ok || pinned.Generation == nil || pinned.Plugin == nil || pinned.Plugin.Meta.Key != expected {
		return false
	}
	plugin, ok := pinned.Generation.GetByChannelType(channel.Type)
	return ok && plugin == pinned.Plugin
}

func pinnedEndpointCandidateForChannel(c *gin.Context, channel *model.Channel, expected string) (jsplugin.ProtocolBinding, bool) {
	if c == nil || channel == nil || expected == "" {
		return jsplugin.ProtocolBinding{}, false
	}
	value, exists := c.Get(jsplugin.ContextKeyPinnedEndpoint)
	pinned, ok := value.(jsplugin.PinnedEndpoint)
	if !exists || !ok || pinned.Generation == nil || pinned.Plugin == nil {
		return jsplugin.ProtocolBinding{}, false
	}
	candidates := pinned.Candidates
	if len(candidates) == 0 {
		candidates = []jsplugin.ProtocolBinding{{Plugin: pinned.Plugin, Protocol: pinned.Protocol, Operation: pinned.Operation, Model: pinned.Model}}
	}
	expectedOwned := false
	selected := jsplugin.ProtocolBinding{}
	for _, candidate := range candidates {
		if candidate.Plugin == nil {
			continue
		}
		if candidate.Plugin.Meta.Key == expected {
			expectedOwned = true
		}
		if channel.Type == constant.ChannelTypeTaskPlugin {
			if channel.GetSetting().TaskPluginKey == candidate.Plugin.Meta.Key {
				selected = candidate
			}
			continue
		}
		plugin, indexed := pinned.Generation.GetByChannelType(channel.Type)
		if indexed && plugin == candidate.Plugin {
			selected = candidate
		}
	}
	return selected, expectedOwned && selected.Plugin != nil
}

// setSchedulerAllowedChannelIDs projects new-api's effective group/model
// permissions into the Scheduler request. Scheduler ranks endpoints, but it
// must never rank a channel outside the native permission scope.
func setSchedulerAllowedChannelIDs(c *gin.Context, modelName, usingGroup, requestPath string) {
	groups := []string{usingGroup}
	if usingGroup == "auto" {
		groups = service.GetRequestAutoGroups(c, common.GetContextKeyString(c, constant.ContextKeyUserGroup))
	}
	allowed := make(map[int]struct{})
	for _, group := range groups {
		for _, channelID := range model.GetEnabledChannelIDsForGroupModel(group, modelName) {
			channel, err := model.CacheGetChannel(channelID)
			if err != nil || channel == nil || channel.Status != common.ChannelStatusEnabled ||
				!channelSupportsRequestPath(channel, requestPath, modelName) {
				continue
			}
			allowed[channelID] = struct{}{}
		}
	}
	ids := make([]int, 0, len(allowed))
	for channelID := range allowed {
		ids = append(ids, channelID)
	}
	slices.Sort(ids)
	common.SetContextKey(c, constant.ContextKeySchedulerAllowedChannelIDs, ids)
}

// getModelFromRequest 从请求中读取模型信息
// 根据 Content-Type 自动处理：
// - application/json
// - application/x-www-form-urlencoded
// - multipart/form-data
func getModelFromRequest(c *gin.Context) (*ModelRequest, error) {
	if cached, exists := c.Get(contextKeyTaskPluginEndpointModel); exists {
		if modelRequest, ok := cached.(ModelRequest); ok {
			cachedRequest := modelRequest
			return &cachedRequest, nil
		}
	}
	if strings.HasPrefix(c.Request.Header.Get("Content-Type"), "application/json") {
		modelRequest, err := getModelFromJSONBody(c)
		if err != nil {
			return nil, errors.New(i18n.T(c, i18n.MsgDistributorInvalidRequest, map[string]any{"Error": err.Error()}))
		}
		return modelRequest, nil
	}

	var modelRequest ModelRequest
	err := common.UnmarshalBodyReusable(c, &modelRequest)
	if err != nil {
		return nil, errors.New(i18n.T(c, i18n.MsgDistributorInvalidRequest, map[string]any{"Error": err.Error()}))
	}
	return &modelRequest, nil
}

func getModelFromJSONBody(c *gin.Context) (*ModelRequest, error) {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return nil, err
	}
	requestBody, err := storage.Bytes()
	if err != nil {
		return nil, err
	}
	if !gjson.ValidBytes(requestBody) {
		return nil, errors.New("invalid JSON request body")
	}
	if countTopLevelJSONKey(requestBody, "model") > 1 {
		return nil, errors.New("model must be provided once")
	}

	values := gjson.GetManyBytes(requestBody, "model", "group", "workload")
	model, err := getJSONStringValue(values[0], "model")
	if err != nil {
		return nil, err
	}
	group, err := getJSONStringValue(values[1], "group")
	if err != nil {
		return nil, err
	}
	workload, err := getJSONStringValue(values[2], "workload")
	if err != nil {
		return nil, err
	}

	if _, seekErr := storage.Seek(0, io.SeekStart); seekErr != nil {
		return nil, seekErr
	}
	c.Request.Body = io.NopCloser(storage)

	return &ModelRequest{
		Model:    model,
		Group:    group,
		Workload: workload,
	}, nil
}

func countTopLevelJSONKey(data []byte, target string) int {
	depth := 0
	inString := false
	escaped := false
	stringStart := 0
	expectingKey := false
	count := 0
	for index, current := range data {
		if inString {
			if escaped {
				escaped = false
				continue
			}
			if current == '\\' {
				escaped = true
				continue
			}
			if current != '"' {
				continue
			}
			inString = false
			if depth == 1 && expectingKey {
				key := string(data[stringStart:index])
				var decodedKey string
				if common.Unmarshal(data[stringStart-1:index+1], &decodedKey) == nil {
					key = decodedKey
				}
				cursor := index + 1
				for cursor < len(data) && (data[cursor] == ' ' || data[cursor] == '\t' || data[cursor] == '\r' || data[cursor] == '\n') {
					cursor++
				}
				if cursor < len(data) && data[cursor] == ':' && key == target {
					count++
				}
				expectingKey = false
			}
			continue
		}
		switch current {
		case '"':
			inString = true
			stringStart = index + 1
		case '{':
			depth++
			if depth == 1 {
				expectingKey = true
			}
		case '}':
			depth--
		case ',':
			if depth == 1 {
				expectingKey = true
			}
		}
	}
	return count
}

func getJSONStringValue(result gjson.Result, field string) (string, error) {
	if !result.Exists() || result.Type == gjson.Null {
		return "", nil
	}
	if result.Type != gjson.String {
		return "", fmt.Errorf("field %s must be a string", field)
	}
	return result.String(), nil
}

func getModelRequest(c *gin.Context) (*ModelRequest, bool, error) {
	var modelRequest ModelRequest
	shouldSelectChannel := true
	var err error
	if modelName := c.GetString("resolved_task_model"); modelName != "" {
		modelRequest.Model = modelName
	} else if strings.Contains(c.Request.URL.Path, "/mj/") {
		relayMode := relayconstant.Path2RelayModeMidjourney(c.Request.URL.Path)
		if relayMode == relayconstant.RelayModeMidjourneyTaskFetch ||
			relayMode == relayconstant.RelayModeMidjourneyTaskFetchByCondition ||
			relayMode == relayconstant.RelayModeMidjourneyNotify ||
			relayMode == relayconstant.RelayModeMidjourneyTaskImageSeed {
			shouldSelectChannel = false
		} else {
			midjourneyRequest := taskdto.MidjourneyRequest{}
			err = common.UnmarshalBodyReusable(c, &midjourneyRequest)
			if err != nil {
				return nil, false, errors.New(i18n.T(c, i18n.MsgDistributorInvalidMidjourney, map[string]any{"Error": err.Error()}))
			}
			midjourneyModel, mjErr, success := service.GetMjRequestModel(relayMode, &midjourneyRequest)
			if mjErr != nil {
				return nil, false, fmt.Errorf("%s", mjErr.Description)
			}
			if midjourneyModel == "" {
				if !success {
					return nil, false, fmt.Errorf("%s", i18n.T(c, i18n.MsgDistributorInvalidParseModel))
				} else {
					// task fetch, task fetch by condition, notify
					shouldSelectChannel = false
				}
			}
			modelRequest.Model = midjourneyModel
		}
		c.Set("relay_mode", relayMode)
	} else if strings.Contains(c.Request.URL.Path, "/v1/videos/") && strings.HasSuffix(c.Request.URL.Path, "/remix") {
		relayMode := relayconstant.RelayModeVideoSubmit
		c.Set("relay_mode", relayMode)
		shouldSelectChannel = false
	} else if strings.Contains(c.Request.URL.Path, "/v1/videos") {
		//curl https://api.openai.com/v1/videos \
		//  -H "Authorization: Bearer $OPENAI_API_KEY" \
		//  -F "model=sora-2" \
		//  -F "prompt=A calico cat playing a piano on stage"
		//	-F input_reference="@image.jpg"
		relayMode := relayconstant.RelayModeUnknown
		if c.Request.Method == http.MethodPost {
			relayMode = relayconstant.RelayModeVideoSubmit
			req, err := getModelFromRequest(c)
			if err != nil {
				return nil, false, err
			}
			if req != nil {
				modelRequest.Model = req.Model
			}
		} else if c.Request.Method == http.MethodGet {
			relayMode = relayconstant.RelayModeVideoFetchByID
			shouldSelectChannel = false
			modelRequest.Model = getTaskOriginModelName(c)
		}
		c.Set("relay_mode", relayMode)
	} else if strings.Contains(c.Request.URL.Path, "/v1/video/generations") {
		relayMode := relayconstant.RelayModeUnknown
		if c.Request.Method == http.MethodPost {
			req, err := getModelFromRequest(c)
			if err != nil {
				return nil, false, err
			}
			modelRequest.Model = req.Model
			relayMode = relayconstant.RelayModeVideoSubmit
		} else if c.Request.Method == http.MethodGet {
			relayMode = relayconstant.RelayModeVideoFetchByID
			shouldSelectChannel = false
			modelRequest.Model = getTaskOriginModelName(c)
		}
		if _, ok := c.Get("relay_mode"); !ok {
			c.Set("relay_mode", relayMode)
		}
	} else if strings.HasPrefix(c.Request.URL.Path, "/v1beta/models/") || strings.HasPrefix(c.Request.URL.Path, "/v1/models/") {
		// Gemini API 路径处理: /v1beta/models/gemini-2.0-flash:generateContent
		relayMode := relayconstant.RelayModeGemini
		modelName := extractModelNameFromGeminiPath(c.Request.URL.Path)
		if modelName != "" {
			modelRequest.Model = modelName
		}
		c.Set("relay_mode", relayMode)
	} else if !strings.HasPrefix(c.Request.URL.Path, "/v1/audio/transcriptions") && !strings.Contains(c.Request.Header.Get("Content-Type"), "multipart/form-data") {
		req, err := getModelFromRequest(c)
		if err != nil {
			return nil, false, err
		}
		modelRequest.Model = req.Model
	}
	if strings.HasPrefix(c.Request.URL.Path, "/v1/realtime") {
		//wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01
		modelRequest.Model = c.Query("model")
	}
	if strings.HasPrefix(c.Request.URL.Path, "/v1/moderations") {
		if modelRequest.Model == "" {
			modelRequest.Model = "text-moderation-stable"
		}
	}
	if strings.HasSuffix(c.Request.URL.Path, "embeddings") {
		if modelRequest.Model == "" {
			modelRequest.Model = c.Param("model")
		}
	}
	if strings.HasPrefix(c.Request.URL.Path, "/v1/images/generations") {
		modelRequest.Model = common.GetStringIfEmpty(modelRequest.Model, "dall-e")
	} else if strings.HasPrefix(c.Request.URL.Path, "/v1/images/edits") {
		//modelRequest.Model = common.GetStringIfEmpty(c.PostForm("model"), "gpt-image-1")
		contentType := c.ContentType()
		if slices.Contains([]string{gin.MIMEPOSTForm, gin.MIMEMultipartPOSTForm}, contentType) {
			req, err := getModelFromRequest(c)
			if err == nil && req.Model != "" {
				modelRequest.Model = req.Model
			}
		}
	}
	if strings.HasPrefix(c.Request.URL.Path, "/v1/audio") {
		relayMode := relayconstant.RelayModeAudioSpeech
		if strings.HasPrefix(c.Request.URL.Path, "/v1/audio/speech") {

			modelRequest.Model = common.GetStringIfEmpty(modelRequest.Model, "tts-1")
		} else if strings.HasPrefix(c.Request.URL.Path, "/v1/audio/translations") {
			// 先尝试从请求读取
			if req, err := getModelFromRequest(c); err == nil && req.Model != "" {
				modelRequest.Model = req.Model
			}
			modelRequest.Model = common.GetStringIfEmpty(modelRequest.Model, "whisper-1")
			relayMode = relayconstant.RelayModeAudioTranslation
		} else if strings.HasPrefix(c.Request.URL.Path, "/v1/audio/transcriptions") {
			// 先尝试从请求读取
			if req, err := getModelFromRequest(c); err == nil && req.Model != "" {
				modelRequest.Model = req.Model
			}
			modelRequest.Model = common.GetStringIfEmpty(modelRequest.Model, "whisper-1")
			relayMode = relayconstant.RelayModeAudioTranscription
		}
		c.Set("relay_mode", relayMode)
	}
	if strings.HasPrefix(c.Request.URL.Path, "/pg/chat/completions") {
		// playground chat completions
		req, err := getModelFromRequest(c)
		if err != nil {
			return nil, false, err
		}
		modelRequest.Model = req.Model
		modelRequest.Group = req.Group
		common.SetContextKey(c, constant.ContextKeyTokenGroup, modelRequest.Group)
	}

	return &modelRequest, shouldSelectChannel, nil
}

// 修复 #4834: GET /v1/video/generations/:task_id && /v1/video/:task_id 此前不解析 model，
// 当 token 启用「可用模型限制」时，下游 modelLimitEnable 校验会因
// modelRequest.Model 为空而误报 "This token has no access to model"。
// 从已存储的任务记录中回填 OriginModelName 即可让校验走在正确的模型上。
func getTaskOriginModelName(c *gin.Context) string {
	if !common.GetContextKeyBool(c, constant.ContextKeyTokenModelLimitEnabled) {
		return ""
	}

	taskId := c.Param("task_id")
	if taskId == "" {
		return ""
	}

	userId := c.GetInt("id")
	if task, exist, err := model.GetByTaskId(userId, taskId); err == nil && exist && task != nil {
		return task.Properties.OriginModelName
	}
	return ""
}

func SetupContextForSelectedChannel(c *gin.Context, channel *model.Channel, modelName string) *types.NewAPIError {
	c.Set("original_model", modelName) // for retry
	expectedPlugin := c.GetString("expected_task_plugin_key")
	if channel == nil {
		logTaskPluginChannelDecision(c, nil, modelName, "channel_rejected", "nil_channel")
		return types.NewError(errors.New("channel is nil"), types.ErrorCodeGetChannelFailed, types.ErrOptionWithSkipRetry())
	}
	if expectedPlugin != "" && !channelMatchesExpectedTaskPlugin(c, channel, expectedPlugin) {
		logTaskPluginChannelDecision(c, channel, modelName, "channel_rejected", "identity_mismatch")
		return types.NewError(
			errors.New("selected channel does not match the pinned task plugin"),
			types.ErrorCodeGetChannelFailed,
			types.ErrOptionWithSkipRetry(),
		)
	}
	if candidate, matched := pinnedEndpointCandidateForChannel(c, channel, expectedPlugin); matched {
		if value, exists := c.Get(jsplugin.ContextKeyPinnedEndpoint); exists {
			if pinned, ok := value.(jsplugin.PinnedEndpoint); ok && candidate.Plugin != nil && candidate.Plugin != pinned.Plugin {
				previousPlugin := pinned.Plugin.Meta.Key
				pinned.Plugin = candidate.Plugin
				pinned.Protocol = candidate.Protocol
				pinned.Operation = candidate.Operation
				c.Set(jsplugin.ContextKeyPinnedEndpoint, pinned)
				c.Set(jsplugin.ContextKeyPinnedPlugin, jsplugin.PinnedPlugin{Generation: pinned.Generation, Plugin: candidate.Plugin})
				c.Set("expected_task_plugin_key", candidate.Plugin.Meta.Key)
				c.Set("task_plugin_key", candidate.Plugin.Meta.Key)
				c.Set("platform", candidate.Plugin.Meta.Key)
				logger.LogDebug(
					c,
					"task_plugin subsystem=endpoint event=provider_selected generation=%d previous_plugin=%q plugin=%q model=%q channel_id=%d channel_type=%d",
					pinned.Generation.Number,
					previousPlugin,
					candidate.Plugin.Meta.Key,
					modelName,
					channel.Id,
					channel.Type,
				)
			}
		}
	}
	common.SetContextKey(c, constant.ContextKeyChannelId, channel.Id)
	common.SetContextKey(c, constant.ContextKeyChannelName, channel.Name)
	common.SetContextKey(c, constant.ContextKeyChannelType, channel.Type)
	common.SetContextKey(c, constant.ContextKeyChannelCreateTime, channel.CreatedTime)
	common.SetContextKey(c, constant.ContextKeyChannelSetting, channel.GetSetting())
	common.SetContextKey(c, constant.ContextKeyChannelOtherSetting, channel.GetOtherSettings())
	if channel.Type == constant.ChannelTypeTaskPlugin {
		c.Set("task_plugin_key", channel.GetSetting().TaskPluginKey)
	}
	logTaskPluginChannelDecision(c, channel, modelName, "channel_selected", "")
	paramOverride := channel.GetParamOverride()
	headerOverride := channel.GetHeaderOverride()
	if mergedParam, applied := service.ApplyChannelAffinityOverrideTemplate(c, paramOverride); applied {
		paramOverride = mergedParam
	}
	common.SetContextKey(c, constant.ContextKeyChannelParamOverride, paramOverride)
	common.SetContextKey(c, constant.ContextKeyChannelHeaderOverride, headerOverride)
	if nil != channel.OpenAIOrganization && *channel.OpenAIOrganization != "" {
		common.SetContextKey(c, constant.ContextKeyChannelOrganization, *channel.OpenAIOrganization)
	}
	common.SetContextKey(c, constant.ContextKeyChannelAutoBan, channel.GetAutoBan())
	common.SetContextKey(c, constant.ContextKeyChannelModelMapping, channel.GetModelMapping())
	common.SetContextKey(c, constant.ContextKeyChannelStatusCodeMapping, channel.GetStatusCodeMapping())

	var key string
	var index int
	var newAPIError *types.NewAPIError
	if schedulerIndex, ok := common.GetContextKeyType[int](c, constant.ContextKeySchedulerKeyIndex); ok {
		key, index, newAPIError = channel.GetEnabledKeyAt(schedulerIndex)
		// The hint is per attempt. Consume it so a later native retry does not
		// accidentally reuse a stale Scheduler selection.
		c.Set(string(constant.ContextKeySchedulerKeyIndex), nil)
	} else {
		key, index, newAPIError = channel.GetNextEnabledKey()
	}
	if newAPIError != nil {
		return newAPIError
	}
	if channel.ChannelInfo.IsMultiKey {
		common.SetContextKey(c, constant.ContextKeyChannelIsMultiKey, true)
		common.SetContextKey(c, constant.ContextKeyChannelMultiKeyIndex, index)
	} else {
		// 必须设置为 false，否则在重试到单个 key 的时候会导致日志显示错误
		common.SetContextKey(c, constant.ContextKeyChannelIsMultiKey, false)
	}
	// c.Request.Header.Set("Authorization", fmt.Sprintf("Bearer %s", key))
	common.SetContextKey(c, constant.ContextKeyChannelKey, key)
	common.SetContextKey(c, constant.ContextKeyChannelBaseUrl, channel.GetBaseURL())

	common.SetContextKey(c, constant.ContextKeySystemPromptOverride, false)

	// TODO: api_version统一
	switch channel.Type {
	case constant.ChannelTypeAzure:
		c.Set("api_version", channel.Other)
	case constant.ChannelTypeVertexAi:
		c.Set("region", channel.Other)
	case constant.ChannelTypeXunfei:
		c.Set("api_version", channel.Other)
	case constant.ChannelTypeGemini:
		c.Set("api_version", channel.Other)
	case constant.ChannelTypeAli:
		c.Set("plugin", channel.Other)
	case constant.ChannelCloudflare:
		c.Set("api_version", channel.Other)
	case constant.ChannelTypeMokaAI:
		c.Set("api_version", channel.Other)
	case constant.ChannelTypeCoze:
		c.Set("bot_id", channel.Other)
	}
	return nil
}

// extractModelNameFromGeminiPath 从 Gemini API URL 路径中提取模型名
// 输入格式: /v1beta/models/gemini-2.0-flash:generateContent
// 输出: gemini-2.0-flash
func extractModelNameFromGeminiPath(path string) string {
	// 查找 "/models/" 的位置
	modelsPrefix := "/models/"
	modelsIndex := strings.Index(path, modelsPrefix)
	if modelsIndex == -1 {
		return ""
	}

	// 从 "/models/" 之后开始提取
	startIndex := modelsIndex + len(modelsPrefix)
	if startIndex >= len(path) {
		return ""
	}

	// 查找 ":" 的位置，模型名在 ":" 之前
	colonIndex := strings.Index(path[startIndex:], ":")
	if colonIndex == -1 {
		// 如果没有找到 ":"，返回从 "/models/" 到路径结尾的部分
		return path[startIndex:]
	}

	// 返回模型名部分
	return path[startIndex : startIndex+colonIndex]
}
