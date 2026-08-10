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

func TestPreviewRecallEmailDerivesDeliveryPolicyFromLifecycleTrigger(t *testing.T) {
	tests := []struct {
		name     string
		trigger  string
		bodyHTML string
		want     string
	}{
		{name: "user registered", trigger: model.RecallLifecycleTriggerUserRegistered, bodyHTML: `<!doctype html><html><body><p>{{.registration_time}}</p></body></html>`, want: "2030-03-17 17:46 UTC"},
		{name: "registration unused", trigger: model.RecallLifecycleTriggerRegistrationUnused, bodyHTML: `<!doctype html><html><body><p>{{.registration_time}}</p><a href="{{.UnsubscribeURL}}">Unsubscribe</a></body></html>`, want: "2030-03-17 17:46 UTC"},
		{name: "quota low", trigger: model.RecallLifecycleTriggerQuotaLow, bodyHTML: `<!doctype html><html><body><p>{{.top_up_url}}</p></body></html>`, want: "https://flatkey.ai/console/topup"},
		{name: "quota exhausted unpaid", trigger: model.RecallLifecycleTriggerQuotaExhaustedUnpaid, bodyHTML: `<!doctype html><html><body><p>{{.top_up_url}}</p></body></html>`, want: "https://flatkey.ai/console/topup"},
		{name: "payment failed", trigger: model.RecallLifecycleTriggerPaymentFailed, bodyHTML: `<!doctype html><html><body><p>{{.payment_url}}</p></body></html>`, want: "preview-trade-no"},
		{name: "payment pending", trigger: model.RecallLifecycleTriggerPaymentPending, bodyHTML: `<!doctype html><html><body><p>{{.payment_url}}</p><a href="{{.UnsubscribeURL}}">Unsubscribe</a></body></html>`, want: "preview-trade-no"},
		{name: "payment succeeded", trigger: model.RecallLifecycleTriggerPaymentSucceeded, bodyHTML: `<!doctype html><html><body><p>{{.completed_at}}</p></body></html>`, want: "2030-03-17 17:46 UTC"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			response, err := PreviewRecallEmail(RecallEmailPreviewRequest{
				CampaignType:     model.RecallCampaignTypeContentOnly,
				LifecycleTrigger: test.trigger,
				Template: RecallEmailTemplate{
					Subject:  "Lifecycle preview",
					BodyHTML: test.bodyHTML,
				},
			})

			require.NoError(t, err)
			require.Contains(t, response.BodyHTML, test.want)
		})
	}
}

func TestPreviewRecallEmailRejectsDeliveryPolicyConflictingWithLifecycleTrigger(t *testing.T) {
	_, err := PreviewRecallEmail(RecallEmailPreviewRequest{
		CampaignType:     model.RecallCampaignTypeContentOnly,
		DeliveryPolicy:   model.RecallDeliveryPolicyService,
		LifecycleTrigger: model.RecallLifecycleTriggerPaymentPending,
		Template: RecallEmailTemplate{
			Subject:  "Payment pending",
			BodyHTML: `<!doctype html><html><body><p>{{.payment_url}}</p></body></html>`,
		},
	})

	require.ErrorContains(t, err, `lifecycle trigger "payment_pending" requires delivery policy "engagement"`)
}
