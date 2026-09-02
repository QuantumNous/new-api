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
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

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
