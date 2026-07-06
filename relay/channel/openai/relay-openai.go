package openai

import (
	"context"
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
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel/openrouter"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"

	"github.com/QuantumNous/new-api/types"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

func sendStreamData(c *gin.Context, info *relaycommon.RelayInfo, data string, forceFormat bool, thinkToContent bool) error {
	if data == "" {
		return nil
	}

	if !forceFormat && !thinkToContent {
		return helper.StringData(c, data)
	}

	var lastStreamResponse dto.ChatCompletionsStreamResponse
	if err := common.UnmarshalJsonStr(data, &lastStreamResponse); err != nil {
		return err
	}

	if !thinkToContent {
		return helper.ObjectData(c, lastStreamResponse)
	}

	hasThinkingContent := false
	hasContent := false
	var thinkingContent strings.Builder
	for _, choice := range lastStreamResponse.Choices {
		if len(choice.Delta.GetReasoningContent()) > 0 {
			hasThinkingContent = true
			thinkingContent.WriteString(choice.Delta.GetReasoningContent())
		}
		if len(choice.Delta.GetContentString()) > 0 {
			hasContent = true
		}
	}

	// Handle think to content conversion
	if info.ThinkingContentInfo.IsFirstThinkingContent {
		if hasThinkingContent {
			response := lastStreamResponse.Copy()
			for i := range response.Choices {
				// send `think` tag with thinking content
				response.Choices[i].Delta.SetContentString("<think>\n" + thinkingContent.String())
				response.Choices[i].Delta.ReasoningContent = nil
				response.Choices[i].Delta.Reasoning = nil
			}
			info.ThinkingContentInfo.IsFirstThinkingContent = false
			info.ThinkingContentInfo.HasSentThinkingContent = true
			return helper.ObjectData(c, response)
		}
	}

	if lastStreamResponse.Choices == nil || len(lastStreamResponse.Choices) == 0 {
		return helper.ObjectData(c, lastStreamResponse)
	}

	// Process each choice
	for i, choice := range lastStreamResponse.Choices {
		// Handle transition from thinking to content
		// only send `</think>` tag when previous thinking content has been sent
		if hasContent && !info.ThinkingContentInfo.SendLastThinkingContent && info.ThinkingContentInfo.HasSentThinkingContent {
			response := lastStreamResponse.Copy()
			for j := range response.Choices {
				response.Choices[j].Delta.SetContentString("\n</think>\n")
				response.Choices[j].Delta.ReasoningContent = nil
				response.Choices[j].Delta.Reasoning = nil
			}
			info.ThinkingContentInfo.SendLastThinkingContent = true
			helper.ObjectData(c, response)
		}

		// Convert reasoning content to regular content if any
		if len(choice.Delta.GetReasoningContent()) > 0 {
			lastStreamResponse.Choices[i].Delta.SetContentString(choice.Delta.GetReasoningContent())
			lastStreamResponse.Choices[i].Delta.ReasoningContent = nil
			lastStreamResponse.Choices[i].Delta.Reasoning = nil
		} else if !hasThinkingContent && !hasContent {
			// flush thinking content
			lastStreamResponse.Choices[i].Delta.ReasoningContent = nil
			lastStreamResponse.Choices[i].Delta.Reasoning = nil
		}
	}

	return helper.ObjectData(c, lastStreamResponse)
}

func OaiStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		logger.LogError(c, "invalid response or response body")
		return nil, types.NewOpenAIError(fmt.Errorf("invalid response"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}

	defer service.CloseResponseBodyGracefully(resp)

	model := info.UpstreamModelName
	var responseId string
	var createAt int64 = 0
	var systemFingerprint string
	var containStreamUsage bool
	var responseTextBuilder strings.Builder
	var toolCount int
	var usage = &dto.Usage{}
	var streamItems []string // store stream items
	var lastStreamData string
	var secondLastStreamData string // 存储倒数第二个stream data，用于音频模型

	// 检查是否为音频模型
	isAudioModel := strings.Contains(strings.ToLower(model), "audio")

	helper.StreamScannerHandler(c, resp, info, func(data string, sr *helper.StreamResult) {
		if lastStreamData != "" {
			if err := HandleStreamFormat(c, info, lastStreamData, info.ChannelSetting.ForceFormat, info.ChannelSetting.ThinkingToContent); err != nil {
				common.SysLog("error handling stream format: " + err.Error())
				sr.Error(err)
			}
		}
		if len(data) > 0 {
			// 对音频模型，保存倒数第二个stream data
			if isAudioModel && lastStreamData != "" {
				secondLastStreamData = lastStreamData
			}

			lastStreamData = data
			streamItems = append(streamItems, data)
		}
	})

	// 对音频模型，从倒数第二个stream data中提取usage信息
	if isAudioModel && secondLastStreamData != "" {
		var streamResp struct {
			Usage *dto.Usage `json:"usage"`
		}
		err := common.Unmarshal([]byte(secondLastStreamData), &streamResp)
		if err == nil && streamResp.Usage != nil && service.ValidUsage(streamResp.Usage) {
			usage = streamResp.Usage
			containStreamUsage = true

			if common.DebugEnabled {
				logger.LogDebug(c, fmt.Sprintf("Audio model usage extracted from second last SSE: PromptTokens=%d, CompletionTokens=%d, TotalTokens=%d, InputTokens=%d, OutputTokens=%d",
					usage.PromptTokens, usage.CompletionTokens, usage.TotalTokens,
					usage.InputTokens, usage.OutputTokens))
			}
		}
	}

	// 处理最后的响应
	shouldSendLastResp := true
	if err := handleLastResponse(lastStreamData, &responseId, &createAt, &systemFingerprint, &model, &usage,
		&containStreamUsage, info, &shouldSendLastResp); err != nil {
		logger.LogError(c, fmt.Sprintf("error handling last response: %s, lastStreamData: [%s]", err.Error(), lastStreamData))
	}

	if info.RelayFormat == types.RelayFormatOpenAI {
		if shouldSendLastResp {
			_ = sendStreamData(c, info, lastStreamData, info.ChannelSetting.ForceFormat, info.ChannelSetting.ThinkingToContent)
		}
	}

	// 处理token计算
	if err := processTokens(info.RelayMode, streamItems, &responseTextBuilder, &toolCount); err != nil {
		logger.LogError(c, "error processing tokens: "+err.Error())
	}

	if !containStreamUsage {
		usage = service.ResponseText2Usage(c, responseTextBuilder.String(), info.UpstreamModelName, info.GetEstimatePromptTokens())
		usage.CompletionTokens += toolCount * 7
	}

	applyUsagePostProcessing(info, usage, common.StringToByteSlice(lastStreamData))

	HandleFinalResponse(c, info, lastStreamData, responseId, createAt, model, systemFingerprint, usage, containStreamUsage)

	return usage, nil
}

func OpenaiHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)

	var simpleResponse dto.OpenAITextResponse
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}
	if common.DebugEnabled {
		println("upstream response body:", string(responseBody))
	}
	// Unmarshal to simpleResponse
	if info.ChannelType == constant.ChannelTypeOpenRouter && info.ChannelOtherSettings.IsOpenRouterEnterprise() {
		// 尝试解析为 openrouter enterprise
		var enterpriseResponse openrouter.OpenRouterEnterpriseResponse
		err = common.Unmarshal(responseBody, &enterpriseResponse)
		if err != nil {
			return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
		}
		if enterpriseResponse.Success {
			responseBody = enterpriseResponse.Data
		} else {
			logger.LogError(c, fmt.Sprintf("openrouter enterprise response success=false, data: %s", enterpriseResponse.Data))
			return nil, types.NewOpenAIError(fmt.Errorf("openrouter response success=false"), types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
		}
	}

	err = common.Unmarshal(responseBody, &simpleResponse)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	if oaiError := simpleResponse.GetOpenAIError(); oaiError != nil && oaiError.Type != "" {
		return nil, types.WithOpenAIError(*oaiError, resp.StatusCode)
	}

	for _, choice := range simpleResponse.Choices {
		if choice.FinishReason == constant.FinishReasonContentFilter {
			common.SetContextKey(c, constant.ContextKeyAdminRejectReason, "openai_finish_reason=content_filter")
			break
		}
	}

	forceFormat := false
	if info.ChannelSetting.ForceFormat {
		forceFormat = true
	}

	usageModified := false
	if simpleResponse.Usage.PromptTokens == 0 {
		completionTokens := simpleResponse.Usage.CompletionTokens
		if completionTokens == 0 {
			for _, choice := range simpleResponse.Choices {
				ctkm := service.CountTextToken(choice.Message.StringContent()+choice.Message.GetReasoningContent(), info.UpstreamModelName)
				completionTokens += ctkm
			}
		}
		simpleResponse.Usage = dto.Usage{
			PromptTokens:     info.GetEstimatePromptTokens(),
			CompletionTokens: completionTokens,
			TotalTokens:      info.GetEstimatePromptTokens() + completionTokens,
		}
		usageModified = true
	}

	applyUsagePostProcessing(info, &simpleResponse.Usage, responseBody)

	switch info.RelayFormat {
	case types.RelayFormatOpenAI:
		if usageModified {
			var bodyMap map[string]interface{}
			err = common.Unmarshal(responseBody, &bodyMap)
			if err != nil {
				return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
			}
			bodyMap["usage"] = simpleResponse.Usage
			responseBody, _ = common.Marshal(bodyMap)
		}
		if forceFormat {
			responseBody, err = common.Marshal(simpleResponse)
			if err != nil {
				return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
			}
		} else {
			break
		}
	case types.RelayFormatClaude:
		claudeResp := service.ResponseOpenAI2Claude(&simpleResponse, info)
		claudeRespStr, err := common.Marshal(claudeResp)
		if err != nil {
			return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
		}
		responseBody = claudeRespStr
	case types.RelayFormatGemini:
		geminiResp := service.ResponseOpenAI2Gemini(&simpleResponse, info)
		geminiRespStr, err := common.Marshal(geminiResp)
		if err != nil {
			return nil, types.NewError(err, types.ErrorCodeBadResponseBody)
		}
		responseBody = geminiRespStr
	}

	service.IOCopyBytesGracefully(c, resp, responseBody)

	return &simpleResponse.Usage, nil
}

func streamTTSResponse(c *gin.Context, resp *http.Response) {
	c.Writer.WriteHeaderNow()

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		logger.LogWarn(c, "streaming not supported")
		_, err := io.Copy(c.Writer, resp.Body)
		if err != nil {
			logger.LogWarn(c, err.Error())
		}
		return
	}

	buffer := make([]byte, 4096)
	for {
		n, err := resp.Body.Read(buffer)
		//logger.LogInfo(c, fmt.Sprintf("streamTTSResponse read %d bytes", n))
		if n > 0 {
			if _, writeErr := c.Writer.Write(buffer[:n]); writeErr != nil {
				logger.LogError(c, writeErr.Error())
				break
			}
			flusher.Flush()
		}
		if err != nil {
			if err != io.EOF {
				logger.LogError(c, err.Error())
			}
			break
		}
	}
}

func OpenaiRealtimeHandler(c *gin.Context, info *relaycommon.RelayInfo) (*types.NewAPIError, *dto.RealtimeUsage) {
	if info == nil || info.ClientWs == nil || info.TargetWs == nil {
		return types.NewError(fmt.Errorf("invalid websocket connection"), types.ErrorCodeBadResponse), nil
	}

	info.IsStream = true
	clientConn := info.ClientWs
	targetConn := info.TargetWs

	clientClosed := make(chan struct{})
	targetClosed := make(chan struct{})
	sendChan := make(chan []byte, 100)
	receiveChan := make(chan []byte, 100)
	errChan := make(chan error, 2)

	usage := &dto.RealtimeUsage{}
	localUsage := &dto.RealtimeUsage{}
	sumUsage := &dto.RealtimeUsage{}

	gopool.Go(func() {
		defer func() {
			if r := recover(); r != nil {
				errChan <- fmt.Errorf("panic in client reader: %v", r)
			}
		}()
		for {
			select {
			case <-c.Done():
				return
			default:
				_, message, err := clientConn.ReadMessage()
				if err != nil {
					if !websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
						errChan <- fmt.Errorf("error reading from client: %v", err)
					}
					close(clientClosed)
					return
				}

				realtimeEvent := &dto.RealtimeEvent{}
				err = common.Unmarshal(message, realtimeEvent)
				if err != nil {
					errChan <- fmt.Errorf("error unmarshalling message: %v", err)
					return
				}

				if realtimeEvent.Type == dto.RealtimeEventTypeSessionUpdate {
					if realtimeEvent.Session != nil {
						if realtimeEvent.Session.Tools != nil {
							info.RealtimeTools = realtimeEvent.Session.Tools
						}
					}
				}

				textToken, audioToken, err := service.CountTokenRealtime(info, *realtimeEvent, info.UpstreamModelName)
				if err != nil {
					errChan <- fmt.Errorf("error counting text token: %v", err)
					return
				}
				logger.LogInfo(c, fmt.Sprintf("type: %s, textToken: %d, audioToken: %d", realtimeEvent.Type, textToken, audioToken))
				localUsage.TotalTokens += textToken + audioToken
				localUsage.InputTokens += textToken + audioToken
				localUsage.InputTokenDetails.TextTokens += textToken
				localUsage.InputTokenDetails.AudioTokens += audioToken

				err = helper.WssString(c, targetConn, string(message))
				if err != nil {
					errChan <- fmt.Errorf("error writing to target: %v", err)
					return
				}

				select {
				case sendChan <- message:
				default:
				}
			}
		}
	})

	gopool.Go(func() {
		defer func() {
			if r := recover(); r != nil {
				errChan <- fmt.Errorf("panic in target reader: %v", r)
			}
		}()
		for {
			select {
			case <-c.Done():
				return
			default:
				_, message, err := targetConn.ReadMessage()
				if err != nil {
					if !websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
						errChan <- fmt.Errorf("error reading from target: %v", err)
					}
					close(targetClosed)
					return
				}
				info.SetFirstResponseTime()
				realtimeEvent := &dto.RealtimeEvent{}
				err = common.Unmarshal(message, realtimeEvent)
				if err != nil {
					errChan <- fmt.Errorf("error unmarshalling message: %v", err)
					return
				}

				if realtimeEvent.Type == dto.RealtimeEventTypeResponseDone {
					realtimeUsage := realtimeEvent.Response.Usage
					if realtimeUsage != nil {
						usage.TotalTokens += realtimeUsage.TotalTokens
						usage.InputTokens += realtimeUsage.InputTokens
						usage.OutputTokens += realtimeUsage.OutputTokens
						usage.InputTokenDetails.AudioTokens += realtimeUsage.InputTokenDetails.AudioTokens
						usage.InputTokenDetails.CachedTokens += realtimeUsage.InputTokenDetails.CachedTokens
						usage.InputTokenDetails.TextTokens += realtimeUsage.InputTokenDetails.TextTokens
						usage.OutputTokenDetails.AudioTokens += realtimeUsage.OutputTokenDetails.AudioTokens
						usage.OutputTokenDetails.TextTokens += realtimeUsage.OutputTokenDetails.TextTokens
						err := preConsumeUsage(c, info, usage, sumUsage)
						if err != nil {
							errChan <- fmt.Errorf("error consume usage: %v", err)
							return
						}
						// 本次计费完成，清除
						usage = &dto.RealtimeUsage{}

						localUsage = &dto.RealtimeUsage{}
					} else {
						textToken, audioToken, err := service.CountTokenRealtime(info, *realtimeEvent, info.UpstreamModelName)
						if err != nil {
							errChan <- fmt.Errorf("error counting text token: %v", err)
							return
						}
						logger.LogInfo(c, fmt.Sprintf("type: %s, textToken: %d, audioToken: %d", realtimeEvent.Type, textToken, audioToken))
						localUsage.TotalTokens += textToken + audioToken
						info.IsFirstRequest = false
						localUsage.InputTokens += textToken + audioToken
						localUsage.InputTokenDetails.TextTokens += textToken
						localUsage.InputTokenDetails.AudioTokens += audioToken
						err = preConsumeUsage(c, info, localUsage, sumUsage)
						if err != nil {
							errChan <- fmt.Errorf("error consume usage: %v", err)
							return
						}
						// 本次计费完成，清除
						localUsage = &dto.RealtimeUsage{}
						// print now usage
					}
					logger.LogInfo(c, fmt.Sprintf("realtime streaming sumUsage: %v", sumUsage))
					logger.LogInfo(c, fmt.Sprintf("realtime streaming localUsage: %v", localUsage))
					logger.LogInfo(c, fmt.Sprintf("realtime streaming localUsage: %v", localUsage))

				} else if realtimeEvent.Type == dto.RealtimeEventTypeSessionUpdated || realtimeEvent.Type == dto.RealtimeEventTypeSessionCreated {
					realtimeSession := realtimeEvent.Session
					if realtimeSession != nil {
						// update audio format
						info.InputAudioFormat = common.GetStringIfEmpty(realtimeSession.InputAudioFormat, info.InputAudioFormat)
						info.OutputAudioFormat = common.GetStringIfEmpty(realtimeSession.OutputAudioFormat, info.OutputAudioFormat)
					}
				} else {
					textToken, audioToken, err := service.CountTokenRealtime(info, *realtimeEvent, info.UpstreamModelName)
					if err != nil {
						errChan <- fmt.Errorf("error counting text token: %v", err)
						return
					}
					logger.LogInfo(c, fmt.Sprintf("type: %s, textToken: %d, audioToken: %d", realtimeEvent.Type, textToken, audioToken))
					localUsage.TotalTokens += textToken + audioToken
					localUsage.OutputTokens += textToken + audioToken
					localUsage.OutputTokenDetails.TextTokens += textToken
					localUsage.OutputTokenDetails.AudioTokens += audioToken
				}

				err = helper.WssString(c, clientConn, string(message))
				if err != nil {
					errChan <- fmt.Errorf("error writing to client: %v", err)
					return
				}

				select {
				case receiveChan <- message:
				default:
				}
			}
		}
	})

	select {
	case <-clientClosed:
	case <-targetClosed:
	case err := <-errChan:
		//return service.OpenAIErrorWrapper(err, "realtime_error", http.StatusInternalServerError), nil
		logger.LogError(c, "realtime error: "+err.Error())
	case <-c.Done():
	}

	if usage.TotalTokens != 0 {
		_ = preConsumeUsage(c, info, usage, sumUsage)
	}

	if localUsage.TotalTokens != 0 {
		_ = preConsumeUsage(c, info, localUsage, sumUsage)
	}

	// check usage total tokens, if 0, use local usage

	return nil, sumUsage
}

func preConsumeUsage(ctx *gin.Context, info *relaycommon.RelayInfo, usage *dto.RealtimeUsage, totalUsage *dto.RealtimeUsage) error {
	if usage == nil || totalUsage == nil {
		return fmt.Errorf("invalid usage pointer")
	}

	totalUsage.TotalTokens += usage.TotalTokens
	totalUsage.InputTokens += usage.InputTokens
	totalUsage.OutputTokens += usage.OutputTokens
	totalUsage.InputTokenDetails.CachedTokens += usage.InputTokenDetails.CachedTokens
	totalUsage.InputTokenDetails.TextTokens += usage.InputTokenDetails.TextTokens
	totalUsage.InputTokenDetails.AudioTokens += usage.InputTokenDetails.AudioTokens
	totalUsage.OutputTokenDetails.TextTokens += usage.OutputTokenDetails.TextTokens
	totalUsage.OutputTokenDetails.AudioTokens += usage.OutputTokenDetails.AudioTokens
	// clear usage
	err := service.PreWssConsumeQuota(ctx, info, usage)
	return err
}

// imagePollDeadlineContextKey stores server-side poll budget (seconds) for async image tasks.
const imagePollDeadlineContextKey = "image_poll_deadline_sec"

// imageRaceTriggerContextKey stores the gpt-image-2 race-fallback trigger threshold (seconds).
const imageRaceTriggerContextKey = "image_race_trigger_sec"

// imagePollTaskIDContextKey stores upstream task id for error logs when sync poll times out.
const imagePollTaskIDContextKey = "image_poll_task_id"

// imageRequestBodyContextKey stores the already-converted JSON request body (set by
// relay/image_handler.go) so the race fallback can resubmit it verbatim to a second channel.
const imageRequestBodyContextKey = "image_request_body_json"

const (
	imagePollMaxDeadlineSec   = 900 // align with nginx proxy_read_timeout for /v1/
	imagePollDefaultDeadline  = 180
	imagePollTier2KDeadline   = 300
	imagePollTierHighDeadline = 900 // 4k / high / hd — upstream can exceed 600s
)

// SetImagePollDeadline stores how long the relay may poll upstream before returning timeout,
// plus the (shorter) gpt-image-2 race-fallback trigger threshold for the same request.
func SetImagePollDeadline(c *gin.Context, req dto.ImageRequest) {
	c.Set(imagePollDeadlineContextKey, imagePollDeadlineSeconds(req))
	c.Set(imageRaceTriggerContextKey, imageRaceTriggerSeconds(req))
}

// imagePollTierFromSize infers poll tier from explicit pixel size (e.g. 1792x1024).
// Returns 0=default, 1=2k-class, 2=4k-class.
func imagePollTierFromSize(size string) int {
	size = strings.TrimSpace(strings.ToLower(size))
	parts := strings.Split(size, "x")
	if len(parts) != 2 {
		return 0
	}
	w, errW := strconv.Atoi(strings.TrimSpace(parts[0]))
	h, errH := strconv.Atoi(strings.TrimSpace(parts[1]))
	if errW != nil || errH != nil || w <= 0 || h <= 0 {
		return 0
	}
	longEdge := w
	if h > longEdge {
		longEdge = h
	}
	switch {
	case longEdge >= 3840:
		return 2
	case longEdge >= 1536:
		return 1
	default:
		return 0
	}
}

// imagePollTier infers the poll tier (0=default/1k, 1=2k-class, 2=4k/hd-class)
// from explicit pixel size, resolution, and quality hints on the request.
// Shared by imagePollDeadlineSeconds (give-up timeout) and imageRaceTriggerSeconds
// (gpt-image-2 race fallback timeout) so both honor the same tier classification.
func imagePollTier(req dto.ImageRequest) int {
	tier := imagePollTierFromSize(req.Size)

	resolution := strings.ToLower(strings.TrimSpace(req.Resolution))
	quality := strings.ToLower(strings.TrimSpace(req.Quality))
	if resolution == "" {
		for key, raw := range req.Extra {
			if strings.EqualFold(key, "resolution") {
				var s string
				if common.Unmarshal(raw, &s) == nil {
					resolution = strings.ToLower(s)
				}
				break
			}
		}
	}

	switch resolution {
	case "4k":
		if tier < 2 {
			tier = 2
		}
	case "2k":
		if tier < 1 {
			tier = 1
		}
	}

	switch quality {
	case "high", "hd":
		if tier < 2 {
			tier = 2
		}
	case "medium":
		if tier < 1 {
			tier = 1
		}
	}
	return tier
}

func imagePollDeadlineSeconds(req dto.ImageRequest) int {
	var sec int
	switch imagePollTier(req) {
	case 2:
		sec = imagePollTierHighDeadline
	case 1:
		sec = imagePollTier2KDeadline
	default:
		sec = imagePollDefaultDeadline
	}
	if sec > imagePollMaxDeadlineSec {
		sec = imagePollMaxDeadlineSec
	}
	return sec
}

// imageRaceTriggerSeconds returns how long pollAsyncImageTask waits on the primary
// channel before also submitting to a second gpt-image-2 channel (race fallback).
// Always smaller than imagePollDeadlineSeconds' give-up timeout for the same tier.
func imageRaceTriggerSeconds(req dto.ImageRequest) int {
	switch imagePollTier(req) {
	case 2:
		return common.GptImage2RaceTimeout4K
	case 1:
		return common.GptImage2RaceTimeout2K
	default:
		return common.GptImage2RaceTimeout1K
	}
}

func imagePollDeadlineFromContext(c *gin.Context) time.Duration {
	if v, ok := c.Get(imagePollDeadlineContextKey); ok {
		if sec, ok := v.(int); ok && sec > 0 {
			return time.Duration(sec) * time.Second
		}
	}
	return 180 * time.Second
}

func imageRaceTriggerFromContext(c *gin.Context) time.Duration {
	if v, ok := c.Get(imageRaceTriggerContextKey); ok {
		if sec, ok := v.(int); ok && sec > 0 {
			return time.Duration(sec) * time.Second
		}
	}
	return 45 * time.Second
}

// startImageRaceHedge selects a second gpt-image-2 channel (excluding the primary,
// already recorded in use_channel by the retry loop) and resubmits the identical
// converted request body to it. Returns ok=false on any reason racing can't proceed
// (feature off, not gpt-image-2, no stashed body — e.g. multipart img2img — or no
// other channel available) so callers fall back to single-channel polling unchanged.
func startImageRaceHedge(c *gin.Context, info *relaycommon.RelayInfo) (target service.ImageTaskTarget, channel *model.Channel, ok bool) {
	if !common.GptImage2RaceFallbackEnabled {
		return service.ImageTaskTarget{}, nil, false
	}
	if info == nil || !common.UsesAsyncImageTaskUpstream(info.OriginModelName) {
		return service.ImageTaskTarget{}, nil, false
	}
	rawBody, exists := c.Get(imageRequestBodyContextKey)
	requestBody, _ := rawBody.([]byte)
	if !exists || len(requestBody) == 0 {
		return service.ImageTaskTarget{}, nil, false
	}
	service.SetGptImage2RaceHedgePick(c, true)
	defer service.SetGptImage2RaceHedgePick(c, false)
	channel, err := service.SelectCheapestEnabledChannel(c, service.NormalizeGptImage2ModelName(info.OriginModelName))
	if err != nil || channel == nil {
		return service.ImageTaskTarget{}, nil, false
	}
	asyncPath := isClientAsyncImageGenerationsPath(c)
	taskID, err := service.SubmitImageGenerationToChannel(c.Request.Context(), channel, requestBody, info.OriginModelName, asyncPath)
	if err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("image race hedge submit to channel #%d failed: %v", channel.Id, err))
		return service.ImageTaskTarget{}, nil, false
	}
	logger.LogInfo(c.Request.Context(), fmt.Sprintf("image race hedge: primary slow, submitted to channel #%d task_id=%s", channel.Id, taskID))
	key, _, apiErr := channel.GetNextEnabledKey()
	if apiErr != nil {
		return service.ImageTaskTarget{}, nil, false
	}
	return service.ImageTaskTarget{
		ChannelID: channel.Id,
		BaseURL:   channel.GetBaseURL(),
		APIKey:    key,
		TaskID:    taskID,
	}, channel, true
}

// scheduleAsyncImageRaceHedge waits for the race-fallback trigger threshold in the
// background — the client already has its own task_id and is polling on its own — then,
// if the primary channel hasn't finished, submits to a second channel and records it on
// the Task row so RelayImageTask's poll can race both going forward.
//
// Runs fully detached from the original request: must not touch the original *gin.Context
// (Gin recycles it once the response has been written) or derive an HTTP context from it.
func scheduleAsyncImageRaceHedge(publicTaskID, modelName string, requestBody []byte, triggerDelay time.Duration) {
	if !common.GptImage2RaceFallbackEnabled || len(requestBody) == 0 {
		return
	}
	if !common.UsesAsyncImageTaskUpstream(modelName) {
		return
	}
	gopool.Go(func() {
		time.Sleep(triggerDelay)

		task, found, err := model.GetByOnlyTaskId(publicTaskID)
		if err != nil || !found || task == nil {
			return
		}
		switch task.Status {
		case model.TaskStatusSuccess, model.TaskStatusFailure:
			return // already resolved
		}

		primaryChannel, err := model.GetChannelById(task.ChannelId, true)
		if err != nil || primaryChannel == nil {
			return
		}
		primaryKey, _, apiErr := primaryChannel.GetNextEnabledKey()
		if apiErr != nil {
			return
		}
		_, status, _, _, _ := service.CheckImageTaskTargetsOnce([]service.ImageTaskTarget{{
			ChannelID: primaryChannel.Id,
			BaseURL:   primaryChannel.GetBaseURL(),
			APIKey:    primaryKey,
			TaskID:    task.GetUpstreamTaskID(),
		}})
		switch status {
		case "succeeded", "success", "completed", "failed", "error", "cancelled":
			return // resolved between submit and now — nothing to hedge
		}

		channelB, err := service.SelectCheapestEnabledChannelExcludingWithFilter(
			service.NormalizeGptImage2ModelName(modelName),
			[]int{task.ChannelId},
			service.GptImage2ChannelPickFilterForTask(task.PrivateData.GptImage2Profile, task.PrivateData.GptImage2OfficialFB),
		)
		if err != nil || channelB == nil {
			return
		}
		hedgeTaskID, err := service.SubmitImageGenerationToChannel(context.Background(), channelB, requestBody, modelName, true)
		if err != nil {
			logger.LogWarn(context.Background(), fmt.Sprintf("async image race hedge submit to channel #%d failed: %v", channelB.Id, err))
			return
		}

		task.PrivateData.HedgeChannelId = channelB.Id
		task.PrivateData.HedgeUpstreamTaskID = hedgeTaskID
		if err := task.Update(); err != nil {
			logger.LogWarn(context.Background(), fmt.Sprintf("async image race hedge: failed to persist hedge on task %s: %v", publicTaskID, err))
			return
		}
		logger.LogInfo(context.Background(), fmt.Sprintf("async image race hedge: task %s primary slow, hedged to channel #%d", publicTaskID, channelB.Id))
	})
}

// asyncImagePollOutcome is the result of server-side polling for a gpt-image-2 task.
type asyncImagePollOutcome struct {
	body           []byte
	timedOut       bool
	upstreamFailed bool
	failReason     string
	failCode       string
}

// pollAsyncImageTask polls the upstream /v1/tasks/{id} until done, then returns OpenAI-compatible image JSON.
// When GptImage2RaceFallbackEnabled is false (default), only the primary channel is polled; slow tasks
// time out without racing a second channel. Upstream terminal failures return upstreamFailed so the
// relay retry loop can pick the next channel.
func pollAsyncImageTask(c *gin.Context, info *relaycommon.RelayInfo, taskID string) asyncImagePollOutcome {
	baseURL := strings.TrimRight(common.GetContextKeyString(c, constant.ContextKeyChannelBaseUrl), "/")
	if baseURL == "" {
		baseURL = "https://api.openai.com"
	}
	apiKey := common.GetContextKeyString(c, constant.ContextKeyChannelKey)
	primaryChannelID := common.GetContextKeyInt(c, constant.ContextKeyChannelId)
	primary := service.ImageTaskTarget{ChannelID: primaryChannelID, BaseURL: baseURL, APIKey: apiKey, TaskID: taskID}

	fullDeadline := time.Now().Add(imagePollDeadlineFromContext(c))
	raceDeadline := time.Now().Add(imageRaceTriggerFromContext(c))
	if raceDeadline.After(fullDeadline) {
		raceDeadline = fullDeadline
	}

	time.Sleep(3 * time.Second)

	var imageURL string
	var ok bool

	if common.GptImage2RaceFallbackEnabled && raceDeadline.Before(fullDeadline) {
		_, imageURL, ok = service.RaceImageTask([]service.ImageTaskTarget{primary}, raceDeadline)
		if !ok {
			if hedgeTarget, hedgeChannel, hedgeOK := startImageRaceHedge(c, info); hedgeOK {
				_, imageURL, ok = service.RaceImageTask([]service.ImageTaskTarget{primary, hedgeTarget}, fullDeadline)
				if ok && hedgeTarget.ChannelID == hedgeChannel.Id && info != nil {
					if setupErr := middleware.SetupContextForSelectedChannel(c, hedgeChannel, info.OriginModelName); setupErr == nil {
						info.PriceData.GroupRatioInfo = helper.HandleGroupRatio(c, info)
					}
					addImageRaceHedgeChannel(c, hedgeChannel.Id)
				}
			} else {
				_, imageURL, ok = service.RaceImageTask([]service.ImageTaskTarget{primary}, fullDeadline)
			}
		}
	} else {
		_, imageURL, ok = service.RaceImageTask([]service.ImageTaskTarget{primary}, fullDeadline)
	}

	if ok && imageURL != "" {
		cachedURL := service.CacheImageLocallyWithHeaders(imageURL, imageCacheAuthHeaders(c))
		if cachedURL != "" {
			c.Set("image_result_url", cachedURL)
		}
		c.Set(imagePollTaskIDContextKey, taskID)
		openaiResp, _ := common.Marshal(map[string]interface{}{
			"created": time.Now().Unix(),
			"data":    []map[string]string{{"url": cachedURL}},
		})
		return asyncImagePollOutcome{body: openaiResp}
	}

	_, status, _, failReason, failCode := service.CheckImageTaskTargetsOnce([]service.ImageTaskTarget{primary})
	switch status {
	case "failed", "error", "cancelled":
		display := service.FormatImageTaskFailReason(failCode, failReason)
		if display == "" {
			display = fmt.Sprintf("upstream task %s failed", taskID)
		}
		return asyncImagePollOutcome{
			upstreamFailed: true,
			failReason:     display,
			failCode:       failCode,
		}
	default:
		logger.LogWarn(context.Background(), fmt.Sprintf("pollAsyncImageTask: timeout for task %s", taskID))
		return asyncImagePollOutcome{timedOut: true}
	}
}

// addImageRaceHedgeChannel appends the hedge channel to use_channel for usage log visibility.
func addImageRaceHedgeChannel(c *gin.Context, channelID int) {
	if c == nil || channelID <= 0 {
		return
	}
	useChannel := c.GetStringSlice("use_channel")
	id := fmt.Sprintf("%d", channelID)
	for _, existing := range useChannel {
		if existing == id {
			return
		}
	}
	c.Set("use_channel", append(useChannel, id))
}

func imageCacheAuthHeaders(c *gin.Context) map[string]string {
	if c == nil {
		return nil
	}
	apiKey := strings.TrimSpace(common.GetContextKeyString(c, constant.ContextKeyChannelKey))
	if apiKey == "" {
		return nil
	}
	return map[string]string{"Authorization": "Bearer " + apiKey}
}

// isClientAsyncImageGenerationsPath reports POST /v1/images/generations/async:
// return upstream task_id immediately without server-side polling.
func isClientAsyncImageGenerationsPath(c *gin.Context) bool {
	return strings.HasSuffix(c.Request.URL.Path, "/images/generations/async")
}

func apimartWebhookEnabled(c *gin.Context) bool {
	baseURL := strings.ToLower(strings.TrimSpace(common.GetContextKeyString(c, constant.ContextKeyChannelBaseUrl)))
	return strings.Contains(baseURL, "apimart.ai") && service.MediaTaskWebhookBase() != ""
}

func trackSubmittedImageTask(c *gin.Context, info *relaycommon.RelayInfo, responseBody []byte, upstreamTaskID string) ([]byte, string) {
	upstreamTaskID = strings.TrimSpace(upstreamTaskID)
	if info == nil || upstreamTaskID == "" {
		return responseBody, upstreamTaskID
	}
	publicTaskID := model.GenerateTaskID()
	task := &model.Task{
		TaskID:     publicTaskID,
		Platform:   constant.TaskPlatformOpenAIImage,
		UserId:     info.UserId,
		ChannelId:  info.ChannelId,
		Status:     model.TaskStatusSubmitted,
		Progress:   "0%",
		SubmitTime: time.Now().Unix(),
		Properties: model.Properties{OriginModelName: info.OriginModelName},
		PrivateData: model.TaskPrivateData{
			UpstreamTaskID:      upstreamTaskID,
			GptImage2Profile:    string(service.GptImage2ProfileFromContext(c)),
			GptImage2OfficialFB: service.GptImage2OfficialFallbackContextValue(c),
		},
	}
	if rd := service.ImageRequestDataFromContext(c); len(rd) > 0 {
		if encoded, merr := common.Marshal(rd); merr == nil {
			task.PrivateData.RequestData = string(encoded)
		}
	}
	if err := task.Insert(); err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("image task insert failed, exposing upstream task_id directly: %v", err))
		return responseBody, upstreamTaskID
	}

	var rootMap map[string]interface{}
	if common.Unmarshal(responseBody, &rootMap) == nil {
		if dataArr, ok := rootMap["data"].([]interface{}); ok && len(dataArr) > 0 {
			if first, ok := dataArr[0].(map[string]interface{}); ok {
				first["task_id"] = publicTaskID
				if rewritten, merr := common.Marshal(rootMap); merr == nil {
					responseBody = rewritten
				}
			}
		}
	}
	return responseBody, publicTaskID
}

func trackCompletedSyncImageTask(c *gin.Context, info *relaycommon.RelayInfo, resultURL string) ([]byte, string) {
	resultURL = strings.TrimSpace(resultURL)
	if info == nil || resultURL == "" {
		return nil, ""
	}
	now := time.Now().Unix()
	publicTaskID := model.GenerateTaskID()
	task := &model.Task{
		TaskID:     publicTaskID,
		Platform:   constant.TaskPlatformOpenAIImage,
		UserId:     info.UserId,
		Group:      info.UsingGroup,
		ChannelId:  info.ChannelId,
		Status:     model.TaskStatusSuccess,
		Progress:   "100%",
		SubmitTime: now,
		StartTime:  now,
		FinishTime: now,
		Properties: model.Properties{OriginModelName: info.OriginModelName, UpstreamModelName: info.UpstreamModelName},
		PrivateData: model.TaskPrivateData{
			ResultURL:        resultURL,
			GptImage2Profile: string(service.GptImage2ProfileFromContext(c)),
		},
	}
	if rd := service.ImageRequestDataFromContext(c); len(rd) > 0 {
		if encoded, merr := common.Marshal(rd); merr == nil {
			task.PrivateData.RequestData = string(encoded)
		}
	}
	if err := task.Insert(); err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("completed image task insert failed: %v", err))
		return nil, ""
	}
	body, err := common.Marshal(gin.H{
		"created": now,
		"data": []gin.H{{
			"task_id": publicTaskID,
			"status":  "submitted",
		}},
	})
	if err != nil {
		return nil, ""
	}
	return body, publicTaskID
}

func OpenaiHandlerWithUsage(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}

	// Client async submit: mint our own public task_id (decoupled from the upstream's),
	// persist a Task row mapping it to the real channel + upstream task_id, and — if the
	// gpt-image-2 race fallback is enabled — schedule a background hedge so the client's
	// later poll can transparently race a second channel without ever seeing either
	// channel's identity.
	if isClientAsyncImageGenerationsPath(c) {
		var asyncCheck struct {
			Data []struct {
				TaskID string `json:"task_id"`
			} `json:"data"`
		}
		if common.Unmarshal(responseBody, &asyncCheck) == nil &&
			len(asyncCheck.Data) > 0 &&
			strings.TrimSpace(asyncCheck.Data[0].TaskID) != "" {
			upstreamTaskID := strings.TrimSpace(asyncCheck.Data[0].TaskID)
			var publicTaskID string
			responseBody, publicTaskID = trackSubmittedImageTask(c, info, responseBody, upstreamTaskID)
			c.Set(imagePollTaskIDContextKey, publicTaskID)
			if publicTaskID != upstreamTaskID {
				if rawBody, exists := c.Get(imageRequestBodyContextKey); exists {
					if bodyBytes, ok := rawBody.([]byte); ok && len(bodyBytes) > 0 {
						scheduleAsyncImageRaceHedge(publicTaskID, info.OriginModelName, bodyBytes, imageRaceTriggerFromContext(c))
					}
				}
			}
		}
		if c.GetString(imagePollTaskIDContextKey) == "" {
			rewrittenBody := service.RewriteImageResponseBodyWithHeaders(responseBody, imageCacheAuthHeaders(c))
			if resultURL := service.ExtractFirstImageURLFromResponse(rewrittenBody); resultURL != "" {
				if taskBody, publicTaskID := trackCompletedSyncImageTask(c, info, resultURL); publicTaskID != "" {
					responseBody = taskBody
					c.Set(imagePollTaskIDContextKey, publicTaskID)
					c.Set("image_result_url", resultURL)
					logger.LogInfo(c.Request.Context(), fmt.Sprintf("client async image request completed by sync upstream, task_id=%s", publicTaskID))
				} else {
					responseBody = rewrittenBody
					c.Set("image_result_url", resultURL)
				}
			}
		}
	}

	// Detect async image task response and poll upstream until done (sync API only).
	if !isClientAsyncImageGenerationsPath(c) {
		var asyncCheck struct {
			Data []struct {
				Status string `json:"status"`
				TaskID string `json:"task_id"`
			} `json:"data"`
		}
		if common.Unmarshal(responseBody, &asyncCheck) == nil &&
			len(asyncCheck.Data) > 0 &&
			asyncCheck.Data[0].TaskID != "" &&
			asyncCheck.Data[0].Status == "submitted" {
			taskID := asyncCheck.Data[0].TaskID
			if apimartWebhookEnabled(c) {
				var publicTaskID string
				responseBody, publicTaskID = trackSubmittedImageTask(c, info, responseBody, taskID)
				c.Set(imagePollTaskIDContextKey, publicTaskID)
				logger.LogInfo(c.Request.Context(), fmt.Sprintf("image task async detected, using webhook task_id=%s public_task_id=%s", taskID, publicTaskID))
			} else {
				logger.LogInfo(c.Request.Context(), fmt.Sprintf("image task async detected, polling task_id=%s", taskID))
				pollOutcome := pollAsyncImageTask(c, info, taskID)
				if pollOutcome.body != nil {
					responseBody = pollOutcome.body
				} else if pollOutcome.upstreamFailed {
					c.Set(imagePollTaskIDContextKey, taskID)
					failCode := pollOutcome.failCode
					if failCode == "" {
						failCode = "image_generation_failed"
					}
					return nil, types.WithOpenAIError(types.OpenAIError{
						Message: pollOutcome.failReason,
						Type:    "server_error",
						Code:    failCode,
					}, http.StatusBadGateway)
				} else {
					c.Set(imagePollTaskIDContextKey, taskID)
					service.ScheduleImageTaskReconcile(c, info, taskID)
					deadlineSec := int(imagePollDeadlineFromContext(c).Seconds())
					return nil, types.WithOpenAIError(types.OpenAIError{
						Message: fmt.Sprintf(
							"Image generation timed out after %d seconds. Retry with lower resolution or quality.",
							deadlineSec,
						),
						Type: "server_error",
						Code: "image_generation_timeout",
					}, http.StatusRequestTimeout, types.ErrOptionWithNoRecordErrorLog(), types.ErrOptionWithSkipRetry())
				}
			}
		}
	}

	var usageResp dto.SimpleResponse
	err = common.Unmarshal(responseBody, &usageResp)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	// Rewrite upstream image URLs before returning to client (sync responses).
	if info.RelayMode == relayconstant.RelayModeImagesGenerations || info.RelayMode == relayconstant.RelayModeImagesEdits {
		responseBody = service.RewriteImageResponseBodyWithHeaders(responseBody, imageCacheAuthHeaders(c))
		if resultURL := service.ExtractFirstImageURLFromResponse(responseBody); resultURL != "" {
			c.Set("image_result_url", resultURL)
		}
	}

	// 写入新的 response body
	service.IOCopyBytesGracefully(c, resp, responseBody)

	// Once we've written to the client, we should not return errors anymore
	// because the upstream has already consumed resources and returned content
	// We should still perform billing even if parsing fails
	// format
	if usageResp.InputTokens > 0 {
		usageResp.PromptTokens += usageResp.InputTokens
	}
	if usageResp.OutputTokens > 0 {
		usageResp.CompletionTokens += usageResp.OutputTokens
	}
	if usageResp.InputTokensDetails != nil {
		usageResp.PromptTokensDetails.ImageTokens += usageResp.InputTokensDetails.ImageTokens
		usageResp.PromptTokensDetails.TextTokens += usageResp.InputTokensDetails.TextTokens
	}
	applyUsagePostProcessing(info, &usageResp.Usage, responseBody)
	return &usageResp.Usage, nil
}

func applyUsagePostProcessing(info *relaycommon.RelayInfo, usage *dto.Usage, responseBody []byte) {
	if info == nil || usage == nil {
		return
	}

	switch info.ChannelType {
	case constant.ChannelTypeDeepSeek:
		if usage.PromptTokensDetails.CachedTokens == 0 && usage.PromptCacheHitTokens != 0 {
			usage.PromptTokensDetails.CachedTokens = usage.PromptCacheHitTokens
		}
	case constant.ChannelTypeZhipu_v4:
		// 智普的cached_tokens在标准位置: usage.prompt_tokens_details.cached_tokens
		if usage.PromptTokensDetails.CachedTokens == 0 {
			if usage.InputTokensDetails != nil && usage.InputTokensDetails.CachedTokens > 0 {
				usage.PromptTokensDetails.CachedTokens = usage.InputTokensDetails.CachedTokens
			} else if cachedTokens, ok := extractCachedTokensFromBody(responseBody); ok {
				usage.PromptTokensDetails.CachedTokens = cachedTokens
			} else if usage.PromptCacheHitTokens > 0 {
				usage.PromptTokensDetails.CachedTokens = usage.PromptCacheHitTokens
			}
		}
	case constant.ChannelTypeMoonshot:
		// Moonshot的cached_tokens在非标准位置: choices[].usage.cached_tokens
		if usage.PromptTokensDetails.CachedTokens == 0 {
			if usage.InputTokensDetails != nil && usage.InputTokensDetails.CachedTokens > 0 {
				usage.PromptTokensDetails.CachedTokens = usage.InputTokensDetails.CachedTokens
			} else if cachedTokens, ok := extractMoonshotCachedTokensFromBody(responseBody); ok {
				usage.PromptTokensDetails.CachedTokens = cachedTokens
			} else if cachedTokens, ok := extractCachedTokensFromBody(responseBody); ok {
				usage.PromptTokensDetails.CachedTokens = cachedTokens
			} else if usage.PromptCacheHitTokens > 0 {
				usage.PromptTokensDetails.CachedTokens = usage.PromptCacheHitTokens
			}
		}
	case constant.ChannelTypeOpenAI:
		if usage.PromptTokensDetails.CachedTokens == 0 {
			if cachedTokens, ok := extractLlamaCachedTokensFromBody(responseBody); ok {
				usage.PromptTokensDetails.CachedTokens = cachedTokens
			}
		}
	}
}

func extractCachedTokensFromBody(body []byte) (int, bool) {
	if len(body) == 0 {
		return 0, false
	}

	var payload struct {
		Usage struct {
			PromptTokensDetails struct {
				CachedTokens *int `json:"cached_tokens"`
			} `json:"prompt_tokens_details"`
			CachedTokens         *int `json:"cached_tokens"`
			PromptCacheHitTokens *int `json:"prompt_cache_hit_tokens"`
		} `json:"usage"`
	}

	if err := common.Unmarshal(body, &payload); err != nil {
		return 0, false
	}

	if payload.Usage.PromptTokensDetails.CachedTokens != nil {
		return *payload.Usage.PromptTokensDetails.CachedTokens, true
	}
	if payload.Usage.CachedTokens != nil {
		return *payload.Usage.CachedTokens, true
	}
	if payload.Usage.PromptCacheHitTokens != nil {
		return *payload.Usage.PromptCacheHitTokens, true
	}
	return 0, false
}

// extractMoonshotCachedTokensFromBody 从Moonshot的非标准位置提取cached_tokens
// Moonshot的流式响应格式: {"choices":[{"usage":{"cached_tokens":111}}]}
func extractMoonshotCachedTokensFromBody(body []byte) (int, bool) {
	if len(body) == 0 {
		return 0, false
	}

	var payload struct {
		Choices []struct {
			Usage struct {
				CachedTokens *int `json:"cached_tokens"`
			} `json:"usage"`
		} `json:"choices"`
	}

	if err := common.Unmarshal(body, &payload); err != nil {
		return 0, false
	}

	// 遍历choices查找cached_tokens
	for _, choice := range payload.Choices {
		if choice.Usage.CachedTokens != nil && *choice.Usage.CachedTokens > 0 {
			return *choice.Usage.CachedTokens, true
		}
	}

	return 0, false
}

// extractLlamaCachedTokensFromBody 从llama.cpp的非标准位置提取cache_n
func extractLlamaCachedTokensFromBody(body []byte) (int, bool) {
	if len(body) == 0 {
		return 0, false
	}

	var payload struct {
		Timings struct {
			CachedTokens *int `json:"cache_n"`
		} `json:"timings"`
	}

	if err := common.Unmarshal(body, &payload); err != nil {
		return 0, false
	}

	if payload.Timings.CachedTokens == nil {
		return 0, false
	}
	return *payload.Timings.CachedTokens, true
}
