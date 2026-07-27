package router

import (
	"os"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestSubscriptionLegacyPurchaseRoutesAreBlockedWhileCallbacksAndTopupsRemain(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()

	SetApiRouter(engine)

	routes := map[string]string{}
	for _, route := range engine.Routes() {
		routes[route.Method+" "+route.Path] = route.Handler
	}

	legacySubscriptionInitiationRoutes := []string{
		"POST /api/subscription/epay/pay",
		"POST /api/subscription/creem/pay",
		"POST /api/subscription/waffo-pancake/pay",
	}
	for _, routeKey := range legacySubscriptionInitiationRoutes {
		handler, ok := routes[routeKey]
		require.True(t, ok, "missing %s", routeKey)
		require.Contains(t, handler, "controller.SubscriptionPurchasePendingMigration")
		require.NotContains(t, handler, "controller.SubscriptionRequestEpay")
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
