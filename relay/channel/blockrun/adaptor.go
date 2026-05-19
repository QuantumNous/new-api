// Package blockrun implements the BlockRun channel adaptor.
//
// BlockRun (https://blockrun.ai) exposes an OpenAI-compatible Chat Completions
// endpoint that does NOT use API keys: each request is paid for on Base mainnet
// in USDC via the x402 v2 micropayment protocol. The "API key" stored on the
// channel is actually an EVM wallet private key (0x-prefixed hex). The flow:
//
//  1. Send the chat request without auth → upstream returns HTTP 402 with
//     payment requirements (base64 JSON) in the payment-required header.
//  2. Sign an EIP-712 / ERC-3009 TransferWithAuthorization with the wallet key.
//  3. Resend the same request with a PAYMENT-SIGNATURE: <base64> header.
//
// Trust boundary note: the same upstream that hosts the LLM also dictates the
// amount, recipient, and validity window of every signature. A compromised
// BlockRun (or a MITM if TLS is broken) could craft a 402 that authorises a
// year-long drain to an attacker address. signX402Payment enforces strict
// bounds (max 5-minute window, Base USDC asset only, ≤1 USDC per call) before
// signing. See x402.go.
//
// The private key never leaves the process — only the signature is transmitted.
// We reuse the audited EIP-712 implementation from BlockRun's official Go SDK
// (CreatePaymentPayload + ParsePaymentRequired) and write our own HTTP wrapper
// so streaming SSE responses are passed through unbuffered.
//
// Both the initial 402 dance and the signed retry go through newapi's standard
// channel.DoApiRequest path so HeaderOverride, proxy config, X-Request-Id
// capture, and SSE keep-alive ping all apply uniformly. The signed payload is
// handed from DoRequest to SetupRequestHeader via the gin context — see the
// ctxKeyPaymentSignature constant below.
package blockrun

import (
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// ctxKeyPaymentSignature is the gin.Context key under which DoRequest stashes
// the base64 PAYMENT-SIGNATURE payload between the first (un-signed) and the
// second (signed) attempts. SetupRequestHeader reads it and injects the header.
// This keeps the retry on the same channel.DoApiRequest path as the first call,
// so all newapi wrappers (HeaderOverride, proxy, request-id, SSE keep-alive)
// apply identically to both legs.
const ctxKeyPaymentSignature = "blockrun_payment_signature"

// Adaptor implements the channel.Adaptor interface for BlockRun. Most of the
// request/response shape is OpenAI-compatible, so we delegate body conversion
// and response handling to openai.Adaptor and only override DoRequest to
// handle the 402 → sign → 200 retry round trip.
type Adaptor struct {
	openaiAdaptor openai.Adaptor
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
	a.openaiAdaptor.Init(info)
}

// GetRequestURL builds the upstream URL. BlockRun ONLY exposes the
// OpenAI-compatible /v1/chat/completions endpoint — for Claude (Messages API)
// and Gemini (generateContent) inbound formats, newapi has already translated
// the request body via ConvertClaudeRequest / ConvertGeminiRequest, so we must
// override the inbound RequestURLPath (e.g. /v1/messages) to point at the
// OpenAI endpoint here. Otherwise BlockRun would 404. Mirrors openai.Adaptor's
// behaviour so Claude Code (ANTHROPIC_BASE_URL→newapi) routes correctly.
func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	if info.RelayFormat == types.RelayFormatClaude || info.RelayFormat == types.RelayFormatGemini {
		// Defensive: BlockRun has no responses-API surface, so RelayModeResponses
		// can't actually occur for this channel — but mirror openai.Adaptor's
		// guard to stay aligned if the upstream contract ever expands.
		if info.RelayMode != relayconstant.RelayModeResponses && info.RelayMode != relayconstant.RelayModeResponsesCompact {
			return fmt.Sprintf("%s/v1/chat/completions", info.ChannelBaseUrl), nil
		}
	}
	return relaycommon.GetFullRequestURL(info.ChannelBaseUrl, info.RequestURLPath, info.ChannelType), nil
}

// SetupRequestHeader sets the standard Content-Type / Accept headers and, on
// the retry leg, the PAYMENT-SIGNATURE header that DoRequest stashed in the
// gin.Context after parsing the 402. BlockRun does not accept Authorization —
// authentication is the EIP-712 signature.
func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)
	if c != nil {
		if sig := c.GetString(ctxKeyPaymentSignature); sig != "" {
			req.Set(headerPaymentSignature, sig)
		}
	}
	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if request == nil {
		return nil, errors.New("blockrun: request is nil")
	}
	// We are listed in streamSupportedChannels, so leave StreamOptions intact
	// and let BlockRun decide whether to honour stream_options.include_usage.
	return request, nil
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	return a.openaiAdaptor.ConvertClaudeRequest(c, info, request)
}

func (a *Adaptor) ConvertGeminiRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) (any, error) {
	return a.openaiAdaptor.ConvertGeminiRequest(c, info, request)
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return nil, errors.New("blockrun: rerank not supported")
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	return nil, errors.New("blockrun: embedding not supported")
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	return nil, errors.New("blockrun: audio not supported")
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	return nil, errors.New("blockrun: image not supported")
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	return nil, errors.New("blockrun: responses API not supported")
}

// DoRequest performs the x402 two-trip dance:
//
//  1. First attempt without signature → upstream returns 402 with requirements
//  2. Validate the requirements, sign with the wallet key
//  3. Stash the signature in the gin context and replay the request through
//     the same channel.DoApiRequest path so all standard wrappers apply
//  4. If the retry STILL returns 402 the signature was rejected — surface a
//     clear error instead of looping (which would burn more USDC trying).
func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	bodyBytes, err := cacheRequestBody(requestBody)
	if err != nil {
		return nil, err
	}

	firstResp, err := channel.DoApiRequest(a, c, info, bodyReader(bodyBytes))
	if err != nil {
		return nil, err
	}
	if firstResp.StatusCode != http.StatusPaymentRequired {
		return firstResp, nil
	}
	// 402 — drain & close the first response so the connection can be reused,
	// then sign and retry on the same code path.
	defer func() {
		_, _ = io.Copy(io.Discard, firstResp.Body)
		_ = firstResp.Body.Close()
	}()

	fullURL, urlErr := a.GetRequestURL(info)
	if urlErr != nil {
		return nil, fmt.Errorf("blockrun: get request url: %w", urlErr)
	}

	paymentB64, signErr := signX402Payment(firstResp, info.ApiKey, fullURL)
	if signErr != nil {
		return nil, signErr
	}

	c.Set(ctxKeyPaymentSignature, paymentB64)
	defer delete(c.Keys, ctxKeyPaymentSignature)

	retryResp, err := channel.DoApiRequest(a, c, info, bodyReader(bodyBytes))
	if err != nil {
		return nil, err
	}
	if retryResp.StatusCode == http.StatusPaymentRequired {
		// Signature was rejected (insufficient balance, replay, expired window,
		// payTo mismatch, …). Do NOT loop — every signed attempt risks an
		// on-chain settle. Surface the upstream body to help operators debug.
		body, _ := io.ReadAll(retryResp.Body)
		_ = retryResp.Body.Close()
		return nil, fmt.Errorf("blockrun: payment signature rejected by upstream (status 402 after signing): %s", string(body))
	}
	return retryResp, nil
}

// DoResponse delegates streaming and non-streaming chat completion handling to
// the OpenAI adaptor, since BlockRun's success response is bit-for-bit
// OpenAI-compatible (200 + same chat.completion JSON shape, with SSE for stream).
func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	return a.openaiAdaptor.DoResponse(c, resp, info)
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}
