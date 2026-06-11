package blockrun

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

// BlockRun's image endpoints are hybrid: ≤30s generations return synchronously,
// slower ones return 202 {id, status, poll_url, price} and must be polled with
// the SAME wallet signature until completed. Settlement only happens on the
// first poll that observes completed (failed / abandoned jobs are never
// charged), so timeouts here are financially safe. Pacing mirrors the official
// SDK (blockrun-llm-go v0.17.0 image.go). Vars, not consts, so tests can shrink.
var (
	imagePollInterval = 3 * time.Second
	imagePollBudget   = 300 * time.Second
)

// maxImageBodyBytes bounds any image body we buffer (b64_json can be tens of MB).
const maxImageBodyBytes = 64 << 20

const (
	headerXPayment       = "X-Payment"
	headerPaymentReceipt = "X-Payment-Receipt"
)

// imageBodyProbe is the minimal shape sniffed from any image response body to
// classify it: synchronous result (data[]), async envelope (poll_url), or
// terminal job state (status).
type imageBodyProbe struct {
	Data []struct {
		URL     string `json:"url"`
		B64JSON string `json:"b64_json"`
	} `json:"data"`
	Status  string `json:"status"`
	PollURL string `json:"poll_url"`
	TxHash  string `json:"tx_hash"`
	// Amount is documented as a decimal string but kept drift-immune (any) so
	// a numeric amount can never fail the envelope parse and lose poll_url.
	Price struct {
		Amount   any    `json:"amount"`
		Currency string `json:"currency"`
	} `json:"price"`
}

func (p *imageBodyProbe) hasImage() bool {
	return len(p.Data) > 0 && (p.Data[0].URL != "" || p.Data[0].B64JSON != "")
}

func isImageMode(info *relaycommon.RelayInfo) bool {
	return info != nil &&
		(info.RelayMode == relayconstant.RelayModeImagesGenerations ||
			info.RelayMode == relayconstant.RelayModeImagesEdits)
}

// resolveImageResult inspects an upstream image response and returns the final
// response the generic ImageHelper should see. Non-image modes and non-202
// statuses pass through untouched. A 202 whose body already carries the image
// (fast-path quirk) is rewritten to 200. A 202 with a poll_url is polled to
// completion, reusing paymentSignature on every poll (single-signature model —
// the 900s image authorization window outlives the 300s poll budget; a 402 on
// poll means the signature was rejected and re-signing mid-poll risks a second
// on-chain authorization, so it is a hard error).
func resolveImageResult(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response, paymentSignature string) (*http.Response, error) {
	if resp == nil || !isImageMode(info) {
		return resp, nil
	}
	captureTxHash(c, resp.Header.Get(headerPaymentReceipt))
	if resp.StatusCode != http.StatusAccepted {
		return resp, nil
	}
	body, err := readAndCloseBody(resp)
	if err != nil {
		return nil, err
	}
	var probe imageBodyProbe
	// best-effort: fields default to zero on partial parse; an unintelligible
	// 202 then falls through both branches below and is handed back unchanged
	// for the generic error path.
	_ = common.Unmarshal(body, &probe)
	if probe.hasImage() {
		// Fast-path quirk: a successful synchronous result delivered with 202.
		out := rewrapResponse(resp, body)
		out.StatusCode = http.StatusOK
		out.Status = "200 OK"
		return out, nil
	}
	if probe.PollURL == "" {
		return rewrapResponse(resp, body), nil
	}
	// Slow path: async envelope. price.amount only reliably exists HERE.
	captureEnvelopePrice(c, priceAmountString(probe.Price.Amount), probe.Price.Currency)
	if isImageStreamMode(c, info) {
		stop := startImageHeartbeat(c)
		defer stop()
	}
	return pollImageJob(c, info, probe.PollURL, paymentSignature)
}

// pollImageJob GETs pollURL until the job reaches a terminal state, mirroring
// the SDK reference: 200+data = completed; 202 = queued/in_progress; 504 =
// transient, keep polling; 402 = signature rejected, hard error (never re-sign
// mid-poll); anything else = failure. No settlement occurs until a poll
// observes completed, so timing out here costs nothing.
func pollImageJob(c *gin.Context, info *relaycommon.RelayInfo, pollPath, paymentSignature string) (*http.Response, error) {
	pollURL, err := absolutePollURL(info.ChannelBaseUrl, pollPath)
	if err != nil {
		return nil, err
	}
	client, err := service.GetHttpClientWithProxy(info.ChannelSetting.Proxy)
	if err != nil {
		return nil, fmt.Errorf("blockrun: poll http client: %w", err)
	}
	if client == nil {
		// The shared relay client is initialised by InitHttpClient() in main;
		// fall back for any caller (e.g. tests) running before that.
		client = http.DefaultClient
	}
	deadline := time.Now().Add(imagePollBudget)
	for {
		// Bound each round (connect + headers + body) by the overall poll
		// budget: the shared relay client may have no Timeout (RelayTimeout=0),
		// so without a per-request deadline a single hung GET could outlive the
		// budget. Deriving from the request context keeps client disconnects
		// interrupting an in-flight poll immediately. cancel() must run only
		// after the body is consumed — cancelling earlier aborts the read.
		reqCtx, cancel := context.WithDeadline(c.Request.Context(), deadline)
		resp, perr := doImagePoll(reqCtx, client, pollURL, paymentSignature)
		if perr != nil {
			cancel()
			return nil, perr
		}
		body, rerr := readAndCloseBody(resp)
		cancel()
		if rerr != nil {
			return nil, rerr
		}
		var probe imageBodyProbe
		// best-effort: status/data fields default to zero on partial parse.
		_ = common.Unmarshal(body, &probe)

		switch resp.StatusCode {
		case http.StatusOK:
			if probe.Status == "failed" {
				return nil, fmt.Errorf("blockrun: image generation failed upstream")
			}
			if !probe.hasImage() {
				return nil, fmt.Errorf("blockrun: image job completed without image data")
			}
			tx := resp.Header.Get(headerPaymentReceipt)
			if tx == "" {
				tx = probe.TxHash
			}
			captureTxHash(c, tx)
			return rewrapResponse(resp, body), nil
		case http.StatusAccepted:
			if probe.Status == "failed" {
				return nil, fmt.Errorf("blockrun: image generation failed upstream")
			}
			// queued / in_progress — keep polling.
		case http.StatusGatewayTimeout:
			// Transient gateway hiccup (SDK reference treats 504 as continue).
		case http.StatusPaymentRequired:
			if paymentSignature == "" {
				return nil, fmt.Errorf("blockrun: upstream returned an async image job but no payment signature is available (free/proxy path); cannot poll a 402-gated job")
			}
			return nil, fmt.Errorf("blockrun: poll rejected the reused payment signature (402); refusing to re-sign mid-poll")
		default:
			return nil, fmt.Errorf("blockrun: image poll failed with status %d: %.512s", resp.StatusCode, string(body))
		}

		if time.Now().After(deadline) {
			return nil, fmt.Errorf("blockrun: image not ready after %s (no settlement occurred)", imagePollBudget)
		}
		select {
		case <-c.Request.Context().Done():
			return nil, fmt.Errorf("blockrun: client disconnected while waiting for image: %w", c.Request.Context().Err())
		case <-time.After(imagePollInterval):
		}
	}
}

// doImagePoll performs one signed poll GET bound to ctx (the request context
// plus the poll-budget deadline) so a client disconnect or budget exhaustion
// interrupts an in-flight poll immediately.
func doImagePoll(ctx context.Context, client *http.Client, pollURL, signature string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, pollURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	if signature != "" {
		req.Header.Set(headerPaymentSignature, signature)
		req.Header.Set(headerXPayment, signature)
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("blockrun: image poll request: %w", err)
	}
	return resp, nil
}

// absolutePollURL resolves a possibly-relative poll_url against the channel base.
func absolutePollURL(base, ref string) (string, error) {
	if strings.HasPrefix(ref, "http://") || strings.HasPrefix(ref, "https://") {
		return ref, nil
	}
	b, err := url.Parse(base)
	if err != nil {
		return "", fmt.Errorf("blockrun: parse channel base url: %w", err)
	}
	r, err := url.Parse(ref)
	if err != nil {
		return "", fmt.Errorf("blockrun: parse poll_url: %w", err)
	}
	return b.ResolveReference(r).String(), nil
}

func readAndCloseBody(resp *http.Response) ([]byte, error) {
	defer func() { _ = resp.Body.Close() }()
	b, err := io.ReadAll(io.LimitReader(resp.Body, maxImageBodyBytes+1))
	if err != nil {
		return nil, fmt.Errorf("blockrun: read image response: %w", err)
	}
	if len(b) > maxImageBodyBytes {
		return nil, fmt.Errorf("blockrun: image response exceeds %d bytes", maxImageBodyBytes)
	}
	return b, nil
}

func rewrapResponse(resp *http.Response, body []byte) *http.Response {
	resp.Body = io.NopCloser(bytes.NewReader(body))
	resp.ContentLength = int64(len(body))
	resp.Header.Set("Content-Length", fmt.Sprintf("%d", len(body)))
	return resp
}

func captureTxHash(c *gin.Context, tx string) {
	if tx == "" {
		return
	}
	mergeSettlement(c, map[string]interface{}{"upstream_tx_hash": tx})
}

// priceAmountString normalizes the envelope's price.amount — documented as a
// decimal string, tolerated as a JSON number in case upstream drifts — into
// the string form stored in the settlement context.
func priceAmountString(v any) string {
	switch a := v.(type) {
	case nil:
		return ""
	case string:
		return a
	case float64: // encoding/json decodes JSON numbers in an `any` field to float64
		return strconv.FormatFloat(a, 'f', -1, 64)
	default: // e.g. json.Number, should a future decoder enable UseNumber
		return fmt.Sprintf("%v", a)
	}
}

func captureEnvelopePrice(c *gin.Context, amount, currency string) {
	if amount == "" {
		return
	}
	kv := map[string]interface{}{"upstream_price_usd": amount}
	if currency != "" {
		kv["upstream_price_currency"] = currency
	}
	mergeSettlement(c, kv)
}

func mergeSettlement(c *gin.Context, kv map[string]interface{}) {
	if c == nil {
		return
	}
	merged := map[string]interface{}{}
	if v, ok := c.Get(string(constant.ContextKeyBlockRunSettlement)); ok {
		if m, ok2 := v.(map[string]interface{}); ok2 {
			merged = m
		}
	}
	for k, v := range kv {
		merged[k] = v
	}
	c.Set(string(constant.ContextKeyBlockRunSettlement), merged)
}

// Placeholder until image_stream.go (Task 5) provides the real implementations.
func isImageStreamMode(_ *gin.Context, _ *relaycommon.RelayInfo) bool { return false }
func startImageHeartbeat(_ *gin.Context) func()                      { return func() {} }
