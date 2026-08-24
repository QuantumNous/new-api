package controller

import (
	"context"

	"github.com/QuantumNous/new-api/service"
)

const (
	gaEventSignUpSuccess = "sign_up_success"
	gaEventInviteSuccess = "invite_sucess"
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
