package relay

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestClaudeAdvisorModelAdmission(t *testing.T) {
	saved := config.GlobalConfig.ExportAllConfigs()
	t.Cleanup(func() { require.NoError(t, config.GlobalConfig.LoadFromDB(saved)) })
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"billing_setting.billing_mode": `{"advisor-expr-test":"tiered_expr"}`,
		"billing_setting.billing_expr": `{"advisor-expr-test":"tier(\"advisor\", p * 5 + c * 25)"}`,
	}))
	old := ratio_setting.ModelRatio2JSONString()
	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(`{"claude-opus-4-8":2.5}`))
	t.Cleanup(func() { require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(old)) })
	for _, tc := range []struct {
		name, model string
		limited     bool
		allowed     map[string]bool
		want        int
	}{
		{"priced advisor", "claude-opus-4-8", false, nil, 0},
		{"expression-only advisor", "advisor-expr-test", false, nil, 0},
		{"missing price", "unpriced-advisor-test", false, nil, 400},
		{"executor-only token", "claude-opus-4-8", true, map[string]bool{"claude-haiku-4-5-20251001": true}, 403},
		{"advisor allowed", "claude-opus-4-8", true, map[string]bool{"claude-opus-4-8": true}, 0},
		{"empty allowlist denies", "claude-opus-4-8", true, nil, 403},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			common.SetContextKey(c, constant.ContextKeyTokenModelLimitEnabled, tc.limited)
			common.SetContextKey(c, constant.ContextKeyTokenModelLimit, tc.allowed)
			req := &dto.ClaudeRequest{Tools: []any{map[string]any{"type": "advisor_20260301", "name": "advisor", "model": tc.model}}}
			info := &relaycommon.RelayInfo{}
			err := checkClaudeAdvisorToolModels(c, info, req)
			if tc.want == 0 {
				require.Nil(t, err)
				assert.Contains(t, info.ClaudeAdvisorPricing, tc.model)
				if tc.model == "advisor-expr-test" {
					assert.NotNil(t, info.ClaudeAdvisorPricing[tc.model].Snapshot)
				}
			} else {
				require.NotNil(t, err)
				assert.Equal(t, tc.want, err.StatusCode)
				assert.Empty(t, info.ClaudeAdvisorPricing)
			}
		})
	}
}
