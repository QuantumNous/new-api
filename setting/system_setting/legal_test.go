package system_setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDefaultLegalSettingsProvideUserFacingDocuments(t *testing.T) {
	settings := GetLegalSettings()

	require.NotEmpty(t, settings.UserAgreement)
	require.NotEmpty(t, settings.PrivacyPolicy)
	assert.Contains(t, settings.UserAgreement, "“宽审核”“低审核”“Global”")
	assert.Contains(t, settings.UserAgreement, "AI 生成合成内容")
	assert.Contains(t, settings.PrivacyPolicy, "请求与生成内容")
	assert.Contains(t, settings.PrivacyPolicy, "AI 上游服务商")
}
