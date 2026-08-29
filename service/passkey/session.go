package passkey

import (
	"errors"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	webauthn "github.com/go-webauthn/webauthn/webauthn"
)

var errSessionNotFound = errors.New("Passkey 会话不存在或已过期")

const passkeyFlowTTL = 5 * time.Minute

type flowPayload struct {
	SessionData webauthn.SessionData `json:"session_data"`
	Scope       string               `json:"scope,omitempty"`
}

func CreateSessionDataFlow(purpose string, userID int, sessionID, scope string, data *webauthn.SessionData) (string, int64, error) {
	if data == nil {
		return "", 0, errors.New("Passkey 会话数据不能为空")
	}
	payload, err := common.Marshal(flowPayload{SessionData: *data, Scope: scope})
	if err != nil {
		return "", 0, err
	}
	expiresAt := time.Now().Add(passkeyFlowTTL)
	token, _, err := model.CreateAuthFlow(model.AuthFlowCreate{
		Purpose:   purpose,
		UserId:    userID,
		SessionId: sessionID,
		Payload:   string(payload),
		ExpiresAt: expiresAt,
	})
	if err != nil {
		return "", 0, err
	}
	return token, expiresAt.Unix(), nil
}

func PopSessionDataFlow(token, purpose string, userID int, sessionID string) (*webauthn.SessionData, string, error) {
	flow, err := model.ConsumeAuthFlow(token, model.AuthFlowMatch{
		Purpose:   purpose,
		UserId:    userID,
		SessionId: sessionID,
	})
	if err != nil {
		if errors.Is(err, model.ErrAuthFlowInvalid) || errors.Is(err, model.ErrAuthFlowExpired) || errors.Is(err, model.ErrAuthFlowConsumed) {
			return nil, "", errSessionNotFound
		}
		return nil, "", err
	}
	var payload flowPayload
	if err := common.UnmarshalJsonStr(flow.Payload, &payload); err != nil {
		return nil, "", err
	}
	return &payload.SessionData, payload.Scope, nil
}
