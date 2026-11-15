package controller

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalizeQuotaUsableGroups(t *testing.T) {
	tests := []struct {
		name string
		raw  string
		want string
	}{
		{name: "empty", raw: "", want: ""},
		{name: "single", raw: "default", want: "default"},
		{name: "trims whitespace", raw: " default , vip ", want: "default,vip"},
		{name: "dedupes", raw: "default,default,vip", want: "default,vip"},
		{name: "drops empty entries", raw: ",,default,,vip,", want: "default,vip"},
		{name: "only separators", raw: " , , ", want: ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, normalizeQuotaUsableGroups(tt.raw))
		})
	}
}

func TestValidateQuotaUsableGroups(t *testing.T) {
	require.NoError(t, i18n.Init())
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"vip":1}`))

	tests := []struct {
		name   string
		groups string
		want   bool
	}{
		{name: "empty is unrestricted", groups: "", want: true},
		{name: "all groups exist", groups: "default,vip", want: true},
		{name: "unknown group rejected", groups: "default,does-not-exist", want: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			assert.Equal(t, tt.want, validateQuotaUsableGroups(c, tt.groups))
		})
	}
}
