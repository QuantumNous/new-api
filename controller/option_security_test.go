package controller

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func initOptionTestDBForController(t *testing.T) {
	t.Helper()

	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Option{}))
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)

	originalDB := model.DB
	model.DB = db
	t.Cleanup(func() {
		model.DB = originalDB
	})
}

func TestUpdateOptionReturnsMissingCryptoKeyErrorForAlipaySecret(t *testing.T) {
	gin.SetMode(gin.TestMode)
	initOptionTestDBForController(t)
	t.Setenv("OPTION_CRYPT_KEY", "")

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(
		http.MethodPut,
		"/api/option/",
		bytes.NewBufferString(`{"key":"AlipayPrivateKey","value":"private-value"}`),
	)
	c.Request.Header.Set("Content-Type", "application/json")

	UpdateOption(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"success":false`)
	require.Contains(t, recorder.Body.String(), "OPTION_CRYPT_KEY is required")
	require.NotContains(t, recorder.Body.String(), "private-value")
}

func TestGetOptionsOmitsProtectedAlipayKeys(t *testing.T) {
	gin.SetMode(gin.TestMode)

	common.OptionMapRWMutex.Lock()
	originalMap := common.OptionMap
	common.OptionMap = map[string]string{
		"AlipayPrivateKey": "private-value",
		"AlipayPublicKey":  "public-value",
		"AlipayEncryptKey": "encrypt-value",
		"AlipayGateway":    "https://openapi.alipay.com/gateway.do",
	}
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		common.OptionMap = originalMap
		common.OptionMapRWMutex.Unlock()
	})

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)

	GetOptions(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.NotContains(t, recorder.Body.String(), "AlipayPrivateKey")
	require.NotContains(t, recorder.Body.String(), "AlipayPublicKey")
	require.NotContains(t, recorder.Body.String(), "AlipayEncryptKey")
	require.Contains(t, recorder.Body.String(), "AlipayGateway")
}
