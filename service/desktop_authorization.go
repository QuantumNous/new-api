package service

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"net"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"gorm.io/gorm"
)

const DesktopClientID = "boxai-desktop"

var ErrDesktopInvalidGrant = errors.New("invalid desktop grant")

func validPKCEValue(value string, minLength, maxLength int) bool {
	if len(value) < minLength || len(value) > maxLength {
		return false
	}
	for _, char := range value {
		if (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') ||
			(char >= '0' && char <= '9') || char == '-' || char == '.' || char == '_' || char == '~' {
			continue
		}
		return false
	}
	return true
}

func opaque(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
func secretHash(s string) string {
	h := sha256.Sum256([]byte(s))
	return base64.RawURLEncoding.EncodeToString(h[:])
}

func ValidateDesktopRedirect(raw string) error {
	u, err := url.Parse(raw)
	if err != nil || u.Scheme != "http" || u.Hostname() != "127.0.0.1" || u.Path != "/auth/callback" || u.RawQuery != "" || u.Fragment != "" || u.User != nil {
		return errors.New("invalid redirect_uri")
	}
	_, p, err := net.SplitHostPort(u.Host)
	if err != nil {
		return errors.New("redirect_uri requires a port")
	}
	port, err := strconv.Atoi(p)
	if err != nil || port < 1 || port > 65535 {
		return errors.New("invalid redirect_uri port")
	}
	return nil
}

func CreateDesktopAuthorization(clientID, redirect, challenge, method, state, name string) (*model.DesktopAuthorization, error) {
	if clientID != DesktopClientID || method != "S256" || len(challenge) != 43 || !validPKCEValue(state, 22, 128) {
		return nil, errors.New("invalid authorization request")
	}
	if _, err := base64.RawURLEncoding.DecodeString(challenge); err != nil {
		return nil, errors.New("invalid code_challenge")
	}
	if err := ValidateDesktopRedirect(redirect); err != nil {
		return nil, err
	}
	id, err := opaque(24)
	if err != nil {
		return nil, err
	}
	now := time.Now().Unix()
	a := &model.DesktopAuthorization{ID: id, ClientID: clientID, RedirectURI: redirect, CodeChallenge: challenge, State: state, ClientName: strings.TrimSpace(name), Status: "pending", CreatedAt: now, ExpiresAt: now + 600}
	if a.ClientName == "" {
		a.ClientName = system_setting.GetDesktopSettings().TokenName
	}
	if len(a.ClientName) > 100 {
		a.ClientName = a.ClientName[:100]
	}
	return a, model.DB.Create(a).Error
}

func GetDesktopAuthorization(id string) (*model.DesktopAuthorization, error) {
	var a model.DesktopAuthorization
	err := model.DB.Where("id = ?", id).First(&a).Error
	if err != nil || a.ExpiresAt <= time.Now().Unix() {
		return nil, ErrDesktopInvalidGrant
	}
	return &a, nil
}

func DecideDesktopAuthorization(id string, userID int, approve bool) (string, *model.DesktopAuthorization, error) {
	a, err := GetDesktopAuthorization(id)
	if err != nil {
		return "", nil, err
	}
	status := "denied"
	code := ""
	hash := ""
	if approve {
		status = "approved"
		code, err = opaque(32)
		if err != nil {
			return "", nil, err
		}
		hash = secretHash(code)
	}
	updates := map[string]any{"status": status, "user_id": userID}
	if approve {
		updates["code_hash"] = hash
	}
	r := model.DB.Model(&model.DesktopAuthorization{}).Where("id = ? AND status = ? AND expires_at > ?", id, "pending", time.Now().Unix()).Updates(updates)
	if r.Error != nil {
		return "", nil, r.Error
	}
	if r.RowsAffected != 1 {
		return "", nil, ErrDesktopInvalidGrant
	}
	a.Status = status
	a.UserID = userID
	return code, a, nil
}

func ExchangeDesktopCode(code, verifier, clientID, redirect string) (access, refresh, apiKey string, expires int, err error) {
	if clientID != DesktopClientID || ValidateDesktopRedirect(redirect) != nil || !validPKCEValue(verifier, 43, 128) {
		return "", "", "", 0, ErrDesktopInvalidGrant
	}
	if _, err = loadDesktopSigningKey(); err != nil {
		return "", "", "", 0, err
	}
	challenge := secretHash(verifier)
	codeHash := secretHash(code)
	var user model.User
	var session model.DesktopSession
	err = model.DB.Transaction(func(tx *gorm.DB) error {
		var a model.DesktopAuthorization
		if e := tx.Where("code_hash = ? AND status = ? AND expires_at > ?", codeHash, "approved", time.Now().Unix()).First(&a).Error; e != nil {
			return ErrDesktopInvalidGrant
		}
		if a.RedirectURI != redirect || a.ClientID != clientID || subtle.ConstantTimeCompare([]byte(a.CodeChallenge), []byte(challenge)) != 1 {
			return ErrDesktopInvalidGrant
		}
		if e := tx.First(&user, a.UserID).Error; e != nil {
			return e
		}
		key, e := common.GenerateKey()
		if e != nil {
			return e
		}
		apiKey = key
		token := model.Token{UserId: a.UserID, Name: a.ClientName, Key: key, Status: common.TokenStatusEnabled, CreatedTime: common.GetTimestamp(), AccessedTime: common.GetTimestamp(), ExpiredTime: -1, UnlimitedQuota: true}
		if e = tx.Create(&token).Error; e != nil {
			return e
		}
		sid, e := opaque(24)
		if e != nil {
			return e
		}
		refresh, e = opaque(32)
		if e != nil {
			return e
		}
		now := time.Now().Unix()
		session = model.DesktopSession{ID: sid, UserID: a.UserID, RelayTokenID: token.Id, ClientName: a.ClientName, RefreshHash: secretHash(refresh), CreatedAt: now, LastRefreshedAt: now, ExpiresAt: now + int64(system_setting.GetDesktopSettings().RefreshTokenDays)*86400}
		if e = tx.Create(&session).Error; e != nil {
			return e
		}
		r := tx.Model(&model.DesktopAuthorization{}).Where("id = ? AND status = ?", a.ID, "approved").Update("status", "consumed")
		if r.Error != nil {
			return r.Error
		}
		if r.RowsAffected != 1 {
			return ErrDesktopInvalidGrant
		}
		return nil
	})
	if err != nil {
		return "", "", "", 0, err
	}
	ttl := time.Duration(system_setting.GetDesktopSettings().AccessTokenMinutes) * time.Minute
	access, err = issueDesktopToken(&user, session.RelayTokenID, DesktopTokenTypeAccess, ttl, session.ID)
	return access, refresh, "sk-" + apiKey, int(ttl.Seconds()), err
}

func RotateDesktopRefresh(raw string) (string, string, int, error) {
	h := secretHash(raw)
	if _, err := loadDesktopSigningKey(); err != nil {
		return "", "", 0, err
	}
	var s model.DesktopSession
	var user model.User
	var relay model.Token
	var access string
	var relayKeyToInvalidate string
	replayed := false
	next, err := opaque(32)
	if err != nil {
		return "", "", 0, err
	}
	err = model.DB.Transaction(func(tx *gorm.DB) error {
		now := time.Now().Unix()
		// This write is deliberately the first database statement. It acquires
		// SQLite's writer lock before any read and remains an atomic compare-and-
		// swap on MySQL/PostgreSQL, so only one caller can rotate this secret.
		r := tx.Model(&model.DesktopSession{}).
			Where("refresh_hash = ? AND revoked_at = 0 AND expires_at > ?", h, now).
			Updates(map[string]any{"previous_hash": h, "refresh_hash": secretHash(next), "last_refreshed_at": now})
		if r.Error != nil {
			return r.Error
		}
		if r.RowsAffected != 1 {
			if e := tx.Where("previous_hash = ? AND revoked_at = 0", h).First(&s).Error; e != nil {
				if errors.Is(e, gorm.ErrRecordNotFound) {
					return ErrDesktopInvalidGrant
				}
				return e
			}
			var e error
			relayKeyToInvalidate, e = revokeDesktopSessionInTx(tx, &s, now)
			if e != nil {
				return e
			}
			replayed = true
			return nil
		}
		if e := tx.Where("refresh_hash = ?", secretHash(next)).First(&s).Error; e != nil {
			return e
		}
		if e := tx.First(&user, s.UserID).Error; e != nil || user.Status != common.UserStatusEnabled {
			return ErrDesktopInvalidGrant
		}
		if e := tx.Where("id = ? AND user_id = ?", s.RelayTokenID, s.UserID).First(&relay).Error; e != nil || relay.Status != common.TokenStatusEnabled {
			return ErrDesktopInvalidGrant
		}
		ttl := time.Duration(system_setting.GetDesktopSettings().AccessTokenMinutes) * time.Minute
		var e error
		access, e = issueDesktopToken(&user, s.RelayTokenID, DesktopTokenTypeAccess, ttl, s.ID)
		return e
	})
	if relayKeyToInvalidate != "" {
		if cacheErr := model.InvalidateTokenCache(relayKeyToInvalidate); cacheErr != nil {
			return "", "", 0, cacheErr
		}
	}
	if err != nil {
		return "", "", 0, err
	}
	if replayed {
		return "", "", 0, ErrDesktopInvalidGrant
	}
	ttl := time.Duration(system_setting.GetDesktopSettings().AccessTokenMinutes) * time.Minute
	return access, next, int(ttl.Seconds()), nil
}

func RevokeDesktopRefresh(raw string) error {
	var relayKey string
	err := model.DB.Transaction(func(tx *gorm.DB) error {
		var s model.DesktopSession
		if e := tx.Where("refresh_hash = ? OR previous_hash = ?", secretHash(raw), secretHash(raw)).First(&s).Error; e != nil {
			if errors.Is(e, gorm.ErrRecordNotFound) {
				return nil
			}
			return e
		}
		var e error
		relayKey, e = revokeDesktopSessionInTx(tx, &s, time.Now().Unix())
		return e
	})
	if err == nil {
		err = model.InvalidateTokenCache(relayKey)
	}
	return err
}
func ListDesktopSessions(userID int) ([]model.DesktopSession, error) {
	var s []model.DesktopSession
	err := model.DB.Where("user_id = ? AND revoked_at = 0", userID).Order("created_at desc").Find(&s).Error
	return s, err
}
func RevokeDesktopSession(userID int, id string) error {
	var relayKey string
	err := model.DB.Transaction(func(tx *gorm.DB) error {
		var s model.DesktopSession
		if e := tx.Where("id = ? AND user_id = ?", id, userID).First(&s).Error; e != nil {
			return e
		}
		var e error
		relayKey, e = revokeDesktopSessionInTx(tx, &s, time.Now().Unix())
		return e
	})
	if err == nil {
		err = model.InvalidateTokenCache(relayKey)
	}
	return err
}

func revokeDesktopSessionInTx(tx *gorm.DB, session *model.DesktopSession, now int64) (string, error) {
	if err := tx.Model(&model.DesktopSession{}).Where("id = ? AND user_id = ?", session.ID, session.UserID).Update("revoked_at", now).Error; err != nil {
		return "", err
	}
	var relay model.Token
	if err := tx.Where("id = ? AND user_id = ?", session.RelayTokenID, session.UserID).First(&relay).Error; err != nil {
		return "", err
	}
	if err := tx.Model(&model.Token{}).Where("id = ? AND user_id = ?", session.RelayTokenID, session.UserID).Update("status", common.TokenStatusDisabled).Error; err != nil {
		return "", err
	}
	return relay.Key, nil
}

func GetActiveDesktopSession(accessToken string) (*model.DesktopSession, error) {
	claims, err := ParseDesktopToken(accessToken, DesktopTokenTypeAccess)
	if err != nil || claims.SessionID == "" || claims.RelayTokenId == 0 {
		return nil, ErrDesktopInvalidGrant
	}
	userID, err := strconv.Atoi(claims.Subject)
	if err != nil || userID <= 0 {
		return nil, ErrDesktopInvalidGrant
	}
	var session model.DesktopSession
	now := time.Now().Unix()
	if err = model.DB.Where("id = ? AND user_id = ? AND relay_token_id = ? AND revoked_at = 0 AND expires_at > ?", claims.SessionID, userID, claims.RelayTokenId, now).First(&session).Error; err != nil {
		return nil, ErrDesktopInvalidGrant
	}
	var relay model.Token
	if err = model.DB.Where("id = ? AND user_id = ? AND status = ?", session.RelayTokenID, userID, common.TokenStatusEnabled).First(&relay).Error; err != nil {
		return nil, ErrDesktopInvalidGrant
	}
	var user model.User
	if err = model.DB.Where("id = ? AND status = ?", userID, common.UserStatusEnabled).First(&user).Error; err != nil {
		return nil, ErrDesktopInvalidGrant
	}
	return &session, nil
}
