package console_setting

import (
	"encoding/base64"
	"fmt"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestValidateSupportLinksAcceptsConfiguredCategories(t *testing.T) {
	value := `[{
		"id":"community",
		"title":"Community",
		"description":"Talk with the team",
		"items":[{
			"id":"github",
			"title":"GitHub",
			"label":"QuantumNous/new-api",
			"description":"Source and issues",
			"url":"https://github.com/QuantumNous/new-api",
			"icon":"github"
		}]
	}]`

	require.NoError(t, ValidateConsoleSettings(value, "SupportLinks"))
}

func TestValidateSupportLinksAcceptsLobeHubIconKeys(t *testing.T) {
	value := `[{
		"id":"models",
		"title":"Models",
		"items":[{
			"id":"openai",
			"title":"OpenAI",
			"url":"https://example.com/openai",
			"icon":"OpenAI.Color"
		}]
	}]`

	require.NoError(t, ValidateConsoleSettings(value, "SupportLinks"))
}

func TestValidateSupportLinksAcceptsUploadedRasterIcon(t *testing.T) {
	pngSignature := []byte{0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a}
	icon := "data:image/png;base64," + base64.StdEncoding.EncodeToString(pngSignature)
	value := fmt.Sprintf(`[{"id":"community","title":"Community","items":[{"id":"custom","title":"Custom","url":"https://example.com/custom","icon":%q}]}]`, icon)

	require.NoError(t, ValidateConsoleSettings(value, "SupportLinks"))
}

func TestValidateSupportLinksRejectsUnsafeDestinations(t *testing.T) {
	value := `[{
		"id":"community",
		"title":"Community",
		"items":[{
			"id":"bad-link",
			"title":"Bad link",
			"url":"javascript:alert(1)",
			"icon":"help"
		}]
	}]`

	err := ValidateConsoleSettings(value, "SupportLinks")
	require.Error(t, err)
	assert.ErrorContains(t, err, "URL")
}

func TestValidateSupportLinksRejectsUnknownIcons(t *testing.T) {
	value := `[{
		"id":"community",
		"title":"Community",
		"items":[{
			"id":"unknown-icon",
			"title":"Unknown icon",
			"url":"https://example.com/support",
			"icon":"custom-svg"
		}]
	}]`

	err := ValidateConsoleSettings(value, "SupportLinks")
	require.Error(t, err)
	assert.ErrorContains(t, err, "图标不合法")
}

func TestValidateSupportLinksRejectsMalformedLobeHubIconKeys(t *testing.T) {
	tests := []struct {
		name string
		icon string
	}{
		{name: "lowercase custom key", icon: "custom-svg"},
		{name: "property expression", icon: `OpenAI.Avatar.type={'platform'}`},
		{name: "oversized key", icon: "A" + strings.Repeat("b", 80)},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			value := fmt.Sprintf(`[{"id":"community","title":"Community","items":[{"id":"bad-icon","title":"Bad icon","url":"https://example.com/support","icon":%q}]}]`, test.icon)

			err := ValidateConsoleSettings(value, "SupportLinks")
			require.Error(t, err)
			assert.ErrorContains(t, err, "图标不合法")
		})
	}
}

func TestValidateSupportLinksRejectsInvalidUploadedIcons(t *testing.T) {
	pngSignature := []byte{0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a}
	oversizedPNG := append(pngSignature, make([]byte, 100*1024-len(pngSignature)+1)...)
	tests := []struct {
		name string
		icon string
	}{
		{name: "unsupported svg", icon: "data:image/svg+xml;base64," + base64.StdEncoding.EncodeToString([]byte("<svg/>"))},
		{name: "invalid base64", icon: "data:image/png;base64,%%%"},
		{name: "mime mismatch", icon: "data:image/png;base64," + base64.StdEncoding.EncodeToString([]byte("not a png"))},
		{name: "oversized image", icon: "data:image/png;base64," + base64.StdEncoding.EncodeToString(oversizedPNG)},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			value := fmt.Sprintf(`[{"id":"community","title":"Community","items":[{"id":"bad-icon","title":"Bad icon","url":"https://example.com/support","icon":%q}]}]`, test.icon)

			err := ValidateConsoleSettings(value, "SupportLinks")
			require.Error(t, err)
			assert.ErrorContains(t, err, "图标不合法")
		})
	}
}

func TestValidateFooterAcceptsConfigurableLeftLinksAndColumns(t *testing.T) {
	value := `{
		"description":"One gateway for every model",
		"socialLinks":[
			{"id":"github","label":"GitHub","url":"https://github.com/QuantumNous/new-api","icon":"github"},
			{"id":"email","label":"Email","url":"mailto:support@example.com","icon":"email"}
		],
		"columns":[{
			"id":"product",
			"title":"Product",
			"links":[{"id":"models","label":"Models","url":"/#models"}]
		}]
	}`

	require.NoError(t, ValidateConsoleSettings(value, "Footer"))
}

func TestValidateWalletPromotionAcceptsConfiguredContent(t *testing.T) {
	value := `{
		"enabled":true,
		"title":"Welcome bonus",
		"description":"New users receive extra credit.",
		"actionLabel":"View offer",
		"actionUrl":"/offers/welcome",
		"imageUrl":"https://example.com/promotion.png"
	}`

	require.NoError(t, ValidateConsoleSettings(value, "WalletPromotion"))
}

func TestValidateWalletPromotionRejectsUnsafeActionURL(t *testing.T) {
	value := `{
		"enabled":true,
		"title":"Welcome bonus",
		"description":"",
		"actionLabel":"View offer",
		"actionUrl":"javascript:alert(1)",
		"imageUrl":""
	}`

	err := ValidateConsoleSettings(value, "WalletPromotion")
	require.Error(t, err)
	assert.ErrorContains(t, err, "链接地址不合法")
}

func TestValidateFooterRejectsUnsafeLinkDestinations(t *testing.T) {
	tests := []struct {
		name string
		url  string
	}{
		{name: "script scheme", url: "javascript:alert(1)"},
		{name: "protocol relative URL", url: "//example.com/path"},
		{name: "unsupported scheme", url: "ftp://example.com/file"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			value := fmt.Sprintf(`{"description":"","socialLinks":[],"columns":[{"id":"links","title":"Links","links":[{"id":"unsafe","label":"Unsafe","url":%q}]}]}`, test.url)

			err := ValidateConsoleSettings(value, "Footer")
			require.Error(t, err)
			assert.ErrorContains(t, err, "链接地址不合法")
		})
	}
}

func TestValidateFooterRejectsMoreThanSixColumns(t *testing.T) {
	columns := make([]FooterColumn, 7)
	for index := range columns {
		columns[index] = FooterColumn{
			ID:    fmt.Sprintf("column-%d", index),
			Title: fmt.Sprintf("Column %d", index),
			Links: []FooterLink{},
		}
	}
	value, err := common.Marshal(FooterConfig{
		Description: "",
		SocialLinks: []FooterSocialLink{},
		Columns:     columns,
	})
	require.NoError(t, err)

	err = ValidateConsoleSettings(string(value), "Footer")
	require.Error(t, err)
	assert.ErrorContains(t, err, "分栏不能超过6个")
}

func TestValidateFooterRejectsMissingLinkCollections(t *testing.T) {
	err := ValidateConsoleSettings(`{"description":"Footer"}`, "Footer")

	require.Error(t, err)
	assert.ErrorContains(t, err, "缺少社交链接或分栏列表")
}

func TestValidateDefaultLanguage(t *testing.T) {
	for _, language := range []string{"auto", "en", "zhCN", "zhTW", "fr", "ru", "ja", "vi"} {
		t.Run(language, func(t *testing.T) { require.NoError(t, ValidateDefaultLanguage(language)) })
	}
	for _, language := range []string{"", "de", "zh", "zh-CN", "automatic", " en "} {
		t.Run("reject_"+language, func(t *testing.T) { require.Error(t, ValidateDefaultLanguage(language)) })
	}
}

func TestFooterRegistrationValidation(t *testing.T) {
	for _, tc := range []struct {
		name, records string
		valid         bool
	}{
		{"multiple", `[{"id":"icp","label":"京ICP备123号","url":"https://beian.miit.gov.cn/","icon":""},{"id":"police","label":"公安备案","url":"https://beian.mps.gov.cn/","icon":""}]`, true},
		{"unsafe URL", `[{"id":"icp","label":"备案","url":"javascript:alert(1)","icon":""}]`, false},
		{"unsafe icon", `[{"id":"icp","label":"备案","url":"https://beian.miit.gov.cn/","icon":"data:image/svg+xml;base64,PHN2Zz4="}]`, false},
		{"duplicate", `[{"id":"a","label":"备案","url":"https://example.com","icon":""},{"id":"a","label":"备案2","url":"https://example.com","icon":""}]`, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidateConsoleSettings(`{"description":"","socialLinks":[],"columns":[],"registrations":`+tc.records+`}`, "Footer")
			if tc.valid {
				require.NoError(t, err)
			} else {
				require.Error(t, err)
			}
		})
	}
}
