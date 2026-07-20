package controller

import (
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestApplyTopupRestriction(t *testing.T) {
	data := gin.H{
		"enable_online_topup":        true,
		"enable_stripe_topup":        true,
		"enable_paypal_topup":        true,
		"enable_creem_topup":         true,
		"enable_waffo_topup":         true,
		"enable_waffo_pancake_topup": true,
		"enable_platega_topup":       true,
		"enable_clink_topup":         true,
		"pay_methods":                []map[string]string{{"type": "alipay"}},
		"waffo_pay_methods":          []map[string]string{{"name": "card"}},
		"creem_products":             []interface{}{"prod_1"},
	}

	applyTopupRestriction(data)

	assert.Equal(t, true, data["topup_forbidden"])
	assert.Equal(t, false, data["enable_online_topup"])
	assert.Equal(t, false, data["enable_stripe_topup"])
	assert.Equal(t, false, data["enable_paypal_topup"])
	assert.Equal(t, false, data["enable_creem_topup"])
	assert.Equal(t, false, data["enable_waffo_topup"])
	assert.Equal(t, false, data["enable_waffo_pancake_topup"])
	assert.Equal(t, false, data["enable_platega_topup"])
	assert.Equal(t, false, data["enable_clink_topup"])

	payMethods, ok := data["pay_methods"].([]map[string]string)
	require.True(t, ok)
	assert.Len(t, payMethods, 0)

	waffoMethods, ok := data["waffo_pay_methods"].([]map[string]string)
	require.True(t, ok)
	assert.Len(t, waffoMethods, 0)

	creemProducts, ok := data["creem_products"].([]interface{})
	require.True(t, ok)
	assert.Len(t, creemProducts, 0)
}
