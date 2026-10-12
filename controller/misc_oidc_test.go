package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetStatusReturnsEffectiveOIDCDisplayName(t *testing.T) {
	settings := system_setting.GetOIDCSettings()
	originalDisplayName := settings.DisplayName
	originalOptionMap := common.OptionMap
	t.Cleanup(func() {
		settings.DisplayName = originalDisplayName
		common.OptionMap = originalOptionMap
	})
	common.OptionMap = map[string]string{}

	tests := []struct {
		name        string
		displayName string
		want        string
	}{
		{
			name:        "custom name is trimmed",
			displayName: "  Acme SSO  ",
			want:        "Acme SSO",
		},
		{
			name:        "whitespace-only name falls back",
			displayName: "   ",
			want:        "OIDC",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			settings.DisplayName = tt.displayName
			response := httptest.NewRecorder()
			context, _ := gin.CreateTestContext(response)
			context.Request = httptest.NewRequest(http.MethodGet, "/api/status", nil)

			GetStatus(context)

			var payload struct {
				Success bool           `json:"success"`
				Data    map[string]any `json:"data"`
			}
			require.NoError(t, common.Unmarshal(response.Body.Bytes(), &payload))
			require.True(t, payload.Success)
			assert.Equal(t, tt.want, payload.Data["oidc_display_name"])
		})
	}
}

func TestGetCustomPages(t *testing.T) {
	common.OptionMapRWMutex.Lock()
	original := common.OptionMap
	common.OptionMap = map[string]string{}
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() { common.OptionMapRWMutex.Lock(); common.OptionMap = original; common.OptionMapRWMutex.Unlock() })
	for _, tc := range []struct {
		name, raw string
		success   bool
	}{
		{"success filters admin URLs", `[{"name":"Public","url":"https://public.example"},{"name":"Admin","url":"https://private.example","adminOnly":true}]`, true},
		{"invalid stored configuration fails closed", `[{"name":"Admin","url":"javascript:secret","adminOnly":true}]`, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			common.OptionMapRWMutex.Lock()
			common.OptionMap["CustomPages"] = tc.raw
			common.OptionMapRWMutex.Unlock()
			response := httptest.NewRecorder()
			context, _ := gin.CreateTestContext(response)
			context.Set("role", common.RoleCommonUser)
			GetCustomPages(context)
			var payload struct {
				Success bool `json:"success"`
				Data    []struct {
					URL string `json:"url"`
				} `json:"data"`
				Message string `json:"message"`
			}
			require.NoError(t, common.Unmarshal(response.Body.Bytes(), &payload))
			assert.Equal(t, tc.success, payload.Success)
			assert.Equal(t, "no-store", response.Header().Get("Cache-Control"))
			if tc.success {
				require.Len(t, payload.Data, 1)
				assert.Equal(t, "https://public.example", payload.Data[0].URL)
			} else {
				assert.Equal(t, "Failed to load custom pages", payload.Message)
			}
			assert.NotContains(t, response.Body.String(), "private.example")
			assert.NotContains(t, response.Body.String(), "javascript:secret")
		})
	}
}
