package controller

import (
	"io"

	"github.com/gin-gonic/gin"
)

// maxPaymentWebhookBodyBytes bounds payment webhook payloads. Signatures are
// verified over the raw body, so the whole body is read; an unbounded read
// would let one oversized request exhaust gateway memory.
const maxPaymentWebhookBodyBytes int64 = 1 << 20

// errPaymentWebhookBodyTooLarge is returned instead of silently truncating a
// body, because a truncated body would corrupt signature verification.
var errPaymentWebhookBodyTooLarge = &paymentWebhookBodyError{}

type paymentWebhookBodyError struct{}

func (*paymentWebhookBodyError) Error() string {
	return "payment webhook body exceeds the size limit"
}

// readPaymentWebhookBody reads at most maxPaymentWebhookBodyBytes and rejects
// anything larger.
func readPaymentWebhookBody(c *gin.Context) ([]byte, error) {
	body, err := io.ReadAll(io.LimitReader(c.Request.Body, maxPaymentWebhookBodyBytes+1))
	if err != nil {
		return nil, err
	}
	if int64(len(body)) > maxPaymentWebhookBodyBytes {
		return nil, errPaymentWebhookBodyTooLarge
	}
	return body, nil
}
