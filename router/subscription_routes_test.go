package router

import (
	"os"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestSubscriptionPurchaseRoutesUseUnifiedHandlersWhileLegacyProvidersRemainBlocked(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()

	SetApiRouter(engine)

	routes := map[string]string{}
	for _, route := range engine.Routes() {
		routes[route.Method+" "+route.Path] = route.Handler
	}

	epayHandler, ok := routes["POST /api/subscription/epay/pay"]
	require.True(t, ok, "missing ePay subscription purchase route")
	require.Contains(t, epayHandler, "controller.SubscriptionRequestEpay")
	require.NotContains(t, epayHandler, "controller.SubscriptionPurchasePendingMigration")
	balanceHandler, ok := routes["POST /api/subscription/balance/pay"]
	require.True(t, ok, "missing balance subscription purchase route")
	require.Contains(t, balanceHandler, "controller.SubscriptionRequestBalancePay")
	require.NotContains(t, balanceHandler, "controller.SubscriptionPurchasePendingMigration")

	legacySubscriptionInitiationRoutes := []string{
		"POST /api/subscription/creem/pay",
		"POST /api/subscription/waffo-pancake/pay",
	}
	for _, routeKey := range legacySubscriptionInitiationRoutes {
		handler, ok := routes[routeKey]
		require.True(t, ok, "missing %s", routeKey)
		require.Contains(t, handler, "controller.SubscriptionPurchasePendingMigration")
		require.NotContains(t, handler, "controller.SubscriptionRequestCreemPay")
		require.NotContains(t, handler, "controller.SubscriptionRequestWaffoPancakePay")
	}

	for _, routeKey := range []string{
		"POST /api/subscription/epay/notify",
		"GET /api/subscription/epay/notify",
		"GET /api/subscription/epay/return",
		"POST /api/subscription/epay/return",
	} {
		_, ok := routes[routeKey]
		require.True(t, ok, "missing callback route %s", routeKey)
	}

	for _, routeKey := range []string{
		"POST /api/user/pay",
		"POST /api/user/creem/pay",
		"POST /api/user/waffo-pancake/pay",
	} {
		handler, ok := routes[routeKey]
		require.True(t, ok, "missing wallet topup route %s", routeKey)
		require.False(t, strings.Contains(handler, "SubscriptionPurchasePendingMigration"), "wallet topup route %s was blocked", routeKey)
	}
}

func TestSubscriptionSelfLifecycleRoutesUseLocalContractHandlers(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()

	SetApiRouter(engine)

	routes := map[string]string{}
	for _, route := range engine.Routes() {
		routes[route.Method+" "+route.Path] = route.Handler
	}

	expectedHandlers := map[string]string{
		"GET /api/subscription/self":                                           "controller.GetSubscriptionSelf",
		"GET /api/subscription/self/refundable-terms":                          "controller.GetRefundableSubscriptionTerms",
		"POST /api/subscription/self/refundable-terms/:term_segment_id/refund": "controller.RefundSubscriptionTerm",
		"POST /api/subscription/self/quote":                                    "controller.QuoteSubscriptionSelfPurchase",
		"POST /api/subscription/self/purchase":                                 "controller.PurchaseSubscriptionSelf",
		"POST /api/subscription/self/change-plan":                              "controller.ChangeSubscriptionPlan",
		"POST /api/subscription/self/renewal/cancel":                           "controller.CancelSubscriptionRenewal",
		"POST /api/subscription/self/renewal/resume":                           "controller.ResumeSubscriptionRenewal",
	}
	for routeKey, expectedHandler := range expectedHandlers {
		handler, ok := routes[routeKey]
		require.True(t, ok, "missing %s", routeKey)
		require.Contains(t, handler, expectedHandler)
	}
	for _, routeKey := range []string{
		"POST /api/subscription/self/recurring/:binding_id/cancel",
		"POST /api/subscription/self/recurring/:binding_id/resume",
	} {
		_, ok := routes[routeKey]
		require.False(t, ok, "user lifecycle route should not be public: %s", routeKey)
	}
}

func TestSubscriptionSelfLifecycleRoutesAreAuthenticatedAndCriticalLimited(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()

	SetApiRouter(engine)

	for _, route := range []struct {
		method string
		path   string
	}{
		{method: "POST", path: "/api/subscription/self/renewal/cancel"},
		{method: "POST", path: "/api/subscription/self/renewal/resume"},
	} {
		found := false
		for _, registered := range engine.Routes() {
			if registered.Method == route.method && registered.Path == route.path {
				found = true
				break
			}
		}
		require.True(t, found, "missing %s %s", route.method, route.path)
	}

	source, err := os.ReadFile("api-router.go")
	require.NoError(t, err)
	routerSource := string(source)
	require.Contains(t, routerSource, "subscriptionRoute.Use(middleware.UserAuth())")
	require.Contains(t, routerSource, `subscriptionRoute.POST("/self/renewal/cancel", middleware.CriticalRateLimit(), controller.CancelSubscriptionRenewal)`)
	require.Contains(t, routerSource, `subscriptionRoute.POST("/self/renewal/resume", middleware.CriticalRateLimit(), controller.ResumeSubscriptionRenewal)`)
}

func TestSubscriptionSelfOpenAPIUsesSelfSpecificSchemas(t *testing.T) {
	raw, err := os.ReadFile("../docs/openapi/api.json")
	require.NoError(t, err)
	var document map[string]any
	require.NoError(t, common.Unmarshal(raw, &document))

	components := document["components"].(map[string]any)
	schemas := components["schemas"].(map[string]any)
	selfResponse := schemas["SubscriptionSelfResponse"].(map[string]any)
	properties := selfResponse["properties"].(map[string]any)

	require.NotContains(t, schemas, "RecurringSubscription")
	require.NotContains(t, schemas, "RecurringSubscriptionResponse")
	require.Contains(t, schemas, "SubscriptionSelfRecurringSubscription")

	expectedRefs := map[string]string{
		"contract":            "#/components/schemas/SubscriptionSelfContract",
		"current_entitlement": "#/components/schemas/SubscriptionSelfEntitlement",
		"pending_change":      "#/components/schemas/SubscriptionSelfPendingChange",
	}
	for property, expectedRef := range expectedRefs {
		schema := properties[property].(map[string]any)
		require.Equal(t, expectedRef, schema["$ref"])
	}

	selfSchemas := []string{
		"SubscriptionSelfContract",
		"SubscriptionSelfEntitlement",
		"SubscriptionSelfPendingChange",
	}
	for _, schemaName := range selfSchemas {
		schema := schemas[schemaName].(map[string]any)
		schemaProperties := schema["properties"].(map[string]any)
		require.NotContains(t, schemaProperties, "current_provider_binding_id", schemaName)
		require.NotContains(t, schemaProperties, "provider_binding_id", schemaName)
	}

	selfContract := schemas["SubscriptionSelfContract"].(map[string]any)
	selfContractProperties := selfContract["properties"].(map[string]any)
	paymentMode := selfContractProperties["payment_mode"].(map[string]any)
	require.ElementsMatch(t, []any{
		"stripe_recurring",
		"prepaid",
		"balance_one_period",
		"external_one_period",
	}, paymentMode["enum"])

	changePlan := schemas["ChangeSubscriptionPlanResponse"].(map[string]any)
	changePlanProperties := changePlan["properties"].(map[string]any)
	changePlanData := changePlanProperties["data"].(map[string]any)
	changePlanDataProperties := changePlanData["properties"].(map[string]any)
	require.Equal(t, "#/components/schemas/SubscriptionSelfContract", changePlanDataProperties["contract"].(map[string]any)["$ref"])
	require.Equal(t, "#/components/schemas/SubscriptionSelfPendingChange", changePlanDataProperties["intent"].(map[string]any)["$ref"])

	renewalLifecycle := schemas["SubscriptionRenewalLifecycleResult"].(map[string]any)
	renewalLifecycleProperties := renewalLifecycle["properties"].(map[string]any)
	require.Contains(t, renewalLifecycleProperties, "change_version")
	require.Contains(t, renewalLifecycle["required"].([]any), "change_version")
	require.NotContains(t, renewalLifecycleProperties, "sync_pending")
	require.NotContains(t, renewalLifecycle["required"].([]any), "sync_pending")
}
