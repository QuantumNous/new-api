package passkey

import (
	"errors"
	"github.com/QuantumNous/new-api/common"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	webauthn "github.com/go-webauthn/webauthn/webauthn"
)

var errSessionNotFound = errors.New("Passkey 会话不存在或已过期")

// passkeySessionPayload binds the WebAuthn challenge to the selected RP ID.
type passkeySessionPayload struct {
	SessionData *webauthn.SessionData `json:"session_data"`
	RPID        string                `json:"rp_id"`
}

func SaveSessionData(c *gin.Context, key string, data *webauthn.SessionData) error {
	session := sessions.Default(c)
	if data == nil {
		session.Delete(key)
		return session.Save()
	}
	payload, err := common.Marshal(data)
	if err != nil {
		return err
	}
	session.Set(key, string(payload))
	return session.Save()
}

func PopSessionData(c *gin.Context, key string) (*webauthn.SessionData, error) {
	session := sessions.Default(c)
	raw := session.Get(key)
	if raw == nil {
		return nil, errSessionNotFound
	}
	session.Delete(key)
	if err := session.Save(); err != nil {
		return nil, err
	}
	var data webauthn.SessionData
	if err := unmarshalSessionValue(raw, &data); err != nil {
		return nil, err
	}
	return &data, nil
}

func SaveSessionDataWithRPID(c *gin.Context, key, rpID string, data *webauthn.SessionData) error {
	if data == nil || rpID == "" {
		return errors.New("Passkey 会话参数无效")
	}
	payload, err := common.Marshal(passkeySessionPayload{SessionData: data, RPID: rpID})
	if err != nil {
		return err
	}
	session := sessions.Default(c)
	session.Set(key, string(payload))
	return session.Save()
}

func PopSessionDataWithRPID(c *gin.Context, key string) (*webauthn.SessionData, string, error) {
	session := sessions.Default(c)
	raw := session.Get(key)
	if raw == nil {
		return nil, "", errSessionNotFound
	}
	session.Delete(key)
	if err := session.Save(); err != nil {
		return nil, "", err
	}
	var payload passkeySessionPayload
	if err := unmarshalSessionValue(raw, &payload); err != nil {
		return nil, "", err
	}
	if payload.SessionData == nil || payload.RPID == "" {
		return nil, "", errors.New("Passkey 会话格式无效")
	}
	return payload.SessionData, payload.RPID, nil
}

func unmarshalSessionValue(raw any, target any) error {
	switch value := raw.(type) {
	case string:
		return common.Unmarshal([]byte(value), target)
	case []byte:
		return common.Unmarshal(value, target)
	default:
		return errors.New("Passkey 会话格式无效")
	}
}
