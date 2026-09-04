/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
package router

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCustomDomainWildcardHostReachesStatusAndAPIAuthentication(t *testing.T) {
	gin.SetMode(gin.TestMode)
	previousGlobal, previousRedis := common.GlobalApiRateLimitEnable, common.RedisEnabled
	common.GlobalApiRateLimitEnable, common.RedisEnabled = false, false
	t.Cleanup(func() { common.GlobalApiRateLimitEnable, common.RedisEnabled = previousGlobal, previousRedis })
	settings, err := common.ParseCustomDomainSettingsWithMainOrigins("true", "yeschoy.io", "https://yeschoy.com",
		"https://yeschoy.com,https://*.yeschoy.com,https://yeschoy.pro,https://*.yeschoy.pro", "5", "")
	require.NoError(t, err)
	resolver, err := service.NewCustomDomainResolver(settings)
	require.NoError(t, err)
	engine := gin.New()
	engine.Use(middleware.CustomDomainContextWithResolver(resolver, true))
	SetApiRouter(engine)
	SetRelayRouter(engine)
	for _, host := range []string{"yeschoy.com", "api.yeschoy.com", "www.yeschoy.com", "new-subdomain.yeschoy.pro", "unrelated.example", "a.api.yeschoy.com", "*.yeschoy.com"} {
		for _, path := range []string{"/api/status", "/v1/models", "/v1/chat/completions"} {
			method := http.MethodGet
			if path == "/v1/chat/completions" {
				method = http.MethodPost
			}
			request := httptest.NewRequest(method, "http://"+host+path, nil)
			request.Header.Set("X-Forwarded-Host", "yeschoy.com")
			response := httptest.NewRecorder()
			engine.ServeHTTP(response, request)
			status := http.StatusNotFound
			switch host {
			case "yeschoy.com", "api.yeschoy.com", "www.yeschoy.com", "new-subdomain.yeschoy.pro":
				status = http.StatusUnauthorized
				if path == "/api/status" {
					status = http.StatusOK
				}
			}
			assert.Equal(t, status, response.Code, "%s %s", host, path)
		}
	}
}

func TestTopUpBrowserReturnRoutesUseCriticalRateLimit(t *testing.T) {
	previousCriticalEnabled := common.CriticalRateLimitEnable
	previousCriticalLimit := common.CriticalRateLimitNum
	previousCriticalDuration := common.CriticalRateLimitDuration
	previousGlobalEnabled := common.GlobalApiRateLimitEnable
	previousRedisEnabled := common.RedisEnabled
	common.CriticalRateLimitEnable = true
	common.CriticalRateLimitNum = 1
	common.CriticalRateLimitDuration = int64(time.Hour / time.Second)
	common.GlobalApiRateLimitEnable = false
	common.RedisEnabled = false
	t.Cleanup(func() {
		common.CriticalRateLimitEnable = previousCriticalEnabled
		common.CriticalRateLimitNum = previousCriticalLimit
		common.CriticalRateLimitDuration = previousCriticalDuration
		common.GlobalApiRateLimitEnable = previousGlobalEnabled
		common.RedisEnabled = previousRedisEnabled
	})

	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetApiRouter(engine)
	for index, path := range []string{"/api/stripe/return", "/api/user/epay/return"} {
		remoteAddr := []string{"192.0.2.201:1234", "192.0.2.202:1234"}[index]
		first := httptest.NewRequest(http.MethodGet, path, nil)
		first.RemoteAddr = remoteAddr
		engine.ServeHTTP(httptest.NewRecorder(), first)

		second := httptest.NewRequest(http.MethodGet, path, nil)
		second.RemoteAddr = remoteAddr
		response := httptest.NewRecorder()
		engine.ServeHTTP(response, second)
		assert.Equal(t, http.StatusTooManyRequests, response.Code, path)
	}
}
