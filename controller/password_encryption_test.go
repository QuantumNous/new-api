package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetPasswordEncryptionKeyReturnsPublicKey(t *testing.T) {
	require.NoError(t, common.InitPasswordEncryption())

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/user/login/encryption-key", nil)

	GetPasswordEncryptionKey(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	var response struct {
		Success bool `json:"success"`
		Data    struct {
			Kid       string `json:"kid"`
			PublicKey string `json:"public_key"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.True(t, response.Success)
	assert.NotEmpty(t, response.Data.Kid)
	assert.Contains(t, response.Data.PublicKey, "BEGIN PUBLIC KEY")
	assert.NotContains(t, response.Data.PublicKey, "PRIVATE KEY")
}

func TestRegisterRequestDecodesEncryptedPasswordFields(t *testing.T) {
	body := `{"username":"alice","email":"alice@example.com","password_encrypted":"cipher","encryption_key_id":"kid1"}`
	var request registerRequest
	require.NoError(t, common.UnmarshalJsonStr(body, &request))
	assert.Equal(t, "alice", request.Username)
	assert.Equal(t, "alice@example.com", request.Email)
	assert.Equal(t, "cipher", request.PasswordEncrypted)
	assert.Equal(t, "kid1", request.EncryptionKeyID)
}
