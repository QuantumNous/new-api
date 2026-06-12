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
	t.Run("wrong value type → ignored, no panic", func(t *testing.T) {
		c := newSettlementTestCtx()
		c.Set(string(constant.ContextKeyBlockRunSettlement), "not-a-map")
		other := map[string]interface{}{"model_price": 0.1}
		appendBlockRunSettlementInfo(c, other)
		if len(other) != 1 {
			t.Fatalf("other mutated on wrong-type value: %v", other)
		}
	})
	t.Run("existing key never clobbered", func(t *testing.T) {
		c := newSettlementTestCtx()
		c.Set(string(constant.ContextKeyBlockRunSettlement), map[string]interface{}{
			"upstream_model_name": "evil-overwrite",
			"upstream_tx_hash":    "0xnew",
		})
		other := map[string]interface{}{"upstream_model_name": "real-model"}
		appendBlockRunSettlementInfo(c, other)
		if other["upstream_model_name"] != "real-model" {
			t.Fatalf("settlement must not clobber keys the generic path emitted: %v", other)
		}
		if other["upstream_tx_hash"] != "0xnew" {
			t.Fatalf("non-colliding settlement keys must still land: %v", other)
		}
	})
}
