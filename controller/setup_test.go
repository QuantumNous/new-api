package controller

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupSetupTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	previousDB := model.DB
	previousSetup := constant.Setup
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Option{}, &model.Setup{}))
	model.DB = db
	constant.Setup = false
	require.NoError(t, i18n.Init())
	t.Cleanup(func() {
		model.DB = previousDB
		constant.Setup = previousSetup
	})
	return db
}

func TestPostSetupRejectsWeakAdminPassword(t *testing.T) {
	setupSetupTestDB(t)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(
		http.MethodPost,
		"/api/setup",
		strings.NewReader(`{"username":"admin","password":"abcdefgh","confirmPassword":"abcdefgh"}`),
	)
	c.Request.Header.Set("Content-Type", "application/json")
	c.Request.Header.Set("Accept-Language", "zh-CN")

	PostSetup(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	var response struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.False(t, response.Success)
	assert.Contains(t, response.Message, "密码强度不足")
}

func TestPostSetupRejectsWeakEncryptedPassword(t *testing.T) {
	setupSetupTestDB(t)
	require.NoError(t, common.InitPasswordEncryption())

	kid, publicKeyPEM := common.PasswordEncryptionPublicKey()
	require.NotEmpty(t, kid)
	require.NotEmpty(t, publicKeyPEM)

	block, _ := pem.Decode([]byte(publicKeyPEM))
	publicKeyAny, err := x509.ParsePKIXPublicKey(block.Bytes)
	require.NoError(t, err)
	publicKey, ok := publicKeyAny.(*rsa.PublicKey)
	require.True(t, ok)

	ciphertext, err := rsa.EncryptOAEP(sha256.New(), rand.Reader, publicKey, []byte("abcdefgh"), nil)
	require.NoError(t, err)

	body := fmt.Sprintf(
		`{"username":"admin","password_encrypted":"%s","encryption_key_id":"%s"}`,
		base64.StdEncoding.EncodeToString(ciphertext),
		kid,
	)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/setup", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Request.Header.Set("Accept-Language", "zh-CN")

	PostSetup(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	var response struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.False(t, response.Success)
	assert.Contains(t, response.Message, "密码强度不足")
}

func TestPostSetupSucceedsWithEncryptedPasswordWithoutConfirmPassword(t *testing.T) {
	setupSetupTestDB(t)
	model.InitOptionMap()
	require.NoError(t, common.InitPasswordEncryption())

	kid, publicKeyPEM := common.PasswordEncryptionPublicKey()
	require.NotEmpty(t, kid)
	require.NotEmpty(t, publicKeyPEM)

	block, _ := pem.Decode([]byte(publicKeyPEM))
	require.NotNil(t, block)
	publicKeyAny, err := x509.ParsePKIXPublicKey(block.Bytes)
	require.NoError(t, err)
	publicKey, ok := publicKeyAny.(*rsa.PublicKey)
	require.True(t, ok)

	ciphertext, err := rsa.EncryptOAEP(sha256.New(), rand.Reader, publicKey, []byte("Admin123!"), nil)
	require.NoError(t, err)

	// The web client validates confirmPassword in the form and omits it from the
	// encrypted payload; the server must accept that contract.
	body := fmt.Sprintf(
		`{"username":"admin","password_encrypted":"%s","encryption_key_id":"%s","SelfUseModeEnabled":true}`,
		base64.StdEncoding.EncodeToString(ciphertext),
		kid,
	)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/setup", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")

	PostSetup(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	var response struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.True(t, response.Success)
	assert.Contains(t, response.Message, "系统初始化成功")
}
