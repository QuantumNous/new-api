// Package blockrun implements the BlockRun channel adaptor.
//
// BlockRun (https://blockrun.ai) exposes VIP NATIVE passthrough endpoints that
// do NOT use API keys: each request is paid for on Base mainnet in USDC via the
// x402 v2 micropayment protocol. The "API key" stored on the channel is actually
// an EVM wallet private key (0x-prefixed hex). The flow:
//
//  1. Send the request without auth → upstream returns HTTP 402 with payment
//     requirements (base64 JSON) in the payment-required header.
//  2. Sign an EIP-712 / ERC-3009 TransferWithAuthorization with the wallet key.
//  3. Resend the same request with a PAYMENT-SIGNATURE: <base64> header.
//
// Native passthrough: this adaptor dispatches by info.RelayFormat. Anthropic
// inbound is forwarded to /v1/messages and handled by the native claude
// handler (preserving thinking signatures, native content blocks, cache tokens,
// native SSE); OpenAI inbound is forwarded to /v1/chat/completions and handled
// by the native openai handler. There is ZERO model substitution and ZERO
// response reshaping. Gemini inbound is not supported (VIP only covers Anthropic
// and OpenAI).
//
// Trust boundary note: the same upstream that hosts the LLM also dictates the
// amount, recipient, and validity window of every signature. A compromised
// BlockRun (or a MITM if TLS is broken) could craft a 402 that authorises a
// year-long drain to an attacker address. SignX402Payment enforces strict
// bounds (max 5-minute window, Base USDC asset only, ≤5 USDC per call) before
// signing. See x402.go.
//
// The private key never leaves the process — only the signature is transmitted.
// SetupRequestHeader NEVER sets x-api-key or Authorization (unlike the claude /
// openai adaptors it delegates response handling to), precisely because
// info.ApiKey is the wallet private key. We reuse the audited EIP-712
// implementation from BlockRun's official Go SDK (CreatePaymentPayload +
// ParsePaymentRequired) and keep our own HTTP wrapper so streaming SSE responses
// are passed through unbuffered.
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
	"net/url"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/pkg/apicompat"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/claude"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
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

// defaultAnthropicVersion is sent on the Claude (Messages API) leg when the
// client did not supply an anthropic-version header.
const defaultAnthropicVersion = "2023-06-01"

// Adaptor implements the channel.Adaptor interface for BlockRun as a VIP native
// passthrough. It embeds BOTH the openai and claude adaptors and dispatches each
// interface method by info.RelayFormat: Claude inbound is forwarded natively to
// /v1/messages and handled by claudeAdaptor; everything else (OpenAI / default)
// goes to /v1/chat/completions and is handled by openaiAdaptor. We override
// GetRequestURL, SetupRequestHeader, the Convert* methods, and DoRequest so the
// x402 payment dance and the wallet-key safety red line apply to both formats;
// only DoResponse delegates to the embedded adaptors.
type Adaptor struct {
	openaiAdaptor openai.Adaptor
	claudeAdaptor claude.Adaptor
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
	a.openaiAdaptor.Init(info)
	a.claudeAdaptor.Init(info)
}

// GetRequestURL builds the upstream URL. Image relay modes are dispatched first
// to their dedicated BlockRun endpoints (independent of RelayFormat). Responses
// is bridged through BlockRun's chat-completions endpoint because BlockRun does
// not currently expose a native /v1/responses route. The rest is VIP native
// passthrough: Anthropic → /v1/messages, OpenAI → /v1/chat/completions, Gemini
// rejected.
func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	switch info.RelayMode {
	case relayconstant.RelayModeImagesGenerations:
		return fmt.Sprintf("%s/v1/images/generations", info.ChannelBaseUrl), nil
	case relayconstant.RelayModeImagesEdits:
		// BlockRun img2img / multi-image fusion endpoint (JSON + base64).
		return fmt.Sprintf("%s/v1/images/image2image", info.ChannelBaseUrl), nil
	case relayconstant.RelayModeResponses:
		return fmt.Sprintf("%s/v1/chat/completions", info.ChannelBaseUrl), nil
	case relayconstant.RelayModeResponsesCompact:
		return "", errors.New("blockrun: responses compact API not supported")
	}
	switch info.RelayFormat {
	case types.RelayFormatClaude:
		requestURL := fmt.Sprintf("%s/v1/messages", info.ChannelBaseUrl)
		if !shouldAppendClaudeBetaQuery(info) {
			return requestURL, nil
		}
		parsedURL, err := url.Parse(requestURL)
		if err != nil {
			return "", err
		}
		query := parsedURL.Query()
		query.Set("beta", "true")
		parsedURL.RawQuery = query.Encode()
		return parsedURL.String(), nil
	case types.RelayFormatGemini:
		return "", errors.New("blockrun: gemini format not supported (VIP native passthrough supports only Anthropic and OpenAI)")
	default:
		// OpenAI / default → native /v1/chat/completions.
		return fmt.Sprintf("%s/v1/chat/completions", info.ChannelBaseUrl), nil
	}
}

// shouldAppendClaudeBetaQuery mirrors claude/adaptor.go: append ?beta=true when
// the inbound request carried it or the channel forces it.
func shouldAppendClaudeBetaQuery(info *relaycommon.RelayInfo) bool {
	if info == nil {
		return false
	}
	if info.IsClaudeBetaQuery {
		return true
	}
	if info.ChannelOtherSettings.ClaudeBetaQuery {
		return true
	}
	return false
}

// SetupRequestHeader sets content-type/accept and, on the signed retry leg, the
// PAYMENT-SIGNATURE header that DoRequest stashed in the gin.Context after parsing
// the 402.
//
// SECURITY CRITICAL: info.ApiKey is the EVM WALLET PRIVATE KEY for this channel.
// We MUST NOT set "x-api-key" or "Authorization" — the claude/openai adaptors set
// those by default, which is exactly why we override here and do NOT delegate.
// Authentication is the EIP-712 x402 signature, never a transmitted secret.
func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)

	// Image legs always send a JSON body (generations passthrough / image2image),
	// so force application/json. channel.SetupApiRequestHeader copies the inbound
	// Content-Type verbatim, which would otherwise forward a multipart/form-data
	// header (from a multipart edits request) over our JSON body and break parsing.
	if info.RelayMode == relayconstant.RelayModeImagesGenerations || info.RelayMode == relayconstant.RelayModeImagesEdits {
		req.Set("Content-Type", "application/json")
	}

	if info.RelayFormat == types.RelayFormatClaude {
		// Native Anthropic Messages API leg. Use the client's incoming
		// anthropic-version (default 2023-06-01) and pass through anthropic-beta.
		// Do NOT call ClaudeSettings.WriteHeaders: namespaced model names
		// (anthropic/claude-*) won't match and it deviates from pure passthrough.
		anthropicVersion := ""
		anthropicBeta := ""
		if c != nil && c.Request != nil {
			anthropicVersion = c.Request.Header.Get("anthropic-version")
			anthropicBeta = c.Request.Header.Get("anthropic-beta")
		}
		if anthropicVersion == "" {
			anthropicVersion = defaultAnthropicVersion
		}
		req.Set("anthropic-version", anthropicVersion)
		if anthropicBeta != "" {
			req.Set("anthropic-beta", anthropicBeta)
		}
	}

	if c != nil {
		if sig := c.GetString(ctxKeyPaymentSignature); sig != "" {
			req.Set(headerPaymentSignature, sig)
		}
	}
	return nil
}

// ConvertOpenAIRequest is a near passthrough. We are listed in
// streamSupportedChannels, so StreamOptions is left intact and BlockRun decides
// whether to honour stream_options.include_usage.
func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if request == nil {
		return nil, errors.New("blockrun: request is nil")
	}
	// parallel_tool_calls is only valid when tools are specified; otherwise the
	// upstream rejects with "'parallel_tool_calls' is only allowed when 'tools'
	// are specified". Drop it here since this adaptor passes the request through.
	if len(request.Tools) == 0 {
		request.ParallelTooCalls = nil
	}
	return request, nil
}

// ConvertClaudeRequest is a NATIVE passthrough: the inbound Anthropic Messages
// request is forwarded as-is to /v1/messages. We no longer convert to OpenAI.
func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	if request == nil {
		return nil, errors.New("blockrun: request is nil")
	}
	return request, nil
}

func (a *Adaptor) ConvertGeminiRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) (any, error) {
	return nil, errors.New("blockrun: gemini format not supported (VIP native passthrough supports only Anthropic and OpenAI)")
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

// ConvertImageRequest dispatches by image relay mode. Text-to-image
// (generations) is an OpenAI-compatible JSON passthrough → /v1/images/generations.
// Image-to-image (edits) accepts a standard OpenAI multipart/form-data request
// (binary files in `image` / `image[]` / `mask` fields); new-api reads the files,
// base64-encodes them, and forwards a JSON body to BlockRun's
// /v1/images/image2image. The upstream wire format (JSON + base64 data URI) is
// unchanged; only the client-facing interface changed from JSON+base64 to standard
// OpenAI multipart.
func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	if request.Model == "" {
		return nil, errors.New("blockrun: image model is required")
	}
	// BlockRun's image endpoints don't understand stream/partial_images: SSE is
	// synthesized locally (image_stream.go). Record the intent, then strip both
	// so they never reach the upstream body.
	if request.Stream != nil && *request.Stream {
		info.IsStream = true
	}
	request.Stream = nil
	request.PartialImages = nil
	switch info.RelayMode {
	case relayconstant.RelayModeImagesGenerations:
		// OpenAI-compatible text-to-image: pass the request through unchanged.
		return a.openaiAdaptor.ConvertImageRequest(c, info, request)
	case relayconstant.RelayModeImagesEdits:
		return buildImage2ImageEditBody(c, &request)
	default:
		return nil, errors.New("blockrun: unsupported image relay mode")
	}
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	if request.Model == "" {
		return nil, errors.New("blockrun: responses model is required")
	}
	return blockRunResponsesRequestToChat(request)
}

func blockRunResponsesRequestToChat(request dto.OpenAIResponsesRequest) (*apicompat.ChatCompletionsRequest, error) {
	jsonData, err := common.Marshal(request)
	if err != nil {
		return nil, err
	}
	var responsesReq apicompat.ResponsesRequest
	if err := common.Unmarshal(jsonData, &responsesReq); err != nil {
		return nil, err
	}
	chatReq, err := apicompat.ResponsesToChatCompletionsRequest(&responsesReq)
	if err != nil {
		return nil, err
	}
	if request.StreamOptions != nil {
		chatReq.StreamOptions = &apicompat.ChatStreamOptions{
			IncludeUsage: request.StreamOptions.IncludeUsage,
		}
	}
	return chatReq, nil
}

// DoRequest performs the x402 two-trip dance. It is FORMAT-AGNOSTIC and works
// identically for /v1/messages and /v1/chat/completions:
//
//  1. First attempt without signature → upstream returns 402 with requirements
//  2. Validate the requirements, sign with the wallet key (SignX402Payment)
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
		// Free/proxy path (no 402): there is no signature to reuse on a poll;
		// resolveImageResult passes "" and a slow-path poll will surface the
		// upstream 402 as a hard error, which is the correct operator signal.
		return resolveImageResult(c, info, firstResp, "")
	}
	// 402 — the payment requirements live in the HEADERS (extractPaymentRequired
	// never reads the body), so drain & close the body NOW to return this
	// connection to the pool. A defer here would pin the connection for the
	// whole retry leg — which for slow images includes a minutes-long poll.
	// Bound the drain: a misbehaving/huge 402 body must not stall the retry.
	_, _ = io.CopyN(io.Discard, firstResp.Body, 512<<10)
	_ = firstResp.Body.Close()

	fullURL, urlErr := a.GetRequestURL(info)
	if urlErr != nil {
		return nil, fmt.Errorf("blockrun: get request url: %w", urlErr)
	}

	// Image endpoints (sync fast path or async 202+poll) advertise a longer
	// authorization window — the same signature must stay valid through
	// generation, whether the request is held open or polled — so raise the
	// window cap for them; chat keeps the default 300s window. Amount cap
	// stays at the default $5.
	var paymentB64 string
	var signErr error
	if info.RelayMode == relayconstant.RelayModeImagesGenerations || info.RelayMode == relayconstant.RelayModeImagesEdits {
		paymentB64, signErr = SignX402PaymentWithCaps(firstResp, info.ApiKey, fullURL, maxAmountAtomicUSDC, maxImageAuthorizationWindowSeconds)
	} else {
		paymentB64, signErr = SignX402Payment(firstResp, info.ApiKey, fullURL)
	}
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
	return resolveImageResult(c, info, retryResp, paymentB64)
}

// DoResponse delegates to the native handler for the inbound format so the
// upstream bytes are returned without reshaping. Claude inbound → native Claude
// SSE/JSON (thinking signatures, native content blocks, cache tokens); OpenAI
// inbound → native OpenAI chat.completion shape. Image modes are handled first:
// streaming images go through streamImageResponse; non-streaming images go
// through imageJSONResponseB64 (downloads URL→base64 for whitelabelling).
//
// Note on /v1/messages/count_tokens: there is no RelayMode for count_tokens in
// relay/constant, so that path cannot route to this adaptor today — out of scope.
func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	if isImageStreamMode(c, info) {
		return streamImageResponse(c, resp, info)
	}
	if isImageMode(info) {
		return imageJSONResponseB64(c, resp, info)
	}
	// Capture the upstream response body's top-level id (chatcmpl-* / msg-*) —
	// BlockRun's "CallTransaction.id" — into the gin context so RecordConsumeLog
	// persists it as logs.upstream_request_id for per-call reconciliation/溯源.
	// Structure-aware (json for non-stream, first-id sniff for SSE) so it survives
	// tool-call bodies; native passthrough and streaming SSE are unaffected.
	captureUpstreamID(c, resp, info)
	if info.RelayMode == relayconstant.RelayModeResponses {
		return blockRunChatResponseToResponses(c, resp, info)
	}
	if info.RelayFormat == types.RelayFormatClaude {
		return a.claudeAdaptor.DoResponse(c, resp, info)
	}
	return a.openaiAdaptor.DoResponse(c, resp, info)
}

func blockRunChatResponseToResponses(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	if info != nil && info.IsStream {
		return blockRunChatStreamToResponses(c, resp, info)
	}
	return blockRunChatJSONToResponses(c, resp, info)
}

func blockRunChatJSONToResponses(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		return nil, types.NewOpenAIError(fmt.Errorf("invalid response"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}
	defer service.CloseResponseBodyGracefully(resp)

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}

	var chatResp apicompat.ChatCompletionsResponse
	if err := common.Unmarshal(body, &chatResp); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	model := ""
	if info != nil {
		model = info.UpstreamModelName
	}
	responsesResp := apicompat.ChatCompletionsResponseToResponses(&chatResp, model)
	responseBody, err := common.Marshal(responsesResp)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeJsonMarshalFailed, http.StatusInternalServerError)
	}

	service.IOCopyBytesGracefully(c, resp, responseBody)
	return chatUsageToDTO(chatResp.Usage), nil
}

func blockRunChatStreamToResponses(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		return nil, types.NewOpenAIError(fmt.Errorf("invalid response"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}

	model := ""
	if info != nil {
		model = info.UpstreamModelName
	}
	state := apicompat.NewChatCompletionsToResponsesStreamState(model)
	var streamErr *types.NewAPIError

	helper.StreamScannerHandler(c, resp, info, func(data string, sr *helper.StreamResult) {
		var chunk apicompat.ChatCompletionsChunk
		if err := common.UnmarshalJsonStr(data, &chunk); err != nil {
			streamErr = types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
			sr.Error(err)
			return
		}
		for _, evt := range apicompat.ChatCompletionsChunkToResponsesEvents(&chunk, state) {
			if err := writeBlockRunResponsesEvent(c, evt); err != nil {
				streamErr = types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusInternalServerError)
				sr.Error(err)
				return
			}
		}
	})
	if streamErr != nil {
		return nil, streamErr
	}
	for _, evt := range apicompat.FinalizeChatCompletionsResponsesStream(state) {
		if err := writeBlockRunResponsesEvent(c, evt); err != nil {
			return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponse, http.StatusInternalServerError)
		}
	}
	helper.Done(c)
	return responsesUsageToDTO(state.Usage), nil
}

func writeBlockRunResponsesEvent(c *gin.Context, evt apicompat.ResponsesStreamEvent) error {
	jsonData, err := common.Marshal(evt)
	if err != nil {
		return err
	}
	c.Render(-1, common.CustomEvent{Data: fmt.Sprintf("event: %s\n", evt.Type)})
	c.Render(-1, common.CustomEvent{Data: "data: " + string(jsonData)})
	return helper.FlushWriter(c)
}

func chatUsageToDTO(usage *apicompat.ChatUsage) *dto.Usage {
	if usage == nil {
		return &dto.Usage{}
	}
	out := &dto.Usage{
		PromptTokens:     usage.PromptTokens,
		CompletionTokens: usage.CompletionTokens,
		TotalTokens:      usage.TotalTokens,
	}
	if out.TotalTokens == 0 {
		out.TotalTokens = out.PromptTokens + out.CompletionTokens
	}
	if usage.PromptTokensDetails != nil {
		out.PromptTokensDetails.CachedTokens = usage.PromptTokensDetails.CachedTokens
	}
	return out
}

func responsesUsageToDTO(usage *apicompat.ResponsesUsage) *dto.Usage {
	if usage == nil {
		return &dto.Usage{}
	}
	out := &dto.Usage{
		PromptTokens:     usage.InputTokens,
		CompletionTokens: usage.OutputTokens,
		TotalTokens:      usage.TotalTokens,
	}
	if out.TotalTokens == 0 {
		out.TotalTokens = out.PromptTokens + out.CompletionTokens
	}
	if usage.InputTokensDetails != nil {
		out.PromptTokensDetails.CachedTokens = usage.InputTokensDetails.CachedTokens
	}
	if usage.OutputTokensDetails != nil {
		out.CompletionTokenDetails.ReasoningTokens = usage.OutputTokensDetails.ReasoningTokens
	}
	return out
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}
