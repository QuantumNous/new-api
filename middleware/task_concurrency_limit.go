package middleware

import (
	"net/http"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func TaskConcurrencyLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		limit := constant.TaskMaxConcurrentTask
		if limit <= 0 {
			c.Next()
			return
		}
		total, err := model.CountUnfinishedTasks()
		if err != nil {
			c.Next()
			return
		}
		if int(total) >= limit {
			c.JSON(http.StatusTooManyRequests, &dto.TaskError{
				Code:       "task_concurrency_limit_exceeded",
				Message:    "任务并发数已达上限，请稍后再试",
				StatusCode: http.StatusTooManyRequests,
			})
			c.Abort()
			return
		}
		c.Next()
	}
}
