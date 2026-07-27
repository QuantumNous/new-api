package openai

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

func OpenaiRealtimeHandler(c *gin.Context, info *relaycommon.RelayInfo) (*types.NewAPIError, *dto.RealtimeUsage) {
	if info == nil || info.ClientWs == nil || info.TargetWs == nil {
		return types.NewError(fmt.Errorf("invalid websocket connection"), types.ErrorCodeBadResponse), nil
	}

	info.IsStream = true
	info.InitRealtimeTranscriptionState()
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
	transcriptionSumUsage := &dto.RealtimeUsage{}

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
						captureRealtimeTranscriptionModel(info, realtimeEvent.Session)
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
						*usage = addRealtimeUsage(*usage, *realtimeUsage)
						_, err := preConsumeUsage(c, info, info.OriginModelName, usage, sumUsage)
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
						_, err = preConsumeUsage(c, info, info.OriginModelName, localUsage, sumUsage)
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

				} else if transcriptionBilling, ok := realtimeTranscriptionBilling(info.OriginModelName, info.GetRealtimeTranscriptionModel(), realtimeEvent); ok {
					// GA 转写会话没有 response.done,转写模型的官方 usage 附在 completed 事件上,与 response.done 同等计费;
					// whisper 系按时长返回(token 全 0)时不走此分支,仍用本地估算兜底
					quotaResult, err := preConsumeUsage(c, info, transcriptionBilling.ModelName, &transcriptionBilling.Usage, transcriptionSumUsage)
					// 已识别官方 usage 后清掉本句本地估算以防双计;这可能同时丢掉下一句已 append 的音频估算
					localUsage = &dto.RealtimeUsage{}
					if err != nil {
						errChan <- fmt.Errorf("error consume usage: %v", err)
						return
					}
					info.AddRealtimeTranscriptionQuota(quotaResult.Quota)
					service.RecordRealtimeTranscriptionConsumeLog(c, info, transcriptionBilling.ModelName, &transcriptionBilling.Usage, quotaResult)
				} else if realtimeEvent.Type == dto.RealtimeEventTypeSessionUpdated || realtimeEvent.Type == dto.RealtimeEventTypeSessionCreated {
					realtimeSession := realtimeEvent.Session
					if realtimeSession != nil {
						// update audio format
						info.InputAudioFormat = common.GetStringIfEmpty(realtimeSession.InputAudioFormat, info.InputAudioFormat)
						info.OutputAudioFormat = common.GetStringIfEmpty(realtimeSession.OutputAudioFormat, info.OutputAudioFormat)
						captureRealtimeTranscriptionModel(info, realtimeSession)
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
		_, _ = preConsumeUsage(c, info, info.OriginModelName, usage, sumUsage)
	}

	if localUsage.TotalTokens != 0 {
		_, _ = preConsumeUsage(c, info, info.OriginModelName, localUsage, sumUsage)
	}

	// check usage total tokens, if 0, use local usage

	return nil, sumUsage
}

func addRealtimeUsage(total, delta dto.RealtimeUsage) dto.RealtimeUsage {
	total.TotalTokens += delta.TotalTokens
	total.InputTokens += delta.InputTokens
	total.OutputTokens += delta.OutputTokens
	total.InputTokenDetails.CachedTokens += delta.InputTokenDetails.CachedTokens
	total.InputTokenDetails.TextTokens += delta.InputTokenDetails.TextTokens
	total.InputTokenDetails.AudioTokens += delta.InputTokenDetails.AudioTokens
	total.OutputTokenDetails.TextTokens += delta.OutputTokenDetails.TextTokens
	total.OutputTokenDetails.AudioTokens += delta.OutputTokenDetails.AudioTokens
	return total
}

func billableRealtimeTranscriptionUsage(event *dto.RealtimeEvent) (dto.RealtimeUsage, bool) {
	if event == nil || event.Type != dto.RealtimeEventInputAudioTranscriptionCompleted || event.Usage == nil || event.Usage.TotalTokens <= 0 {
		return dto.RealtimeUsage{}, false
	}

	usage := addRealtimeUsage(dto.RealtimeUsage{}, *event.Usage)
	// GA 转写 usage 不带 output_token_details,而计费公式只认明细字段,明细缺失时输出全按文本补记
	if event.Usage.OutputTokenDetails.TextTokens == 0 && event.Usage.OutputTokenDetails.AudioTokens == 0 {
		usage.OutputTokenDetails.TextTokens = event.Usage.OutputTokens
	}
	return usage, true
}

type realtimeTranscriptionBillingInfo struct {
	ModelName string
	Usage     dto.RealtimeUsage
}

func realtimeTranscriptionBilling(originModelName, transcriptionModelName string, event *dto.RealtimeEvent) (realtimeTranscriptionBillingInfo, bool) {
	usage, ok := billableRealtimeTranscriptionUsage(event)
	if !ok {
		return realtimeTranscriptionBillingInfo{}, false
	}
	if transcriptionModelName == "" {
		transcriptionModelName = originModelName
	}
	return realtimeTranscriptionBillingInfo{
		ModelName: transcriptionModelName,
		Usage:     usage,
	}, true
}

func captureRealtimeTranscriptionModel(info *relaycommon.RelayInfo, session *dto.RealtimeSession) {
	if info == nil || session == nil || session.InputAudioTranscription.Model == "" {
		return
	}
	info.SetRealtimeTranscriptionModel(session.InputAudioTranscription.Model)
}

func preConsumeUsage(ctx *gin.Context, info *relaycommon.RelayInfo, modelName string, usage *dto.RealtimeUsage, totalUsage *dto.RealtimeUsage) (service.WssQuotaResult, error) {
	if usage == nil || totalUsage == nil {
		return service.WssQuotaResult{}, fmt.Errorf("invalid usage pointer")
	}

	*totalUsage = addRealtimeUsage(*totalUsage, *usage)
	return service.PreWssConsumeQuota(ctx, info, modelName, usage)
}
