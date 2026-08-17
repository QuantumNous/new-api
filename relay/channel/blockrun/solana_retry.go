package blockrun

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	common2 "github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

// A stale Solana transaction is dead. These bounded delays give the gateway
// time to rotate a cached challenge without permitting an unbounded series of
// paid attempts.
var blockRunStaleRetryBackoffs = []time.Duration{500 * time.Millisecond, 2 * time.Second}

const maxStalePaymentErrorBytes = 64 << 10

type prefixedBody struct {
	r io.Reader
	c io.Closer
}

func (b *prefixedBody) Read(p []byte) (int, error) { return b.r.Read(p) }
func (b *prefixedBody) Close() error               { return b.c.Close() }

// isStaleSolanaPaymentResponse accepts only explicit verification-phase stale
// signals. Settlement failures are deliberately excluded: settlement may have
// broadcast successfully even when its confirmation response was lost.
func isStaleSolanaPaymentResponse(resp *http.Response) bool {
	if resp == nil || resp.Body == nil {
		return false
	}
	original := resp.Body
	body, err := io.ReadAll(io.LimitReader(original, maxStalePaymentErrorBytes+1))
	resp.Body = &prefixedBody{r: io.MultiReader(bytes.NewReader(body), original), c: original}
	if err != nil || len(body) > maxStalePaymentErrorBytes {
		return false
	}
	var failure struct {
		Code           string          `json:"code"`
		Reason         string          `json:"reason"`
		InvalidMessage string          `json:"invalidMessage"`
		Error          json.RawMessage `json:"error"`
	}
	if common2.Unmarshal(body, &failure) != nil {
		return false
	}
	var errorText string
	var nested struct {
		Message string `json:"message"`
	}
	if len(failure.Error) > 0 {
		if common2.Unmarshal(failure.Error, &errorText) != nil {
			_ = common2.Unmarshal(failure.Error, &nested)
		}
	}
	code := normalizeBlockRunPaymentSignal(failure.Code)
	reason := normalizeBlockRunPaymentSignal(failure.Reason)
	detail := normalizeBlockRunPaymentSignal(failure.InvalidMessage)
	errLabel := normalizeBlockRunPaymentSignal(errorText)
	message := normalizeBlockRunPaymentSignal(nested.Message)
	if strings.Contains(code, "settlementfailed") || strings.Contains(errLabel, "settlementfailed") || strings.Contains(message, "settlementfailed") {
		return false
	}
	verifyPhase := code == "paymentinvalid" || strings.Contains(errLabel, "verificationfailed") || strings.Contains(message, "verificationfailed")
	return code == "paymentblockhashstale" || strings.Contains(detail, "blockhashnotfound") || strings.Contains(detail, "blockheightexceeded") ||
		(verifyPhase && (reason == "expiredsignature" || strings.Contains(message, "expiredsignature")))
}

func normalizeBlockRunPaymentSignal(value string) string {
	return strings.NewReplacer("_", "", "-", "", " ", "", ":", "").Replace(strings.ToLower(value))
}

func waitForBlockRunStaleRetry(c *gin.Context, delay time.Duration) error {
	if delay <= 0 {
		return nil
	}
	ctx := c.Request.Context()
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-timer.C:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}
