package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func insertCdkToolOptionTestUser(t *testing.T, id int, group string) {
	t.Helper()
	require.NoError(t, model.DB.Create(&model.User{
		Id:       id,
		Username: "cdk_option_user",
		Password: "password",
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
		Group:    group,
		AffCode:  "cdk_option_user_aff",
	}).Error)
}

func TestValidateCdkToolSettingCandidateRejectsUnusableTokenGroup(t *testing.T) {
	db := openTokenControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.User{}))
	insertCdkToolOptionTestUser(t, 7101, "default")

	err := validateCdkToolSettingCandidate(operation_setting.CdkToolSetting{
		Enabled:         true,
		ServiceUserId:   7101,
		TokenGroup:      "svip",
		TokenNamePrefix: "cdk-tool",
	})

	require.Error(t, err)
	assert.Contains(t, err.Error(), "无权使用 svip 分组")
}

func TestValidateCdkToolSettingCandidateAllowsAutoTokenGroup(t *testing.T) {
	db := openTokenControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.User{}))
	insertCdkToolOptionTestUser(t, 7101, "default")

	err := validateCdkToolSettingCandidate(operation_setting.CdkToolSetting{
		Enabled:         true,
		ServiceUserId:   7101,
		TokenGroup:      "auto",
		TokenNamePrefix: "cdk-tool",
	})

	require.NoError(t, err)
}
