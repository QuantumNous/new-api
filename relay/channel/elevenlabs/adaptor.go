// Package elevenlabs adapts ElevenLabs' native voice/SFX endpoints
// (POST /v1/text-to-speech/{voice_id}, GET /v1/voices, POST /v1/sound-generation,
// to the flatkey gateway. Clients authenticate with their flatkey
// Bearer key; the gateway forwards the request verbatim to api.elevenlabs.io with
// the channel's key in the xi-api-key header and streams the audio bytes back.
//
// Billing is metered as PromptTokens via PostTextConsumeQuota, with a per-model
// ratio chosen so the effective price matches ElevenLabs' official rates:
//   - eleven_multilingual_v2 : PromptTokens = input characters   (ratio 50   -> $0.10 / 1k chars)
//   - eleven_sound_v1        : PromptTokens = requested seconds   (ratio 1000 -> $0.12 / min)
//
// The helper (relay.ElevenLabsHelper) computes and sets the estimate before the call.
package elevenlabs

import (
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

const DefaultBaseURL = "https://api.elevenlabs.io"

type Adaptor struct{}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {}

// GetRequestURL forwards the exact inbound path to the ElevenLabs base URL, so
// /v1/text-to-speech/{voice_id}, /v1/voices and /v1/sound-generation all
// map straight through without per-endpoint URL logic.
func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	base := strings.TrimSuffix(info.ChannelBaseUrl, "/")
	if base == "" {
		base = DefaultBaseURL
	}
	return base + info.RequestURLPath, nil
}

// SetupRequestHeader swaps the client's Bearer auth (already stripped by the token
// middleware) for ElevenLabs' xi-api-key using the channel's upstream key.
func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	req.Set("xi-api-key", info.ApiKey)
	if ct := c.Request.Header.Get("Content-Type"); ct != "" {
		req.Set("Content-Type", ct)
	} else {
		req.Set("Content-Type", "application/json")
	}
	if accept := c.Request.Header.Get("Accept"); accept != "" {
		req.Set("Accept", accept)
	}
	return nil
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
}

// DoResponse streams the upstream audio (or JSON, for /v1/voices) straight back to
// the client and reports usage = the pre-computed estimate so the caller settles the
// per-model quota.
func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)
	for k, v := range resp.Header {
		if !service.ShouldCopyUpstreamHeader(c, k, v) || len(v) == 0 {
			continue
		}
		c.Writer.Header().Set(k, v[0])
	}
	c.Writer.WriteHeader(resp.StatusCode)
	if _, err := io.Copy(c.Writer, resp.Body); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	usage := &dto.Usage{}
	usage.PromptTokens = info.GetEstimatePromptTokens()
	usage.TotalTokens = usage.PromptTokens
	return usage, nil
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return "ElevenLabs"
}

// ── Unsupported OpenAI-shaped conversions (ElevenLabs uses native endpoints via the
//    dedicated ElevenLabsHelper passthrough, not these Convert* paths) ──────────────

var errUnsupported = errors.New("elevenlabs: endpoint not supported; use the native /v1 voice routes")

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	return nil, errUnsupported
}
func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return nil, errUnsupported
}
func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	return nil, errUnsupported
}
func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	return nil, errUnsupported
}
func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	return nil, errUnsupported
}
func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	return nil, errUnsupported
}
func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	return nil, errUnsupported
}
func (a *Adaptor) ConvertGeminiRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) (any, error) {
	return nil, errUnsupported
}
