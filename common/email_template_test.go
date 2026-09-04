package common

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRenderEmailTemplateUsesFallbackWhenCustomIsEmpty(t *testing.T) {
	result := RenderEmailTemplate("  ", DefaultEmailVerificationHTML, map[string]string{
		"system_name": "New API",
		"code":        "123456",
		"minutes":     "10",
	})

	require.Equal(t, "<p>您好，你正在进行New API邮箱验证。</p>"+
		"<p>您的验证码为: <strong>123456</strong></p>"+
		"<p>验证码 10 分钟内有效，如果不是本人操作，请忽略。</p>", result)
}

func TestRenderEmailTemplateUsesCustomHTML(t *testing.T) {
	result := RenderEmailTemplate(
		"<h1>{{system_name}}</h1><p>code={{code}} email={{email}}</p>",
		DefaultEmailVerificationHTML,
		map[string]string{
			"system_name": "Site",
			"code":        "654321",
			"email":       "user@example.com",
		},
	)

	require.Equal(t, "<h1>Site</h1><p>code=654321 email=user@example.com</p>", result)
}

func TestEmailTemplateVarsIncludesSystemDefaults(t *testing.T) {
	originalName := SystemName
	originalMinutes := VerificationValidMinutes
	t.Cleanup(func() {
		SystemName = originalName
		VerificationValidMinutes = originalMinutes
	})

	SystemName = "Demo"
	VerificationValidMinutes = 15

	vars := EmailTemplateVars(map[string]string{
		"code": "888888",
	})

	require.Equal(t, "Demo", vars["system_name"])
	require.Equal(t, "15", vars["minutes"])
	require.Equal(t, "888888", vars["code"])
}
