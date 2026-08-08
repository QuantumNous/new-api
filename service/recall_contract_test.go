package service

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestPreviewRecallEmailRendersLifecycleTriggerVariables(t *testing.T) {
	response, err := PreviewRecallEmail(RecallEmailPreviewRequest{
		CampaignType:     model.RecallCampaignTypeContentOnly,
		DeliveryPolicy:   model.RecallDeliveryPolicyService,
		LifecycleTrigger: model.RecallLifecycleTriggerPaymentSucceeded,
		Template: RecallEmailTemplate{
			Subject:  "Payment complete",
			BodyHTML: `<!doctype html><html><body><p>{{.trade_no}}</p><p>{{.amount}} {{.currency}}</p><p>{{.completed_at}}</p></body></html>`,
		},
	})

	require.NoError(t, err)
	require.Contains(t, response.BodyHTML, "preview-trade-no")
	require.Contains(t, response.BodyHTML, "100 USD")
	require.Contains(t, response.BodyHTML, "2030-03-17 17:46 UTC")
	require.NotContains(t, response.BodyHTML, "/api/recall/unsubscribe")
}

func TestPreviewRecallEmailRejectsCrossTriggerLifecycleVariables(t *testing.T) {
	_, err := PreviewRecallEmail(RecallEmailPreviewRequest{
		CampaignType:     model.RecallCampaignTypeContentOnly,
		DeliveryPolicy:   model.RecallDeliveryPolicyService,
		LifecycleTrigger: model.RecallLifecycleTriggerPaymentSucceeded,
		Template: RecallEmailTemplate{
			Subject:  "Payment complete",
			BodyHTML: `<!doctype html><html><body><p>{{.payment_url}}</p></body></html>`,
		},
	})

	require.ErrorContains(t, err, `unsupported template field "payment_url"`)
}
