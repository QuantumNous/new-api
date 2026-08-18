package common

import (
	"net/http"
	"net/http/httptest"
	"testing"

	rootcommon "github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestCompactRelayInfoUsesFamilySpecificIdentity(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tests := []struct {
		name        string
		model       string
		wantBase    string
		wantBilling string
	}{
		{name: "gpt virtual", model: "gpt-5-openai-compact", wantBase: "gpt-5", wantBilling: "gpt-5-openai-compact"},
		{name: "non gpt suffix", model: "claude-3-5-sonnet-openai-compact", wantBase: "claude-3-5-sonnet", wantBilling: "claude-3-5-sonnet"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
			ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/responses/compact", nil)
			rootcommon.SetContextKey(ctx, constant.ContextKeyOriginalModel, test.model)

			info := GenRelayInfoResponsesCompaction(ctx, &dto.OpenAIResponsesCompactionRequest{})
			require.Equal(t, test.wantBase, info.RequestedModel)
			require.Equal(t, test.wantBase, info.OriginModelName)
			require.Equal(t, test.wantBilling, info.LogicalBillingModel)
		})
	}
}
