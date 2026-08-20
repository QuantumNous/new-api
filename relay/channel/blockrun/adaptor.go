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
// native SSE); OpenAI Chat inbound is forwarded to /v1/chat/completions, while
// OpenAI Responses inbound is forwarded to /v1/responses. Both are handled by
// the native openai response handlers. There is ZERO model substitution;
// Responses uses the shared typed-remarshal request pipeline and semantic SSE
// handling rather than byte-for-byte passthrough. Gemini inbound is not supported
// (VIP only covers Anthropic and OpenAI).
//
// Trust boundary note: the same upstream that hosts the LLM also dictates the
// amount, recipient, and validity window of every signature. A compromised
// BlockRun (or a MITM if TLS is broken) could craft a 402 that authorises a
// year-long drain to an attacker address. SignX402Payment enforces strict
// bounds (max 5-minute window, Base USDC asset only, valid positive amount)
// before signing. See x402.go.
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
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"net/url"
	"strings"

	blockrunSDK "github.com/BlockRunAI/blockrun-llm-go"
	common2 "github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/claude"
	"github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"

	ethcrypto "github.com/ethereum/go-ethereum/crypto"
	"github.com/gin-gonic/gin"
	"github.com/tidwall/sjson"
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

const (
	headerBlockRunFacilitator = "X-Blockrun-Facilitator"
	headerPayerWallet         = "X-Payer-Wallet"
	blockRunFacilitator       = "figment"
)

var blockRunProtectedPaymentHeaders = map[string]struct{}{
	"payment-signature":      {},
	"x-payment":              {},
	"x-blockrun-facilitator": {},
	"x-payer-wallet":         {},
}

// Adaptor implements the channel.Adaptor interface for BlockRun as a VIP native
// passthrough. It embeds BOTH the openai and claude adaptors and dispatches each
// interface method by info.RelayFormat: Claude inbound is forwarded natively to
// /v1/messages and handled by claudeAdaptor; OpenAI Chat goes to
// /v1/chat/completions; OpenAI Responses goes to /v1/responses. We override
// GetRequestURL, SetupRequestHeader, the Convert* methods, and DoRequest so the
// x402 payment dance and the wallet-key safety red line apply to every format;
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
// uses BlockRun's native /v1/responses endpoint. The rest is VIP native
// passthrough: Anthropic → /v1/messages, OpenAI Chat → /v1/chat/completions,
// Gemini rejected.
func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	if _, _, err := validateBlockRunPaymentConfig(info); err != nil {
		return "", err
	}
	switch info.RelayMode {
	case relayconstant.RelayModeImagesGenerations:
		return fmt.Sprintf("%s/v1/images/generations", info.ChannelBaseUrl), nil
	case relayconstant.RelayModeImagesEdits:
		// BlockRun img2img / multi-image fusion endpoint (JSON + base64).
		return fmt.Sprintf("%s/v1/images/image2image", info.ChannelBaseUrl), nil
	case relayconstant.RelayModeResponses:
		return fmt.Sprintf("%s/v1/responses", info.ChannelBaseUrl), nil
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
	chain, payer, err := validateBlockRunPaymentConfig(info)
	if err != nil {
		return err
	}
	if err := rejectProtectedPaymentHeaderOverrides(info); err != nil {
		return err
	}
	channel.SetupApiRequestHeader(info, c, req)
	if chain == dto.BlockRunPaymentChainSolana {
		req.Set(headerBlockRunFacilitator, blockRunFacilitator)
		req.Set(headerPayerWallet, payer)
	}

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
	// BlockRun's native Responses endpoint rejects stream_options, including
	// stream_options.include_usage. Native response.completed events already carry
	// usage, so strip the field provider-locally without affecting Chat requests.
	request.StreamOptions = nil
	return request, nil
}

// DoRequest performs the x402 two-trip dance. It is FORMAT-AGNOSTIC and works
// identically for /v1/messages, /v1/chat/completions, and /v1/responses:
//
//  1. First attempt without signature → upstream returns 402 with requirements
//  2. Validate the requirements, sign with the wallet key (SignX402Payment)
//  3. Stash the signature in the gin context and replay the request through
//     the same channel.DoApiRequest path so all standard wrappers apply
//  4. If the retry STILL returns 402 the signature was rejected — surface a
//     clear error instead of looping (which would burn more USDC trying).
func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	chain, payer, err := validateBlockRunPaymentConfig(info)
	if err != nil {
		return nil, err
	}
	bodyBytes, err := cacheRequestBody(requestBody)
	if err != nil {
		return nil, err
	}
	if info.RelayMode == relayconstant.RelayModeResponses {
		bodyBytes, err = removeBlockRunResponsesStreamOptions(bodyBytes)
		if err != nil {
			return nil, err
		}
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
	fullURL, urlErr := a.GetRequestURL(info)
	if urlErr != nil {
		return nil, fmt.Errorf("blockrun: get request url: %w", urlErr)
	}

	// Solana signatures contain a server-provided recent blockhash. If the
	// gateway rejects that signature as stale, the only safe recovery is a new
	// unsigned challenge followed by a new signature. Keep this state machine
	// isolated from Base so the existing single-shot EIP-3009 flow is unchanged.
	if chain == dto.BlockRunPaymentChainSolana {
		return a.doSolanaPaymentRequest(c, info, bodyBytes, firstResp, fullURL, payer)
	}

	// 402 — the payment requirements live in the HEADERS (extractPaymentRequired
	// never reads the body), so drain & close the body NOW to return this
	// connection to the pool. A defer here would pin the connection for the
	// whole retry leg — which for slow images includes a minutes-long poll.
	// Bound the drain: a misbehaving/huge 402 body must not stall the retry.
	_, _ = io.CopyN(io.Discard, firstResp.Body, 512<<10)
	_ = firstResp.Body.Close()

	// Image endpoints (sync fast path or async 202+poll) advertise a longer
	// authorization window — the same signature must stay valid through
	// generation, whether the request is held open or polled — so raise the
	// window cap for them; chat and Responses keep the default 300s window.
	var paymentB64 string
	var signErr error
	if chain == dto.BlockRunPaymentChainSolana {
		maxAmountAtomic, _ := new(big.Int).SetString(strings.TrimSpace(info.ChannelOtherSettings.BlockRunMaxPaymentAtomic), 10)
		paymentB64, signErr = SignSolanaX402Payment(firstResp, info.ApiKey, fullURL, maxAmountAtomic)
	} else if info.RelayMode == relayconstant.RelayModeImagesGenerations || info.RelayMode == relayconstant.RelayModeImagesEdits {
		paymentB64, signErr = SignX402PaymentWithCaps(firstResp, info.ApiKey, fullURL, nil, maxImageAuthorizationWindowSeconds)
	} else {
		paymentB64, signErr = SignX402Payment(firstResp, info.ApiKey, fullURL)
	}
	if signErr != nil {
		return nil, signErr
	}

	c.Set(ctxKeyPaymentSignature, paymentB64)
	defer delete(c.Keys, ctxKeyPaymentSignature)

	if chain == dto.BlockRunPaymentChainBase {
		if privateKey, parseErr := parsePrivateKey(info.ApiKey); parseErr == nil {
			payer = ethcrypto.PubkeyToAddress(privateKey.PublicKey).Hex()
		}
	}
	relaycommon.MarkBlockRunPaymentAttempt(c, chain, info.ChannelId, blockRunPaymentReconciliation(c, payer, paymentB64))
	retryResp, err := channel.DoApiRequest(a, c, info, bodyReader(bodyBytes))
	if err != nil {
		return nil, err
	}
	if retryResp.StatusCode == http.StatusPaymentRequired {
		relaycommon.UpdateBlockRunPaymentOutcome(c, relaycommon.BlockRunPaymentOutcomeRejected, false)
		// Signature was rejected (insufficient balance, replay, expired window,
		// payTo mismatch, …). Do NOT loop — every signed attempt risks an
		// on-chain settle. Never surface the upstream body: it may echo the full
		// payment signature and must not reach API errors or logs.
		_, _ = io.CopyN(io.Discard, retryResp.Body, 512<<10)
		_ = retryResp.Body.Close()
		return nil, errors.New("blockrun: payment signature rejected by upstream (status 402 after signing)")
	}
	return resolveImageResult(c, info, retryResp, paymentB64)
}

func (a *Adaptor) doSolanaPaymentRequest(c *gin.Context, info *relaycommon.RelayInfo, bodyBytes []byte, firstResp *http.Response, fullURL, payer string) (any, error) {
	defer delete(c.Keys, ctxKeyPaymentSignature)

	maxAmountAtomic, _ := new(big.Int).SetString(strings.TrimSpace(info.ChannelOtherSettings.BlockRunMaxPaymentAtomic), 10)
	backoffs := blockRunStaleRetryBackoffs
	staleRetries := 0
	resp := firstResp
	for {
		// The first response is the initial challenge; subsequent unsigned
		// responses are fresh challenges after a stale signed transaction.
		_, _ = io.CopyN(io.Discard, resp.Body, 512<<10)
		_ = resp.Body.Close()
		paymentB64, signErr := SignSolanaX402Payment(resp, info.ApiKey, fullURL, maxAmountAtomic)
		if signErr != nil {
			return nil, signErr
		}
		c.Set(ctxKeyPaymentSignature, paymentB64)
		relaycommon.MarkBlockRunPaymentAttempt(c, dto.BlockRunPaymentChainSolana, info.ChannelId, blockRunPaymentReconciliation(c, payer, paymentB64))

		retryResp, err := channel.DoApiRequest(a, c, info, bodyReader(bodyBytes))
		if err != nil {
			return nil, err
		}
		if retryResp.StatusCode != http.StatusPaymentRequired {
			return resolveImageResult(c, info, retryResp, paymentB64)
		}

		if staleRetries >= len(backoffs) || !isStaleSolanaPaymentResponse(retryResp) {
			relaycommon.UpdateBlockRunPaymentOutcome(c, relaycommon.BlockRunPaymentOutcomeRejected, false)
			_, _ = io.CopyN(io.Discard, retryResp.Body, 512<<10)
			_ = retryResp.Body.Close()
			return nil, errors.New("blockrun: payment signature rejected by upstream (status 402 after signing)")
		}

		// Discard the stale signed transaction and return to an unsigned
		// challenge. Never replay the same signature: a different nonce can
		// otherwise result in a second settlement for one request.
		_ = retryResp.Body.Close()
		if err := waitForBlockRunStaleRetry(c, backoffs[staleRetries]); err != nil {
			return nil, err
		}
		staleRetries++
		c.Set(ctxKeyPaymentSignature, "")
		resp, err = channel.DoApiRequest(a, c, info, bodyReader(bodyBytes))
		if err != nil {
			return nil, err
		}
		if resp.StatusCode != http.StatusPaymentRequired {
			return resolveImageResult(c, info, resp, "")
		}
	}
}

func blockRunPaymentReconciliation(c *gin.Context, payer, paymentPayload string) string {
	payerHash := sha256.Sum256([]byte(payer))
	payloadHash := sha256.Sum256([]byte(paymentPayload))
	reconciliation := fmt.Sprintf("payer_sha256=%x;payload_sha256=%x", payerHash[:8], payloadHash[:8])
	if c != nil {
		if requestID := c.GetString(common2.RequestIdKey); requestID != "" {
			reconciliation += ";request_id=" + requestID
		}
		if upstreamRequestID := c.GetString(common2.UpstreamRequestIdKey); upstreamRequestID != "" {
			reconciliation += ";upstream_request_id=" + upstreamRequestID
		}
	}
	return reconciliation
}

func validateBlockRunPaymentConfig(info *relaycommon.RelayInfo) (dto.BlockRunPaymentChain, string, error) {
	if info == nil || info.ChannelMeta == nil {
		return "", "", errors.New("blockrun: missing channel configuration")
	}
	chain := info.ChannelOtherSettings.GetBlockRunPaymentChain()
	switch chain {
	case dto.BlockRunPaymentChainBase:
		return chain, "", nil
	case dto.BlockRunPaymentChainSolana:
		if !blockRunSolanaSupportsRequest(info) {
			return "", "", errors.New("blockrun: Solana payment only supports /v1/chat/completions, /v1/messages, and /v1/responses")
		}
		if strings.TrimRight(strings.TrimSpace(info.ChannelBaseUrl), "/") != blockrunSDK.DefaultSolanaAPIURL {
			return "", "", fmt.Errorf("blockrun: Solana base URL must be %s", blockrunSDK.DefaultSolanaAPIURL)
		}
		capAmount, ok := new(big.Int).SetString(strings.TrimSpace(info.ChannelOtherSettings.BlockRunMaxPaymentAtomic), 10)
		if !ok || capAmount.Sign() <= 0 {
			return "", "", errors.New("blockrun: Solana per-call payment cap must be configured as a positive integer")
		}
		payer, err := blockrunSDK.GetSolanaPublicKey(strings.TrimSpace(info.ApiKey))
		if err != nil {
			return "", "", errors.New("blockrun: Solana wallet key is invalid")
		}
		return chain, payer, nil
	default:
		return "", "", fmt.Errorf("blockrun: unsupported payment chain %q", chain)
	}
}

func blockRunSolanaSupportsRequest(info *relaycommon.RelayInfo) bool {
	if info == nil {
		return false
	}
	requestPath := normalizeBlockRunRequestPath(info.RequestURLPath)
	switch requestPath {
	case "/v1/chat/completions":
		return info.RelayMode == relayconstant.RelayModeChatCompletions && info.RelayFormat == types.RelayFormatOpenAI
	case "/v1/messages":
		return info.RelayMode == relayconstant.RelayModeChatCompletions && info.RelayFormat == types.RelayFormatClaude
	case "/v1/responses":
		return info.RelayMode == relayconstant.RelayModeResponses &&
			(info.RelayFormat == types.RelayFormatOpenAI || info.RelayFormat == types.RelayFormatOpenAIResponses)
	default:
		return false
	}
}

func normalizeBlockRunRequestPath(requestPath string) string {
	if idx := strings.IndexAny(requestPath, "?#"); idx >= 0 {
		return requestPath[:idx]
	}
	return requestPath
}

func rejectProtectedPaymentHeaderOverrides(info *relaycommon.RelayInfo) error {
	for key := range relaycommon.GetEffectiveHeaderOverride(info) {
		if channel.IsHeaderPassthroughRuleKey(key) {
			continue
		}
		if _, protected := blockRunProtectedPaymentHeaders[strings.ToLower(strings.TrimSpace(key))]; protected {
			return fmt.Errorf("blockrun: header override %q is reserved for x402 payment", key)
		}
	}
	return nil
}

// removeBlockRunResponsesStreamOptions enforces the provider constraint at the
// final outbound boundary, after channel parameter overrides have run. This is
// intentionally Responses-only so BlockRun Chat keeps its existing behavior.
func removeBlockRunResponsesStreamOptions(body []byte) ([]byte, error) {
	cleaned, err := sjson.DeleteBytes(body, "stream_options")
	if err != nil {
		return nil, fmt.Errorf("blockrun: remove final responses stream_options: %w", err)
	}
	return cleaned, nil
}

// DoResponse delegates to the native handler for the inbound format. Claude
// inbound → native Claude SSE/JSON (thinking signatures, native content blocks,
// cache tokens); OpenAI Chat → native chat.completion; OpenAI Responses → native
// Responses JSON plus semantically equivalent SSE reconstructed from event data.
// Image modes are handled first: streaming images go through streamImageResponse;
// non-streaming images go through imageJSONResponseB64 (downloads URL→base64 for
// whitelabelling).
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
	// Capture the upstream response body's top-level id (chatcmpl-* / resp_* /
	// msg-*) —
	// BlockRun's "CallTransaction.id" — into the gin context so RecordConsumeLog
	// persists it as logs.upstream_request_id for per-call reconciliation/溯源.
	// Structure-aware (json for non-stream, first-id sniff for SSE) so it survives
	// tool-call bodies; native passthrough and streaming SSE are unaffected.
	captureUpstreamID(c, resp, info)
	if info.RelayMode == relayconstant.RelayModeResponses {
		return a.openaiAdaptor.DoResponse(c, resp, info)
	}
	if info.RelayFormat == types.RelayFormatClaude {
		return a.claudeAdaptor.DoResponse(c, resp, info)
	}
	return a.openaiAdaptor.DoResponse(c, resp, info)
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}
