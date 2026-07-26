package service

import (
	"crypto/sha256"
	"encoding/base64"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupDesktopAuthorizationTest(t *testing.T) *model.User {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Token{}, &model.Option{}, &model.DesktopAuthorization{}, &model.DesktopSession{}))
	old := model.DB
	model.DB = db
	desktopKeyCache = nil
	t.Cleanup(func() { model.DB = old; desktopKeyCache = nil })
	u := &model.User{Username: "desktop", Email: "desktop@example.com", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(u).Error)
	return u
}

func pkce(verifier string) string {
	sum := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}

const desktopTestState = "0123456789012345678901"

func TestDesktopRedirectValidation(t *testing.T) {
	valid := []string{"http://127.0.0.1:1/auth/callback", "http://127.0.0.1:65535/auth/callback"}
	for _, redirect := range valid {
		assert.NoError(t, ValidateDesktopRedirect(redirect))
	}
	invalid := []string{"https://127.0.0.1:1234/auth/callback", "http://localhost:1234/auth/callback", "http://127.0.0.1/auth/callback", "http://127.0.0.1:0/auth/callback", "http://127.0.0.1:1234/other", "http://127.0.0.1:1234/auth/callback?x=1"}
	for _, redirect := range invalid {
		assert.Error(t, ValidateDesktopRedirect(redirect), redirect)
	}
}

func TestDesktopAuthorizationPKCEReplayRotationAndLinkage(t *testing.T) {
	u := setupDesktopAuthorizationTest(t)
	verifier := "0123456789012345678901234567890123456789012"
	redirect := "http://127.0.0.1:49152/auth/callback"
	a, err := CreateDesktopAuthorization(DesktopClientID, redirect, pkce(verifier), "S256", desktopTestState, "Laptop")
	require.NoError(t, err)
	var before int64
	require.NoError(t, model.DB.Model(&model.Token{}).Count(&before).Error)
	assert.Zero(t, before, "approval request must not create a relay token")
	code, _, err := DecideDesktopAuthorization(a.ID, u.Id, true)
	require.NoError(t, err)
	require.NotEmpty(t, code)
	_, _, _, _, err = ExchangeDesktopCode(code, verifier+"x", DesktopClientID, redirect)
	assert.ErrorIs(t, err, ErrDesktopInvalidGrant, "wrong verifier must not consume the code")
	access, refresh, apiKey, _, err := ExchangeDesktopCode(code, verifier, DesktopClientID, redirect)
	require.NoError(t, err)
	assert.NotEmpty(t, access)
	assert.NotEmpty(t, refresh)
	assert.Contains(t, apiKey, "sk-")
	_, _, _, _, err = ExchangeDesktopCode(code, verifier, DesktopClientID, redirect)
	assert.ErrorIs(t, err, ErrDesktopInvalidGrant)
	var session model.DesktopSession
	require.NoError(t, model.DB.First(&session).Error)
	assert.NotZero(t, session.RelayTokenID)
	assert.NotEqual(t, refresh, session.RefreshHash)
	active, err := GetActiveDesktopSession(access)
	require.NoError(t, err)
	assert.Equal(t, session.ID, active.ID)
	_, rotated, _, err := RotateDesktopRefresh(refresh)
	require.NoError(t, err)
	assert.NotEqual(t, refresh, rotated)
	_, _, _, err = RotateDesktopRefresh(refresh)
	assert.ErrorIs(t, err, ErrDesktopInvalidGrant)
	require.NoError(t, model.DB.First(&session, "id = ?", session.ID).Error)
	assert.NotZero(t, session.RevokedAt, "replay revokes the whole session")
	var relay model.Token
	require.NoError(t, model.DB.Unscoped().First(&relay, session.RelayTokenID).Error)
	assert.Equal(t, common.TokenStatusDisabled, relay.Status)
	_, err = GetActiveDesktopSession(access)
	assert.ErrorIs(t, err, ErrDesktopInvalidGrant, "revocation must invalidate an unexpired access JWT")
}

func TestDesktopAuthorizationDenial(t *testing.T) {
	u := setupDesktopAuthorizationTest(t)
	verifier := "0123456789012345678901234567890123456789012"
	a, err := CreateDesktopAuthorization(DesktopClientID, "http://127.0.0.1:9000/auth/callback", pkce(verifier), "S256", desktopTestState, "Laptop")
	require.NoError(t, err)
	code, decided, err := DecideDesktopAuthorization(a.ID, u.Id, false)
	require.NoError(t, err)
	assert.Empty(t, code)
	assert.Equal(t, "denied", decided.Status)
	_, _, _, _, err = ExchangeDesktopCode(code, verifier, DesktopClientID, a.RedirectURI)
	assert.ErrorIs(t, err, ErrDesktopInvalidGrant)
}

func TestDesktopAuthorizationAllowsMultiplePendingAndDeniedRequests(t *testing.T) {
	u := setupDesktopAuthorizationTest(t)
	verifier := "0123456789012345678901234567890123456789012"
	redirect := "http://127.0.0.1:9001/auth/callback"

	first, err := CreateDesktopAuthorization(DesktopClientID, redirect, pkce(verifier), "S256", desktopTestState, "First")
	require.NoError(t, err)
	second, err := CreateDesktopAuthorization(DesktopClientID, redirect, pkce(verifier), "S256", desktopTestState+"x", "Second")
	require.NoError(t, err)
	_, _, err = DecideDesktopAuthorization(first.ID, u.Id, false)
	require.NoError(t, err)
	_, _, err = DecideDesktopAuthorization(second.ID, u.Id, false)
	require.NoError(t, err)
	_, err = CreateDesktopAuthorization(DesktopClientID, redirect, pkce(verifier), "S256", desktopTestState+"y", "Third")
	require.NoError(t, err)
}
