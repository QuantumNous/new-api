package controller

import (
	"bytes"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupImageAutoBillingReviewControllerTest(t *testing.T) *gorm.DB {
	t.Helper()
	oldDB := model.DB
	oldRedisEnabled := common.RedisEnabled
	oldRDB := common.RDB
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "image-auto-review.db")), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Token{}, &model.ImageAutoBillingJournal{}))
	sqlDB, err := db.DB()
	require.NoError(t, err)
	model.DB = db
	common.RedisEnabled = false
	common.RDB = nil
	t.Cleanup(func() {
		require.NoError(t, sqlDB.Close())
		model.DB = oldDB
		common.RedisEnabled = oldRedisEnabled
		common.RDB = oldRDB
	})
	return db
}

func performImageAutoBillingReviewResolve(body string) *httptest.ResponseRecorder {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/review/resolve", ResolveImageAutoBillingReview)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/review/resolve", bytes.NewBufferString(body))
	request.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(recorder, request)
	return recorder
}

func createImageAutoBillingReviewFixture(t *testing.T, db *gorm.DB, requestID string) {
	t.Helper()
	user := model.User{Id: 901, Username: "review-controller-user", Password: "password", Quota: 1000}
	token := model.Token{Id: 902, UserId: user.Id, Key: "review-controller-token", RemainQuota: 1000}
	require.NoError(t, db.Create(&user).Error)
	require.NoError(t, db.Create(&token).Error)
	_, err := model.ReserveImageAutoBilling(model.ImageAutoBillingReserveParams{
		RequestId:     requestID,
		UserId:        user.Id,
		TokenId:       token.Id,
		ReservedQuota: 400,
		FundingSource: model.ImageAutoBillingFundingWallet,
	})
	require.NoError(t, err)
}

func TestResolveImageAutoBillingReviewRejectsReservedJournal(t *testing.T) {
	db := setupImageAutoBillingReviewControllerTest(t)
	createImageAutoBillingReviewFixture(t, db, "controller-reserved")

	response := performImageAutoBillingReviewResolve(
		`{"request_id":"controller-reserved","actual_quota":150}`,
	)

	assert.Equal(t, http.StatusConflict, response.Code)
	journal, err := model.GetImageAutoBillingJournalByRequestId("controller-reserved")
	require.NoError(t, err)
	require.NotNil(t, journal)
	assert.Equal(t, model.ImageAutoBillingStatusReserved, journal.Status)
}

func TestResolveImageAutoBillingReviewRejectsQuotaOutsideDatabaseBounds(t *testing.T) {
	for _, quota := range []int64{-1, int64(common.MaxQuota) + 1} {
		t.Run(fmt.Sprintf("quota_%d", quota), func(t *testing.T) {
			response := performImageAutoBillingReviewResolve(fmt.Sprintf(
				`{"request_id":"controller-bounds","actual_quota":%d}`, quota,
			))

			assert.Equal(t, http.StatusBadRequest, response.Code)
			assert.Contains(t, response.Body.String(), fmt.Sprintf("[0, %d]", common.MaxQuota))
		})
	}
}

func TestResolveImageAutoBillingReviewSettlesReviewJournal(t *testing.T) {
	db := setupImageAutoBillingReviewControllerTest(t)
	createImageAutoBillingReviewFixture(t, db, "controller-success")
	require.NoError(t, model.MarkImageAutoBillingSettlementReview("controller-success", nil))

	response := performImageAutoBillingReviewResolve(
		`{"request_id":"controller-success","actual_quota":150}`,
	)

	assert.Equal(t, http.StatusOK, response.Code, response.Body.String())
	journal, err := model.GetImageAutoBillingJournalByRequestId("controller-success")
	require.NoError(t, err)
	require.NotNil(t, journal)
	assert.Equal(t, model.ImageAutoBillingStatusSettled, journal.Status)
	assert.Equal(t, 150, journal.ActualQuota)
	var user model.User
	var token model.Token
	require.NoError(t, db.First(&user, 901).Error)
	require.NoError(t, db.First(&token, 902).Error)
	assert.Equal(t, 850, user.Quota)
	assert.Equal(t, 850, token.RemainQuota)
	assert.Equal(t, 150, token.UsedQuota)
}
