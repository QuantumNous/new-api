package service

// Airbotix billing webhook dispatch: fires after each relay round-trip when the
// requesting tenant (= model.User) has BillingWebhookURL configured. Used by
// downstream consumers (e.g. kidsinai/platform-backend) to deduct credits and
// record the consumption ledger.
//
// V0 fires-and-forgets via gopool: 3-retry HMAC-signed POST in a goroutine.
// Idempotency is the receiver's responsibility (DeepRouter PRD §7.3). Failures
// are logged but never propagated back to the end user.

import (
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/internal/billing"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
)

func dispatchAirbotixBilling(c *gin.Context, relayInfo *relaycommon.RelayInfo, usage *dto.Usage, quota int) {
	if relayInfo == nil || usage == nil {
		return
	}
	raw, ok := common.GetContextKey(c, constant.ContextKeyAirbotixUser)
	if !ok || raw == nil {
		return
	}
	user, ok := raw.(*model.User)
	// TrimSpace guards against whitespace-only secrets that would pass the
	// empty-string check but produce a trivially guessable HMAC key.
	if !ok || user == nil || user.BillingWebhookURL == "" || strings.TrimSpace(user.WebhookSecret) == "" {
		return
	}

	costUSD := float64(quota) / common.QuotaPerUnit
	event := &billing.Event{
		RequestID:        relayInfo.RequestId,
		TenantID:         user.Username,
		Provider:         constant.GetChannelTypeName(relayInfo.ChannelType),
		Model:            relayInfo.OriginModelName,
		PromptTokens:     usage.PromptTokens,
		CompletionTokens: usage.CompletionTokens,
		CostUSD:          costUSD,
		Timestamp:        time.Now().UTC().Format(time.RFC3339),
	}

	url := user.BillingWebhookURL
	secret := []byte(user.WebhookSecret)
	// Gin contexts must be copied before crossing a goroutine boundary
	// (https://pkg.go.dev/github.com/gin-gonic/gin#Context.Copy).
	asyncCtx := c.Copy()
	gopool.Go(func() {
		dispatcher := billing.NewDispatcher()
		status, err := dispatcher.Send(url, secret, event)
		if err != nil {
			logger.LogWarn(asyncCtx, fmt.Sprintf("airbotix billing webhook failed status=%d err=%s", status, err.Error()))
		}
	})
}
