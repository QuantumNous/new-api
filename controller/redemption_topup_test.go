package controller

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTopUpQuotaRedemptionKeepsLegacyNumberResponse(t *testing.T) {
	db := openTokenControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Redemption{}, &model.Log{}))
	confirmPaymentComplianceForTest(t)

	user := &model.User{
		Id:       701,
		Username: "topup_quota_user",
		Status:   common.UserStatusEnabled,
		Quota:    10,
		Group:    "default",
	}
	require.NoError(t, db.Create(user).Error)
	require.NoError(t, db.Create(&model.Redemption{
		UserId:         1,
		Key:            "topup-quota-code",
		Status:         common.RedemptionCodeStatusEnabled,
		Name:           "TopUp Quota",
		RedemptionType: model.RedemptionTypeQuota,
		Quota:          25,
		CreatedTime:    common.GetTimestamp(),
	}).Error)

	ctx, recorder := newAuthenticatedContext(t, http.MethodPost, "/api/user/topup", map[string]string{
		"key": "topup-quota-code",
	}, user.Id)
	TopUp(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	response := decodeAPIResponse(t, recorder)
	require.True(t, response.Success)

	var quota int
	require.NoError(t, json.Unmarshal(response.Data, &quota))
	assert.Equal(t, 25, quota)

	var updatedUser model.User
	require.NoError(t, db.Select("quota").Where("id = ?", user.Id).First(&updatedUser).Error)
	assert.Equal(t, 35, updatedUser.Quota)
}
