package middleware

import (
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
)

// SystemPerformanceCheck checks system performance middleware
func SystemPerformanceCheck() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Only check Relay interfaces (/v1, /v1beta, etc.)
		// Here we simply determine the path prefix, which can be adjusted according to the actual route.
		path := c.Request.URL.Path
		if strings.HasPrefix(path, "/v1/messages") {
			if err := checkSystemPerformance(); err != nil {
				c.JSON(err.StatusCode, gin.H{
					"error": err.ToClaudeError(),
				})
				c.Abort()
				return
			}
		} else {
			if err := checkSystemPerformance(); err != nil {
				c.JSON(err.StatusCode, gin.H{
					"error": err.ToOpenAIError(),
				})
				c.Abort()
				return
			}
		}
		c.Next()
	}
}

// checkSystemPerformance checks whether system performance exceeds the threshold
func checkSystemPerformance() *types.NewAPIError {
	// Overload marking is done on the sampling side: CPU/memory is calculated per container cgroup quota and required multiple times in a row
	// Exceeding the threshold; when judging, review based on the current threshold and ignore expired samples.
	overload := common.CheckSystemOverload(common.GetSystemStatus(), common.GetPerformanceMonitorConfig(), time.Now())
	if overload == nil {
		return nil
	}
	return types.NewErrorWithStatusCode(overload, types.ErrorCode(overload.Code), http.StatusServiceUnavailable)
}
