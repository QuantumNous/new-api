package controller

import (
	"bytes"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupPasswordEncryptionRouter(t *testing.T) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	store := cookie.NewStore([]byte("secret"))
	r.Use(sessions.Sessions("mysession", store))
	r.GET("/api/user/login/encryption-key", GetPasswordEncryptionKey)
	r.POST("/api/user/login", Login)
	return r
}

func encryptTestPassword(t *testing.T, password string, pubKeyPEM string) string {
	block, _ := pem.Decode([]byte(pubKeyPEM))
	require.NotNil(t, block)
	parsedPubKey, err := x509.ParsePKIXPublicKey(block.Bytes)
	require.NoError(t, err)
	rsaPubKey, ok := parsedPubKey.(*rsa.PublicKey)
	require.True(t, ok)

	ciphertext, err := rsa.EncryptOAEP(sha256.New(), rand.Reader, rsaPubKey, []byte(password), nil)
	require.NoError(t, err)
	return base64.StdEncoding.EncodeToString(ciphertext)
}

func TestGetPasswordEncryptionKeyDisabled(t *testing.T) {
	oldEnabled := common.PasswordLoginEncryptionEnabled
	defer func() { common.PasswordLoginEncryptionEnabled = oldEnabled }()
	common.PasswordLoginEncryptionEnabled = false

	r := setupPasswordEncryptionRouter(t)
	req := httptest.NewRequest(http.MethodGet, "/api/user/login/encryption-key", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			Enabled bool `json:"enabled"`
		} `json:"data"`
	}
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.True(t, resp.Success)
	assert.False(t, resp.Data.Enabled)
}

func TestGetPasswordEncryptionKeyEnabled(t *testing.T) {
	db := setupUserSelfControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.LoginEncryptionKey{}))
	require.NoError(t, model.InitPasswordEncryption())

	oldEnabled := common.PasswordLoginEncryptionEnabled
	defer func() { common.PasswordLoginEncryptionEnabled = oldEnabled }()
	common.PasswordLoginEncryptionEnabled = true

	r := setupPasswordEncryptionRouter(t)
	req := httptest.NewRequest(http.MethodGet, "/api/user/login/encryption-key", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp struct {
		Success bool `json:"success"`
		Data    struct {
			Enabled   bool   `json:"enabled"`
			KID       string `json:"kid"`
			PublicKey string `json:"public_key"`
		} `json:"data"`
	}
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(t, err)
	assert.True(t, resp.Success)
	assert.True(t, resp.Data.Enabled)
	assert.NotEmpty(t, resp.Data.KID)
	assert.NotEmpty(t, resp.Data.PublicKey)
}

func TestLoginWithEncryptionDisabledAcceptsPlaintext(t *testing.T) {
	db := setupUserSelfControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.TwoFA{}))
	user := &model.User{Username: "plainuser", Password: "correctpass"}
	require.NoError(t, user.Insert(0))

	oldLoginEnabled := common.PasswordLoginEnabled
	oldEncEnabled := common.PasswordLoginEncryptionEnabled
	defer func() {
		common.PasswordLoginEnabled = oldLoginEnabled
		common.PasswordLoginEncryptionEnabled = oldEncEnabled
	}()
	common.PasswordLoginEnabled = true
	common.PasswordLoginEncryptionEnabled = false

	r := setupPasswordEncryptionRouter(t)

	// Plaintext correct login
	payload, _ := json.Marshal(LoginRequest{
		Username: "plainuser",
		Password: "correctpass",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/user/login", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	var resp struct {
		Success bool `json:"success"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.True(t, resp.Success)
}

func TestLoginWithEncryptionEnabledEnforcesDecryption(t *testing.T) {
	db := setupUserSelfControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.LoginEncryptionKey{}, &model.TwoFA{}))
	require.NoError(t, model.InitPasswordEncryption())

	user := &model.User{Username: "encuser", Password: "correctpass"}
	require.NoError(t, user.Insert(0))

	oldLoginEnabled := common.PasswordLoginEnabled
	oldEncEnabled := common.PasswordLoginEncryptionEnabled
	defer func() {
		common.PasswordLoginEnabled = oldLoginEnabled
		common.PasswordLoginEncryptionEnabled = oldEncEnabled
	}()
	common.PasswordLoginEnabled = true
	common.PasswordLoginEncryptionEnabled = true

	keyID, pubKeyPEM := common.PasswordEncryptionPublicKey()
	require.NotEmpty(t, keyID)
	require.NotEmpty(t, pubKeyPEM)

	r := setupPasswordEncryptionRouter(t)

	// Case 1: Plaintext only (missing encrypted password and key ID) -> Rejected
	{
		payload, _ := json.Marshal(LoginRequest{
			Username: "encuser",
			Password: "correctpass",
		})
		req := httptest.NewRequest(http.MethodPost, "/api/user/login", bytes.NewReader(payload))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		var resp struct {
			Success bool `json:"success"`
		}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		assert.False(t, resp.Success)
	}

	// Case 2: Tampered ciphertext -> Rejected
	{
		payload, _ := json.Marshal(LoginRequest{
			Username:          "encuser",
			PasswordEncrypted: base64.StdEncoding.EncodeToString([]byte("invalid")),
			EncryptionKeyID:   keyID,
		})
		req := httptest.NewRequest(http.MethodPost, "/api/user/login", bytes.NewReader(payload))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		var resp struct {
			Success bool `json:"success"`
		}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		assert.False(t, resp.Success)
	}

	// Case 3: Wrong Key ID -> Rejected
	{
		encrypted := encryptTestPassword(t, "correctpass", pubKeyPEM)
		payload, _ := json.Marshal(LoginRequest{
			Username:          "encuser",
			PasswordEncrypted: encrypted,
			EncryptionKeyID:   "wrong-key-id",
		})
		req := httptest.NewRequest(http.MethodPost, "/api/user/login", bytes.NewReader(payload))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		var resp struct {
			Success bool `json:"success"`
		}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		assert.False(t, resp.Success)
	}

	// Case 4: Correct encryption of correct password -> Success
	{
		encrypted := encryptTestPassword(t, "correctpass", pubKeyPEM)
		payload, _ := json.Marshal(LoginRequest{
			Username:          "encuser",
			PasswordEncrypted: encrypted,
			EncryptionKeyID:   keyID,
		})
		req := httptest.NewRequest(http.MethodPost, "/api/user/login", bytes.NewReader(payload))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		var resp struct {
			Success bool `json:"success"`
		}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		assert.True(t, resp.Success)
	}

	// Case 5: Correct encryption of wrong password -> Rejected
	{
		encrypted := encryptTestPassword(t, "wrongpassword", pubKeyPEM)
		payload, _ := json.Marshal(LoginRequest{
			Username:          "encuser",
			PasswordEncrypted: encrypted,
			EncryptionKeyID:   keyID,
		})
		req := httptest.NewRequest(http.MethodPost, "/api/user/login", bytes.NewReader(payload))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		var resp struct {
			Success bool `json:"success"`
		}
		require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
		assert.False(t, resp.Success)
	}
}
