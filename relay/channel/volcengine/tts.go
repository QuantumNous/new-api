package volcengine

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/samber/lo"
)

type VolcengineTTSRequest struct {
	App     VolcengineTTSApp     `json:"app"`
	User    VolcengineTTSUser    `json:"user"`
	Audio   VolcengineTTSAudio   `json:"audio"`
	Request VolcengineTTSReqInfo `json:"request"`
}

type VolcengineTTSApp struct {
	AppID   string `json:"appid"`
	Token   string `json:"token"`
	Cluster string `json:"cluster"`
}

type VolcengineTTSUser struct {
	UID string `json:"uid"`
}

type VolcengineTTSAudio struct {
	VoiceType        string  `json:"voice_type"`
	Encoding         string  `json:"encoding"`
	SpeedRatio       float64 `json:"speed_ratio"`
	Rate             int     `json:"rate"`
	Bitrate          int     `json:"bitrate,omitempty"`
	LoudnessRatio    float64 `json:"loudness_ratio,omitempty"`
	EnableEmotion    bool    `json:"enable_emotion,omitempty"`
	Emotion          string  `json:"emotion,omitempty"`
	EmotionScale     float64 `json:"emotion_scale,omitempty"`
	ExplicitLanguage string  `json:"explicit_language,omitempty"`
	ContextLanguage  string  `json:"context_language,omitempty"`
}

type VolcengineTTSReqInfo struct {
	ReqID           string                   `json:"reqid"`
	Text            string                   `json:"text"`
	Operation       string                   `json:"operation"`
	Model           string                   `json:"model,omitempty"`
	TextType        string                   `json:"text_type,omitempty"`
	SilenceDuration float64                  `json:"silence_duration,omitempty"`
	WithTimestamp   interface{}              `json:"with_timestamp,omitempty"`
	ExtraParam      *VolcengineTTSExtraParam `json:"extra_param,omitempty"`
}

type VolcengineTTSExtraParam struct {
	DisableMarkdownFilter      bool                      `json:"disable_markdown_filter,omitempty"`
	EnableLatexTn              bool                      `json:"enable_latex_tn,omitempty"`
	MuteCutThreshold           string                    `json:"mute_cut_threshold,omitempty"`
	MuteCutRemainMs            string                    `json:"mute_cut_remain_ms,omitempty"`
	DisableEmojiFilter         bool                      `json:"disable_emoji_filter,omitempty"`
	UnsupportedCharRatioThresh float64                   `json:"unsupported_char_ratio_thresh,omitempty"`
	AigcWatermark              bool                      `json:"aigc_watermark,omitempty"`
	CacheConfig                *VolcengineTTSCacheConfig `json:"cache_config,omitempty"`
}

type VolcengineTTSCacheConfig struct {
	TextType int  `json:"text_type,omitempty"`
	UseCache bool `json:"use_cache,omitempty"`
}

type VolcengineTTSResponse struct {
	ReqID    string                     `json:"reqid"`
	Code     int                        `json:"code"`
	Message  string                     `json:"message"`
	Sequence int                        `json:"sequence"`
	Data     string                     `json:"data"`
	Addition *VolcengineTTSAdditionInfo `json:"addition,omitempty"`
}

type VolcengineTTSAdditionInfo struct {
	Duration string `json:"duration"`
}

var openAIToVolcengineVoiceMap = map[string]string{
	"alloy":   "zh_male_M392_conversation_wvae_bigtts",
	"echo":    "zh_male_wenhao_mars_bigtts",
	"fable":   "zh_female_tianmei_mars_bigtts",
	"onyx":    "zh_male_zhibei_mars_bigtts",
	"nova":    "zh_female_shuangkuaisisi_mars_bigtts",
	"shimmer": "zh_female_cancan_mars_bigtts",
}

const (
	ttsAgentPlanEndpoint          = "wss://openspeech.bytedance.com/api/v3/plan/tts/bidirection"
	ttsAgentPlanResourceID        = "seed-tts-2.0"
	contextKeyAgentPlanTTSRequest = "volcengine_agent_plan_tts_request"
)

type VolcengineAgentPlanTTSRequest struct {
	User      VolcengineTTSUser               `json:"user"`
	Namespace string                          `json:"namespace"`
	ReqParams VolcengineAgentPlanTTSReqParams `json:"req_params"`
}

type VolcengineAgentPlanTTSReqParams struct {
	Text        string                         `json:"text,omitempty"`
	Speaker     string                         `json:"speaker"`
	AudioParams VolcengineAgentPlanAudioParams `json:"audio_params"`
}

type VolcengineAgentPlanAudioParams struct {
	Format     string `json:"format"`
	SampleRate int    `json:"sample_rate"`
	SpeechRate int    `json:"speech_rate,omitempty"`
}

var responseFormatToEncodingMap = map[string]string{
	"mp3":  "mp3",
	"opus": "ogg_opus",
	"aac":  "mp3",
	"flac": "mp3",
	"wav":  "wav",
	"pcm":  "pcm",
}

func parseVolcengineAuth(apiKey string) (appID, token string, err error) {
	parts := strings.Split(apiKey, "|")
	if len(parts) != 2 {
		return "", "", errors.New("invalid api key format, expected: appid|access_token")
	}
	return parts[0], parts[1], nil
}

func mapVoiceType(openAIVoice string) string {
	if voice, ok := openAIToVolcengineVoiceMap[openAIVoice]; ok {
		return voice
	}
	return openAIVoice
}

func mapEncoding(responseFormat string) string {
	if encoding, ok := responseFormatToEncodingMap[responseFormat]; ok {
		return encoding
	}
	return "mp3"
}

func getContentTypeByEncoding(encoding string) string {
	contentTypeMap := map[string]string{
		"mp3":      "audio/mpeg",
		"ogg_opus": "audio/ogg",
		"wav":      "audio/wav",
		"pcm":      "audio/pcm",
	}
	if ct, ok := contentTypeMap[encoding]; ok {
		return ct
	}
	return "application/octet-stream"
}

func handleTTSResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo, encoding string) (usage any, err *types.NewAPIError) {
	body, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		return nil, types.NewErrorWithStatusCode(
			errors.New("failed to read volcengine response"),
			types.ErrorCodeReadResponseBodyFailed,
			http.StatusInternalServerError,
		)
	}
	defer resp.Body.Close()

	var volcResp VolcengineTTSResponse
	if unmarshalErr := json.Unmarshal(body, &volcResp); unmarshalErr != nil {
		return nil, types.NewErrorWithStatusCode(
			errors.New("failed to parse volcengine response"),
			types.ErrorCodeBadResponseBody,
			http.StatusInternalServerError,
		)
	}

	if volcResp.Code != 3000 {
		return nil, types.NewErrorWithStatusCode(
			errors.New(volcResp.Message),
			types.ErrorCodeBadResponse,
			http.StatusBadRequest,
		)
	}

	audioData, decodeErr := base64.StdEncoding.DecodeString(volcResp.Data)
	if decodeErr != nil {
		return nil, types.NewErrorWithStatusCode(
			errors.New("failed to decode audio data"),
			types.ErrorCodeBadResponseBody,
			http.StatusInternalServerError,
		)
	}

	contentType := getContentTypeByEncoding(encoding)
	c.Header("Content-Type", contentType)
	c.Data(http.StatusOK, contentType, audioData)

	usage = &dto.Usage{
		PromptTokens:     info.GetEstimatePromptTokens(),
		CompletionTokens: 0,
		TotalTokens:      info.GetEstimatePromptTokens(),
	}

	return usage, nil
}

func generateRequestID() string {
	return uuid.New().String()
}

func isAgentPlanTTSBase(baseURL string) bool {
	baseURL = normalizeVolcengineBaseURL(baseURL)
	return baseURL == "https://ark.cn-beijing.volces.com" || isVolcengineAgentPlanBase(baseURL)
}

func isAgentPlanTTS(info *relaycommon.RelayInfo) bool {
	return strings.HasPrefix(strings.TrimSpace(info.ApiKey), "ark-") && isAgentPlanTTSBase(info.ChannelBaseUrl)
}

func agentPlanVoice(voice string) string {
	if voice == "" {
		return "zh_female_vv_uranus_bigtts"
	}
	switch strings.ToLower(voice) {
	case "alloy", "fable", "nova", "shimmer":
		return "zh_female_vv_uranus_bigtts"
	case "echo", "onyx":
		return "zh_male_yuanboxiaoshu_moon_bigtts"
	default:
		return voice
	}
}

func buildAgentPlanTTSRequest(request dto.AudioRequest) VolcengineAgentPlanTTSRequest {
	speedRatio := lo.FromPtrOr(request.Speed, 1.0)
	speechRate := int((speedRatio - 1) * 100)
	if speechRate < -50 {
		speechRate = -50
	}
	if speechRate > 100 {
		speechRate = 100
	}
	encoding := mapEncoding(request.ResponseFormat)
	return VolcengineAgentPlanTTSRequest{
		User:      VolcengineTTSUser{UID: generateRequestID()},
		Namespace: "BidirectionalTTS",
		ReqParams: VolcengineAgentPlanTTSReqParams{
			Text:    request.Input,
			Speaker: agentPlanVoice(request.Voice),
			AudioParams: VolcengineAgentPlanAudioParams{
				Format:     encoding,
				SampleRate: 24000,
				SpeechRate: speechRate,
			},
		},
	}
}

func buildAgentPlanTTSHeaders(apiKey string) http.Header {
	header := http.Header{}
	header.Set("X-Api-Key", strings.TrimSpace(apiKey))
	header.Set("X-Api-Resource-Id", ttsAgentPlanResourceID)
	header.Set("X-Api-Connect-Id", uuid.New().String())
	return header
}

func handleAgentPlanTTSWebSocketResponse(c *gin.Context, requestURL string, info *relaycommon.RelayInfo, encoding string) (usage any, err *types.NewAPIError) {
	requestValue, exists := c.Get(contextKeyAgentPlanTTSRequest)
	if !exists {
		return nil, types.NewErrorWithStatusCode(errors.New("volcengine Agent Plan TTS request not found in context"), types.ErrorCodeBadRequestBody, http.StatusInternalServerError)
	}
	request, ok := requestValue.(VolcengineAgentPlanTTSRequest)
	if !ok {
		return nil, types.NewErrorWithStatusCode(errors.New("invalid volcengine Agent Plan TTS request type"), types.ErrorCodeBadRequestBody, http.StatusInternalServerError)
	}

	conn, resp, dialErr := websocket.DefaultDialer.DialContext(context.Background(), requestURL, buildAgentPlanTTSHeaders(info.ApiKey))
	if dialErr != nil {
		if resp != nil {
			return nil, types.NewErrorWithStatusCode(fmt.Errorf("failed to connect to Agent Plan TTS websocket: %w, status: %d", dialErr, resp.StatusCode), types.ErrorCodeBadResponseStatusCode, http.StatusBadGateway)
		}
		return nil, types.NewErrorWithStatusCode(fmt.Errorf("failed to connect to Agent Plan TTS websocket: %w", dialErr), types.ErrorCodeBadResponseStatusCode, http.StatusBadGateway)
	}
	defer conn.Close()

	sessionID := uuid.New().String()
	sendEvent := func(event EventType, session string, payload any) error {
		message, messageErr := NewMessage(MsgTypeFullClientRequest, MsgTypeFlagWithEvent)
		if messageErr != nil {
			return messageErr
		}
		message.EventType = event
		message.SessionID = session
		if payload == nil {
			message.Payload = []byte("{}")
		} else {
			message.Payload, messageErr = json.Marshal(payload)
			if messageErr != nil {
				return messageErr
			}
		}
		frame, messageErr := message.Marshal()
		if messageErr != nil {
			return messageErr
		}
		return conn.WriteMessage(websocket.BinaryMessage, frame)
	}

	if err := sendEvent(EventType_StartConnection, "", nil); err != nil {
		return nil, types.NewErrorWithStatusCode(fmt.Errorf("failed to start Agent Plan TTS connection: %w", err), types.ErrorCodeBadRequestBody, http.StatusInternalServerError)
	}
	message, recvErr := ReceiveMessage(conn)
	if recvErr != nil || message.EventType != EventType_ConnectionStarted {
		if recvErr == nil && message.MsgType == MsgTypeError {
			return nil, types.NewErrorWithStatusCode(fmt.Errorf("Agent Plan TTS connection error: code=%d, %s", message.ErrorCode, string(message.Payload)), types.ErrorCodeBadResponse, http.StatusBadGateway)
		}
		return nil, types.NewErrorWithStatusCode(fmt.Errorf("failed to start Agent Plan TTS session: %w", recvErr), types.ErrorCodeBadResponse, http.StatusBadGateway)
	}

	startPayload := request
	if err := sendEvent(EventType_StartSession, sessionID, startPayload); err != nil {
		return nil, types.NewErrorWithStatusCode(fmt.Errorf("failed to start Agent Plan TTS session: %w", err), types.ErrorCodeBadRequestBody, http.StatusInternalServerError)
	}
	message, recvErr = ReceiveMessage(conn)
	if recvErr != nil || message.EventType != EventType_SessionStarted {
		if recvErr == nil && message.MsgType == MsgTypeError {
			return nil, types.NewErrorWithStatusCode(fmt.Errorf("Agent Plan TTS session error: code=%d, %s", message.ErrorCode, string(message.Payload)), types.ErrorCodeBadResponse, http.StatusBadGateway)
		}
		return nil, types.NewErrorWithStatusCode(fmt.Errorf("failed to start Agent Plan TTS session: %w", recvErr), types.ErrorCodeBadResponse, http.StatusBadGateway)
	}

	if err := sendEvent(EventType_TaskRequest, sessionID, request); err != nil {
		return nil, types.NewErrorWithStatusCode(fmt.Errorf("failed to send Agent Plan TTS request: %w", err), types.ErrorCodeBadRequestBody, http.StatusInternalServerError)
	}
	if err := sendEvent(EventType_FinishSession, sessionID, nil); err != nil {
		return nil, types.NewErrorWithStatusCode(fmt.Errorf("failed to finish Agent Plan TTS request: %w", err), types.ErrorCodeBadRequestBody, http.StatusInternalServerError)
	}

	c.Header("Content-Type", getContentTypeByEncoding(encoding))
	c.Header("Transfer-Encoding", "chunked")
	for {
		message, recvErr = ReceiveMessage(conn)
		if recvErr != nil {
			if websocket.IsCloseError(recvErr, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
				break
			}
			return nil, types.NewErrorWithStatusCode(fmt.Errorf("failed to receive Agent Plan TTS message: %w", recvErr), types.ErrorCodeBadResponse, http.StatusBadGateway)
		}
		if message.MsgType == MsgTypeError {
			return nil, types.NewErrorWithStatusCode(fmt.Errorf("Agent Plan TTS error: code=%d, %s", message.ErrorCode, string(message.Payload)), types.ErrorCodeBadResponse, http.StatusBadGateway)
		}
		switch message.MsgType {
		case MsgTypeAudioOnlyServer:
			if len(message.Payload) > 0 {
				if _, writeErr := c.Writer.Write(message.Payload); writeErr != nil {
					return nil, types.NewErrorWithStatusCode(fmt.Errorf("failed to write Agent Plan TTS audio: %w", writeErr), types.ErrorCodeBadResponse, http.StatusInternalServerError)
				}
				c.Writer.Flush()
			}
		case MsgTypeFullServerResponse:
			if message.EventType == EventType_TTSEnded || message.EventType == EventType_SessionFinished {
				c.Status(http.StatusOK)
				return &dto.Usage{PromptTokens: info.GetEstimatePromptTokens(), TotalTokens: info.GetEstimatePromptTokens()}, nil
			}
		}
	}

	c.Status(http.StatusOK)
	return &dto.Usage{PromptTokens: info.GetEstimatePromptTokens(), TotalTokens: info.GetEstimatePromptTokens()}, nil
}

func handleTTSWebSocketResponse(c *gin.Context, requestURL string, volcRequest VolcengineTTSRequest, info *relaycommon.RelayInfo, encoding string) (usage any, err *types.NewAPIError) {
	_, token, parseErr := parseVolcengineAuth(info.ApiKey)
	if parseErr != nil {
		return nil, types.NewErrorWithStatusCode(
			parseErr,
			types.ErrorCodeChannelInvalidKey,
			http.StatusUnauthorized,
		)
	}

	header := http.Header{}
	header.Set("Authorization", fmt.Sprintf("Bearer;%s", token))

	conn, resp, dialErr := websocket.DefaultDialer.DialContext(context.Background(), requestURL, header)
	if dialErr != nil {
		if resp != nil {
			return nil, types.NewErrorWithStatusCode(
				fmt.Errorf("failed to connect to websocket: %w, status: %d", dialErr, resp.StatusCode),
				types.ErrorCodeBadResponseStatusCode,
				http.StatusBadGateway,
			)
		}
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf("failed to connect to websocket: %w", dialErr),
			types.ErrorCodeBadResponseStatusCode,
			http.StatusBadGateway,
		)
	}
	defer conn.Close()

	payload, marshalErr := json.Marshal(volcRequest)
	if marshalErr != nil {
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf("failed to marshal request: %w", marshalErr),
			types.ErrorCodeBadRequestBody,
			http.StatusInternalServerError,
		)
	}

	if sendErr := FullClientRequest(conn, payload); sendErr != nil {
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf("failed to send request: %w", sendErr),
			types.ErrorCodeBadRequestBody,
			http.StatusInternalServerError,
		)
	}

	contentType := getContentTypeByEncoding(encoding)
	c.Header("Content-Type", contentType)
	c.Header("Transfer-Encoding", "chunked")

	for {
		msg, recvErr := ReceiveMessage(conn)
		if recvErr != nil {
			if websocket.IsCloseError(recvErr, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
				break
			}
			return nil, types.NewErrorWithStatusCode(
				fmt.Errorf("failed to receive message: %w", recvErr),
				types.ErrorCodeBadResponse,
				http.StatusInternalServerError,
			)
		}

		switch msg.MsgType {
		case MsgTypeError:
			return nil, types.NewErrorWithStatusCode(
				fmt.Errorf("received error from server: code=%d, %s", msg.ErrorCode, string(msg.Payload)),
				types.ErrorCodeBadResponse,
				http.StatusBadRequest,
			)
		case MsgTypeFrontEndResultServer:
			continue
		case MsgTypeAudioOnlyServer:
			if len(msg.Payload) > 0 {
				if _, writeErr := c.Writer.Write(msg.Payload); writeErr != nil {
					return nil, types.NewErrorWithStatusCode(
						fmt.Errorf("failed to write audio data: %w", writeErr),
						types.ErrorCodeBadResponse,
						http.StatusInternalServerError,
					)
				}
				c.Writer.Flush()
			}

			if msg.Sequence < 0 {
				c.Status(http.StatusOK)
				usage = &dto.Usage{
					PromptTokens:     info.GetEstimatePromptTokens(),
					CompletionTokens: 0,
					TotalTokens:      info.GetEstimatePromptTokens(),
				}
				return usage, nil
			}
		default:
			continue
		}
	}

	c.Status(http.StatusOK)
	usage = &dto.Usage{
		PromptTokens:     info.GetEstimatePromptTokens(),
		CompletionTokens: 0,
		TotalTokens:      info.GetEstimatePromptTokens(),
	}
	return usage, nil
}
