package volcengine

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

// ----------------------------------------------------------------------------
// v3 payload structs (encoded via common.Marshal — Rule 1)
// ----------------------------------------------------------------------------

type v3UserMeta struct {
	UID string `json:"uid,omitempty"`
}

type v3StartSessionPayload struct {
	User      *v3UserMeta      `json:"user,omitempty"`
	Event     int32            `json:"event"`               // 100
	Namespace string           `json:"namespace,omitempty"` // BidirectionalTTS / UnidirectionalTTS
	ReqParams v3StartReqParams `json:"req_params"`
}

type v3StartReqParams struct {
	Text        string         `json:"text,omitempty"`     // unidirectional path: full text up-front
	Speaker     string         `json:"speaker"`
	Model       string         `json:"model,omitempty"`
	AudioParams v3AudioParams  `json:"audio_params"`
	Additions   string         `json:"additions,omitempty"` // raw JSON string per upstream contract
}

type v3AudioParams struct {
	Format          string   `json:"format,omitempty"`
	SampleRate      *int     `json:"sample_rate,omitempty"`     // Rule 6
	BitRate         *int     `json:"bit_rate,omitempty"`        // Rule 6
	SpeechRate      *int     `json:"speech_rate,omitempty"`     // Rule 6
	LoudnessRate    *int     `json:"loudness_rate,omitempty"`   // Rule 6
	Emotion         string   `json:"emotion,omitempty"`
	EmotionScale    *float64 `json:"emotion_scale,omitempty"`   // Rule 6
	EnableTimestamp *bool    `json:"enable_timestamp,omitempty"` // Rule 6
	EnableSubtitle  *bool    `json:"enable_subtitle,omitempty"`  // Rule 6
}

type v3TaskPayload struct {
	Event     int32           `json:"event"` // 200
	Namespace string          `json:"namespace,omitempty"`
	ReqParams v3TaskReqParams `json:"req_params"`
}

type v3TaskReqParams struct {
	Text string `json:"text"`
}

// v3SessionResultEnvelope is the common shape carried by SessionFinished /
// SessionFailed / ConnectionFailed payloads.
type v3SessionResultEnvelope struct {
	StatusCode int           `json:"status_code"`
	Message    string        `json:"message"`
	Usage      *v3UsageStats `json:"usage,omitempty"`
}

type v3UsageStats struct {
	TextWords int `json:"text_words"`
}

// ----------------------------------------------------------------------------
// Header / payload builders
// ----------------------------------------------------------------------------

// buildV3Headers builds the WS/HTTP request headers used by every v3 transport.
// connectID is always emitted so server-side troubleshooting is possible.
//
// Auth modes:
//   - new_console (default): the channel key is the new-console API Key sent
//     verbatim as X-Api-Key. Both formats are accepted for ergonomics:
//     * single segment "<api_key>" — new-console issued key (recommended).
//     * legacy "<app_id>|<access_token>" — second segment is used as X-Api-Key
//       and a deprecation hint is logged via the response error if upstream
//       rejects (since legacy access tokens are NOT valid X-Api-Key values).
//   - legacy: the channel key MUST be "<app_id>|<access_token>", split into
//     X-Api-App-Id + X-Api-Access-Key headers.
func buildV3Headers(cfg dto.VolcTTSConfig, apiKey, connectID string) (http.Header, error) {
	apiKey = strings.TrimSpace(apiKey)
	if apiKey == "" {
		return nil, errors.New("empty volcengine api key")
	}
	h := http.Header{}
	if cfg.EffectiveAuthMode() == dto.VolcTTSAuthModeLegacy {
		appID, token, err := parseVolcengineAuth(apiKey)
		if err != nil {
			return nil, err
		}
		h.Set("X-Api-App-Id", appID)
		h.Set("X-Api-Access-Key", token)
	} else {
		// new_console: single-segment key is the X-Api-Key as-is.
		// If the operator pasted the legacy "appid|token" format we still pick
		// the second segment, but note that an old access_token is generally
		// NOT a valid new-console API Key.
		key := apiKey
		if idx := strings.Index(apiKey, "|"); idx >= 0 {
			key = apiKey[idx+1:]
		}
		h.Set("X-Api-Key", key)
	}
	h.Set("X-Api-Resource-Id", cfg.EffectiveResourceID())
	h.Set("X-Api-Connect-Id", connectID)
	if cfg.ShouldRequireUsage() {
		h.Set("X-Control-Require-Usage-Tokens-Return", "*")
	}
	return h, nil
}

// buildV3StartSessionPayload converts the v1 request shape into a v3 StartSession payload.
func buildV3StartSessionPayload(vReq VolcengineTTSRequest, encoding string, namespace string, includeText bool) v3StartSessionPayload {
	speedPtr := mapV1SpeedToV3(vReq.Audio.SpeedRatio)
	audio := v3AudioParams{
		Format:     encoding,
		SampleRate: intPtr(vReq.Audio.Rate),
		SpeechRate: speedPtr,
	}
	if vReq.Audio.Bitrate > 0 {
		audio.BitRate = intPtr(vReq.Audio.Bitrate)
	}
	if vReq.Audio.LoudnessRatio != 0 {
		audio.LoudnessRate = intPtr(int(vReq.Audio.LoudnessRatio))
	}
	if vReq.Audio.EnableEmotion && vReq.Audio.Emotion != "" {
		audio.Emotion = vReq.Audio.Emotion
		if vReq.Audio.EmotionScale != 0 {
			s := vReq.Audio.EmotionScale
			audio.EmotionScale = &s
		}
	}

	payload := v3StartSessionPayload{
		User:      &v3UserMeta{UID: vReq.User.UID},
		Event:     int32(EventType_StartSession),
		Namespace: namespace,
		ReqParams: v3StartReqParams{
			Speaker:     vReq.Audio.VoiceType,
			Model:       vReq.Request.Model,
			AudioParams: audio,
		},
	}
	if includeText {
		payload.ReqParams.Text = vReq.Request.Text
	}
	return payload
}

// mapV1SpeedToV3 maps v1 speed_ratio (float around 1.0) to v3 speech_rate (int [-50, 100]).
// 1.0 → 0 (default), 2.0 → 100, 0.5 → -50. Returns nil if the v1 ratio is the implicit default 0.
func mapV1SpeedToV3(v1 float64) *int {
	if v1 == 0 {
		return nil
	}
	// v3 spec: 100 == 2.0x, -50 == 0.5x, 0 == 1.0x. Linear mapping piecewise.
	var rate int
	if v1 >= 1 {
		rate = int((v1 - 1.0) * 100.0)
	} else {
		rate = int((v1 - 1.0) * 100.0) // gives negative
	}
	if rate > 100 {
		rate = 100
	} else if rate < -50 {
		rate = -50
	}
	return &rate
}

func intPtr(v int) *int {
	if v == 0 {
		return nil
	}
	return &v
}

// ----------------------------------------------------------------------------
// Main entry point
// ----------------------------------------------------------------------------

// handleTTSV3WSResponse drives a single OpenAI /v1/audio/speech (+stream)
// request through Volcengine v3 bidirectional or unidirectional WebSocket.
// Audio bytes are written directly to c.Writer (chunked transfer); usage is
// returned as *dto.Usage so the caller (audio_handler.go) can bill via
// service.PostAudioConsumeQuota.
func handleTTSV3WSResponse(c *gin.Context, requestURL string, vReq VolcengineTTSRequest, info *relaycommon.RelayInfo, encoding string, cfg dto.VolcTTSConfig) (any, *types.NewAPIError) {
	connectID := uuid.NewString()
	header, err := buildV3Headers(cfg, info.ApiKey, connectID)
	if err != nil {
		return nil, types.NewErrorWithStatusCode(err, types.ErrorCodeChannelInvalidKey, http.StatusUnauthorized)
	}

	dialer := websocket.DefaultDialer
	dialCtx, cancelDial := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancelDial()
	conn, resp, dialErr := dialer.DialContext(dialCtx, requestURL, header)
	if dialErr != nil {
		statusCode := http.StatusBadGateway
		hint := ""
		if resp != nil {
			statusCode = resp.StatusCode
			if logID := resp.Header.Get("X-Tt-Logid"); logID != "" {
				hint = fmt.Sprintf(" logid=%s", logID)
			}
		}
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf("volcengine v3 dial failed: %w%s", dialErr, hint),
			types.ErrorCodeBadResponseStatusCode,
			statusCode,
		)
	}
	defer conn.Close()

	// Capture upstream logid (best-effort; ignore if absent).
	if resp != nil {
		if logID := resp.Header.Get("X-Tt-Logid"); logID != "" {
			c.Header("X-Volc-Logid", logID)
		}
	}

	// Step 1: StartConnection
	if sErr := EventClientRequest(conn, EventType_StartConnection, "", nil); sErr != nil {
		return nil, v3WrapError(sErr, "send StartConnection failed")
	}
	if apiErr := v3ExpectEvent(conn, EventType_ConnectionStarted, EventType_ConnectionFailed); apiErr != nil {
		return nil, apiErr
	}

	// Step 2: StartSession
	sessionID := uuid.NewString()
	namespace, includeText := v3NamespaceAndTextMode(cfg)
	startPayload := buildV3StartSessionPayload(vReq, encoding, namespace, includeText)
	startBytes, marshalErr := common.Marshal(startPayload)
	if marshalErr != nil {
		return nil, v3WrapError(marshalErr, "marshal StartSession payload failed")
	}
	if sErr := EventClientRequest(conn, EventType_StartSession, sessionID, startBytes); sErr != nil {
		return nil, v3WrapError(sErr, "send StartSession failed")
	}
	if apiErr := v3ExpectEvent(conn, EventType_SessionStarted, EventType_SessionFailed); apiErr != nil {
		return nil, apiErr
	}

	// Step 3 (bidirectional only): TaskRequest carrying the text.
	if !includeText {
		taskPayload := v3TaskPayload{
			Event:     int32(EventType_TaskRequest),
			Namespace: namespace,
			ReqParams: v3TaskReqParams{Text: vReq.Request.Text},
		}
		taskBytes, marshalErr := common.Marshal(taskPayload)
		if marshalErr != nil {
			return nil, v3WrapError(marshalErr, "marshal TaskRequest payload failed")
		}
		if sErr := EventClientRequest(conn, EventType_TaskRequest, sessionID, taskBytes); sErr != nil {
			return nil, v3WrapError(sErr, "send TaskRequest failed")
		}
	}

	// Step 4: FinishSession (signals upstream we are done feeding text).
	if sErr := EventClientRequest(conn, EventType_FinishSession, sessionID, nil); sErr != nil {
		return nil, v3WrapError(sErr, "send FinishSession failed")
	}

	// Step 5: prepare response stream + drain audio
	contentType := getContentTypeByEncoding(encoding)
	c.Header("Content-Type", contentType)
	c.Header("Transfer-Encoding", "chunked")

	usage := &dto.Usage{}
	wroteAny := false

drainLoop:
	for {
		msg, recvErr := ReceiveMessage(conn)
		if recvErr != nil {
			if websocket.IsCloseError(recvErr, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
				break drainLoop
			}
			return nil, v3WrapError(recvErr, "recv frame failed")
		}

		switch msg.MsgType {
		case MsgTypeError:
			return nil, types.NewErrorWithStatusCode(
				fmt.Errorf("volcengine v3 error frame: code=%d body=%s", msg.ErrorCode, string(msg.Payload)),
				types.ErrorCodeBadResponse,
				http.StatusBadGateway,
			)
		case MsgTypeAudioOnlyServer:
			if msg.EventType == EventType_TTSResponse && len(msg.Payload) > 0 {
				if _, wErr := c.Writer.Write(msg.Payload); wErr != nil {
					return nil, v3WrapError(wErr, "write audio chunk to client failed")
				}
				c.Writer.Flush()
				wroteAny = true
			}
			// negative-sequence audio frames mark stream end (legacy v1 cue);
			// rely on SessionFinished from full-server-response frames instead.
		case MsgTypeFullServerResponse:
			switch msg.EventType {
			case EventType_TTSSentenceStart, EventType_TTSSentenceEnd, EventType_TTSResponse:
				// Subtitle / sentence boundary — currently swallowed since clients
				// receive raw audio bytes only. Reserve for future passthrough.
			case EventType_SessionFinished:
				if env := parseV3SessionResult(msg.Payload); env != nil && env.Usage != nil {
					usage.PromptTokens = env.Usage.TextWords
					usage.TotalTokens = env.Usage.TextWords
				}
				break drainLoop
			case EventType_SessionFailed:
				env := parseV3SessionResult(msg.Payload)
				return nil, types.NewErrorWithStatusCode(
					fmt.Errorf("volcengine v3 session failed: status=%s msg=%s",
						envStatus(env), envMessage(env)),
					types.ErrorCodeBadResponse,
					http.StatusBadGateway,
				)
			case EventType_ConnectionFailed:
				env := parseV3SessionResult(msg.Payload)
				return nil, types.NewErrorWithStatusCode(
					fmt.Errorf("volcengine v3 connection failed: status=%s msg=%s",
						envStatus(env), envMessage(env)),
					types.ErrorCodeBadResponse,
					http.StatusBadGateway,
				)
			case EventType_TTSEnded:
				// some providers send TTSEnded ahead of SessionFinished — drain until SessionFinished
			}
		}
	}

	// Best-effort: tell the server we're done; ignore any response/timeout.
	_ = EventClientRequest(conn, EventType_FinishConnection, "", nil)
	_ = conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, _ = ReceiveMessage(conn) // ConnectionFinished or close — both fine

	if !wroteAny {
		return nil, types.NewErrorWithStatusCode(
			errors.New("volcengine v3 finished without delivering audio"),
			types.ErrorCodeBadResponse,
			http.StatusBadGateway,
		)
	}

	if usage.PromptTokens == 0 {
		// Fall back to estimated character count when usage event is absent.
		est := info.GetEstimatePromptTokens()
		usage.PromptTokens = est
		usage.TotalTokens = est
	}
	return usage, nil
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

func v3NamespaceAndTextMode(cfg dto.VolcTTSConfig) (namespace string, includeText bool) {
	if cfg.Protocol == dto.VolcTTSProtocolV3WsUni {
		return "UnidirectionalTTS", true
	}
	return "BidirectionalTTS", false
}

func v3WrapError(err error, hint string) *types.NewAPIError {
	return types.NewErrorWithStatusCode(
		fmt.Errorf("%s: %w", hint, err),
		types.ErrorCodeBadResponse,
		http.StatusBadGateway,
	)
}

// v3ExpectEvent blocks until either the success event or the failure event
// arrives. Any other event (e.g. SentenceStart) is swallowed; an MsgTypeError
// frame surfaces immediately.
func v3ExpectEvent(conn *websocket.Conn, success, failure EventType) *types.NewAPIError {
	for {
		msg, err := ReceiveMessage(conn)
		if err != nil {
			return v3WrapError(err, fmt.Sprintf("waiting for %s", success))
		}
		switch msg.MsgType {
		case MsgTypeError:
			return types.NewErrorWithStatusCode(
				fmt.Errorf("volcengine v3 error frame: code=%d body=%s", msg.ErrorCode, string(msg.Payload)),
				types.ErrorCodeBadResponse,
				http.StatusBadGateway,
			)
		case MsgTypeFullServerResponse:
			switch msg.EventType {
			case success:
				return nil
			case failure:
				env := parseV3SessionResult(msg.Payload)
				return types.NewErrorWithStatusCode(
					fmt.Errorf("volcengine v3 %s: status=%s msg=%s",
						strings.ReplaceAll(failure.String(), "EventType_", ""),
						envStatus(env), envMessage(env)),
					types.ErrorCodeBadResponse,
					http.StatusBadGateway,
				)
			}
		}
	}
}

func parseV3SessionResult(payload []byte) *v3SessionResultEnvelope {
	if len(payload) == 0 {
		return nil
	}
	env := &v3SessionResultEnvelope{}
	if err := common.Unmarshal(payload, env); err != nil {
		return nil
	}
	return env
}

func envStatus(env *v3SessionResultEnvelope) string {
	if env == nil {
		return "?"
	}
	return fmt.Sprintf("%d", env.StatusCode)
}

func envMessage(env *v3SessionResultEnvelope) string {
	if env == nil {
		return ""
	}
	return env.Message
}
