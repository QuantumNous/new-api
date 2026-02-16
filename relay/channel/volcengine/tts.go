package volcengine

import (
	"github.com/QuantumNous/new-api/i18n"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
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
		return "", "", errors.New(i18n.Translate("relay.invalid_api_key_format_expected_appid_access_token"))
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
			errors.New(i18n.Translate("relay.failed_to_read_volcengine_response")),
			types.ErrorCodeReadResponseBodyFailed,
			http.StatusInternalServerError,
		)
	}
	defer resp.Body.Close()

	var volcResp VolcengineTTSResponse
	if unmarshalErr := json.Unmarshal(body, &volcResp); unmarshalErr != nil {
		return nil, types.NewErrorWithStatusCode(
			errors.New(i18n.Translate("relay.failed_to_parse_volcengine_response")),
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
			errors.New(i18n.Translate("relay.failed_to_decode_audio_data")),
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
	header.Set("Authorization", fmt.Sprintf("Bearer %s", token))

	conn, resp, dialErr := websocket.DefaultDialer.DialContext(context.Background(), requestURL, header)
	if dialErr != nil {
		if resp != nil {
			return nil, types.NewErrorWithStatusCode(
				fmt.Errorf(i18n.Translate("relay.failed_to_connect_to_websocket_status"), dialErr, resp.StatusCode),
				types.ErrorCodeBadResponseStatusCode,
				http.StatusBadGateway,
			)
		}
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf(i18n.Translate("relay.failed_to_connect_to_websocket"), dialErr),
			types.ErrorCodeBadResponseStatusCode,
			http.StatusBadGateway,
		)
	}
	defer conn.Close()

	payload, marshalErr := json.Marshal(volcRequest)
	if marshalErr != nil {
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf(i18n.Translate("relay.failed_to_marshal_request"), marshalErr),
			types.ErrorCodeBadRequestBody,
			http.StatusInternalServerError,
		)
	}

	if sendErr := FullClientRequest(conn, payload); sendErr != nil {
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf(i18n.Translate("relay.failed_to_send_request_2cb6"), sendErr),
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
				fmt.Errorf(i18n.Translate("relay.failed_to_receive_message"), recvErr),
				types.ErrorCodeBadResponse,
				http.StatusInternalServerError,
			)
		}

		switch msg.MsgType {
		case MsgTypeError:
			return nil, types.NewErrorWithStatusCode(
				fmt.Errorf(i18n.Translate("relay.received_error_from_server_code"), msg.ErrorCode, string(msg.Payload)),
				types.ErrorCodeBadResponse,
				http.StatusBadRequest,
			)
		case MsgTypeFrontEndResultServer:
			continue
		case MsgTypeAudioOnlyServer:
			if len(msg.Payload) > 0 {
				if _, writeErr := c.Writer.Write(msg.Payload); writeErr != nil {
					return nil, types.NewErrorWithStatusCode(
						fmt.Errorf(i18n.Translate("relay.failed_to_write_audio_data"), writeErr),
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
