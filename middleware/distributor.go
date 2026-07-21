package middleware

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	relayhelper "github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

type ModelRequest struct {
	Model string `json:"model"`
	Group string `json:"group,omitempty"`
}

func Distribute() func(c *gin.Context) {
	return func(c *gin.Context) {
		var channel *model.Channel
		channelId, ok := common.GetContextKey(c, constant.ContextKeyTokenSpecificChannelId)
		bodyReadStart := time.Now()
		modelRequest, shouldSelectChannel, err := getModelRequest(c)
		if err != nil {
			if common.IsClientDisconnectError(err) {
				abortWithClientDisconnect(c, err, bodyReadStart)
				return
			}
			abortWithOpenAiMessage(c, http.StatusBadRequest, i18n.T(c, i18n.MsgDistributorInvalidRequest, map[string]any{"Error": err.Error()}))
			return
		}
		imageRequirement, err := getImageSelectionRequirement(c, modelRequest.Model)
		if err != nil {
			abortWithOpenAiMessage(c, http.StatusBadRequest, i18n.T(c, i18n.MsgDistributorInvalidRequest, map[string]any{"Error": err.Error()}))
			return
		}
		if imageRequirement != nil {
			common.SetContextKey(c, constant.ContextKeyImageSelectionRequirement, *imageRequirement)
		}
		if ok {
			id, err := strconv.Atoi(channelId.(string))
			if err != nil {
				abortWithOpenAiMessage(c, http.StatusBadRequest, i18n.T(c, i18n.MsgDistributorInvalidChannelId))
				return
			}
			channel, err = model.GetChannelById(id, true)
			if err != nil {
				abortWithOpenAiMessage(c, http.StatusBadRequest, i18n.T(c, i18n.MsgDistributorInvalidChannelId))
				return
			}
			if channel.Status != common.ChannelStatusEnabled {
				abortWithOpenAiMessage(c, http.StatusForbidden, i18n.T(c, i18n.MsgDistributorChannelDisabled))
				return
			}
			if !model.ChannelSupportsImageSelection(channel, modelRequest.Model, imageRequirement) {
				abortWithOpenAiMessage(c, http.StatusBadRequest, fmt.Sprintf("channel #%d does not support the requested image variant", channel.Id))
				return
			}
		} else {
			// Select a channel for the user
			// check token model mapping
			modelLimitEnable := common.GetContextKeyBool(c, constant.ContextKeyTokenModelLimitEnabled)
			if modelLimitEnable {
				s, ok := common.GetContextKey(c, constant.ContextKeyTokenModelLimit)
				if !ok {
					// token model limit is empty, all models are not allowed
					abortWithOpenAiMessage(c, http.StatusForbidden, i18n.T(c, i18n.MsgDistributorTokenNoModelAccess))
					return
				}
				var tokenModelLimit map[string]bool
				tokenModelLimit, ok = s.(map[string]bool)
				if !ok {
					tokenModelLimit = map[string]bool{}
				}
				matchName := ratio_setting.FormatMatchingModelName(modelRequest.Model) // match gpts & thinking-*
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
				// check path is /pg/chat/completions
				if strings.HasPrefix(c.Request.URL.Path, "/pg/chat/completions") {
					playgroundRequest := &dto.PlayGroundRequest{}
					err = common.UnmarshalBodyReusable(c, playgroundRequest)
					if err != nil {
						if common.IsClientDisconnectError(err) {
							abortWithClientDisconnect(c, err, bodyReadStart)
							return
						}
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

				// Explicit image capabilities are authoritative across every eligible
				// channel. A sticky channel may be legacy-unconfigured even when another
				// candidate has a verified profile, so image requests always use the
				// capability-aware selector below.
				if preferredChannelID, found := service.GetPreferredChannelByAffinity(c, modelRequest.Model, usingGroup); found && imageRequirement == nil {
					affinityUsable := false
					preferred, err := model.CacheGetChannel(preferredChannelID)
					affinityKey := model.ChannelHealthKey{ChannelID: preferredChannelID, Model: modelRequest.Model, Path: service.ChannelHealthPath(c.Request.URL.Path)}
					hostCircuitOpen := err == nil && preferred != nil && model.IsChannelRouteHostCoolingDown(
						preferred,
						modelRequest.Model,
						c.Request.URL.Path,
						affinityKey.Path,
					)
					// Keep prompt-cache affinity as long as the sticky channel can
					// still serve the request. The session already holds this
					// channel's upstream prompt cache; leaving throws it away and the
					// next channel pays a full cold prefill — 20-40s on a ~200k-token
					// prompt, measured in prod, far worse than riding out a slow
					// channel where the cache hit still yields a ~1s first token.
					// AcquireChannelHealthForAffinity therefore yields ONLY on failure
					// (failure-open circuit), not on slowness; the previous logic
					// migrated on slowness and made a session churn #42->#41->#29->#17,
					// paying a cold prefill on every hop. (An Advanced Custom channel
					// whose routes do not cover this path is still not pinnable.)
					stickyUsable := err == nil && preferred != nil && !hostCircuitOpen && !model.IsChannelCoolingDown(preferred.Id) &&
						channelSupportsRequestPath(preferred, c.Request.URL.Path, modelRequest.Model) &&
						model.ChannelSupportsImageSelection(preferred, modelRequest.Model, imageRequirement)
					if hostCircuitOpen {
						logger.LogInfo(c, fmt.Sprintf(
							"channel_affinity_released: channel #%d shares an open upstream host circuit for model=%s path=%s",
							preferred.Id, modelRequest.Model, affinityKey.Path))
					}
					if stickyUsable && !model.AcquireChannelHealthForAffinity(affinityKey) {
						// The channel is failing, not merely slow: staying would error.
						// Leaving means the next channel is cold, so flag it — the cold
						// prefill is a cost we imposed and must not be charged to that
						// channel's health EWMA or slow-channel cooldown.
						stickyUsable = false
						common.SetContextKey(c, constant.ContextKeyAffinityColdStart, true)
						logger.LogInfo(c, fmt.Sprintf(
							"channel_affinity_released: channel #%d is failing for model=%s; leaving its warm cache for a healthy channel (cold prefill expected)",
							preferred.Id, modelRequest.Model))
					}
					if stickyUsable {
						if preferred.Status != common.ChannelStatusEnabled {
							// Affinity channel is disabled, fall back to random selection
							// Skip retry only applies if we actually used the affinity channel
						} else if usingGroup == "auto" {
							userGroup := common.GetContextKeyString(c, constant.ContextKeyUserGroup)
							autoGroups := service.GetUserAutoGroup(userGroup)
							for _, g := range autoGroups {
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
					if !affinityUsable {
						// The next selected channel cannot share this affinity's prompt
						// cache. Mark the migration so its one-time cold prefill does not
						// poison channel latency scoring or trigger another migration.
						common.SetContextKey(c, constant.ContextKeyAffinityColdStart, true)
					}
					if !affinityUsable && !service.ShouldKeepChannelAffinityOnChannelDisabled() {
						service.ClearCurrentChannelAffinityCache(c)
					}
				}

				if channel == nil {
					channel, selectGroup, err = service.CacheGetRandomSatisfiedChannel(&service.RetryParam{
						Ctx:              c,
						ModelName:        modelRequest.Model,
						TokenGroup:       usingGroup,
						RequestPath:      c.Request.URL.Path,
						ImageRequirement: imageRequirement,
						Retry:            common.GetPointer(0),
					})
					if err != nil {
						showGroup := usingGroup
						if usingGroup == "auto" {
							showGroup = fmt.Sprintf("auto(%s)", selectGroup)
						}
						message := i18n.T(c, i18n.MsgDistributorGetChannelFailed, map[string]any{"Group": showGroup, "Model": modelRequest.Model, "Error": err.Error()})
						// 如果错误，但是渠道不为空，说明是数据库一致性问题
						//if channel != nil {
						//	common.SysError(fmt.Sprintf("渠道不存在：%d", channel.Id))
						//	message = "数据库一致性已被破坏，请联系管理员"
						//}
						statusCode := http.StatusServiceUnavailable
						errorCode := types.ErrorCodeModelNotFound
						if imageRequirement != nil {
							statusCode = http.StatusBadRequest
							errorCode = types.ErrorCodeInvalidRequest
						}
						abortWithOpenAiMessage(c, statusCode, message, errorCode)
						return
					}
					if channel == nil {
						abortWithOpenAiMessage(c, http.StatusServiceUnavailable, i18n.T(c, i18n.MsgDistributorNoAvailableChannel, map[string]any{"Group": usingGroup, "Model": modelRequest.Model}), types.ErrorCodeModelNotFound)
						return
					}
				}
			}
		}
		common.SetContextKey(c, constant.ContextKeyRequestStartTime, time.Now())
		SetupContextForSelectedChannel(c, channel, modelRequest.Model)
		c.Next()
		if channel != nil && c.Writer != nil && c.Writer.Status() < http.StatusBadRequest {
			service.RecordChannelAffinity(c, channel.Id)
		}
	}
}

// StatusClientClosedRequest 是 nginx 事实标准的 499：客户端在服务端应答前就走了。
// 用它而不是 400，是为了让「客户端掉线」在日志和监控里跟真正的坏请求分开。
const StatusClientClosedRequest = 499

// maxLoggedUserAgentLen 限制写进日志的 UA 长度，避免单条日志被超长 UA 撑爆。
const maxLoggedUserAgentLen = 80

// abortWithClientDisconnect 处理「客户端在我们读完请求体之前掉线」。
//
// 这类请求从没选到渠道，因此不计费、也不会记到任何渠道的健康度上；客户端已经走了，
// 响应大概率没人接收，所以唯一有价值的产物是日志。
//
// 字段是为了回答一个具体问题挑的：为什么 body 发不完。read_bytes 对比
// content_length 是最关键的一刀 —— 0 说明客户端根本没开始发（例如卡在等
// 100-continue），读到一半是上传途中断流，接近 content_length 是尾部截断。
// 三者的 err 完全一样，只有这个数能分开。encoding 则用来识别「压缩流被截断」，
// gzip/zstd reader 在那种情况下同样报 unexpected EOF。
func abortWithClientDisconnect(c *gin.Context, err error, bodyReadStart time.Time) {
	ctxErr := "none"
	if e := c.Request.Context().Err(); e != nil {
		ctxErr = e.Error()
	}
	// 按 rune 截断：按字节切会把多字节字符腰斩，日志里变成一串 \xHH 乱码。
	ua := c.Request.UserAgent()
	if r := []rune(ua); len(r) > maxLoggedUserAgentLen {
		ua = string(r[:maxLoggedUserAgentLen])
	}
	// gzip 中间件会在解压后删掉 Content-Encoding，所以这里读它保存的原始值。
	encoding := c.Request.Header.Get("Content-Encoding")
	if orig, ok := c.Get(middlewareOriginalContentEncodingKey); ok {
		if s, _ := orig.(string); s != "" {
			encoding = s
		}
	}
	if encoding == "" {
		encoding = "identity"
	}
	// wire_bytes is the number that assigns blame; the rest is context.
	// It counts raw bytes off the socket, so it is directly comparable to
	// content_length: short means the client stopped sending, equal means it
	// sent everything and the stall is ours. plain_bytes is post-decompression
	// output and is NOT comparable to content_length when encoding != identity.
	wire := WireBytesRead(c)
	shortfall := "n/a"
	if wire >= 0 && c.Request.ContentLength > 0 {
		shortfall = fmt.Sprintf("%.1f%%", 100*float64(c.Request.ContentLength-wire)/float64(c.Request.ContentLength))
	}
	logger.LogWarn(c, fmt.Sprintf(
		"client_upload_aborted: err=%v ctx_err=%s elapsed_ms=%d wire_bytes=%d content_length=%d missing=%s plain_bytes=%d encoding=%s expect=%q proto=%s path=%s ua=%q",
		err, ctxErr, time.Since(bodyReadStart).Milliseconds(),
		wire, c.Request.ContentLength, shortfall,
		common.GetContextKeyInt64(c, constant.ContextKeyRequestBodyReadBytes),
		encoding, c.Request.Header.Get("Expect"),
		c.Request.Proto, c.Request.URL.Path, ua,
	))
	c.Status(StatusClientClosedRequest)
	c.Abort()
}

// channelSupportsRequestPath reports whether a channel can serve the request path.
// Only Advanced Custom (type 58) channels are path-checked; all other channel types
// always pass. A type-58 channel is usable only when one of its routes matches.
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

func getImageSelectionRequirement(c *gin.Context, modelName string) (*dto.ImageSelectionRequirement, error) {
	if c == nil || c.Request == nil || c.Request.Method != http.MethodPost {
		return nil, nil
	}
	relayMode := relayconstant.Path2RelayMode(c.Request.URL.Path)
	switch relayMode {
	case relayconstant.RelayModeImagesGenerations:
	case relayconstant.RelayModeImagesEdits:
	default:
		return nil, nil
	}

	request, err := relayhelper.GetAndValidOpenAIImageRequest(c, relayMode)
	if err != nil {
		return nil, err
	}
	if request.Model == "" {
		request.Model = modelName
	}
	common.SetContextKey(c, constant.ContextKeyValidatedImageRequest, request)
	operation := relayhelper.ResolveImageOperation(relayMode, modelName, request)
	requirement, err := dto.ResolveImageSelectionRequirement(request, modelName, operation)
	if err != nil {
		return nil, err
	}
	return &requirement, nil
}

// getModelFromRequest 从请求中读取模型信息
// 根据 Content-Type 自动处理：
// - application/json
// - application/x-www-form-urlencoded
// - multipart/form-data
func getModelFromRequest(c *gin.Context) (*ModelRequest, error) {
	// 这里返回裸 error：调用方 Distribute 会统一套上 MsgDistributorInvalidRequest，
	// 在这里再套一层会得到「无效的请求，无效的请求，xxx」。同时保留原始 error 以便
	// Distribute 能用 errors.Is 识别出客户端掉线。
	if strings.HasPrefix(c.Request.Header.Get("Content-Type"), "application/json") {
		return getModelFromJSONBody(c)
	}

	var modelRequest ModelRequest
	if err := common.UnmarshalBodyReusable(c, &modelRequest); err != nil {
		return nil, err
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

	values := gjson.GetManyBytes(requestBody, "model", "group")
	model, err := getJSONStringValue(values[0], "model")
	if err != nil {
		return nil, err
	}
	group, err := getJSONStringValue(values[1], "group")
	if err != nil {
		return nil, err
	}

	if _, seekErr := storage.Seek(0, io.SeekStart); seekErr != nil {
		return nil, seekErr
	}
	c.Request.Body = io.NopCloser(storage)

	return &ModelRequest{
		Model: model,
		Group: group,
	}, nil
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
	if strings.Contains(c.Request.URL.Path, "/mj/") {
		relayMode := relayconstant.Path2RelayModeMidjourney(c.Request.URL.Path)
		if relayMode == relayconstant.RelayModeMidjourneyTaskFetch ||
			relayMode == relayconstant.RelayModeMidjourneyTaskFetchByCondition ||
			relayMode == relayconstant.RelayModeMidjourneyNotify ||
			relayMode == relayconstant.RelayModeMidjourneyTaskImageSeed {
			shouldSelectChannel = false
		} else {
			midjourneyRequest := dto.MidjourneyRequest{}
			err = common.UnmarshalBodyReusable(c, &midjourneyRequest)
			if err != nil {
				// 客户端掉线时原样返回：errors.New(i18n.T(...)) 会把错误链拍成字符串，
				// 调用方的 errors.Is 就再也看不穿它了。
				if common.IsClientDisconnectError(err) {
					return nil, false, err
				}
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
	} else if strings.Contains(c.Request.URL.Path, "/suno/") {
		relayMode := relayconstant.Path2RelaySuno(c.Request.Method, c.Request.URL.Path)
		if relayMode == relayconstant.RelayModeSunoFetch ||
			relayMode == relayconstant.RelayModeSunoFetchByID {
			shouldSelectChannel = false
		} else {
			modelName := service.CoverTaskActionToModelName(constant.TaskPlatformSuno, c.Param("action"))
			modelRequest.Model = modelName
		}
		c.Set("platform", string(constant.TaskPlatformSuno))
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
	} else if strings.HasPrefix(c.Request.URL.Path, "/v1/images/edits") || strings.HasPrefix(c.Request.URL.Path, "/v1/edits") {
		//modelRequest.Model = common.GetStringIfEmpty(c.PostForm("model"), "gpt-image-1")
		contentType := c.ContentType()
		if slices.Contains([]string{gin.MIMEPOSTForm, gin.MIMEMultipartPOSTForm}, contentType) {
			if contentType == gin.MIMEMultipartPOSTForm {
				form, err := common.ParseMultipartFormReusable(c)
				if err != nil {
					return nil, false, err
				}
				modelRequest.Model = strings.TrimSpace(url.Values(form.Value).Get("model"))
			} else {
				req, err := getModelFromRequest(c)
				if err != nil {
					return nil, false, err
				}
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

	if strings.HasPrefix(c.Request.URL.Path, "/v1/responses/compact") && modelRequest.Model != "" {
		// Codex CLI's /v1/responses/compact endpoint sends `model: <base>` and
		// new-api conventionally rewrites it to `<base>-openai-compact` so
		// admins can route compact traffic to a different channel and bill it
		// separately. Set COMPACT_USE_BASE_MODEL=true to skip the rewrite —
		// useful when the upstream relay does not differentiate compact from
		// regular Responses calls (e.g. xtokenmirror, hostcentral), removing
		// the need to declare `*-openai-compact` in every channel's model
		// list and price table.
		if !ratio_setting.CompactUseBaseModel() {
			modelRequest.Model = ratio_setting.WithCompactModelSuffix(modelRequest.Model)
		}
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
		// jimeng adapter
		taskId = c.GetString("task_id")
	}
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
	if channel == nil {
		return types.NewError(errors.New("channel is nil"), types.ErrorCodeGetChannelFailed, types.ErrOptionWithSkipRetry())
	}
	common.SetContextKey(c, constant.ContextKeyChannelId, channel.Id)
	common.SetContextKey(c, constant.ContextKeyChannelName, channel.Name)
	common.SetContextKey(c, constant.ContextKeyChannelType, channel.Type)
	common.SetContextKey(c, constant.ContextKeyChannelCreateTime, channel.CreatedTime)
	common.SetContextKey(c, constant.ContextKeyChannelSetting, channel.GetSetting())
	common.SetContextKey(c, constant.ContextKeyChannelOtherSetting, channel.GetOtherSettings())
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

	key, index, newAPIError := channel.GetNextEnabledKey()
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
