package service

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"

	"github.com/gin-gonic/gin"
)

func newSettlementTestCtx() *gin.Context {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	return c
}

func TestAppendBlockRunSettlementInfo(t *testing.T) {
	t.Run("key absent → other untouched", func(t *testing.T) {
		c := newSettlementTestCtx()
		other := map[string]interface{}{"model_price": 0.1}
		appendBlockRunSettlementInfo(c, other)
		if len(other) != 1 {
			t.Fatalf("other mutated without settlement key: %v", other)
		}
	})
	t.Run("key present → fields overlaid", func(t *testing.T) {
		c := newSettlementTestCtx()
		c.Set(string(constant.ContextKeyBlockRunSettlement), map[string]interface{}{
			"upstream_price_usd": "0.063000",
			"upstream_tx_hash":   "0xabc",
		})
		other := map[string]interface{}{}
		appendBlockRunSettlementInfo(c, other)
		if other["upstream_price_usd"] != "0.063000" || other["upstream_tx_hash"] != "0xabc" {
			t.Fatalf("settlement not overlaid: %v", other)
		}
	})
	t.Run("nil ctx safe", func(t *testing.T) {
		appendBlockRunSettlementInfo(nil, map[string]interface{}{})
	})
}
