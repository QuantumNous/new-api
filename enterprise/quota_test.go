/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
package enterprise

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

const (
	quotaTestEnterpriseID = 1
	quotaTestAdminUserID  = 1
	quotaTestMember1ID    = 2
	quotaTestMember2ID    = 3
)

// setupQuotaTestDB returns an in-memory SQLite DB migrated for quota tests,
// with one enabled enterprise, its admin, two regular members, and matching
// user rows. The admin starts with a known quota balance.
func setupQuotaTestDB(t *testing.T, adminQuota int) *gorm.DB {
	t.Helper()
	gin.SetMode(gin.TestMode)
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RedisEnabled = false

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)

	require.NoError(t, db.AutoMigrate(&Enterprise{}, &Member{}, &Invitation{}, &JoinRequest{}, &Tag{}, &MemberTag{}, &QuotaRecord{}, &model.User{}, &model.Log{}))

	now := common.GetTimestamp()
	require.NoError(t, db.Create(&Enterprise{Id: quotaTestEnterpriseID, Name: "Acme", Status: EnterpriseStatusEnabled, AdminUserId: quotaTestAdminUserID, CreatedTime: now, UpdatedTime: now}).Error)
	require.NoError(t, db.Create(&Member{EnterpriseId: quotaTestEnterpriseID, UserId: quotaTestMember1ID, Role: MemberRoleUser, Status: MemberStatusActive, JoinedAt: now}).Error)
	require.NoError(t, db.Create(&Member{EnterpriseId: quotaTestEnterpriseID, UserId: quotaTestMember2ID, Role: MemberRoleUser, Status: MemberStatusActive, JoinedAt: now}).Error)
	require.NoError(t, db.Create(&model.User{Id: quotaTestAdminUserID, Username: "admin", Password: "password123", AffCode: "admin", Quota: adminQuota}).Error)
	require.NoError(t, db.Create(&model.User{Id: quotaTestMember1ID, Username: "alice", Password: "password123", AffCode: "alice"}).Error)
	require.NoError(t, db.Create(&model.User{Id: quotaTestMember2ID, Username: "bob", Password: "password123", AffCode: "bob"}).Error)

	model.DB = db
	model.LOG_DB = db
	return db
}

// distributeContext builds a gin context for a POST /quota/distribute request
// body, set up so distributeQuota runs as the enterprise admin without going
// through EnterpriseAdminAuth.
func distributeContext(t *testing.T, adminID int, body any) (*gin.Context, *httptest.ResponseRecorder) {
	t.Helper()
	payload, err := common.Marshal(body)
	require.NoError(t, err)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/quota/distribute", bytes.NewReader(payload))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Set("id", adminID)
	ctx.Set(enterpriseIDContextKey, quotaTestEnterpriseID)
	return ctx, recorder
}

// TestDistributeQuota_WritesRecordsAndAccumulates verifies that a successful
// distribution writes one QuotaRecord per recipient, accumulates each member's
// received_quota, and transfers user quota correctly.
func TestDistributeQuota_WritesRecordsAndAccumulates(t *testing.T) {
	db := setupQuotaTestDB(t, 1_000_000)
	initI18nOnce(t)

	ctx, recorder := distributeContext(t, quotaTestAdminUserID, distributeQuotaRequest{
		MemberIds: []int{quotaTestMember1ID, quotaTestMember2ID},
		Amount:    500,
	})
	distributeQuota(ctx)
	require.Equal(t, http.StatusOK, recorder.Code, "body=%s", recorder.Body.String())

	// One record per recipient, each carrying the per-member amount.
	var records []QuotaRecord
	require.NoError(t, db.Where("enterprise_id = ?", quotaTestEnterpriseID).Order("member_user_id ASC").Find(&records).Error)
	require.Len(t, records, 2)
	assert.Equal(t, quotaTestAdminUserID, records[0].AdminUserId)
	assert.Equal(t, quotaTestMember1ID, records[0].MemberUserId)
	assert.Equal(t, 500, records[0].Amount)
	assert.Equal(t, quotaTestMember2ID, records[1].MemberUserId)
	assert.Equal(t, 500, records[1].Amount)

	// received_quota accumulated on each member row.
	var member1 Member
	require.NoError(t, db.Where("user_id = ?", quotaTestMember1ID).First(&member1).Error)
	assert.Equal(t, 500, member1.ReceivedQuota)
	var member2 Member
	require.NoError(t, db.Where("user_id = ?", quotaTestMember2ID).First(&member2).Error)
	assert.Equal(t, 500, member2.ReceivedQuota)

	// Admin quota reduced by total, members each gained the amount.
	var admin model.User
	require.NoError(t, db.First(&admin, quotaTestAdminUserID).Error)
	assert.Equal(t, 1_000_000-1000, admin.Quota)
	var alice model.User
	require.NoError(t, db.First(&alice, quotaTestMember1ID).Error)
	assert.Equal(t, 500, alice.Quota)
}

// TestDistributeQuota_AccumulatesAcrossDistributions verifies received_quota
// sums across multiple distributions rather than being overwritten.
func TestDistributeQuota_AccumulatesAcrossDistributions(t *testing.T) {
	db := setupQuotaTestDB(t, 1_000_000)
	initI18nOnce(t)

	for _, amount := range []int{300, 200, 500} {
		ctx, recorder := distributeContext(t, quotaTestAdminUserID, distributeQuotaRequest{
			MemberIds: []int{quotaTestMember1ID},
			Amount:    amount,
		})
		distributeQuota(ctx)
		require.Equal(t, http.StatusOK, recorder.Code, "body=%s", recorder.Body.String())
	}

	var member Member
	require.NoError(t, db.Where("user_id = ?", quotaTestMember1ID).First(&member).Error)
	assert.Equal(t, 1000, member.ReceivedQuota, "received_quota should accumulate across distributions")

	var count int64
	db.Model(&QuotaRecord{}).Where("member_user_id = ?", quotaTestMember1ID).Count(&count)
	assert.Equal(t, int64(3), count, "one record per distribution per recipient")
}

// TestDistributeQuota_InsufficientQuotaWritesNothing verifies that a failed
// distribution (admin lacks quota) writes no records and does not accumulate.
func TestDistributeQuota_InsufficientQuotaWritesNothing(t *testing.T) {
	db := setupQuotaTestDB(t, 100) // admin has only 100, distributing 500*2 needs 1000
	initI18nOnce(t)

	ctx, recorder := distributeContext(t, quotaTestAdminUserID, distributeQuotaRequest{
		MemberIds: []int{quotaTestMember1ID, quotaTestMember2ID},
		Amount:    500,
	})
	distributeQuota(ctx)
	require.Equal(t, http.StatusBadRequest, recorder.Code, "body=%s", recorder.Body.String())

	var count int64
	db.Model(&QuotaRecord{}).Where("enterprise_id = ?", quotaTestEnterpriseID).Count(&count)
	assert.Equal(t, int64(0), count, "no records on failed distribution")

	var member Member
	require.NoError(t, db.Where("user_id = ?", quotaTestMember1ID).First(&member).Error)
	assert.Equal(t, 0, member.ReceivedQuota, "received_quota must not change on failed distribution")
}
