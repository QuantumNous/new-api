package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestValidateImageAutoBillingRequestID(t *testing.T) {
	require.NoError(t, validateImageAutoBillingRequestID("202607220001abcDEF"))
	require.Error(t, validateImageAutoBillingRequestID(""))
	require.Error(t, validateImageAutoBillingRequestID("../../logs"))
	require.Error(t, validateImageAutoBillingRequestID(strings.Repeat("a", 65)))
}

func TestReadImageAutoBillingSettlementStatus(t *testing.T) {
	status := readImageAutoBillingSettlementStatus(`{"admin_info":{"image_auto_billing":{"settlement_status":"settled","billing_model":"do-not-return"}}}`)
	require.Equal(t, "settled", status)
	require.Empty(t, readImageAutoBillingSettlementStatus(`not-json`))
}

func TestStudioImageBillingReadsOnlyTheCallingTokenLedger(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Log{}, &model.ImageAutoBillingJournal{}))
	oldDB := model.DB
	oldLogDB := model.LOG_DB
	model.DB = db
	model.LOG_DB = db
	t.Cleanup(func() {
		model.DB = oldDB
		model.LOG_DB = oldLogDB
	})

	requestID := "202607220001abcDEF"
	require.NoError(t, db.Create(&model.Log{
		UserId: 1, TokenId: 9, Type: model.LogTypeConsume, ModelName: imageAutoPublicModel,
		RequestId: requestID, Quota: 100000,
		Other: `{"admin_info":{"image_auto_billing":{"settlement_status":"settled"}}}`,
	}).Error)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{{Key: "request_id", Value: requestID}}
	c.Set("id", 1)
	c.Set("token_id", 9)
	StudioImageBilling(c)

	require.Equal(t, http.StatusOK, w.Code)
	var response map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &response))
	require.Equal(t, true, response["found"])
	require.Equal(t, "settled", response["settlement_status"])

	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	c.Params = gin.Params{{Key: "request_id", Value: requestID}}
	c.Set("id", 1)
	c.Set("token_id", 10)
	StudioImageBilling(c)
	require.Equal(t, http.StatusAccepted, w.Code)
}

func TestStudioImageBillingPrefersOwnedDurableJournalForEveryState(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Log{}, &model.ImageAutoBillingJournal{}))
	oldDB := model.DB
	oldLogDB := model.LOG_DB
	model.DB = db
	model.LOG_DB = db
	t.Cleanup(func() {
		model.DB = oldDB
		model.LOG_DB = oldLogDB
	})

	tests := []struct {
		requestID string
		status    string
		actual    int
		pending   bool
		charged   int
	}{
		{requestID: "202607220071reserved", status: model.ImageAutoBillingStatusReserved, pending: true},
		{requestID: "202607220072settlepending", status: model.ImageAutoBillingStatusSettlementPending, actual: 150, pending: true, charged: 150},
		{requestID: "202607220076review", status: model.ImageAutoBillingStatusSettlementReview, pending: true},
		{requestID: "202607220073refundpending", status: model.ImageAutoBillingStatusRefundPending, pending: true},
		{requestID: "202607220074settled", status: model.ImageAutoBillingStatusSettled, actual: 150, charged: 150},
		{requestID: "202607220075refunded", status: model.ImageAutoBillingStatusRefunded},
	}
	for _, tt := range tests {
		require.NoError(t, db.Create(&model.ImageAutoBillingJournal{
			RequestId: tt.requestID, UserId: 71, TokenId: 72,
			FundingSource: model.ImageAutoBillingFundingWallet,
			ReservedQuota: 400, ActualQuota: tt.actual, Status: tt.status,
			LastError: "must-not-leak",
		}).Error)
	}
	// A conflicting legacy log proves the main-DB journal is authoritative.
	require.NoError(t, db.Create(&model.Log{
		UserId: 71, TokenId: 72, Type: model.LogTypeConsume, ModelName: imageAutoPublicModel,
		RequestId: "202607220075refunded", Quota: 999,
		Other: `{"admin_info":{"image_auto_billing":{"settlement_status":"settled"}}}`,
	}).Error)

	for _, tt := range tests {
		t.Run(tt.status, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			c.Params = gin.Params{{Key: "request_id", Value: tt.requestID}}
			c.Set("id", 71)
			c.Set("token_id", 72)
			StudioImageBilling(c)

			require.Equal(t, http.StatusOK, w.Code)
			var response map[string]any
			require.NoError(t, json.Unmarshal(w.Body.Bytes(), &response))
			require.Equal(t, true, response["found"])
			require.Equal(t, tt.pending, response["pending"])
			require.Equal(t, tt.status, response["settlement_status"])
			require.Equal(t, float64(tt.charged), response["charged_quota"])
			require.NotContains(t, response, "reserved_quota")
			require.NotContains(t, response, "funding_source")
			require.NotContains(t, response, "user_id")
			require.NotContains(t, response, "token_id")
			require.NotContains(t, response, "last_error")
		})
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Params = gin.Params{{Key: "request_id", Value: "202607220074settled"}}
	c.Set("id", 71)
	c.Set("token_id", 999)
	StudioImageBilling(c)
	require.Equal(t, http.StatusAccepted, w.Code)
}
