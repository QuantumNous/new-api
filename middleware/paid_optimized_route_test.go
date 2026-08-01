package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupPaidOptimizedRouteRatios(t *testing.T) {
	t.Helper()
	groupRatios := ratio_setting.GetGroupRatioSetting().GroupRatio
	groupSpecialRatios := ratio_setting.GetGroupRatioSetting().GroupGroupRatio
	originalGroupRatios := groupRatios.ReadAll()
	originalGroupSpecialRatios := groupSpecialRatios.ReadAll()
	originalAutoGroups := setting.AutoGroups2JsonString()
	originalUsableGroups := setting.UserUsableGroups2JSONString()
	t.Cleanup(func() {
		groupRatios.Clear()
		groupRatios.AddAll(originalGroupRatios)
		groupSpecialRatios.Clear()
		groupSpecialRatios.AddAll(originalGroupSpecialRatios)
		require.NoError(t, setting.UpdateAutoGroupsByJsonString(originalAutoGroups))
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(originalUsableGroups))
	})

	groupRatios.Clear()
	groupRatios.AddAll(map[string]float64{
		"default": 1,
		"free":    0,
		"paid":    1,
	})
	groupSpecialRatios.Clear()
	groupSpecialRatios.Set("sponsored", map[string]float64{"paid": 0})
	require.NoError(t, setting.UpdateAutoGroupsByJsonString(`["free","paid"]`))
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"auto":"Auto","default":"Default","free":"Free","paid":"Paid"}`))
}

func TestPaidOptimizedRoute(t *testing.T) {
	require.NoError(t, i18n.Init())
	setupPaidOptimizedRouteRatios(t)
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	tests := []struct {
		name        string
		method      string
		path        string
		marked      bool
		userGroup   string
		tokenGroup  string
		usingGroup  string
		expected    int
		handlerRuns bool
	}{
		{name: "ordinary node keeps free group behavior", method: http.MethodPost, path: "/v1/chat/completions", userGroup: "default", tokenGroup: "free", usingGroup: "free", expected: http.StatusNoContent, handlerRuns: true},
		{name: "marked node rejects free chat group", method: http.MethodPost, path: "/v1/chat/completions", marked: true, userGroup: "default", tokenGroup: "free", usingGroup: "free", expected: http.StatusForbidden},
		{name: "marked node rejects free image group", method: http.MethodPost, path: "/v1/images/generations", marked: true, userGroup: "default", tokenGroup: "free", usingGroup: "free", expected: http.StatusForbidden},
		{name: "marked node rejects free read request", method: http.MethodGet, path: "/v1/models", marked: true, userGroup: "default", tokenGroup: "free", usingGroup: "free", expected: http.StatusForbidden},
		{name: "marked node allows paid group", method: http.MethodPost, path: "/v1/responses", marked: true, userGroup: "default", tokenGroup: "paid", usingGroup: "paid", expected: http.StatusNoContent, handlerRuns: true},
		{name: "marked node uses token fallback group ratio", method: http.MethodPost, path: "/v1/messages", marked: true, userGroup: "default", expected: http.StatusNoContent, handlerRuns: true},
		{name: "marked node uses session fallback group ratio", method: http.MethodGet, path: "/v1/videos/task/content", marked: true, userGroup: "free", expected: http.StatusForbidden},
		{name: "marked node allows auto with paid candidate", method: http.MethodPost, path: "/v1/responses/compact", marked: true, userGroup: "default", tokenGroup: "auto", usingGroup: "auto", expected: http.StatusNoContent, handlerRuns: true},
		{name: "marked node rejects auto without paid candidate", method: http.MethodPost, path: "/v1/responses", marked: true, userGroup: "sponsored", tokenGroup: "auto", usingGroup: "auto", expected: http.StatusForbidden},
		{name: "marked node honors special zero ratio", method: http.MethodPost, path: "/v1/completions", marked: true, userGroup: "sponsored", tokenGroup: "paid", usingGroup: "paid", expected: http.StatusForbidden},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			handlerRan := false
			router := gin.New()
			router.Handle(test.method, test.path, func(c *gin.Context) {
				common.SetContextKey(c, constant.ContextKeyUserGroup, test.userGroup)
				common.SetContextKey(c, constant.ContextKeyTokenGroup, test.tokenGroup)
				common.SetContextKey(c, constant.ContextKeyUsingGroup, test.usingGroup)
				c.Next()
			}, func(c *gin.Context) {
				if rejectUnpaidOptimizedRoute(c) {
					return
				}
				c.Next()
			}, func(c *gin.Context) {
				handlerRan = true
				c.Status(http.StatusNoContent)
			})

			request := httptest.NewRequest(test.method, test.path, nil)
			if test.marked {
				request.Header.Set(paidOptimizedRouteHeader, paidOptimizedRouteValue)
			}
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)

			assert.Equal(t, test.expected, response.Code)
			assert.Equal(t, test.handlerRuns, handlerRan)
			if test.expected == http.StatusForbidden {
				assert.Contains(t, response.Body.String(), `"code":"access_denied"`)
			}
		})
	}
}

func TestTokenAuthOnPaidOptimizedRoute(t *testing.T) {
	require.NoError(t, i18n.Init())
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })
	handlerRan := false
	router := gin.New()
	router.GET("/mj/image/test", TokenAuthOnPaidOptimizedRoute(), func(c *gin.Context) {
		handlerRan = true
		c.Status(http.StatusNoContent)
	})

	ordinaryRequest := httptest.NewRequest(http.MethodGet, "/mj/image/test", nil)
	ordinaryResponse := httptest.NewRecorder()
	router.ServeHTTP(ordinaryResponse, ordinaryRequest)
	assert.Equal(t, http.StatusNoContent, ordinaryResponse.Code)
	assert.True(t, handlerRan)

	handlerRan = false
	optimizedRequest := httptest.NewRequest(http.MethodGet, "/mj/image/test", nil)
	optimizedRequest.Header.Set(paidOptimizedRouteHeader, paidOptimizedRouteValue)
	optimizedResponse := httptest.NewRecorder()
	router.ServeHTTP(optimizedResponse, optimizedRequest)
	assert.Equal(t, http.StatusUnauthorized, optimizedResponse.Code)
	assert.False(t, handlerRan)
}
