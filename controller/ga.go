package controller

import (
	"context"
	"strings"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
)

const (
	gaEventSignUpSuccess  = "sign_up_success"
	gaEventPaymentSuccess = "payment_success"
	gaEventInviteSuccess  = "invite_sucess"
)

func sendSignUpSuccessGA(ctx context.Context, userID int, inviterID int, method string, clientID string, sessionID string) {
	params := map[string]any{
		"method": method,
	}
	service.SendGAEvent(ctx, service.GAEvent{
		Name:      gaEventSignUpSuccess,
		ClientID:  service.NormalizeGAIdentifier(clientID),
		SessionID: service.NormalizeGAIdentifier(sessionID),
		Params:    params,
	})
	if inviterID > 0 {
		service.SendGAEvent(ctx, service.GAEvent{
			Name:      gaEventInviteSuccess,
			ClientID:  service.NormalizeGAIdentifier(clientID),
			SessionID: service.NormalizeGAIdentifier(sessionID),
			Params:    params,
		})
	}
}

func sendPaymentSuccessGA(ctx context.Context, topUp *model.TopUp) {
	if topUp == nil {
		return
	}
	currency := strings.ToUpper(strings.TrimSpace(topUp.PaymentCurrency))
	if currency == "" {
		currency = "USD"
	}
	service.SendGAEvent(ctx, service.GAEvent{
		Name:      gaEventPaymentSuccess,
		ClientID:  service.NormalizeGAIdentifier(topUp.GAClientID),
		SessionID: service.NormalizeGAIdentifier(topUp.GASessionID),
		Params: map[string]any{
			"payment_method":   topUp.PaymentMethod,
			"payment_provider": topUp.PaymentProvider,
			"value":            topUp.Money,
			"currency":         currency,
		},
	})
}
