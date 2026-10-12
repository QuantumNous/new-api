package model

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseCustomPages(t *testing.T) {
	tests := []struct{ name, raw, wantError string }{
		{"empty", "", ""},
		{"empty array", "[]", ""},
		{"normal", `[{"name":" 状态页 ","url":" https://status.example.com ","adminOnly":false,"highlight":true}]`, ""},
		{"duplicate", `[{"name":"Status","url":"https://a.example"},{"name":" status ","url":"https://b.example"}]`, "Menu names must be unique"},
		{"long rune name", `[{"name":"` + strings.Repeat("页", 31) + `","url":"https://example.com"}]`, "Page name cannot exceed 30 characters"},
		{"empty name", `[{"name":" ","url":"https://example.com"}]`, "Page name is required"},
		{"newline name", "[{\"name\":\"Status\\n\",\"url\":\"https://example.com\"}]", "Page name cannot contain newlines or tabs"},
		{"tab name", `[{"name":"Sta\ttus","url":"https://example.com"}]`, "Page name cannot contain newlines or tabs"},
		{"javascript", `[{"name":"Bad","url":"javascript:alert(1)"}]`, "Page URL must be an absolute http:// or https:// URL with a host"},
		{"data URL", `[{"name":"Bad","url":"data:text/html,bad"}]`, "Page URL must be an absolute http:// or https:// URL with a host"},
		{"missing host", `[{"name":"Bad","url":"https:///page"}]`, "Page URL must be an absolute http:// or https:// URL with a host"},
		{"relative URL", `[{"name":"Bad","url":"/page"}]`, "Page URL must be an absolute http:// or https:// URL with a host"},
		{"empty hostname", `[{"name":"Bad","url":"https://:443"}]`, "Page URL must be an absolute http:// or https:// URL with a host"},
		{"empty URL", `[{"name":"Bad","url":" "}]`, "Page URL is required"},
		{"long URL", `[{"name":"Bad","url":"https://example.com/` + strings.Repeat("a", 500) + `"}]`, "Page URL cannot exceed 500 characters"},
		{"object", `{}`, "Custom pages must be a JSON array"},
		{"null", `null`, "Custom pages must be a JSON array"},
		{"invalid flag", `[{"name":"Bad","url":"https://example.com","adminOnly":"false"}]`, "Custom pages must be a JSON array"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pages, err := ParseCustomPages(tt.raw)
			if tt.wantError != "" {
				require.EqualError(t, err, tt.wantError)
				assert.Error(t, validateOptionValue(CustomPagesOptionKey, tt.raw))
				// Validation must reject before any database operation (DB is not initialized).
				assert.Error(t, UpdateOption(CustomPagesOptionKey, tt.raw))
				assert.Error(t, UpdateOptionsBulk(map[string]string{CustomPagesOptionKey: tt.raw}))
				return
			}
			require.NoError(t, err)
			require.NotNil(t, pages)
			if tt.name == "normal" {
				assert.Equal(t, []CustomPage{{Name: "状态页", URL: "https://status.example.com", Highlight: true}}, pages)
			} else {
				assert.Empty(t, pages)
			}
		})
	}
	pages := make([]CustomPage, MaxCustomPages)
	for i := range pages {
		pages[i] = CustomPage{Name: strings.Repeat("页", i+1), URL: "http://example.com"}
	}
	raw, err := common.Marshal(pages)
	require.NoError(t, err)
	require.NoError(t, ValidateCustomPagesOption(string(raw)))
	pages = append(pages, CustomPage{Name: "Extra", URL: "https://example.com"})
	raw, err = common.Marshal(pages)
	require.NoError(t, err)
	assert.EqualError(t, ValidateCustomPagesOption(string(raw)), "At most 20 pages are supported")
}

func TestGetCustomPagesForRole(t *testing.T) {
	common.OptionMapRWMutex.Lock()
	original := common.OptionMap
	common.OptionMap = map[string]string{CustomPagesOptionKey: `[{"name":"Public","url":"https://public.example"},{"name":"Admin","url":"https://private.example","adminOnly":true}]`}
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() { common.OptionMapRWMutex.Lock(); common.OptionMap = original; common.OptionMapRWMutex.Unlock() })
	for _, role := range []int{common.RoleCommonUser, common.RoleAdminUser, common.RoleRootUser} {
		pages, err := GetCustomPagesForRole(role)
		require.NoError(t, err)
		if role < common.RoleAdminUser {
			require.Len(t, pages, 1)
			assert.Equal(t, "https://public.example", pages[0].URL)
		} else {
			require.Len(t, pages, 2)
		}
	}
	common.OptionMapRWMutex.Lock()
	common.OptionMap[CustomPagesOptionKey] = `[{"name":"bad","url":"javascript:alert(1)"}]`
	common.OptionMapRWMutex.Unlock()
	pages, err := GetCustomPagesForRole(common.RoleAdminUser)
	require.Error(t, err)
	assert.Nil(t, pages)
}
